# Questionnaire Extension Design

## Goal

A Pi extension that registers a `questionnaire` tool for collecting 1-10 structured user answers in a single interactive TUI flow. Supports single-choice, multi-choice, and free-text question types with a mandatory review screen before submission.

## Architecture

Pure-Function Core + Thin UI. Business logic (schema, validation, normalization, formatting) lives in `src/core/` as pure functions with zero pi-tui dependency. The TUI layer in `src/tui/` owns the `ctx.ui.custom()` closure with mutable state, input routing, and rendering. The extension entry point in `src/index.ts` wires core + TUI together via `pi.registerTool()`.

## Question Types

Three discriminated question types via a `type` field:

### choice (single-select)

```ts
{
  type: "choice",
  id: string,               // unique identifier
  header: string,            // short label for tab bar
  prompt: string,            // full question text
  options: QuestionOption[], // 2-12 options, each { value, label, description? }
  recommendation?: string    // value of the recommended option
}
```

### multi-choice

```ts
{
  type: "multi-choice",
  id: string,
  header: string,
  prompt: string,
  options: QuestionOption[], // 2-12 options
  recommendation?: string[]  // values of recommended options
}
```

### text (free-text)

```ts
{
  type: "text",
  id: string,
  header: string,
  prompt: string,
  recommendation?: string   // prefilled editor value
}
```

## Schema Constraints

- `questions`: array, 1-10 items
- Each question requires `type`, `id`, `header`, `prompt`
- Choice/multi-choice require `options` with 2-12 items
- Each option requires `value` and `label`; `description` is optional
- `recommendation` is optional on all question types

## Validation Rules (strict, pre-normalization)

Returns an error result on first failure:

1. Empty questions array or > 10 questions
2. Duplicate question `id` values
3. Empty/whitespace-only `id`, `header`, or `prompt` on any question
4. Choice/multi-choice with < 2 or > 12 options
5. Duplicate option `value` within a question
6. Empty/whitespace-only option `value` or `label`
7. `recommendation` value that does not match any option value (choice/multi-choice only)

## Internal Types

### NormalizedQuestion

Raw params normalized with trimmed strings and defaults applied. Same shape as schema types but guaranteed clean.

### NormalizedAnswer (discriminated union)

```ts
type NormalizedAnswer =
  | { type: "choice"; questionId: string; value: string; label: string }
  | { type: "multi-choice"; questionId: string; selected: { value: string; label: string }[] }
  | { type: "text"; questionId: string; value: string }
```

### QuestionnaireResult

```ts
interface QuestionnaireResult {
  questions: NormalizedQuestion[];
  answers: NormalizedAnswer[];
  cancelled: boolean;
  error?: string;
}
```

## Tool Registration

```ts
name: "questionnaire"
label: "Questionnaire"
description: "Ask the user 1-10 structured questions. Supports single-choice,
  multi-choice, and free-text questions. Use for clarifying requirements,
  getting preferences, or confirming decisions."
promptSnippet: "Use this tool to collect structured user decisions before
  proceeding with implementation or planning."
promptGuidelines:
  - "Batch related clarification questions into one questionnaire call."
  - "Prefer this tool over guessing when requirements or preferences are unclear."
  - "Use choice/multi-choice when options are enumerable; use text for open-ended input."
  - "Place the recommended option's value in the recommendation field instead of modifying the label."
  - "Keep questions to 1-5 per call unless a decision genuinely requires more context."
```

## Execute Flow

```
params -> validate -> normalize -> check ctx.hasUI -> runQuestionnaireUI -> format result
```

## TUI State

Mutable variables inside the `ctx.ui.custom()` closure:

```ts
activeTab: number              // 0..N-1 = questions, N = review tab
optionCursor: number           // cursor within current question (reset on tab switch)
multiChecked: Map<string, Set<string>>  // questionId -> selected option values
textValues: Map<string, string>         // questionId -> text answer
choiceValues: Map<string, string>       // questionId -> selected option value
```

