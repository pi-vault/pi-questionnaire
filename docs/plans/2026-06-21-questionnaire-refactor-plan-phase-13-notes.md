# Phase 13: Per-Question Notes via Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `notes` state, `enterNotes`/`submitNotes`/`cancelNotes` actions, Tab key routing, notes editor, and `[n]` indicator in tab bar and review screen.

**Spec:** `docs/specs/2026-06-21-questionnaire-refactor-design.md`

**Master plan:** `docs/plans/2026-06-21-questionnaire-refactor-plan.md`

**Prerequisite:** Phase 12 complete (all sentinels working).

**Verification:** After completing all tasks, run `pnpm check` (lint + typecheck + tests). All must pass before committing.

---

Add `notes` state, `enterNotes`/`submitNotes`/`cancelNotes` actions, Tab key routing, notes editor, and `[n]` indicator in tab bar and review screen.

### Task 13.1: Add Notes State and Actions

**Files:**

- Modify: `src/tui/state.ts`
- Test: `tests/tui/state.test.ts`

- [ ] **Step 1: Add `notes` to state and `hasSelection` helper**

In `QuestionnaireState`, add:

```ts
notes: Map<string, string>;
```

In `initState`:

```ts
notes: new Map(),
```

In `cloneState`:

```ts
notes: new Map(state.notes),
```

Add helper:

```ts
export function hasSelection(
  state: QuestionnaireState,
  questionId: string,
): boolean {
  return state.answers.has(questionId);
}
```

- [ ] **Step 2: Add notes actions to Action type**

```ts
| { type: "enterNotes"; questionId: string }
| { type: "submitNotes"; questionId: string; value: string }
| { type: "cancelNotes" }
```

- [ ] **Step 3: Add reducer cases**

```ts
case "enterNotes": {
  next.inputMode = "notes";
  next.editingQuestionId = action.questionId;
  return next;
}
case "submitNotes": {
  const trimmed = action.value.trim();
  if (trimmed) {
    next.notes.set(action.questionId, trimmed);
  } else {
    next.notes.delete(action.questionId);
  }
  next.inputMode = "navigate";
  next.editingQuestionId = null;
  return next;
}
case "cancelNotes": {
  next.inputMode = "navigate";
  next.editingQuestionId = null;
  return next;
}
```

- [ ] **Step 4: Update `buildResult` to include notes**

```ts
export function buildResult(
  state: QuestionnaireState,
  questions: NormalizedQuestion[],
  cancelled: boolean,
): QuestionnaireResult {
  const responses: QuestionResponse[] = questions
    .map((q) => {
      const selection = state.answers.get(q.id);
      if (!selection) return undefined;
      const notes = state.notes.get(q.id);
      const response: QuestionResponse = { questionId: q.id, selection };
      if (notes) response.notes = notes;
      return response;
    })
    .filter((r): r is QuestionResponse => r !== undefined);
  return { questions, responses, cancelled };
}
```

- [ ] **Step 5: Write tests and run**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/tui/state.test.ts`
Expected: PASS

### Task 13.2: Update Input Mapping for Notes

**Files:**

- Modify: `src/tui/input.ts`
- Test: `tests/tui/input.test.ts`

- [ ] **Step 1: Add `forward-to-notes-editor` and notes mode routing**

Update `InputResult`:

```ts
export type InputResult =
  | { type: "action"; action: Action }
  | { type: "finalize"; cancelled: boolean }
  | { type: "forward-to-editor" }
  | { type: "forward-to-notes-editor" }
  | { type: "none" };
