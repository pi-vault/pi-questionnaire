# Multi-Select Custom Answers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support `Type something.` for multi-select questions, with custom answers and checked options mutually exclusive.

**Architecture:** Make `rowLayout` the one topology source for both question types: options, optional custom row, optional chat row, then multi-select Next. Synchronize checked options through one reducer helper; submitting custom text clears checks, and toggling an option replaces a custom selection.

**Tech Stack:** TypeScript, Vitest, `@earendil-works/pi-tui`.

---

## File map

- `src/tui/state.ts` — universal row layout and mutually exclusive answer state.
- `src/tui/input.ts` — enables direct multi-select custom-row confirmation.
- `src/tui/render-question.ts` — consumes the existing row topology; alter only if its multi rendering omits `other`.
- `tests/tui/state.test.ts`, `tests/tui/input.test.ts`, `tests/tui/render-question.test.ts` — pure regressions.
- `tests/tui/questionnaire-ui.test.ts` — one-question custom and Next completion.
- `README.md`, `CHANGELOG.md` — public contract.

### Task 1: Put `other` in multi-select row topology

**Files:**

- Modify: `src/tui/state.ts`
- Modify: `tests/tui/state.test.ts`
- Modify: `tests/tui/render-question.test.ts`

- [ ] **Step 1: Add the row-layout regression.**

Add this fixture once near the other state-test fixtures:

```ts
const multiQuestion: NormalizedQuestion = {
  multiSelect: true, id: "features-other", header: "Features", prompt: "Pick features",
  options: [{ value: "auth", label: "Auth" }, { value: "log", label: "Logging" }],
  recommendation: "auth", allowOther: true, allowChat: false,
};
```

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
```

- [ ] **Step 2: Add a render regression.**

```ts
it("renders Type something before Next for multi-select", () => {
  const q = { ...multiQuestion, allowOther: true };
  const text = renderQuestion(input(q, { cursor: q.options.length })).join("\n");
  expect(text).toContain(`${q.options.length + 1}. Type something.`);
  expect(text.indexOf("Type something.")).toBeLessThan(text.indexOf("Next"));
});
```

- [ ] **Step 3: Run focused tests and confirm the layout test fails.**

```bash
pnpm exec vitest run tests/tui/state.test.ts tests/tui/render-question.test.ts
```

Expected: multi-select `rowLayout` currently omits `other`.

- [ ] **Step 4: Replace the conditional tail of `rowLayout` in `src/tui/state.ts`.**

```ts
if (question.allowOther) slots.push({ kind: "other" });
if (question.allowChat) slots.push({ kind: "chat" });
if (question.multiSelect) slots.push({ kind: "next" });
```

This replaces the current separate single/multi branches. Check `src/tui/render-question.ts` immediately after this change: if it maps `rowLayout` or `cursorTarget`, no source edit is needed; otherwise add the `other` display branch using the existing single-select label rendering.

- [ ] **Step 5: Verify focused topology/render tests pass.**

```bash
pnpm exec vitest run tests/tui/state.test.ts tests/tui/render-question.test.ts
```

Expected: PASS.

### Task 2: Make multi custom and option answers mutually exclusive

**Files:**

- Modify: `src/tui/state.ts`
- Modify: `tests/tui/state.test.ts`

- [ ] **Step 1: Add reducer regressions.**

```ts
it("replaces multi-select checks with a custom answer", () => {
  const state = initState([multiQuestion]);
  state.multiChecked.set(multiQuestion.id, new Set([multiQuestion.options[0]!.value]));
  const next = reduce(state, { type: "submitTyping", questionId: multiQuestion.id, value: "Custom" }, [multiQuestion]);
  expect(next.multiChecked.get(multiQuestion.id)).toEqual(new Set());
  expect(next.answers.get(multiQuestion.id)).toEqual({ kind: "custom", value: "Custom" });
});

it("replaces a custom multi-select answer when an option is toggled", () => {
  const state = initState([multiQuestion]);
  state.answers.set(multiQuestion.id, { kind: "custom", value: "Custom" });
  const next = reduce(state, { type: "toggleCheckbox", questionId: multiQuestion.id, value: multiQuestion.options[0]!.value }, [multiQuestion]);
  expect(next.answers.get(multiQuestion.id)).toEqual({
    kind: "options",
    selected: [{ value: multiQuestion.options[0]!.value, label: multiQuestion.options[0]!.label }],
  });
});

