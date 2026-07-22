# Single-Question Questionnaire Fast Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve a one-question questionnaire when its answer is committed, with no tabs or Review screen.

**Architecture:** `input.ts` and `render.ts` treat tabs/review as multi-question-only presentation. `questionnaire-ui.ts` becomes the single completion boundary through a local `applyAction` helper that finalizes only valid one-question commits.

**Tech Stack:** TypeScript, Vitest, `@earendil-works/pi-tui`.

---

## File map

- `src/tui/input.ts` — disables tab switching for one question.
- `src/tui/render.ts` — hides tab/review chrome and inaccurate key hints.
- `src/tui/questionnaire-ui.ts` — finalizes valid commits once.
- `tests/tui/input.test.ts`, `tests/tui/render.test.ts` — pure behavior.
- `tests/tui/questionnaire-ui.test.ts` — create an adapter harness if absent.

### Task 1: Remove one-question tab and review presentation

**Files:**

- Modify: `src/tui/input.ts`
- Modify: `src/tui/render.ts`
- Modify: `tests/tui/input.test.ts`
- Modify: `tests/tui/render.test.ts`

- [ ] **Step 1: Add no-tab interpreter regressions.**

```ts
it("does not create tab-navigation effects for one question", () => {
  const one = [questions[0]!];
  expect(interpret("\x1b[C", ctx(one))).toEqual([]);
  expect(interpret("\x1b[D", ctx(one))).toEqual([]);
});
```

- [ ] **Step 2: Add rendering regression.**

```ts
it("hides tabs and review chrome for one question", () => {
  const one = [questions[0]!];
  const text = renderQuestionnaire(initState(one), one, [], [], noopTheme, 80).join("\n");
  expect(text).not.toContain("Review");
  expect(text).not.toContain("Left/Right tabs");
});
```

- [ ] **Step 3: Run the focused tests and confirm they fail.**

```bash
pnpm exec vitest run tests/tui/input.test.ts tests/tui/render.test.ts
```

- [ ] **Step 4: In `src/tui/input.ts`, add and use the session-size guard.**

```ts
const isMultiQuestion = questions.length > 1;
const totalTabs = isMultiQuestion ? questions.length + 1 : questions.length;

if (matchesKey(data, Key.right)) {
  return isMultiQuestion
    ? [dispatch({ type: "switchTab", tab: (state.activeTab + 1) % totalTabs })]
    : [];
}
if (matchesKey(data, Key.left)) {
  return isMultiQuestion
    ? [dispatch({ type: "switchTab", tab: (state.activeTab - 1 + totalTabs) % totalTabs })]
    : [];
}
```

Leave the existing review branch intact: it is unreachable for a one-question session once no action can switch there.

- [ ] **Step 5: In `src/tui/render.ts`, render `renderTabBar` only for `questions.length > 1`.** For question hints, use `Up/Down select | ...`; retain the existing `Left/Right tabs | ...` text only for multi-question sessions. Do not change the review renderer.

- [ ] **Step 6: Verify this task passes.**

```bash
pnpm exec vitest run tests/tui/input.test.ts tests/tui/render.test.ts
```

Expected: PASS.

### Task 2: Finalize valid single-question commits in the UI adapter

**Files:**

- Modify: `src/tui/questionnaire-ui.ts`
- Create: `tests/tui/questionnaire-ui.test.ts`

- [ ] **Step 1: Create a focused `ui.custom` harness.** Mock `Editor` with `onSubmit`, `setText`, `getText`, `handleInput`, and `render`. Capture the component and `done` callback supplied by `ui.custom`; use a fake TUI with `requestRender` and a theme whose `fg`, `bg`, and `bold` return their input unchanged.

Add these fixtures in the test file before `createHarness`:

```ts
const singleQuestion: NormalizedQuestion = {
  multiSelect: false, id: "scope", header: "Scope", prompt: "Pick scope",
  options: [{ value: "small", label: "Small" }, { value: "large", label: "Large" }],
  recommendation: null, allowOther: false, allowChat: false,
};
const singleMultiQuestion: NormalizedQuestion = {
  multiSelect: true, id: "features", header: "Features", prompt: "Pick features",
  options: [{ value: "auth", label: "Auth" }, { value: "log", label: "Logging" }],
  recommendation: "auth", allowOther: false, allowChat: false,
};
```

- [ ] **Step 2: Add the immediate-completion tests.**

```ts
it("resolves one single-select answer immediately", async () => {
  const ui = createHarness([singleQuestion]);
  ui.component.handleInput("\r");
  expect(ui.done).toHaveBeenCalledWith(expect.objectContaining({
    cancelled: false,
    responses: [{ questionId: "scope", selection: { kind: "option", value: "small", label: "Small" } }],
  }));
});

it("does not resolve a whitespace custom submission", () => {
  const ui = createHarness([{ ...singleQuestion, allowOther: true }]);
  ui.component.handleInput("\x1b[B");
  ui.component.handleInput("\r");
  ui.editor.onSubmit("   ");
  expect(ui.done).not.toHaveBeenCalled();
});

it("does not resolve one multi-select question until Next", () => {
  const ui = createHarness([singleMultiQuestion]);
  ui.component.handleInput(" ");
  expect(ui.done).not.toHaveBeenCalled();
  ui.component.handleInput("\x1b[B");
  ui.component.handleInput("\x1b[B");
  ui.component.handleInput("\r");
  expect(ui.done).toHaveBeenCalledTimes(1);
});
```

Use the fixture's actual row count for the two Down inputs if it has more than one option. Do not assert a pending Promise: the captured `done` callback is deterministic.

- [ ] **Step 3: Run the adapter test and confirm it fails.**

```bash
pnpm exec vitest run tests/tui/questionnaire-ui.test.ts
```

Expected: single-select confirmation does not call `done` because the current reducer advances to Review.

- [ ] **Step 4: Import `Action` and add `applyAction` in `src/tui/questionnaire-ui.ts`.**

```ts
function applyAction(action: Action): boolean {
  state = reduce(state, action, questions);
  const commits =
    action.type === "selectOption" ||
    action.type === "selectChat" ||
    action.type === "confirmMulti" ||
    (action.type === "submitTyping" && action.value.trim().length > 0);

  if (questions.length === 1 && commits && state.answers.has(questions[0]!.id)) {
    done(buildResult(state, questions, false));
    return true;
  }
  return false;
}
```

- [ ] **Step 5: Route every action through `applyAction`.** In both editor `onSubmit` callbacks and the `dispatch` effect case, return from `handleInput` when `applyAction` returns true. On the non-completed path retain the existing editor clearing and `tui.requestRender()` calls. The trimmed-value condition prevents stale custom text from being resubmitted when whitespace is entered.

- [ ] **Step 6: Verify the phase and commit it.**

```bash
pnpm exec vitest run tests/tui/input.test.ts tests/tui/render.test.ts tests/tui/questionnaire-ui.test.ts
git add src/tui/input.ts src/tui/render.ts src/tui/questionnaire-ui.ts tests/tui/input.test.ts tests/tui/render.test.ts tests/tui/questionnaire-ui.test.ts
git commit -m "feat(tui): submit single-question responses immediately"
```

Expected: Vitest passes before committing.

## Plan self-review

- **Spec coverage:** Covers immediate option/chat/custom/multi-next commits and removes the one-question Review detour.
- **Placeholder scan:** Every test observes the captured completion callback, avoiding timing-dependent assertions.
- **Type consistency:** `Action`, `buildResult`, `reduce`, and UI `done` already exist; `applyAction` is local to the adapter.
