# Questionnaire Interaction Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a one-question questionnaire submit its answer immediately, enter custom text as soon as `Type something.` receives focus, and tell Herdr that Pi is waiting for user input.

**Architecture:** Preserve the existing pure interpreter → reducer → UI adapter flow. The reducer owns row topology, wrapped question-row navigation, selections, and notes; the interpreter derives editor effects from the row that receives focus; the UI adapter is the sole completion boundary. `src/index.ts` brackets the actual interactive wait with paired `herdr:blocked` events, requiring no Herdr dependency.

**Tech Stack:** TypeScript, Vitest, Biome, `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`.

---

## Behaviour contract

- A single-question questionnaire has no tab bar and no Review screen. Selecting a single-select option, submitting non-empty custom text, choosing chat, or confirming a multi-select response resolves it immediately.
- A one-question multi-select still requires its `Next` row, so toggling a checkbox alone does not resolve the UI.
- `Tab` opens notes even before an answer exists. A saved note is included once that question is answered.
- Question rows wrap: Up from the first row selects the last row; Down from the last row selects the first. Review rows remain clamped.
- Moving onto `Type something.` immediately opens the existing multiline `Editor`, preloaded with the saved custom answer. Moving away discards unsaved editor text. Escape from custom input cancels the questionnaire.
- `allowOther` works for multi-select questions too. Their row order is options → Type something. (when allowed) → chat (when allowed) → Next. A custom answer clears checked options; toggling an option after custom text replaces the custom answer.
- `src/index.ts` emits `pi.events.emit("herdr:blocked", { active: true, label: "Waiting for questionnaire response" })` immediately before `runQuestionnaireUI`, and emits `{ active: false }` from `finally`. Validation and non-TUI early returns emit neither event.

## File map

- `src/tui/state.ts` — row layout, wrapping movement, answer transitions, and notes state.
- `src/tui/input.ts` — maps input to state/editor/finalize effects.
- `src/tui/questionnaire-ui.ts` — reduces actions, runs editors, and resolves `ui.custom` exactly once.
- `src/tui/render.ts` — hides single-question tab/review chrome and reports accurate key hints.
- `src/index.ts` — brackets interactive waits with Herdr events.
- `tests/tui/state.test.ts`, `tests/tui/input.test.ts`, `tests/tui/render.test.ts` — pure regressions.
- `tests/tui/questionnaire-ui.test.ts` — adapter completion tests using the existing Pi TUI mocks/patterns; create it if absent.
- `tests/index.test.ts` — tool-level Herdr lifecycle tests.
- `README.md`, `CHANGELOG.md` — public behavior description.

## Phase 1 — Notes before an answer

This is independently usable: users can record context before deciding, and the result retains it after they answer.

### Task 1: Remove the answer gate from notes

**Files:**

- Modify: `src/tui/input.ts`
- Modify: `tests/tui/input.test.ts`
- Modify: `tests/tui/state.test.ts`

- [ ] **Step 1: Add the failing input test beside the existing Tab/notes tests.**

```ts
it("opens notes for an unanswered question", () => {
  expect(interpret("\t", ctx(questions))).toEqual([
    { type: "dispatch", action: { type: "enterNotes", questionId: "scope" } },
    { type: "set-notes-editor-text", text: "" },
  ]);
});
```

- [ ] **Step 2: Add the result regression beside existing `buildResult` tests.**

```ts
it("attaches a note saved before the answer", () => {
  const state = initState(questions);
  state.notes.set("scope", "Keep this small");
  state.answers.set("scope", {
    kind: "option",
    value: "small",
    label: "Small",
  });

  expect(buildResult(state, questions, false).responses).toEqual([
    {
      questionId: "scope",
      selection: { kind: "option", value: "small", label: "Small" },
      notes: "Keep this small",
    },
  ]);
});
```

- [ ] **Step 3: Run the focused tests and confirm the Tab test fails.**

```bash
pnpm exec vitest run tests/tui/input.test.ts tests/tui/state.test.ts
```

Expected: `opens notes for an unanswered question` fails because `interpret` currently checks `state.answers.has(q.id)`.