Text questions activate the Editor widget automatically when their tab is active. The active question type (derived from `activeTab`) determines whether keystrokes route to the Editor or to option navigation.

## Navigation

### Global

- **Tab / Right**: next tab (wraps)
- **Shift+Tab / Left**: previous tab (wraps)
- **Esc**: cancel questionnaire

### Choice question

- **Up/Down**: move cursor
- **Space or Enter**: select option, save answer

### Multi-choice question

- **Up/Down**: move cursor
- **Space**: toggle checkbox
- **Enter**: confirm current selection set

### Text question

- Editor widget is shown inline, active when the tab is focused
- **Tab / Shift+Tab / Left / Right**: intercepted before the editor for tab navigation
- **Enter**: submit text (via `editor.onSubmit`), saves the answer
- **Esc**: cancel the questionnaire (same as global Esc)
- All other keystrokes route to the Editor

### Review screen

- **Up/Down**: navigate answer rows
- **Space or Enter on a question row**: jump to that question tab
- **Enter (all answered)**: submit
- Enter is blocked if any question is unanswered; a warning is shown

## Tab Bar

Always visible at top. Shows question headers + Review tab:

```
 [x] Scope   [ ] Priority   [ ] Notes   [ ] Review
```

- `[x]` = answered, `[ ]` = unanswered
- Active tab: highlighted background
- Review tab: checkmark marker when all questions are answered

## Recommendation Display

- Choice: `> 1. Small [recommended]` -- suffix on the label
- Multi-choice: `[ ] 1. Auth [recommended]` -- suffix on the label
- Text: prefills the editor value

## Result Formatting

### Model-facing text (content field)

One line per answer:

- choice: `{header}: user selected: {index}. {label}`
- multi-choice: `{header}: user selected: {index}. {label}, {index}. {label}`
- text: `{header}: user wrote: "{value}"` or `{header}: (empty response)`

### renderCall

```
questionnaire 3 questions (Scope, Priority, Notes)
```

### renderResult

- Cancelled: warning-colored "Cancelled"
- Submitted: one checkmark line per answer

## Error Results

All return `{ content, details, isError: true }`:

| Scenario | Message |
|----------|---------|
| No questions | `Error: Questionnaire must include at least 1 question.` |
| > 10 questions | `Error: Questionnaire supports at most 10 questions.` |
| Duplicate ID | `Error: Duplicate question id: "scope".` |
| Empty id/header/prompt | `Error: Question 1 has an empty id.` |
| < 2 or > 12 options | `Error: Question "scope" must have 2-12 options.` |
| Duplicate option value | `Error: Question "scope" has duplicate option value "small".` |
| Invalid recommendation | `Error: Question "scope" recommendation "xyz" does not match any option value.` |
| No UI | `Error: Questionnaire requires interactive mode.` |

## Cancellation

```ts
{
  content: [{ type: "text", text: "User cancelled the questionnaire" }],
  details: { questions, answers: [], cancelled: true }
}
```

## File Layout

```
src/
  index.ts                    # Extension entry: registerTool
  core/
    index.ts                  # Barrel export
    schema.ts                 # TypeBox parameter schemas
    types.ts                  # Internal types
    validate.ts               # Strict validation
    normalize.ts              # Raw params -> normalized types
    format.ts                 # Answer formatting
  tui/
    index.ts                  # Barrel export
    questionnaire-ui.ts       # ctx.ui.custom() entry point
    render-tabs.ts            # Tab bar rendering
    render-question.ts        # Question screen rendering
    render-review.ts          # Review screen rendering
    helpers.ts                # Shared TUI utilities
tests/
  core/
    validate.test.ts
    normalize.test.ts
    format.test.ts
  tui/
    questionnaire-ui.test.ts
    render-tabs.test.ts
    render-question.test.ts
    render-review.test.ts
  index.test.ts
```
