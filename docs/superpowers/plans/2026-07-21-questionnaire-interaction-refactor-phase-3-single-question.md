# Single-Question Questionnaire Fast Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve a one-question questionnaire when its answer is committed, without tabs or a Review detour.

**Architecture:** Derive single-question mode from `questions.length === 1`. `input.ts` disables tab navigation, `render.ts` removes tab/review chrome while retaining the question header, and `questionnaire-ui.ts` owns one completion boundary after reducer transitions. Tests drive the real Pi `Editor` through `ui.custom`, matching the reference package’s public component harness.

**Tech Stack:** TypeScript, Vitest, `@earendil-works/pi-tui`.

---

## Scope and file map

- `src/tui/input.ts` — disables Left/Right tab effects for one question.
- `src/tui/render.ts` — hides tabs, keeps the single-question header, and removes inaccurate tab hints.
- `src/tui/questionnaire-ui.ts` — centralizes state application and one-question completion.
- `tests/tui/input.test.ts`, `tests/tui/render.test.ts` — pure navigation and presentation regressions.
- `tests/tui/questionnaire-ui.test.ts` — real `ui.custom`/`Editor` interaction tests.

No public API, result shape, reducer action, or multi-question behavior changes. Recommendation-to-answer synchronization remains phase 5.

### Task 1: Make navigation and rendering single-question-aware

**Files:**

- Modify: `src/tui/input.ts`
- Modify: `src/tui/render.ts`
- Modify: `tests/tui/input.test.ts`
- Modify: `tests/tui/render.test.ts`

- [ ] **Step 1: Add failing pure regressions.** Use `const one = questions.slice(0, 1)` so the tests add no non-null assertions.

```ts
it("does not create tab-navigation effects for one question", () => {
  const one = questions.slice(0, 1);
  expect(interpret("\x1b[C", ctx(one))).toEqual([]);
  expect(interpret("\x1b[D", ctx(one))).toEqual([]);
});

it("hides tabs and review chrome but keeps the single-question header", () => {
  const one = questions.slice(0, 1);
  const text = renderQuestionnaire(
    initState(one),
    one,
    [],
    [],
    noopTheme,
    80,
  ).join("\n");
  expect(text).toContain("Scope");
  expect(text).not.toContain("Review");
  expect(text).not.toContain("Left/Right tabs");
});
```

- [ ] **Step 2: Run the focused tests and confirm the new expectations fail.**

```bash
pnpm exec vitest run tests/tui/input.test.ts tests/tui/render.test.ts
```

Expected: the one-question arrows still dispatch `switchTab`, and the tab bar/hint still render.

- [ ] **Step 3: Guard Left/Right in `src/tui/input.ts`.** Derive `const isMultiQuestion = questions.length > 1`; return `[]` for Left/Right when false, and retain the existing `questions.length + 1` tab cycle for multi-question sessions.

```ts
const isMultiQuestion = questions.length > 1;
const reviewTabIndex = questions.length;
const totalTabs = questions.length + 1;

if (matchesKey(data, Key.right)) {
  return isMultiQuestion
    ? [dispatch({ type: "switchTab", tab: (state.activeTab + 1) % totalTabs })]
    : [];
}
if (matchesKey(data, Key.left)) {
  return isMultiQuestion
    ? [
        dispatch({
          type: "switchTab",
          tab: (state.activeTab - 1 + totalTabs) % totalTabs,
        }),
      ]
    : [];
}
```

- [ ] **Step 4: Make the renderer single-question-aware.** Call `renderTabBar` only when `questions.length > 1`. Before rendering the question body in single-question mode, retain the short header with the selected-tab styling:

```ts
if (!isMultiQuestion) {
  lines.push(theme.bg("selectedBg", theme.fg("text", ` ${q.header} `)), "");
}
```

Keep the Review renderer and Review hint unchanged for multi-question sessions. For question hints, include `Left/Right tabs | ` only when `isMultiQuestion` is true.

- [ ] **Step 5: Verify and commit Task 1.**

