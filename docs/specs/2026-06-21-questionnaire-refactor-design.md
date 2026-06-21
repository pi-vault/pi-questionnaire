# Questionnaire Refactor: Sentinels, Notes & Key Remapping

Date: 2026-06-21

## Summary

Refactor the questionnaire extension to remove the free-text question type, add sentinel options ("Type something." and "Chat about this") to choice questions, add per-question notes via Tab, and remap tab-navigation from Tab/Shift+Tab to Left/Right.

## Motivation

The current questionnaire supports three question types: single-choice, multi-choice, and free-text. In practice, free-text questions are rarely used by agents and don't fit the structured-decision model well. Meanwhile, users need ways to:

1. Provide a custom answer when none of the predefined options fit (currently impossible without the awkward text question type)
2. Signal to the agent that a question needs discussion rather than a selection
3. Add context or reasoning to their selections without changing the selection itself

Several community implementations (coding-agent, rpiv, dreki-gg, supi-ask-user, amosblomqvist) solve these problems with "Other" options, "Chat about this" rows, and per-option/per-question comments. This refactoring brings those patterns into pi-questionnaire.

## Approach

Evolve the existing state machine (Approach A). The Phase 8 architecture (pure-function reducer, input mapper, render assembly) stays intact. Changes are behavioral — new modes, new actions, new key mapping — not structural.

## Changes

### 1. Types & Schema

**Removed:**
- `NormalizedTextQuestion` type and `TextAnswer` type
- `TextQuestionSchema` from the schema union
- `submitText` action
- `textValues` from state

**Modified question schema — both question types gain optional sentinel controls:**

```ts
// SingleChoiceQuestionSchema additions
allowOther?: boolean;  // default true — appends "Type something." sentinel
allowChat?: boolean;   // default true — appends "Chat about this" sentinel

// MultiChoiceQuestionSchema additions
allowChat?: boolean;   // default true — appends "Chat about this" sentinel
// allowOther is not applicable for multi-choice (ignored if provided)
```

**New answer/result types:**

```ts
type QuestionSelection =
  | { kind: "option"; value: string; label: string }    // single-choice picked option
  | { kind: "options"; selected: SelectedOption[] }      // multi-choice picked options
  | { kind: "custom"; value: string }                    // "Type something." text
  | { kind: "chat" };                                    // "Chat about this" signal

interface QuestionResponse {
  questionId: string;
  selection: QuestionSelection;
  notes?: string;
}

interface QuestionnaireResult {
  questions: NormalizedQuestion[];
  responses: QuestionResponse[];
  cancelled: boolean;
}
```

The discriminator moves from question type to answer kind. A single-choice question can produce `option`, `custom`, or `chat`. A multi-choice question can produce `options` or `chat`.

Selecting "Chat about this" replaces any existing selection for that question. In multi-choice, it clears checked options. It is an alternative answer path, not additive.

### 2. State Machine

**State shape:**

```ts
interface QuestionnaireState {
  activeTab: number;
  optionCursor: number;
  reviewCursor: number;
  answers: Map<string, QuestionSelection>;
  multiChecked: Map<string, Set<string>>;
  notes: Map<string, string>;              // per-question notes
  inputMode: "navigate" | "typing" | "notes";
  editingQuestionId: string | null;
  customText: Map<string, string>;         // typed text per question, persisted across tab switches
}
```

**New actions:**

```ts
| { type: "enterTyping"; questionId: string }
| { type: "submitTyping"; questionId: string; value: string }
| { type: "cancelTyping" }
| { type: "selectChat"; questionId: string }
| { type: "enterNotes"; questionId: string }
| { type: "submitNotes"; questionId: string; value: string }
| { type: "cancelNotes" }
```

Removed: `submitText`.

**Visible rows per question type:**

Single-choice:
```
1. Option A
2. Option B
3. Type something.       <- if allowOther
4. Chat about this       <- if allowChat
```

Multi-choice:
```
[x] 1. Option A
[ ] 2. Option B
[ ] Chat about this      <- if allowChat (no "Type something.")
--- Next                 <- always present for multi-choice
```

**Helper functions:**

- `visibleRowCount(question)` — computes total rows including sentinels
  - Single-choice: `options.length + (allowOther ? 1 : 0) + (allowChat ? 1 : 0)`
  - Multi-choice: `options.length + (allowChat ? 1 : 0) + 1` (+1 for Next)
- `cursorTarget(question, cursor)` — returns `{ kind: "option", index }` | `{ kind: "other" }` | `{ kind: "chat" }` | `{ kind: "next" }` based on cursor position
- `hasSelection(state, questionId)` — gates Tab-for-notes availability
- Existing helpers (`allAnswered`, `currentQuestion`, `advanceToNextTab`) remain with minor adjustments
- "Chat about this" counts as answered for `allAnswered` purposes

### 3. Input Mapping (Key Routing)

**Key remapping:**
- Left/Right replaces Tab/Shift+Tab for tab navigation
- Tab opens notes editor (only if question has a selection)
- Shift+Tab is unbound
- Left/Right is context-sensitive: forwarded to editor in typing/notes modes

**Navigate mode — question screen:**

| Key | Action |
|---|---|
| Up/Down | Move cursor through options + sentinels |
| Left/Right | Switch tab (wrapping) |
| Space/Enter | Select option (single), toggle checkbox (multi), enter typing, select chat, or confirm Next |
| Tab | Open notes editor (only if question has a selection) |
| Esc | Cancel questionnaire |

**Typing mode** (inline editor for "Type something."):

| Key | Action |
|---|---|
| Enter | Submit typed text as answer, auto-advance |
| Esc | Cancel typing, return to navigate |
| Up/Down | Cancel typing, return to navigate, move cursor |
| Left/Right | Forward to editor (text cursor movement) |
| All other | Forward to editor |

