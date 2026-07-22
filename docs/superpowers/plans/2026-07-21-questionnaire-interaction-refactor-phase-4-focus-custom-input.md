# Focus-Driven Custom Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open the multiline custom editor as soon as `Type something.` receives focus, while wrapping question-row navigation.

**Architecture:** `state.ts` owns wrapped question-row movement through one shared helper and leaves review navigation clamped. `input.ts` predicts the next row to issue editor effects; its typing-mode Escape finalizes cancellation, while Up/Down discard drafts and move normally.

**Tech Stack:** TypeScript, Vitest, `@earendil-works/pi-tui`.

---

## File map

- `src/tui/state.ts` — exports wrapped index math and moves question cursors.
- `src/tui/input.ts` — turns movements onto `other` into typing/editor effects.
- `src/tui/render.ts` — reports the changed custom-input controls.
- `tests/tui/state.test.ts`, `tests/tui/input.test.ts`, `tests/tui/render.test.ts` — regressions.

### Task 1: Wrap question rows but preserve clamped Review navigation

**Files:**

- Modify: `src/tui/state.ts`
- Modify: `tests/tui/state.test.ts`

- [ ] **Step 1: Add state regressions.**

```ts
it("wraps question rows", () => {
  const q = { ...questionsWithOther[0]!, allowOther: true };
  expect(reduce({ ...initState([q]), optionCursor: 0 }, { type: "moveCursor", direction: "up" }, [q]).optionCursor)
    .toBe(visibleRowCount(q) - 1);
  expect(reduce({ ...initState([q]), optionCursor: visibleRowCount(q) - 1 }, { type: "moveCursor", direction: "down" }, [q]).optionCursor)
    .toBe(0);
});

it("keeps review navigation clamped", () => {
  const state = { ...initState(questions), activeTab: questions.length, reviewCursor: 0 };
  expect(reduce(state, { type: "moveCursor", direction: "up" }, questions).reviewCursor).toBe(0);
});
```

- [ ] **Step 2: Run the state test and confirm question navigation fails.**

```bash
pnpm exec vitest run tests/tui/state.test.ts
```

Expected: the wrap assertion fails because `moveCursor` clamps question rows.

- [ ] **Step 3: Add the shared helper near `visibleRowCount` in `src/tui/state.ts`.**

```ts
export function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}
```

- [ ] **Step 4: Replace the question branch of `moveCursor`.**

```ts
const rowCount = visibleRowCount(q);
const delta = action.direction === "up" ? -1 : 1;
next.optionCursor = wrapIndex(next.optionCursor + delta, rowCount);
return next;
```

Do not change the preceding review-tab `Math.max`/`Math.min` branch.

- [ ] **Step 5: Verify the reducer tests pass.**

```bash
pnpm exec vitest run tests/tui/state.test.ts
```

Expected: PASS.

### Task 2: Enter custom mode from the focused row

**Files:**

- Modify: `src/tui/input.ts`
- Modify: `src/tui/render.ts`
- Modify: `tests/tui/input.test.ts`
- Modify: `tests/tui/render.test.ts`

- [ ] **Step 1: Add focus/editor regressions.**

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

it("leaves typing, wraps to the next row, and clears the draft", () => {
  const state = { ...initState(questionsWithOther), optionCursor: 2, inputMode: "typing" as const, editingQuestionId: "scope" };
  expect(interpret("\x1b[B", { state, questions: questionsWithOther, notesEditorText: "" })).toEqual([
    { type: "dispatch", action: { type: "cancelTyping" } },
    { type: "dispatch", action: { type: "moveCursor", direction: "down" } },
    { type: "set-editor-text", text: "" },
  ]);
});

it("cancels the questionnaire from custom input", () => {
  const state = { ...initState(questionsWithOther), inputMode: "typing" as const, editingQuestionId: "scope" };
  expect(interpret("\x1b", { state, questions: questionsWithOther, notesEditorText: "" }))
    .toEqual([{ type: "finalize", cancelled: true }]);
});
```

- [ ] **Step 2: Run the input test and confirm the focus/Escape assertions fail.**

```bash
pnpm exec vitest run tests/tui/input.test.ts
```

- [ ] **Step 3: Import `visibleRowCount` and `wrapIndex` in `src/tui/input.ts`, then add `moveEffects`.**

```ts
function moveEffects(direction: "up" | "down", question: NormalizedQuestion, state: QuestionnaireState): Effect[] {
  const delta = direction === "up" ? -1 : 1;
  const cursor = wrapIndex(state.optionCursor + delta, visibleRowCount(question));
  const effects: Effect[] = [dispatch({ type: "moveCursor", direction })];
  if (cursorTarget(question, cursor).kind === "other") {
    effects.push(
      dispatch({ type: "enterTyping", questionId: question.id }),
      { type: "set-editor-text", text: state.customText.get(question.id) ?? "" },
    );
  }
  return effects;
}
```

- [ ] **Step 4: Route navigate-mode question movement through `moveEffects`.** Replace direct Up/Down dispatches in both the single-select and multi-select branches. Leave review and notes movement alone.

- [ ] **Step 5: Replace typing-mode controls.**

```ts
if (state.inputMode === "typing") {
  if (matchesKey(data, Key.escape)) return [{ type: "finalize", cancelled: true }];
  if (matchesKey(data, Key.up) || matchesKey(data, Key.down)) {
    const direction = matchesKey(data, Key.up) ? "up" : "down";
    return [
      dispatch({ type: "cancelTyping" }),
      ...moveEffects(direction, currentQuestion(state, questions)!, state),
      { type: "set-editor-text", text: "" },
    ];
  }
  return [{ type: "forward-to-editor" }];
}
```

The non-null question is safe because typing can only be entered from a question row. Do not retain the former “Esc cancel typing” behavior.

- [ ] **Step 6: Update the typing hint in `src/tui/render.ts`.**

```ts
hint = "Enter submit | Esc cancel | Up/Down move";
```

- [ ] **Step 7: Verify and commit the phase.**

```bash
pnpm exec vitest run tests/tui/state.test.ts tests/tui/input.test.ts tests/tui/render.test.ts
git add src/tui/state.ts src/tui/input.ts src/tui/render.ts tests/tui/state.test.ts tests/tui/input.test.ts tests/tui/render.test.ts
git commit -m "feat(tui): enter custom text when its row is focused"
```

Expected: Vitest passes before committing.

## Plan self-review

- **Spec coverage:** Wraps only question rows, activates/preloads custom input on focus, discards drafts when leaving, and makes custom-input Escape cancel the UI.
- **Placeholder scan:** Tests and exact effects cover each control transition.
- **Type consistency:** `wrapIndex`, `visibleRowCount`, `cursorTarget`, `QuestionnaireState`, and `Effect` are all defined in the touched modules.
