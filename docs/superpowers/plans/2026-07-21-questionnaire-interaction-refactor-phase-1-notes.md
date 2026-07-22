# Questionnaire Notes Before Answer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users open and save a note for a question before choosing its answer.

**Architecture:** Keep notes in the existing `QuestionnaireState.notes` map. In navigate mode, `Tab` opens the existing notes editor whenever a question tab is active; typing and notes modes keep their existing precedence, and Review still has no active question. No reducer or result-builder change is required.

**Tech Stack:** TypeScript, Vitest, `@earendil-works/pi-tui`.

---

## File map

- `src/tui/input.ts` — removes the answer-presence gate from the Tab notes effect.
- `tests/tui/input.test.ts` — proves Tab opens notes on unanswered single- and multi-select question tabs.

### Task 1: Permit notes on unanswered question tabs

**Files:**

- Modify: `src/tui/input.ts`
- Modify: `tests/tui/input.test.ts`

- [ ] **Step 1: Replace the existing `Tab on unanswered question returns empty effects` regression with this parameterized positive case.**

```ts
it.each([0, 1])(
  "Tab opens notes for unanswered question tab %i",
  (activeTab) => {
    const question = questions[activeTab]!;
    expect(interpret("\t", ctx(questions, { activeTab }))).toEqual([
      {
        type: "dispatch",
        action: { type: "enterNotes", questionId: question.id },
      },
      { type: "set-notes-editor-text", text: "" },
    ]);
  },
);
```

- [ ] **Step 2: Verify both new cases fail.**

```bash
pnpm exec vitest run tests/tui/input.test.ts
```

Expected: both parameterized cases fail because the Tab branch currently requires `state.answers.has(q.id)`.

- [ ] **Step 3: Remove only the answer gate in `src/tui/input.ts`.**

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

Do not change `state.ts`, `buildResult`, rendering, public types, or the Tab shortcut. Existing typing and notes mode branches run before this branch, and `currentQuestion` remains undefined on Review.

- [ ] **Step 4: Verify the focused regression passes, then run the complete project check.**

```bash
pnpm exec vitest run tests/tui/input.test.ts
pnpm check
```

Expected: both commands pass. The existing answered-note preload and Review no-op regressions remain green.

- [ ] **Step 5: Commit the phase.**

```bash
git add src/tui/input.ts tests/tui/input.test.ts
git commit -m "feat(tui): allow notes before answering"
```

## Plan self-review

- **Spec coverage:** Covers both question types before an answer exists while retaining existing saved-note preload, reducer, and result coverage.
- **Placeholder scan:** No deferred work or unspecified tests.
- **Type consistency:** Uses existing `interpret`, `ctx`, `QuestionnaireState`, and `Effect` interfaces.