**Notes mode** (inline editor for per-question note):

| Key | Action |
|---|---|
| Enter | Save note, return to navigate |
| Esc | Discard unsaved edits, return to navigate |
| Up/Down | Save note, return to navigate, move cursor |
| Left/Right | Forward to editor (text cursor movement) |
| All other | Forward to editor |

**Navigate mode — review screen:**

| Key | Action |
|---|---|
| Up/Down | Move review cursor |
| Left/Right | Switch tab (wrapping) |
| Space/Enter on row | Jump to that question's tab |
| Enter (all answered) | Submit questionnaire |
| Tab | No-op |
| Esc | Cancel questionnaire |

**InputResult type:**

```ts
export type InputResult =
  | { type: "action"; action: Action }
  | { type: "finalize"; cancelled: boolean }
  | { type: "forward-to-editor" }
  | { type: "forward-to-notes-editor" }
  | { type: "none" };
```

### 4. Rendering

**Question screen — sentinel rows:**

Sentinel rows appear after options in the cursor list. They use muted styling to distinguish them from regular options.

Single-choice typing mode — the editor replaces the sentinel row inline:

```
  1. Option A
  2. Option B
> 3. some typed text|              <- inline editor at the sentinel position

  Enter submit | Esc cancel | Up/Down exit
```

If the user previously typed something but navigated away:

```
    1. Option A
  > 2. Option B
    3. "my custom answer"          <- persisted custom text, quoted
```

Multi-choice:

```
  [x] 1. Option A
  [ ] 2. Option B
  [ ] Chat about this
  -- Next
```

Notes mode — inline editor below options:

```
  * 1. Option A                    <- selected marker
    2. Option B

  Note for this question:
  |                                <- editor

  Enter save | Esc discard
```

**Tab bar — notes indicator:**

```
 [x] Scope [n]   [x] Priority   [ ] Features   [ ] Review
```

`[n]` marker appears on questions that have notes.

**Review screen:**

```
  Review answers

  > [x] Scope: 1. Small [n]
    [x] Priority: (wrote) "custom text"
    [ ] Features: chat
```

**Hint bar per context:**

| Context | Hint |
|---|---|
| Navigate (single-choice) | `Left/Right tabs \| Up/Down select \| Enter confirm \| Tab notes \| Esc cancel` |
| Navigate (multi-choice) | `Left/Right tabs \| Up/Down select \| Space toggle \| Tab notes \| Esc cancel` |
| Typing | `Enter submit \| Esc cancel \| Up/Down exit` |
| Notes | `Enter save \| Esc discard` |
| Review | `Left/Right tabs \| Up/Down select \| Enter submit \| Esc cancel` |

### 5. Validation, Normalization & Formatting

**Normalization:**

```ts
interface NormalizedSingleChoiceQuestion {
  type: "single-choice";
  id: string; header: string; prompt: string;
  options: QuestionOption[];
  recommendation: string | null;
  allowOther: boolean;    // default true
  allowChat: boolean;     // default true
}

interface NormalizedMultiChoiceQuestion {
  type: "multi-choice";
  id: string; header: string; prompt: string;
  options: QuestionOption[];
  recommendation: string[];
  allowChat: boolean;     // default true
  // no allowOther
}

type NormalizedQuestion = NormalizedSingleChoiceQuestion | NormalizedMultiChoiceQuestion;
```

**Validation changes:**

- Remove text-question validation branch
- Reject questions where all interaction paths are disabled (both sentinels off and fewer than 2 options)
- Existing validations remain: duplicate IDs, option count bounds, recommendation matching

**Format changes:**

Model-facing output:

```
Scope: user selected: 1. Small
Scope note: "prefer minimal scope for first iteration"
Priority: user wrote: "critical - blocking release"
Features: user wants to discuss this question
```

- `formatModelLine` handles all four selection kinds
- `formatContentSummary` concatenates responses, appending notes where present
- `formatAnswerForRender` produces shorter versions for the review screen

**Result construction:**

`buildResult` assembles `QuestionResponse[]`:
- Option: `{ questionId, selection: { kind: "option", value, label }, notes? }`
- Custom: `{ questionId, selection: { kind: "custom", value }, notes? }`
- Options: `{ questionId, selection: { kind: "options", selected: [...] }, notes? }`
- Chat: `{ questionId, selection: { kind: "chat" }, notes? }`

Unanswered questions are omitted. "Chat about this" counts as answered.

## Files Affected

| File | Change |
|---|---|
| `src/core/types.ts` | Remove text types, add sentinel/response types |
| `src/core/schema.ts` | Remove TextQuestionSchema, add allowOther/allowChat fields |
| `src/core/validate.ts` | Remove text branch, add sentinel validation |
| `src/core/normalize.ts` | Remove text normalization, add sentinel defaults |
| `src/core/process.ts` | No structural change |
| `src/core/format.ts` | Rewrite for QuestionResponse shape |
| `src/tui/state.ts` | New state fields, new actions, updated helpers |
| `src/tui/input.ts` | Full rewrite of key routing for new modes/keys |
| `src/tui/render.ts` | Update render assembly for new modes |
| `src/tui/render-question.ts` | Sentinel rows, inline editor, notes editor |
| `src/tui/render-tabs.ts` | Notes indicator `[n]` |
| `src/tui/render-review.ts` | New answer display formats |
| `src/index.ts` | Updated result handling, remove text references |
| `tests/` | All test files updated to match |

## Non-Goals

- No per-option notes (per-question only)
- No backward compatibility with text question type
- No new question types
- No collapse/expand feature (rpiv-specific)
- No preview pane (rpiv-specific)
