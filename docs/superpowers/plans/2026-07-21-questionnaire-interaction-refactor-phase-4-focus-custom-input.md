# Focus-Driven Custom Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open the existing multiline custom editor as soon as `Type something.` receives focus, while wrapping question-row navigation.

**Architecture:** Keep the pure interpreter → reducer → UI adapter flow. `state.ts` owns wrapped question-row movement and keeps Review navigation clamped; `input.ts` predicts the destination row to emit editor effects; the existing multiline `Editor` remains the input widget.

**Tech Stack:** TypeScript, Vitest, Biome, `@earendil-works/pi-tui`.

---

## Task 1: Wrap question rows

**Files:**

- Modify: `src/tui/state.ts`
- Modify: `tests/tui/state.test.ts`

- [ ] **Step 1: Replace the contradictory clamp regression.** Replace the existing `moveCursor down clamps at last option` test with one covering both question-row boundaries:

```ts
it("wraps question rows", () => {
  const questions = [singleWithOther];
  const rowCount = visibleRowCount(singleWithOther);

  expect(
    reduce(initState(questions), { type: "moveCursor", direction: "up" }, questions)
      .optionCursor,
  ).toBe(rowCount - 1);

  expect(
    reduce(
      { ...initState(questions), optionCursor: rowCount - 1 },
      { type: "moveCursor", direction: "down" },
      questions,
    ).optionCursor,
  ).toBe(0);
});
```

Keep the existing Review clamp tests unchanged.

- [ ] **Step 2: Run the state test and confirm the replacement fails.**

```bash
pnpm exec vitest run tests/tui/state.test.ts
```

Expected: the new wrap assertion fails because question movement still clamps.

- [ ] **Step 3: Add the shared helper beside `visibleRowCount`.**

```ts
export function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}
```

- [ ] **Step 4: Use wrapping only in the question branch of `moveCursor`.**

```ts
const delta = action.direction === "up" ? -1 : 1;
next.optionCursor = wrapIndex(
  next.optionCursor + delta,
  visibleRowCount(q),
);
return next;
```

Do not change the Review branch’s `Math.max`/`Math.min` clamps.

- [ ] **Step 5: Verify and commit.**

```bash
pnpm exec vitest run tests/tui/state.test.ts
git add src/tui/state.ts tests/tui/state.test.ts
git commit -m "feat(tui): wrap question row navigation"
```

Expected: the state suite passes.

## Task 2: Activate custom input on focus

**Files:**

- Modify: `src/tui/input.ts`
- Modify: `src/tui/render.ts`
- Modify: `tests/tui/input.test.ts`
- Modify: `tests/tui/render.test.ts`
- Modify: `tests/tui/questionnaire-ui.test.ts`

- [ ] **Step 1: Replace stale typing expectations and add focus regressions.**

Add coverage for navigation onto `other`, including wrapping Up from the first row:

```ts
it("enters typing when navigation reaches other and preloads saved text", () => {
  const state = { ...initState(questionsWithOther), optionCursor: 1 };
  state.customText.set("scope", "existing text");
  expect(interpret("\x1b[B", { state, questions: questionsWithOther, notesEditorText: "" })).toEqual([
    { type: "dispatch", action: { type: "moveCursor", direction: "down" } },
    { type: "dispatch", action: { type: "enterTyping", questionId: "scope" } },
    { type: "set-editor-text", text: "existing text" },
  ]);
});

it("enters typing when Up wraps onto other", () => {
  expect(interpret("\x1b[A", ctx(questionsWithOther))).toEqual([
    { type: "dispatch", action: { type: "moveCursor", direction: "up" } },
    { type: "dispatch", action: { type: "enterTyping", questionId: "scope" } },
    { type: "set-editor-text", text: "" },
  ]);
});

it("leaves typing, wraps to the first row, and clears the draft", () => {
  const state = {
    ...initState(questionsWithOther),
    optionCursor: 2,
    inputMode: "typing" as const,
    editingQuestionId: "scope",
  };
  expect(interpret("\x1b[B", { state, questions: questionsWithOther, notesEditorText: "" })).toEqual([
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
  expect(interpret("\x1b", { state, questions: questionsWithOther, notesEditorText: "" }))
    .toEqual([{ type: "finalize", cancelled: true }]);
});
```

