# Architecture Deepening

Five independent refactors that improve locality, leverage, and testability. Ordered simplest to most complex. Each is its own PR delivering a complete, usable result — no assumed merge order.

## Constraints

- Each refactor is atomic: merge the PR, get the improvement.
- No refactor depends on another having landed. Where a previous refactor would make a later one cleaner, the later one works either way.
- Public API (`src/core/index.ts` exports, tool registration contract) is unchanged.
- All existing tests must pass after each refactor (with updated imports/signatures where needed).

---

## 1. Dissolve theme.ts

**Problem:** `src/tui/theme.ts` is a 5-line file defining a 3-method interface with exactly one adapter (the pi-tui theme from the host). One adapter = hypothetical seam. The file adds a layer of indirection that doesn't earn its keep.

**Changes:**

- Delete `src/tui/theme.ts`.
- Move the `RenderTheme` type into `src/tui/render-question.ts` (primary consumer) and export it.
- Update imports in `render-tabs.ts`, `render-review.ts`, `render.ts` to import from `./render-question.ts`.

**Files touched:**

| File                         | Change                                       |
| ---------------------------- | -------------------------------------------- |
| `src/tui/theme.ts`           | Deleted                                      |
| `src/tui/render-question.ts` | Gains `RenderTheme` type definition + export |
| `src/tui/render-tabs.ts`     | Import path update                           |
| `src/tui/render-review.ts`   | Import path update                           |
| `src/tui/render.ts`          | Import path update                           |

**Tests:** No behavioral change. `tests/helpers/theme.ts` (provides `noopTheme`) is unaffected — it defines its own object literal, not an import of the type.

---

## 2. Inline process.ts

**Problem:** `src/core/process.ts` is 16 lines composing validate + normalize. Deletion test: the 4-line composition moves to one call site. Marginal locality.

**Changes:**

- Delete `src/core/process.ts`.
- Export `validateQuestions` from `src/core/validate.ts` and `normalizeQuestions` from `src/core/normalize.ts` through the barrel (`src/core/index.ts`).
- Inline the validate-then-normalize composition into `src/index.ts` (the single call site).
- Remove `ProcessResult` type — replace with inline result handling at the call site.

**Files touched:**

| File                         | Change                                                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/core/process.ts`        | Deleted                                                                                                     |
| `src/core/index.ts`          | Exports `validateQuestions` and `normalizeQuestions` directly; drops `processQuestions` and `ProcessResult` |
| `src/index.ts`               | Inlines validate-then-normalize (4 lines replacing `processQuestions` call)                                 |
| `tests/core/process.test.ts` | Deleted — the composition is now trivial inline code; underlying functions have their own tests             |

**Tests:** `validate.test.ts` and `normalize.test.ts` already cover the two functions independently. The composition tests in `process.test.ts` (valid input returns normalized, invalid returns error) are redundant once the composition is 4 visible lines in `src/index.ts`.

---

## 3. Consolidate cursor-position arithmetic

**Problem:** Cursor sentinel-index math (which row is "Type something", "Chat about this", "Next") lives in two places: `state.ts` canonicalizes it in `cursorTarget()` and `visibleRowCount()`, but `render-question.ts` re-derives the same indices independently. Change the layout = edit two modules with duplicated logic.

**Changes:**

Add a `rowLayout()` function to `state.ts` that returns a typed array of row descriptors. `cursorTarget` and `visibleRowCount` delegate to it. `render-question.ts` iterates the descriptors instead of computing positions.

**New type and function in state.ts:**

```ts
export type RowSlot =
  | { kind: "option"; index: number; option: NormalizedOption }
  | { kind: "other" }
  | { kind: "chat" }
  | { kind: "next" };

export function rowLayout(question: NormalizedQuestion): RowSlot[];
```

Layout rules (already implicit in the codebase, now explicit in one place):

- Single-select: `option` slots for each option, then `other` (if `allowOther`), then `chat` (if `allowChat`).
- Multi-select: `option` slots for each option, then `chat` (if `allowChat`), then `next`.

Simplified existing functions:

```ts
export function visibleRowCount(question: NormalizedQuestion): number {
  return rowLayout(question).length;
}