```bash
pnpm exec vitest run tests/tui/input.test.ts tests/tui/render.test.ts
git add src/tui/input.ts src/tui/render.ts tests/tui/input.test.ts tests/tui/render.test.ts
git commit -m "feat(tui): simplify single-question presentation"
```

Expected: PASS.

### Task 2: Complete valid one-question commits at the UI adapter boundary

**Files:**

- Modify: `src/tui/questionnaire-ui.ts`
- Create: `tests/tui/questionnaire-ui.test.ts`

- [ ] **Step 1: Add a real Pi component harness.** Follow the `driveCustom` pattern in `rpiv-ask-user-question/factory.test.ts`: invoke the `ui.custom` factory synchronously, instantiate the real `Editor`, supply an identity theme and `{ requestRender }`, capture the returned component and a wrapped `done`, and expose the UI promise for assertions. Do not mock `Editor` methods.

The harness must use these real key sequences: Enter `"\r"`, Escape `"\x1b"`, Down `"\x1b[B"`, and Space `" "`. Its `done` wrapper resolves the promise and remains a Vitest spy.

- [ ] **Step 2: Add failing adapter scenarios.** Use fixtures for a single-select question, a single-select question with `allowOther`, a single-select question with `allowChat`, and a single multi-select question with `recommendation: null`.

Cover these exact flows:

1. Enter on the first option resolves one option response immediately.
2. Down twice then Enter on `Chat about this` resolves one chat response immediately.
3. Down twice, Enter, type `Custom` character-by-character, then Enter resolves one custom response.
4. Down twice, Enter, submit only whitespace, and assert `done` has not been called; press Escape to settle the harness as cancelled.
5. Space toggles a multi-select option without calling `done`; Down twice to `Next`, then Enter resolves one options response.
6. With two questions, answering the first does not call `done`; Escape settles the harness.

- [ ] **Step 3: Run the adapter test and confirm it fails.**

```bash
pnpm exec vitest run tests/tui/questionnaire-ui.test.ts
```

Expected: single-question option/chat/custom actions advance to the synthetic Review state without resolving the `ui.custom` promise.

- [ ] **Step 4: Add the completion boundary in `src/tui/questionnaire-ui.ts`.** Import `Action` and `allAnswered`, then use one completion guard and one reducer entry point:

```ts
let completed = false;

function finish(cancelled: boolean): void {
  if (completed) return;
  completed = true;
  done(buildResult(state, questions, cancelled));
}

function applyAction(action: Action): boolean {
  if (completed) return true;
  state = reduce(state, action, questions);

  if (
    questions.length === 1 &&
    state.activeTab === questions.length &&
    allAnswered(state, questions)
  ) {
    finish(false);
    return true;
  }
  return false;
}
```

Route both editor submission callbacks and every `dispatch` effect through `applyAction`. If a submission completes, skip editor clearing and rendering. In `handleInput`, return immediately after a completing dispatch, use `finish(effect.cancelled)` for explicit finalize effects, and return after forwarding editor input when `completed` becomes true. Ignore later input once completed.

This predicate intentionally uses the reducer’s existing transition: option/chat/valid custom/`Next` advance to Review, while checkbox toggles and whitespace custom input do not.

- [ ] **Step 5: Verify and commit Task 2.**

```bash
pnpm exec vitest run tests/tui/input.test.ts tests/tui/render.test.ts tests/tui/questionnaire-ui.test.ts
git add src/tui/questionnaire-ui.ts tests/tui/questionnaire-ui.test.ts
git commit -m "feat(tui): submit single-question responses immediately"
```

Expected: PASS, with exactly one completion callback per valid one-question commit.

## Final verification

Run:

```bash
pnpm check
git diff --check
```

The existing Biome schema-version and phase-1 non-null-assertion diagnostics are baseline warnings and remain out of scope; this phase must not add new warnings.

## Plan self-review

- Covers option, chat, custom, multi-select `Next`, whitespace rejection, no-tab navigation, retained header, and multi-question non-regression.
- Uses no placeholders or new public interfaces.
- Leaves recommendation synchronization and multi-select custom-answer exclusivity to phase 5, where those changes are already planned.