Replace the old typing-mode Escape and Up tests; they must no longer expect `cancelTyping` for Escape or a move-free Up result.

- [ ] **Step 2: Update adapter scenarios before implementation.** In the existing one-question custom and whitespace tests, remove the Enter used only to activate the custom editor. After the two Down keys, type directly into the editor:

```ts
input(harness, "\x1b[B");
input(harness, "\x1b[B");
for (const character of "Custom") input(harness, character);
input(harness, "\r");
```

The whitespace test sends the space directly after the two Down keys, then submits and confirms it does not resolve.

- [ ] **Step 3: Run pure regressions and confirm the new focus behavior fails.**

```bash
pnpm exec vitest run tests/tui/input.test.ts tests/tui/render.test.ts
```

Expected: focus, wrapping, Escape, and hint assertions fail against the current implementation.

- [ ] **Step 4: Add `moveEffects` in `src/tui/input.ts` and import `visibleRowCount`/`wrapIndex`.**

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
  const effects: Effect[] = [
    dispatch({ type: "moveCursor", direction }),
  ];

  if (cursorTarget(question, cursor).kind === "other") {
    effects.push(
      dispatch({ type: "enterTyping", questionId: question.id }),
      {
        type: "set-editor-text",
        text: state.customText.get(question.id) ?? "",
      },
    );
  }
  return effects;
}
```

Route question-row Up/Down through this helper in both single- and multi-select branches. Leave Review and notes movement unchanged.

- [ ] **Step 5: Replace typing-mode controls.** Use the already-computed optional current question rather than a non-null assertion:

```ts
if (state.inputMode === "typing") {
  if (matchesKey(data, Key.escape)) {
    return [{ type: "finalize", cancelled: true }];
  }
  if (matchesKey(data, Key.up) || matchesKey(data, Key.down)) {
    if (!q) return [];
    const direction = matchesKey(data, Key.up) ? "up" : "down";
    return [
      dispatch({ type: "cancelTyping" }),
      ...moveEffects(direction, q, state),
      { type: "set-editor-text", text: "" },
    ];
  }
  return [{ type: "forward-to-editor" }];
}
```

Retain Enter/Space activation on an already-focused `other` row for empty-submit recovery.

- [ ] **Step 6: Update the typing hint and existing render assertion.** Set the hint to:

```ts
hint = "Enter submit | Esc cancel | Up/Down move";
```

- [ ] **Step 7: Run focused, complete, and quality checks, then commit.**

```bash
pnpm exec vitest run tests/tui/state.test.ts tests/tui/input.test.ts tests/tui/render.test.ts tests/tui/questionnaire-ui.test.ts
pnpm exec vitest run
pnpm check
git add src/tui/input.ts src/tui/render.ts tests/tui/input.test.ts tests/tui/render.test.ts tests/tui/questionnaire-ui.test.ts
git commit -m "feat(tui): activate custom input on focus"
```

Expected: all tests pass and no new lint/type diagnostics appear. Existing Biome schema-version and non-null-assertion warnings are pre-existing and out of scope.

## Scope assumptions

- Keep the existing multiline Editor; reference implementations inform keyboard semantics only.
- No public API, schema, dependency, README, or changelog changes.
- Validated questions always contain at least two options, so zero-length wrapping needs no speculative guard.
- Saved `customText` is preloaded when revisiting `other`; only unsaved editor drafts are discarded.
- Review navigation remains clamped.
- Multi-select `allowOther` remains Phase 5 work.

## Plan self-review

- Existing contradictory tests are explicitly replaced rather than duplicated.
- Adapter coverage proves focus activation through the real UI effect path.
- No non-null assertion is introduced, and Phase 5’s dependency on `moveEffects` remains valid.