- [ ] **Step 4: Change the Tab guard in `src/tui/input.ts` from `if (q && state.answers.has(q.id))` to `if (q)`.** Keep the existing `enterNotes` and preload effects unchanged; `buildResult` already attaches a note to any eventual answer.

- [ ] **Step 5: Re-run the focused tests.**

```bash
pnpm exec vitest run tests/tui/input.test.ts tests/tui/state.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the independent phase.**

```bash
git add src/tui/input.ts tests/tui/input.test.ts tests/tui/state.test.ts
git commit -m "feat(tui): allow notes before answering"
```

## Phase 2 — Herdr blocked lifecycle

This is independently usable: Herdr sees the agent as blocked for the whole interactive questionnaire lifetime and returns to normal afterwards.

### Task 2: Pair Herdr events around the UI promise

**Files:**

- Modify: `src/index.ts`
- Modify: `tests/index.test.ts`

- [ ] **Step 1: Add test doubles that capture `pi.events.emit` and control `ui.custom`.** The extension API fixture must provide `events: { emit: vi.fn() }`; make the UI mock resolve `runQuestionnaireUI` with a non-cancelled `QuestionnaireResult` after its captured `done` callback is called.

- [ ] **Step 2: Add the lifecycle regression.**

```ts
it("marks Herdr blocked only while the questionnaire UI is active", async () => {
  const { tool, events, finishQuestionnaire } = setupExtension();
  const pending = tool.execute(
    "call",
    validParams,
    new AbortController().signal,
    vi.fn(),
    tuiContext,
  );

  expect(events.emit).toHaveBeenCalledWith("herdr:blocked", {
    active: true,
    label: "Waiting for questionnaire response",
  });

  finishQuestionnaire({
    questions: normalizedQuestions,
    responses: [],
    cancelled: true,
  });
  await pending;

  expect(events.emit).toHaveBeenLastCalledWith("herdr:blocked", {
    active: false,
  });
  expect(events.emit).toHaveBeenCalledTimes(2);
});