```

Add notes mode handling after typing mode and before navigate mode. `mapInput` is pure and cannot access the editor buffer, so Up/Down save-and-exit is handled by the UI adapter (which intercepts Up/Down before calling `mapInput`). Esc dispatches `cancelNotes`. All other keys forward to the notes editor (Enter is handled by `editor.onSubmit`):

```ts
// Notes mode
if (state.inputMode === "notes") {
  if (matchesKey(data, Key.escape)) {
    return action({ type: "cancelNotes" });
  }
  // Enter, Up, Down, and all other keys → forward to notes editor
  // The UI adapter intercepts Up/Down before reaching mapInput to save-and-exit
  return { type: "forward-to-notes-editor" };
}
```

- [ ] **Step 2: Add Tab key handling in navigate mode**

After the Esc handler and before Left/Right, add:

```ts
// Tab — open notes editor (only if question has a selection)
if (matchesKey(data, Key.tab)) {
  if (q && hasSelection(state, q.id)) {
    return action({ type: "enterNotes", questionId: q.id });
  }
  return { type: "none" };
}
```

Import `hasSelection` from state.

- [ ] **Step 3: Write tests and run**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/tui/input.test.ts`
Expected: PASS

### Task 13.3: Update UI Adapter for Notes Editor

**Files:**

- Modify: `src/tui/questionnaire-ui.ts`

- [ ] **Step 1: Add notes editor to `questionnaire-ui.ts`**

Add a second `Editor` instance for notes. The pi-tui `Editor` exposes `getText(): string` for reading the current buffer. Use this for Up/Down save-and-exit. Add `Key` and `matchesKey` imports from `@earendil-works/pi-tui` (already used in `input.ts`).

```ts
const notesEditor = new Editor(tui, editorTheme);

notesEditor.onSubmit = (value) => {
  if (state.inputMode === "notes" && state.editingQuestionId) {
    state = reduce(
      state,
      {
        type: "submitNotes",
        questionId: state.editingQuestionId,
        value: value.trim(),
      },
      questions,
    );
    notesEditor.setText("");
    tui.requestRender();
  }
};
```

In `handleInput`, intercept notes-mode Up/Down before calling `mapInput` to save the current buffer and exit:

```ts
function handleInput(data: string) {
  // Notes mode: intercept Up/Down to save-and-exit
  if (state.inputMode === "notes" && state.editingQuestionId) {
    if (matchesKey(data, Key.up) || matchesKey(data, Key.down)) {
      const notesValue = notesEditor.getText();
      state = reduce(
        state,
        {
          type: "submitNotes",
          questionId: state.editingQuestionId,
          value: notesValue.trim(),
        },
        questions,
      );
      state = reduce(
        state,
        {
          type: "moveCursor",
          direction: matchesKey(data, Key.up) ? "up" : "down",
        },
        questions,
      );
      notesEditor.setText("");
      tui.requestRender();
      return;
    }
  }

  const result = mapInput(data, state, questions);
  switch (result.type) {
    case "action":
      state = reduce(state, result.action, questions);
      // Sync editor when entering typing mode
      if (state.inputMode === "typing" && state.editingQuestionId) {
        editor.setText(state.customText.get(state.editingQuestionId) ?? "");
      }
      // Sync notes editor when entering notes mode
      if (state.inputMode === "notes" && state.editingQuestionId) {
        notesEditor.setText(state.notes.get(state.editingQuestionId) ?? "");
      }
      tui.requestRender();
      break;
    case "finalize":
      done(buildResult(state, questions, result.cancelled));
      break;
    case "forward-to-editor":
      editor.handleInput(data);
      tui.requestRender();
      break;
    case "forward-to-notes-editor":
      notesEditor.handleInput(data);
      tui.requestRender();
      break;
    case "none":
      break;
  }
}
```

- [ ] **Step 2: Update render call to pass notes editor lines**

```ts
function render(width: number): string[] {
  const editorLines =
    state.inputMode === "typing" ? editor.render(Math.max(1, width - 4)) : [];
  const notesEditorLines =
    state.inputMode === "notes"
      ? notesEditor.render(Math.max(1, width - 4))
      : [];
  return renderQuestionnaire(
    state,
    questions,
    editorLines,
    notesEditorLines,
    theme,
    width,
  );
}
```

### Task 13.4: Update Rendering for Notes

**Files:**

