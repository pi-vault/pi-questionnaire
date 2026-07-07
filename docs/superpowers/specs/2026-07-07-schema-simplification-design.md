# Schema Simplification for Model Compatibility

## Problem

MiniMax-M3's guided decoding cannot generate deeply nested JSON with `anyOf` (TypeBox `Type.Union`) constructs. The current `QuestionnaireParamsSchema` uses `Type.Union([SingleChoiceQuestionSchema, MultiChoiceQuestionSchema])` inside the `questions` array. This compiles to JSON Schema with `anyOf` at the array-item level, causing M3 to produce `{"questions": [{}]}` on every attempt (21/21 failures observed in session logs).

The issue is model-level and persists across both Anthropic and OpenAI API formats.

## Prior Art

Five community implementations of the same tool concept were compared:

| Package | Uses Union? | M3-safe? |
|---------|------------|----------|
| pi coding-agent example | No | Yes |
| rpiv-ask-user-question | No | Yes |
| supi-ask-user | Yes (`Type.Union([Choice, Text])`) | No |
| dreki-gg questionnaire | No | Yes |
| amosblomqvist ask-user-question | No | Yes |

Three of four M3-safe packages use a single flat question schema with a boolean or enum field to differentiate single-select from multi-select, eliminating `anyOf` entirely from the compiled JSON Schema.

## Solution

Merge `SingleChoiceQuestionSchema` and `MultiChoiceQuestionSchema` into a single `QuestionSchema` with a `multiSelect: boolean` field (defaults to `false`). Make option `value` optional (defaults to `label` during normalization).

### Schema

```ts
const QuestionOptionSchema = Type.Object({
  label: Type.String({ description: "User-facing label" }),
  value: Type.Optional(Type.String({
    description: "Stable value returned when selected (defaults to label)",
  })),
  description: Type.Optional(Type.String({
    description: "Helper text shown below the label",
  })),
});

const QuestionSchema = Type.Object({
  id: Type.String({ description: "Unique question identifier" }),
  header: Type.String({ description: "Short label for tabs and summaries" }),
  prompt: Type.String({ description: "Full question text shown to the user" }),
  options: Type.Array(QuestionOptionSchema, {
    minItems: 2,
    maxItems: 12,
    description: "Available options (2-12)",
  }),
  multiSelect: Type.Optional(Type.Boolean({
    description: "Allow multiple selections (default: false)",
  })),
  recommendation: Type.Optional(Type.String({
    description: "Value of the recommended option",
  })),
  allowOther: Type.Optional(Type.Boolean({
    description: 'Append a "Type something." option for custom text input (default: true)',
  })),
  allowChat: Type.Optional(Type.Boolean({
    description: 'Append a "Chat about this" option (default: true)',
  })),
});

const QuestionnaireParamsSchema = Type.Object({
  questions: Type.Array(QuestionSchema, {
    minItems: 1,
    maxItems: 10,
    description: "1-10 questions to ask the user",
  }),
});
```

The compiled JSON Schema contains zero `anyOf` constructs.

### Internal Types

The two normalized question interfaces merge into one:

```ts
interface NormalizedQuestion {
  id: string;
  header: string;
  prompt: string;
  options: QuestionOption[];  // value guaranteed populated after normalization
  multiSelect: boolean;
  recommendation: string | null;
  allowOther: boolean;        // only effective when multiSelect is false
  allowChat: boolean;
}
```

`QuestionSelection`, `QuestionResponse`, and `QuestionnaireResult` are unchanged.

### Normalization Changes

One new responsibility: defaulting `value` to `label` on options.

```ts
options: input.options.map(o => ({
  label: o.label,
  value: o.value ?? o.label,
  description: o.description,
}))
```

Single normalization path for all questions (no branching on `input.type`). `multiSelect` defaults to `false`.

### What Changed from Current

- `SingleChoiceQuestionSchema` + `MultiChoiceQuestionSchema` + `Type.Union` replaced by one flat `QuestionSchema`.
- `type: "single-choice" | "multi-choice"` discriminator replaced by `multiSelect: boolean` (defaults `false`).
- `value` on options is now optional (defaults to `label` in normalization).
- `recommendation` is always `Type.Optional(Type.String())` instead of a union of string and string-array.
- `allowOther` available on all questions (only effective when `multiSelect` is `false`, matching current behavior).

### What Does Not Change

- TUI behavior: tabs, input handling, review screen, rendering. Logic is identical, field names differ (`question.multiSelect` instead of `question.type === "multi-choice"`).
- Result contract: `QuestionSelection`, `QuestionResponse`, `QuestionnaireResult` types stay the same.
- `formatContentSummary` and `formatAnswerForRender` stay the same.
- Tool registration in `index.ts` (just uses the new schema).

## Breaking Change

This is a breaking change to the schema (tool input) contract. Models that previously generated `type: "single-choice"` must now omit or set `multiSelect: false`. The result (tool output) contract is unaffected.

## Files Changed

| File | Change |
|------|--------|
| `src/core/schema.ts` | Replace union with single flat schema, make value optional |
| `src/core/types.ts` | Merge two interfaces into one with `multiSelect: boolean` |
| `src/core/normalize.ts` | Single normalization path, default value to label |
| `src/core/validate.ts` | Remove type-discriminator branching |
| `src/core/process.ts` | Remove type-discriminator branching |
| `src/tui/render-question.ts` | `question.multiSelect` instead of `question.type === "multi-choice"` |
| `src/tui/render.ts` | Same field rename |
| `src/tui/state.ts` | Same field rename |
| `src/tui/input.ts` | Same field rename |
| `tests/**` | Update fixtures from `type:` to `multiSelect:` |

No new files. No new dependencies.

## Testing

Existing tests update fixtures from `type: "single-choice"` / `type: "multi-choice"` to `multiSelect: false` / `multiSelect: true`. No new behavioral test cases beyond one addition: verify `value` defaults to `label` when omitted (in `normalize.test.ts`).