it("does not emit Herdr events for validation and non-TUI failures", async () => {
  const { tool, events } = setupExtension();
  await tool.execute(
    "call",
    invalidParams,
    new AbortController().signal,
    vi.fn(),
    tuiContext,
  );
  await tool.execute(
    "call",
    validParams,
    new AbortController().signal,
    vi.fn(),
    nonTuiContext,
  );
  expect(events.emit).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run the index test and confirm the lifecycle test fails.**

```bash
pnpm exec vitest run tests/index.test.ts
```

Expected: FAIL because `pi.events.emit` is not called.

- [ ] **Step 4: Wrap only `runQuestionnaireUI` in `src/index.ts` with this exact lifecycle.**

```ts
pi.events.emit("herdr:blocked", {
  active: true,
  label: "Waiting for questionnaire response",
});
try {
  const uiResult = await runQuestionnaireUI(ctx, questions);
  return {
    content: [{ type: "text", text: formatContentSummary(uiResult) }],
    details: uiResult,
  };
} finally {
  pi.events.emit("herdr:blocked", { active: false });
}
```

Do not move either early return into this `try`: malformed requests and non-TUI calls are not interactive waits.

- [ ] **Step 5: Re-run the index test and type-check.**

```bash
pnpm exec vitest run tests/index.test.ts
pnpm check
```

Expected: both commands pass.

- [ ] **Step 6: Commit the independent phase.**

```bash
git add src/index.ts tests/index.test.ts
git commit -m "feat: report questionnaire waits to Herdr"
```

## Phase 3 — Single-question fast path

This is independently usable: a one-question prompt completes as soon as the user commits a valid answer, without a Review detour.

### Task 3: Make tabs and review multi-question-only

**Files:**

- Modify: `src/tui/input.ts`
- Modify: `src/tui/render.ts`
- Modify: `tests/tui/input.test.ts`
- Modify: `tests/tui/render.test.ts`

- [ ] **Step 1: Add interpreter regressions for a one-question fixture.**

```ts
it("does not create tab-navigation effects for one question", () => {
  const one = [questions[0]!];
  expect(interpret("\x1b[C", ctx(one))).toEqual([]);
  expect(interpret("\x1b[D", ctx(one))).toEqual([]);
});

it("finalizes a one-question single-select confirmation", () => {
  const one = [questions[0]!];
  expect(interpret("\r", ctx(one))).toEqual([
    {
      type: "dispatch",
      action: {
        type: "selectOption",
        questionId: "scope",
        value: "small",
        label: "Small",
      },
    },
  ]);
});
```

- [ ] **Step 2: Add rendering regressions.**

```ts
it("hides tabs and review chrome for one question", () => {
  const one = [questions[0]!];
  const text = renderQuestionnaire(
    initState(one),
    one,
    [],
    [],
    noopTheme,
    80,
  ).join("\n");
  expect(text).not.toContain("Review");
  expect(text).not.toContain("Left/Right tabs");
});
```

- [ ] **Step 3: Run the focused tests and confirm the no-tab/render expectations fail.**

```bash
pnpm exec vitest run tests/tui/input.test.ts tests/tui/render.test.ts
```

- [ ] **Step 4: In `input.ts`, derive `const isMultiQuestion = questions.length > 1`.** Use it to set `totalTabs` to `questions.length + 1` only for multi-question sessions. Return `[]` for Left/Right when false; preserve current tab/review handling otherwise.

- [ ] **Step 5: In `render.ts`, conditionally call `renderTabBar` only when `questions.length > 1`.** In every non-editor hint, omit `Left/Right tabs` when false. Do not render a Review screen in a single-question session because the reducer will never move `activeTab` there.

- [ ] **Step 6: Add a UI-adapter completion harness test.** Mock `Editor` with `onSubmit`, `setText`, `getText`, `handleInput`, and `render`, capture the component and `done` callback passed to `ui.custom`, then test these real inputs:

```ts
it("resolves one single-select answer immediately", async () => {
  const ui = createHarness([singleQuestion]);
  ui.component.handleInput("\r");
  expect(ui.done).toHaveBeenCalledWith(
    expect.objectContaining({
      cancelled: false,
      responses: [
        {
          questionId: "scope",
          selection: { kind: "option", value: "small", label: "Small" },
        },
      ],
    }),
  );
});

it("does not resolve an empty custom submission or reuse an old custom answer", () => {
  const ui = createHarness([{ ...singleQuestion, allowOther: true }]);
  ui.component.handleInput("\x1b[B");
  ui.editor.onSubmit("previous");
  ui.component.handleInput("\x1b[A");
  ui.component.handleInput("\x1b[B");
  ui.editor.onSubmit("   ");
  expect(ui.done).toHaveBeenCalledTimes(1);
});
```

The second test must assert after the first successful `previous` submission only if the harness reopens the same one-question UI; alternatively, split it into two harnesses and assert that whitespace yields zero calls. Do not assert that a promise remains unsettled.

- [ ] **Step 7: Add `applyAction` in `src/tui/questionnaire-ui.ts` and use it for every dispatch and editor submission.** It must reduce first, then finalize only when the session has one question and the action commits a valid answer:

```ts
function applyAction(action: Action): boolean {
  state = reduce(state, action, questions);
  const commits =
    action.type === "selectOption" ||
    action.type === "selectChat" ||
    action.type === "confirmMulti" ||
    (action.type === "submitTyping" && action.value.trim().length > 0);

  if (
    questions.length === 1 &&
    commits &&
    state.answers.has(questions[0]!.id)
  ) {
    done(buildResult(state, questions, false));
    return true;
  }
  return false;
}
```

Use `applyAction` from both editor `onSubmit` callbacks and the `dispatch` effect branch. If it returns true, return from `handleInput` before clearing/rendering. This explicit trimmed-value predicate prevents whitespace from re-submitting a previously stored custom response.

- [ ] **Step 8: Add a one-question multi-select test that requires `Next`.** Toggle an option and assert no `done` call; navigate to the `next` row, press Enter, and assert one options response. Implement no special case in the reducer: `confirmMulti` is the commit action.

- [ ] **Step 9: Run the focused suite and commit.**

```bash
pnpm exec vitest run tests/tui/input.test.ts tests/tui/render.test.ts tests/tui/questionnaire-ui.test.ts
git add src/tui/input.ts src/tui/render.ts src/tui/questionnaire-ui.ts tests/tui/input.test.ts tests/tui/render.test.ts tests/tui/questionnaire-ui.test.ts
git commit -m "feat(tui): submit single-question responses immediately"
```

Expected: Vitest passes before committing.

## Phase 4 — Focus-driven custom text and wrapping navigation

This is independently usable: custom input behaves like a focused row rather than a separate step, while normal question navigation becomes cyclic.

### Task 4: Put row topology and wrapping in the reducer

**Files:**

- Modify: `src/tui/state.ts`
- Modify: `src/tui/input.ts`
- Modify: `src/tui/render.ts`
- Modify: `tests/tui/state.test.ts`
- Modify: `tests/tui/input.test.ts`

- [ ] **Step 1: Add state tests for wrapping question rows and clamped review rows.**

```ts
it("wraps question rows", () => {
  const q = { ...questionsWithOther[0]!, allowOther: true };
  expect(
    reduce(
      { ...initState([q]), optionCursor: 0 },
      { type: "moveCursor", direction: "up" },
      [q],
    ).optionCursor,
  ).toBe(visibleRowCount(q) - 1);
  expect(
    reduce(
      { ...initState([q]), optionCursor: visibleRowCount(q) - 1 },
      { type: "moveCursor", direction: "down" },
      [q],
    ).optionCursor,
  ).toBe(0);
});

it("keeps review navigation clamped", () => {
  const state = {
    ...initState(questions),
    activeTab: questions.length,
    reviewCursor: 0,
  };
  expect(
    reduce(state, { type: "moveCursor", direction: "up" }, questions)
      .reviewCursor,
  ).toBe(0);
});
```

- [ ] **Step 2: Add input tests for focus transitions and Escape.**

```ts
it("enters typing when navigation reaches other and preloads saved text", () => {
  const state = { ...initState(questionsWithOther), optionCursor: 1 };
  state.customText.set("scope", "existing text");
  expect(
    interpret("\x1b[B", {
      state,
      questions: questionsWithOther,
      notesEditorText: "",
    }),
  ).toEqual([
    { type: "dispatch", action: { type: "moveCursor", direction: "down" } },
    { type: "dispatch", action: { type: "enterTyping", questionId: "scope" } },
    { type: "set-editor-text", text: "existing text" },
  ]);
});

it("leaves typing, moves to the wrapped row, and clears the draft", () => {
  const state = {
    ...initState(questionsWithOther),
    optionCursor: 2,
    inputMode: "typing" as const,
    editingQuestionId: "scope",
  };
  expect(
    interpret("\x1b[B", {
      state,
      questions: questionsWithOther,
      notesEditorText: "",
    }),
  ).toEqual([
    { type: "dispatch", action: { type: "cancelTyping" } },
    { type: "dispatch", action: { type: "moveCursor", direction: "down" } },
    { type: "set-editor-text", text: "" },
  ]);
});

it("cancels the questionnaire from custom input", () => {
  const state = {
    ...initState(questionsWithOther),
    inputMode: "typing" as const,
    editingQuestionId: "scope",
  };
  expect(
    interpret("\x1b", {
      state,
      questions: questionsWithOther,
      notesEditorText: "",
    }),
  ).toEqual([{ type: "finalize", cancelled: true }]);
});
```

- [ ] **Step 3: Run the focused tests and confirm they fail.**

```bash
pnpm exec vitest run tests/tui/state.test.ts tests/tui/input.test.ts
```

- [ ] **Step 4: Add one exported wrapped-index helper in `state.ts`.**

```ts
export function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}
```

Use it in the question branch of `moveCursor` as `next.optionCursor = wrapIndex(next.optionCursor + delta, visibleRowCount(q))`. Keep the review branch's existing `Math.max`/`Math.min` behavior.

- [ ] **Step 5: Add a `moveEffects` helper in `input.ts` that calculates the destination with `wrapIndex`.** It must dispatch `moveCursor`, then append `enterTyping` and `set-editor-text` only when `cursorTarget(question, destination).kind === "other"`.

```ts
function moveEffects(
  direction: "up" | "down",
  question: NormalizedQuestion,
  state: QuestionnaireState,
): Effect[] {
  const delta = direction === "up" ? -1 : 1;
  const cursor = wrapIndex(
    state.optionCursor + delta,
    visibleRowCount(question),
  );
  const effects: Effect[] = [dispatch({ type: "moveCursor", direction })];
  if (cursorTarget(question, cursor).kind === "other") {
    effects.push(dispatch({ type: "enterTyping", questionId: question.id }), {
      type: "set-editor-text",
      text: state.customText.get(question.id) ?? "",
    });
  }
  return effects;
}
```

Use it for navigate-mode Up/Down in both single- and multi-select branches. In typing mode, Escape returns only `{ type: "finalize", cancelled: true }`; Up/Down return `cancelTyping`, the matching `moveEffects`, and one empty editor effect. Do not call `moveEffects` in review or notes mode.

- [ ] **Step 6: Change the typing hint in `render.ts` to `Enter submit | Esc cancel | Up/Down move`.** The text must match the new Escape behavior.

- [ ] **Step 7: Run focused tests, then commit.**

```bash
pnpm exec vitest run tests/tui/state.test.ts tests/tui/input.test.ts tests/tui/render.test.ts
git add src/tui/state.ts src/tui/input.ts src/tui/render.ts tests/tui/state.test.ts tests/tui/input.test.ts tests/tui/render.test.ts
git commit -m "feat(tui): enter custom text when its row is focused"
```

## Phase 5 — Multi-select custom answers

This is independently usable: the schema's default `allowOther: true` behaves consistently for single- and multi-select questions.

### Task 5: Add custom-row topology and mutually exclusive multi-answer state

**Files:**

- Modify: `src/tui/state.ts`
- Modify: `src/tui/input.ts`
- Modify: `src/tui/render-question.ts` only if its multi-select rendering ignores the `other` target
- Modify: `tests/tui/state.test.ts`
- Modify: `tests/tui/input.test.ts`
- Modify: `tests/tui/render-question.test.ts`
- Modify: `tests/tui/questionnaire-ui.test.ts`
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add the row-layout and state regressions.**

```ts
it("puts other before chat and next for a multi-select question", () => {
  const q = { ...multiQuestion, allowOther: true, allowChat: true };
  expect(rowLayout(q)).toEqual([
    { kind: "option", index: 0 },
    { kind: "option", index: 1 },
    { kind: "other" },
    { kind: "chat" },
    { kind: "next" },
  ]);
});

it("replaces multi-select checks with a custom answer", () => {
  const state = initState([multiQuestion]);
  const next = reduce(
    state,
    { type: "submitTyping", questionId: multiQuestion.id, value: "Custom" },
    [multiQuestion],
  );
  expect(next.multiChecked.get(multiQuestion.id)).toEqual(new Set());
  expect(next.answers.get(multiQuestion.id)).toEqual({
    kind: "custom",
    value: "Custom",
  });
});

it("replaces a custom multi-select answer when an option is toggled", () => {
  const state = initState([multiQuestion]);
  state.answers.set(multiQuestion.id, { kind: "custom", value: "Custom" });
  const next = reduce(
    state,
    {
      type: "toggleCheckbox",
      questionId: multiQuestion.id,
      value: multiQuestion.options[0]!.value,
    },
    [multiQuestion],
  );
  expect(next.answers.get(multiQuestion.id)).toEqual({
    kind: "options",
    selected: [
      {
        value: multiQuestion.options[0]!.value,
        label: multiQuestion.options[0]!.label,
      },
    ],
  });
});
```

- [ ] **Step 2: Add input and render regressions.** Navigate to the multi-select other row and expect `enterTyping`; render a multi-select question with `allowOther: true` and assert `Type something.` appears before `Next`. Keep the existing multiline editor rendering; do not replace it with Pi's single-line `Input`.

- [ ] **Step 3: Run focused tests and confirm the layout test fails.**

```bash
pnpm exec vitest run tests/tui/state.test.ts tests/tui/input.test.ts tests/tui/render-question.test.ts
```

- [ ] **Step 4: Change `rowLayout` in `state.ts` to append optional rows uniformly.**

```ts
if (question.allowOther) slots.push({ kind: "other" });
if (question.allowChat) slots.push({ kind: "chat" });
if (question.multiSelect) slots.push({ kind: "next" });
```

This replaces the current single/multi conditional. It is the one shared topology source for rendering, cursor targeting, and input.

- [ ] **Step 5: Make multi state mutually exclusive.** In `toggleCheckbox`, delete `next.answers.get(questionId)` only when it is `{ kind: "custom" }` before syncing selected options. In `submitTyping`, clear `next.multiChecked.get(questionId)` when it exists before storing the custom response. Keep `selectChat`'s existing clear. Extract the existing options synchronization into one private `syncMultiAnswer(next, questionId, questions)` helper and call it from `toggleCheckbox` and `confirmMulti`; this ensures a recommended pre-checked option becomes an answer when `Next` is confirmed.

- [ ] **Step 6: Extend multi input routing.** In the multi-select Enter/Space branch, add the same `other` effect currently used for single-select:

```ts
if (target.kind === "other") {
  return [
    dispatch({ type: "enterTyping", questionId: q.id }),
    { type: "set-editor-text", text: state.customText.get(q.id) ?? "" },
  ];
}
```

`moveEffects` from Phase 4 covers keyboard movement; this covers direct confirmation on the row.

- [ ] **Step 7: Add UI integration tests.** Verify that a single multi-select question: (a) reaching Other and submitting `Custom` calls `done` immediately with a custom response, and (b) toggling a recommended checkbox and pressing Next calls `done` with an options response. Verify toggling an option after custom text produces the options response, not both kinds.

- [ ] **Step 8: Update public docs.** In `README.md`, state that `allowOther` appends `Type something.` to both single- and multi-select questions, and that multi-select custom text replaces checked options. In `CHANGELOG.md`, replace “single-choice questions” with “single- and multi-select questions.”

- [ ] **Step 9: Run the complete validation and commit.**

```bash
pnpm exec vitest run
pnpm check
pnpm pack:dry-run
git add src/tui/state.ts src/tui/input.ts src/tui/render-question.ts tests/tui/state.test.ts tests/tui/input.test.ts tests/tui/render-question.test.ts tests/tui/questionnaire-ui.test.ts README.md CHANGELOG.md
git commit -m "feat(tui): support custom multi-select answers"
```

Expected: all commands pass. If `render-question.ts` needs no code change after the new row layout, omit it from `git add`.

## Final manual acceptance

- [ ] In Pi with Herdr installed, invoke a questionnaire and confirm Herdr changes to blocked while the UI is open and returns to normal after submit or Escape.
- [ ] Ask one single-select question; select an option, custom text, and chat in separate runs. Each should return directly with no tabs or Review screen.
- [ ] Ask one multi-select question; toggle choices then use Next, and separately submit a custom answer. Confirm neither result includes both options and custom text.
- [ ] Ask multiple questions; verify Tab saves notes before answers, row navigation wraps, Review still appears, and Review Up/Down stays clamped.

## Plan self-review

- **Spec coverage:** Phases 3–5 cover immediate single-question submission and focus-driven custom input; Phase 2 covers the Herdr wait status; Phase 1 preserves pre-answer notes. Multi-select custom support is explicitly included because `allowOther` already defaults to true.
- **No placeholders:** Every behavior-changing step names its exact source/test files, expected assertions, and verification command. The adapter harness deliberately asserts captured `done` calls rather than timing-sensitive pending promises.
- **Type consistency:** `Action`, `Effect`, `QuestionnaireState`, `rowLayout`, `visibleRowCount`, `cursorTarget`, `buildResult`, and `runQuestionnaireUI` are existing project interfaces; the only new helper named by this plan is `wrapIndex` plus private `syncMultiAnswer` and local `moveEffects`/`applyAction`.
