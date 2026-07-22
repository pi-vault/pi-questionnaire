# Questionnaire Notes Before Answer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users open and save a note for a question before choosing its answer.

**Architecture:** Keep notes in the existing `QuestionnaireState.notes` map. Only remove the interpreter's answer-presence gate; `buildResult` already attaches a saved note when the question later has a selection.

**Tech Stack:** TypeScript, Vitest, `@earendil-works/pi-tui`.

---

## File map

- `src/tui/input.ts` — maps Tab to notes-editor effects.
- `src/tui/state.ts` — retains saved notes and creates final responses.
- `tests/tui/input.test.ts` — interpreter regression.
- `tests/tui/state.test.ts` — result regression.

### Task 1: Permit notes on unanswered questions

**Files:**

- Modify: `src/tui/input.ts`
- Modify: `tests/tui/input.test.ts`
- Modify: `tests/tui/state.test.ts`

- [ ] **Step 1: Add the failing Tab regression to `tests/tui/input.test.ts`.**

```ts
it("opens notes for an unanswered question", () => {
  expect(interpret("\t", ctx(questions))).toEqual([
    { type: "dispatch", action: { type: "enterNotes", questionId: "scope" } },
    { type: "set-notes-editor-text", text: "" },
  ]);
});
```

- [ ] **Step 2: Add the final-result regression to `tests/tui/state.test.ts`.** Ensure the test imports `buildResult` if it does not already.

```ts
it("attaches a note saved before the answer", () => {
  const state = initState(questions);
  state.notes.set("scope", "Keep this small");
  state.answers.set("scope", { kind: "option", value: "small", label: "Small" });

  expect(buildResult(state, questions, false).responses).toEqual([
    {
      questionId: "scope",
      selection: { kind: "option", value: "small", label: "Small" },
      notes: "Keep this small",
    },
  ]);
});
```

- [ ] **Step 3: Verify the new input regression fails.**

```bash
pnpm exec vitest run tests/tui/input.test.ts tests/tui/state.test.ts
```

Expected: `opens notes for an unanswered question` fails because the Tab branch currently requires `state.answers.has(q.id)`.

- [ ] **Step 4: Remove only the answer gate in `src/tui/input.ts`.**

```ts
if (matchesKey(data, Key.tab)) {
  if (q) {
    return [
      dispatch({ type: "enterNotes", questionId: q.id }),
      { type: "set-notes-editor-text", text: state.notes.get(q.id) ?? "" },
    ];
  }
  return [];
}
```

Do not change `buildResult`; its existing response construction already reads `state.notes.get(q.id)` after confirming an answer exists.

- [ ] **Step 5: Verify the focused regressions pass.**

```bash
pnpm exec vitest run tests/tui/input.test.ts tests/tui/state.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the phase.**

```bash
git add src/tui/input.ts tests/tui/input.test.ts tests/tui/state.test.ts
git commit -m "feat(tui): allow notes before answering"
```

## Plan self-review

- **Spec coverage:** Covers the approved pre-answer note behavior and confirms notes appear after the answer is supplied.
- **Placeholder scan:** No deferred work or unspecified tests.
- **Type consistency:** Uses existing `interpret`, `ctx`, `initState`, and `buildResult` interfaces.