it("records a preselected recommendation when Next confirms multi-select", () => {
  const state = initState([multiQuestion]);
  const next = reduce(state, { type: "confirmMulti", questionId: multiQuestion.id }, [multiQuestion]);
  const recommended = multiQuestion.options.find((option) => option.value === multiQuestion.recommendation)!;
  expect(next.answers.get(multiQuestion.id)).toEqual({
    kind: "options",
    selected: [{ value: recommended.value, label: recommended.label }],
  });
});
```

- [ ] **Step 2: Run the reducer test and confirm it fails.**

```bash
pnpm exec vitest run tests/tui/state.test.ts
```

Expected: custom submissions retain checked values, and `confirmMulti` does not turn the recommendation into an answer.

- [ ] **Step 3: Extract `syncMultiAnswer` above `reduce` in `src/tui/state.ts`.**

```ts
function syncMultiAnswer(
  state: QuestionnaireState,
  questionId: string,
  questions: NormalizedQuestion[],
): void {
  const question = questions.find((candidate) => candidate.id === questionId);
  if (!question?.multiSelect) return;
  const checked = state.multiChecked.get(questionId) ?? new Set<string>();
  const selected = question.options
    .filter((option) => checked.has(option.value))
    .map((option) => ({ value: option.value, label: option.label }));

  if (selected.length === 0) state.answers.delete(questionId);
  else state.answers.set(questionId, { kind: "options", selected });
}
```

- [ ] **Step 4: Use the helper and clear conflicting state.** Replace the inline synchronization in `toggleCheckbox` with `syncMultiAnswer(next, action.questionId, questions)`. Before it, delete a custom selection with:

```ts
if (next.answers.get(action.questionId)?.kind === "custom") {
  next.answers.delete(action.questionId);
}
```

In `submitTyping`, before `next.customText.set`, clear `next.multiChecked.get(action.questionId)` when it exists. In `confirmMulti`, call `syncMultiAnswer(next, action.questionId, questions)` before `advanceToNextTab`.

- [ ] **Step 5: Verify reducer tests pass.**

```bash
pnpm exec vitest run tests/tui/state.test.ts
```

Expected: PASS.

### Task 3: Route multi-select custom input and document it

**Files:**

- Modify: `src/tui/input.ts`
- Modify: `tests/tui/input.test.ts`
- Modify: `tests/tui/questionnaire-ui.test.ts`
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add the input regression.**

Add this fixture in `tests/tui/input.test.ts` near the existing multi-select fixtures:

```ts
const multiQuestion: NormalizedQuestion = {
  multiSelect: true, id: "features-other", header: "Features", prompt: "Pick features",
  options: [{ value: "auth", label: "Auth" }, { value: "log", label: "Logging" }],
  recommendation: "auth", allowOther: true, allowChat: false,
};
```

```ts
it("opens custom input from the multi-select other row", () => {
  const q = { ...multiQuestion, allowOther: true };
  const state = { ...initState([q]), optionCursor: q.options.length };
  expect(interpret("\r", { state, questions: [q], notesEditorText: "" })).toEqual([
    { type: "dispatch", action: { type: "enterTyping", questionId: q.id } },
    { type: "set-editor-text", text: "" },
  ]);
});
```

- [ ] **Step 2: Add adapter completion regressions to the Phase 3 harness.**

```ts
it("immediately completes a one-question multi custom answer", () => {
  const q = { ...singleMultiQuestion, allowOther: true };
  const ui = createHarness([q]);
  for (let index = 0; index < q.options.length; index++) ui.component.handleInput("\x1b[B");
  ui.editor.onSubmit("Custom");
  expect(ui.done).toHaveBeenCalledWith(expect.objectContaining({
    responses: [{ questionId: q.id, selection: { kind: "custom", value: "Custom" } }],
  }));
});

it("completes one multi-select recommendation after Next", () => {
  const ui = createHarness([singleMultiQuestion]);
  for (let index = 0; index < singleMultiQuestion.options.length; index++) ui.component.handleInput("\x1b[B");
  ui.component.handleInput("\r");
  expect(ui.done).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 3: Run the focused tests and confirm the custom-input test fails.**

```bash
pnpm exec vitest run tests/tui/input.test.ts tests/tui/questionnaire-ui.test.ts
```

- [ ] **Step 4: Add multi-select `other` routing in `src/tui/input.ts`.** Place it between the option and chat branches of the multi-select Enter/Space handler.

```ts
if (target.kind === "other") {
  return [
    dispatch({ type: "enterTyping", questionId: q.id }),
    { type: "set-editor-text", text: state.customText.get(q.id) ?? "" },
  ];
}
```

Focus movement onto the row is already handled by Phase 4's `moveEffects`; this branch handles Enter/Space while already focused.

- [ ] **Step 5: Update docs.** In `README.md`, replace the custom-answer description with: `allowOther — append Type something. for a custom answer on single- or multi-select questions; a multi-select custom answer replaces checked options.` In `CHANGELOG.md`, replace `single-choice questions` in the `Type something.` entry with `single- and multi-select questions`.

- [ ] **Step 6: Run complete validation and commit.**

```bash
pnpm exec vitest run
pnpm check
pnpm pack:dry-run
git add src/tui/state.ts src/tui/input.ts tests/tui/state.test.ts tests/tui/input.test.ts tests/tui/render-question.test.ts tests/tui/questionnaire-ui.test.ts README.md CHANGELOG.md
git commit -m "feat(tui): support custom multi-select answers"
```

Expected: all commands pass. Include `src/tui/render-question.ts` in the commit only if Task 1 changed it.

## Final manual acceptance

- [ ] Ask one multi-select question with `allowOther: true`; submit custom text and confirm it returns only a custom response.
- [ ] Ask one multi-select question with a recommendation; press Next and confirm it returns the recommended option.
- [ ] Toggle an option after custom text in a multi-question session; confirm Review displays the option selection rather than custom text.

## Plan self-review

- **Spec coverage:** Applies `allowOther` consistently to multi-select, preserves row ordering, makes selections exclusive, and covers immediate one-question completion.
- **Placeholder scan:** Every state/input/doc edit has a named source file, exact assertion, and validation command.
- **Type consistency:** Reuses existing `rowLayout`, `QuestionnaireState`, `NormalizedQuestion`, `reduce`, and Phase 3 harness names.