- Modify: `src/tui/render.ts`
- Modify: `src/tui/render-tabs.ts`
- Modify: `src/tui/render-review.ts`
- Test: `tests/tui/render-tabs.test.ts`, `tests/tui/render-review.test.ts`, `tests/tui/render.test.ts`

- [ ] **Step 1: Update `renderQuestionnaire` signature**

Add `notesEditorLines` parameter:

```ts
export function renderQuestionnaire(
  state: QuestionnaireState,
  questions: NormalizedQuestion[],
  editorLines: string[],
  notesEditorLines: string[],
  theme: RenderTheme,
  width: number,
): string[];
```

When `state.inputMode === "notes"`, render the notes editor below the question content:

```ts
// After question content rendering, before hint bar:
if (state.inputMode === "notes") {
  lines.push("");
  pushWrapped(lines, theme.fg("muted", "Note for this question:"), renderWidth);
  for (const line of notesEditorLines) {
    lines.push(` ${line}`);
  }
}
```

Update the hint bar to include notes mode:

```ts
let hint: string;
if (state.inputMode === "typing") {
  hint = "Enter submit | Esc cancel | Up/Down exit";
} else if (state.inputMode === "notes") {
  hint = "Enter save | Esc discard";
} else if (state.activeTab === reviewTabIndex) {
  hint = "Left/Right tabs | Enter submit | Space edit | Esc cancel";
} else if (q?.type === "multi-choice") {
  hint =
    "Left/Right tabs | Up/Down move | Space toggle | Tab notes | Esc cancel";
} else {
  hint =
    "Left/Right tabs | Up/Down move | Space/Enter select | Tab notes | Esc cancel";
}
```

Note: "Tab notes" only shows when it's relevant. For simplicity, always show it in the hint. The actual Tab key is a no-op when there's no selection.

- [ ] **Step 2: Update tab bar with notes indicator**

In `src/tui/render-tabs.ts`, update signature to accept `notes`:

```ts
export function renderTabBar(
  questions: NormalizedQuestion[],
  activeTab: number,
  answeredIds: Set<string>,
  notedIds: Set<string>,
  theme: RenderTheme,
  _width: number,
): string[];
```

Add `[n]` marker:

```ts
const noted = notedIds.has(q.id);
const noteSuffix = noted ? " [n]" : "";
const text = ` ${marker} ${q.header}${noteSuffix} `;
```

Update the caller in `render.ts` to pass `notedIds`:

```ts
const notedIds = new Set(state.notes.keys());
lines.push(
  ...renderTabBar(
    questions,
    state.activeTab,
    answeredIds(state),
    notedIds,
    theme,
    renderWidth,
  ),
);
```

- [ ] **Step 3: Update review screen with notes indicator**

In `src/tui/render-review.ts`, add `notes` parameter:

```ts
export function renderReviewScreen(
  questions: NormalizedQuestion[],
  answers: Map<string, QuestionSelection>,
  notes: Map<string, string>,
  cursor: number,
  theme: RenderTheme,
  width: number,
): string[];
```

Add `[n]` after the answer value:

```ts
const hasNote = notes.has(q.id);
const noteSuffix = hasNote ? " [n]" : "";
const value = selection
  ? formatAnswerForRender(q, selection) + noteSuffix
  : "(unanswered)";
```

Update the caller in `render.ts`:

```ts
lines.push(
  ...renderReviewScreen(
    questions,
    state.answers,
    state.notes,
    state.reviewCursor,
    theme,
    renderWidth,
  ),
);
```

- [ ] **Step 4: Update all tests**

Update test files to pass new parameters and verify notes indicators.

- [ ] **Step 5: Run full check**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && pnpm check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/ tests/
git commit -m "feat: add per-question notes via Tab key"
```

---

## Final Verification

After all phases:

- [ ] Run `pnpm check` — lint, typecheck, all tests pass
- [ ] Manually verify the questionnaire works end-to-end (if pi TUI environment is available)
- [ ] Review the full diff for any leftover dead code or stale references