export function cursorTarget(
  question: NormalizedQuestion,
  cursor: number,
): CursorTarget {
  const slots = rowLayout(question);
  const slot = slots[Math.min(cursor, slots.length - 1)];
  if (slot.kind === "option") return { kind: "option", index: slot.index };
  return { kind: slot.kind };
}
```

**Render-question.ts changes:**

Instead of computing `const sentinelIndex = question.options.length` and `const chatIndex = question.options.length + (question.allowOther ? 1 : 0)`, it calls `rowLayout(question)` and iterates slots, rendering each by kind:

- `option` slot: render numbered option with cursor/selection indicator
- `other` slot: render "Type something." with editor or custom text
- `chat` slot: render "Chat about this"
- `next` slot: render "--- Next"

**Files touched:**

| File                         | Change                                                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/tui/state.ts`           | Adds `RowSlot` type and `rowLayout()` function; simplifies `cursorTarget` and `visibleRowCount` to delegate |
| `src/tui/render-question.ts` | Rewritten to iterate `RowSlot[]` instead of computing sentinel indices                                      |

**Tests:**

- New: unit tests for `rowLayout()` covering single-select (with/without allowOther, allowChat) and multi-select variants.
- Existing: `cursorTarget` and `visibleRowCount` tests unchanged in assertions (same outputs, now delegating internally).
- Existing: render-question tests unchanged in assertions (same visual output).

---

## 4. Merge render-question into one function

**Problem:** `render-question.ts` exports two functions (`renderSingleChoiceQuestion` with 8 params, `renderMultiChoiceQuestion` with 5 params) for the same task. The caller (`render.ts`) branches on `multiSelect` and assembles different argument lists. Interface nearly as wide as the implementation — shallow.

**Changes:**

Collapse into one function with one input object:

```ts
export interface RenderQuestionInput {
  question: NormalizedQuestion;
  cursor: number;
  selectedValue: string | null;
  customText: string | null;
  checked: Set<string>;
  inputMode: "navigate" | "typing" | "notes";
  editorLines: string[];
}

export function renderQuestion(
  input: RenderQuestionInput,
  theme: RenderTheme,
  width: number,
): string[];
```

`question.multiSelect` drives branching internally. Shared logic: prompt rendering, option loop. Mode-specific: single-select has "Type something" + custom text display; multi-select has checkbox markers + "Next".

If refactor 3 (cursor consolidation) has landed, the option loop iterates `RowSlot[]`. If not, it uses inline index arithmetic — just in one place.

**render.ts simplification:**

The current `if (q.multiSelect) { ... } else { ... }` block (20 lines assembling different argument lists) becomes:

```ts
lines.push(
  ...renderQuestion(
    {
      question: q,
      cursor: state.optionCursor,
      selectedValue: getSelectedValue(state, q.id),
      customText: state.customText.get(q.id) ?? null,
      checked: state.multiChecked.get(q.id) ?? new Set(),
      inputMode: state.inputMode,
      editorLines,
    },
    theme,
    renderWidth,
  ),
);
```

**Files touched:**

| File                         | Change                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `src/tui/render-question.ts` | Two functions become one; exports `renderQuestion` and `RenderQuestionInput` |
| `src/tui/render.ts`          | Simplifies content-rendering block                                           |

**Tests:**

- `tests/tui/render-question.test.ts`: tests call `renderQuestion()` with `RenderQuestionInput`. Same behavioral assertions, different function signature.
- `tests/tui/render.test.ts`: unchanged (tests the composed output).

---

## 5. Deepen the input interpreter to own editor effects

**Problem:** `mapInput` is pure but notes-mode Up/Down needs the editor buffer text. This forces `questionnaire-ui.ts` to intercept keys before `mapInput` (lines 61-87), splitting "what does this keypress do?" across two modules. A comment in the code admits this: "mapInput is pure and cannot access the editor buffer." Post-dispatch editor loading (`if (state.inputMode === "typing") editor.setText(...)`) also lives in the UI adapter.

**Changes:**

Widen `mapInput`'s interface to accept editor buffer text. Rename to `interpret`. Return `Effect[]` instead of a single `InputResult`. All key-to-behavior logic concentrates in `input.ts`.

**New interface:**

```ts
export interface InputContext {
  state: QuestionnaireState;
  questions: NormalizedQuestion[];
  editorText: string;
  notesEditorText: string;
}

export type Effect =
  | { type: "dispatch"; action: Action }
  | { type: "finalize"; cancelled: boolean }
  | { type: "forward-to-editor" }
  | { type: "forward-to-notes-editor" }
  | { type: "set-editor-text"; text: string }
  | { type: "set-notes-editor-text"; text: string }
  | { type: "clear-editor" }
  | { type: "clear-notes-editor" };

export function interpret(data: string, ctx: InputContext): Effect[];
```

Key behaviors that move into `interpret`:

- Notes-mode Up/Down: returns `[dispatch(submitNotes), dispatch(moveCursor), clearNotesEditor]`
- Typing-mode submit via Escape/Up/Down: returns `[dispatch(cancelTyping), clearEditor]`
- Enter typing mode: returns `[dispatch(enterTyping), setEditorText(existingCustomText)]`
- Enter notes mode: returns `[dispatch(enterNotes), setNotesEditorText(existingNotes)]`

**questionnaire-ui.ts simplification:**

`handleInput` becomes a dumb effect applier:

```ts
function handleInput(data: string) {
  const effects = interpret(data, {
    state,
    questions,
    editorText: editor.getText(),
    notesEditorText: notesEditor.getText(),
  });
  for (const effect of effects) {
    switch (effect.type) {
      case "dispatch":
        state = reduce(state, effect.action, questions);
        break;
      case "finalize":
        done(buildResult(state, questions, effect.cancelled));
        return;
      case "forward-to-editor":
        editor.handleInput(data);
        break;
      case "forward-to-notes-editor":
        notesEditor.handleInput(data);
        break;
      case "set-editor-text":
        editor.setText(effect.text);
        break;
      case "set-notes-editor-text":
        notesEditor.setText(effect.text);
        break;
      case "clear-editor":
        editor.setText("");
        break;
      case "clear-notes-editor":
        notesEditor.setText("");
        break;
    }
  }
  tui.requestRender();
}
```

No key inspection, no pre-interception, no post-dispatch loading. Just apply effects.

**What stays the same:**

- `editor.onSubmit` / `notesEditor.onSubmit` callbacks remain as direct dispatch. The Editor component owns its Enter-to-submit lifecycle independently.
- `reduce()` and all state actions — unchanged.
- Render layer — unchanged.

**Files touched:**

| File                          | Change                                                                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `src/tui/input.ts`            | Rewritten: `mapInput` becomes `interpret`, accepts `InputContext`, returns `Effect[]`, absorbs notes-mode and editor-loading logic |
| `src/tui/questionnaire-ui.ts` | `handleInput` becomes effect applier loop; notes-mode interception block deleted; post-dispatch editor loading deleted             |

**Tests:**

- `tests/tui/input.test.ts`: rewritten to test `interpret()`. Assertions check full `Effect[]` arrays. New test cases:
  - Notes-mode Up/Down produces `[dispatch(submitNotes), dispatch(moveCursor), clearNotesEditor]`
  - Entering typing mode produces `[dispatch(enterTyping), setEditorText(existingText)]`
  - Entering notes mode produces `[dispatch(enterNotes), setNotesEditorText(existingNotes)]`
- No new integration tests needed — the effect applier is mechanical.

---

## Summary

| #   | Refactor                      | Complexity | Key gain                              |
| --- | ----------------------------- | ---------- | ------------------------------------- |
| 1   | Dissolve theme.ts             | Trivial    | Remove phantom seam                   |
| 2   | Inline process.ts             | Trivial    | Remove pass-through                   |
| 3   | Consolidate cursor arithmetic | Medium     | Locality: layout logic in one place   |
| 4   | Merge render-question         | Medium     | Leverage: one interface for callers   |
| 5   | Deepen input interpreter      | Complex    | Locality: all key logic in one module |
