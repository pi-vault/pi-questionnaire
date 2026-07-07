# Schema Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the union-based schema (`SingleChoiceQuestionSchema | MultiChoiceQuestionSchema`) with a single flat `QuestionSchema` using a `multiSelect: boolean` field, and update all consumers so the project compiles and all tests pass after every commit.

**Architecture:** Merge the two schema variants into one `QuestionSchema` with `multiSelect: Optional(Boolean)`. Merge `NormalizedSingleChoiceQuestion` and `NormalizedMultiChoiceQuestion` into one `NormalizedQuestion` interface with `multiSelect: boolean`. Make option `value` optional (defaults to `label` during normalization). Simplify `recommendation` from `string | string[]` to always `string | null`. Update all downstream files (normalization, validation, TUI, tests) atomically.

**Tech Stack:** TypeScript, TypeBox, Vitest

**Spec:** `docs/superpowers/specs/2026-07-07-schema-simplification-design.md`

---

## File Map

### Files to modify (source)

| File                         | Responsibility                            | Change                                                       |
| ---------------------------- | ----------------------------------------- | ------------------------------------------------------------ |
| `src/core/schema.ts`         | TypeBox schema definitions + static types | Replace union with flat schema, make `value` optional        |
| `src/core/types.ts`          | Normalized runtime interfaces             | Merge two interfaces into one with `multiSelect: boolean`    |
| `src/core/normalize.ts`      | Raw input → normalized questions          | Single path, default `value` to `label`                      |
| `src/core/validate.ts`       | Input validation before normalization     | Remove type-discriminator branching, handle optional `value` |
| `src/core/index.ts`          | Barrel exports for core                   | Remove old type exports                                      |
| `src/tui/state.ts`           | TUI state, reducer, cursor logic          | `q.type` → `q.multiSelect` checks                            |
| `src/tui/input.ts`           | Key → action mapping                      | `q.type` → `q.multiSelect` checks                            |
| `src/tui/render-question.ts` | Render single/multi question bodies       | Update param types, fix `recommendation` access              |
| `src/tui/render.ts`          | Top-level render orchestration            | `switch(q.type)` → `if(q.multiSelect)`                       |

### Files to modify (tests)

| File                                | Change                                                         |
| ----------------------------------- | -------------------------------------------------------------- |
| `tests/core/normalize.test.ts`      | Update fixtures to new shape, add value-defaults-to-label test |
| `tests/core/validate.test.ts`       | Update fixtures, update recommendation validation tests        |
| `tests/core/process.test.ts`        | Update fixtures                                                |
| `tests/core/format.test.ts`         | Update fixtures                                                |
| `tests/tui/state.test.ts`           | Update fixtures                                                |
| `tests/tui/input.test.ts`           | Update fixtures                                                |
| `tests/tui/render-question.test.ts` | Update fixtures and import types                               |
| `tests/tui/render-review.test.ts`   | Update fixtures                                                |
| `tests/tui/render-tabs.test.ts`     | Update fixtures                                                |
| `tests/tui/render.test.ts`          | Update fixtures                                                |

### Files unchanged

| File                          | Why                                                                                                |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/core/format.ts`          | Only accesses `question.header`, `question.options` — works on new type                            |
| `src/core/process.ts`         | Just calls validate + normalize, no type-discriminator logic (spec lists it but no changes needed) |
| `src/index.ts`                | Tool registration uses `QuestionInput` and `QuestionnaireResult` — both still exist                |
| `src/tui/questionnaire-ui.ts` | No type-specific access                                                                            |
| `src/tui/render-review.ts`    | Only uses `q.header`, `q.id`                                                                       |
| `src/tui/render-tabs.ts`      | Only uses `q.header`, `q.id`                                                                       |
| `src/tui/helpers.ts`          | Pure text helpers                                                                                  |
| `src/tui/theme.ts`            | Interface only                                                                                     |
| `src/tui/index.ts`            | Re-export only                                                                                     |
| `tests/core/schema.test.ts`   | Only tests constraint constants (unchanged)                                                        |
| `tests/index.test.ts`         | Only tests extension registration                                                                  |
| `tests/helpers/theme.ts`      | Theme mock                                                                                         |

---

### Task 1: Rewrite `src/core/schema.ts`

**Files:**

- Modify: `src/core/schema.ts`

- [ ] **Step 1: Replace the entire schema file**

Replace the contents of `src/core/schema.ts` with:

```ts
import { Type } from "typebox";
import type { Static } from "typebox";

// Constraint constants — single source of truth
export const MIN_QUESTIONS = 1;
export const MAX_QUESTIONS = 10;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 12;

export const QuestionOptionSchema = Type.Object({
  label: Type.String({ description: "User-facing label for this option" }),
  value: Type.Optional(
    Type.String({
      description:
        "Stable value returned when this option is selected (defaults to label)",
    }),
  ),
  description: Type.Optional(
    Type.String({ description: "Optional helper text shown below the label" }),
  ),
});

export const QuestionSchema = Type.Object({
  id: Type.String({ description: "Unique question identifier" }),
  header: Type.String({
    description: "Short label shown in tabs and summaries",
  }),
  prompt: Type.String({ description: "Full question text shown to the user" }),
  options: Type.Array(QuestionOptionSchema, {
    minItems: MIN_OPTIONS,
    maxItems: MAX_OPTIONS,
    description: `Available options (${MIN_OPTIONS}-${MAX_OPTIONS})`,
  }),
  multiSelect: Type.Optional(
    Type.Boolean({
      description: "Allow multiple selections (default: false)",
    }),
  ),
  recommendation: Type.Optional(
    Type.String({ description: "Value of the recommended option" }),
  ),
  allowOther: Type.Optional(
    Type.Boolean({
      description:
        'Append a "Type something." option for custom text input (default: true)',
    }),
  ),
  allowChat: Type.Optional(
    Type.Boolean({
      description:
        'Append a "Chat about this" option to signal the agent for discussion (default: true)',
    }),
  ),
});

export const QuestionnaireParamsSchema = Type.Object({
  questions: Type.Array(QuestionSchema, {
    minItems: MIN_QUESTIONS,
    maxItems: MAX_QUESTIONS,
    description: `${MIN_QUESTIONS}-${MAX_QUESTIONS} questions to ask the user`,
  }),
});

// Static type aliases — derived from schemas
export type QuestionOption = Static<typeof QuestionOptionSchema>;
export type QuestionInput = Static<typeof QuestionSchema>;
```

Key changes:

- `SingleChoiceQuestionSchema`, `MultiChoiceQuestionSchema`, and `Type.Union` are gone.
- `QuestionOptionSchema.value` is now `Type.Optional`.
- `multiSelect: Type.Optional(Type.Boolean())` replaces the `type: "single-choice" | "multi-choice"` discriminator.
- `recommendation` is always `Type.Optional(Type.String())` (no array variant).
- Removed exports: `SingleChoiceQuestionInput`, `MultiChoiceQuestionInput`.

---

### Task 2: Rewrite `src/core/types.ts`

**Files:**

- Modify: `src/core/types.ts`

- [ ] **Step 1: Replace the types file**

Replace the contents of `src/core/types.ts` with:

```ts
import type { QuestionOption } from "./schema.ts";

export interface NormalizedQuestion {
  id: string;
  header: string;
  prompt: string;
  options: QuestionOption[];
  multiSelect: boolean;
  recommendation: string | null;
  allowOther: boolean;
  allowChat: boolean;
}

export interface SelectedOption {
  value: string;
  label: string;
}

export type QuestionSelection =
  | { kind: "option"; value: string; label: string }
  | { kind: "options"; selected: SelectedOption[] }
  | { kind: "custom"; value: string }
  | { kind: "chat" };

export interface QuestionResponse {
  questionId: string;
  selection: QuestionSelection;
  notes?: string;
}

export interface QuestionnaireResult {
  questions: NormalizedQuestion[];
  responses: QuestionResponse[];
  cancelled: boolean;
  error?: string;
}
```

Key changes:

- `NormalizedSingleChoiceQuestion` and `NormalizedMultiChoiceQuestion` are gone.
- `NormalizedQuestion` is a single interface with `multiSelect: boolean`.
- `recommendation` is always `string | null` (no `string[]` variant).
- `allowOther` is present on all questions (only effective when `multiSelect` is `false`).

---

### Task 3: Rewrite `src/core/normalize.ts`

**Files:**

- Modify: `src/core/normalize.ts`

- [ ] **Step 1: Replace the normalize file**

Replace the contents of `src/core/normalize.ts` with:

```ts
import type { QuestionInput, QuestionOption } from "./schema.ts";
import type { NormalizedQuestion } from "./types.ts";

function normalizeOptions(
  options: QuestionOption[],
): Required<QuestionOption>[] {
  return options.map((opt) => ({
    label: opt.label.trim(),
    value: (opt.value ?? opt.label).trim(),
    description: opt.description?.trim() || undefined,
  }));
}

export function normalizeQuestions(
  questions: QuestionInput[],
): NormalizedQuestion[] {
  return questions.map((q) => ({
    id: q.id.trim(),
    header: q.header.trim(),
    prompt: q.prompt.trim(),
    options: normalizeOptions(q.options),
    multiSelect: q.multiSelect === true,
    recommendation: q.recommendation?.trim() ?? null,
    allowOther: q.allowOther !== false,
    allowChat: q.allowChat !== false,
  }));
}
```

Key changes:

- Two functions (`normalizeSingleChoice`, `normalizeMultiChoice`) merged into one path inside `normalizeQuestions`.
- `normalizeOptions` defaults `value` to `label` via `opt.value ?? opt.label`.
- `multiSelect` defaults to `false` (via `=== true`).
- `recommendation` is always `string | null`.
- `allowOther` defaults to `true` for all questions.

---

### Task 4: Update `src/core/validate.ts`

**Files:**

- Modify: `src/core/validate.ts`

- [ ] **Step 1: Replace the validate file**

Replace the contents of `src/core/validate.ts` with:

```ts
import type { QuestionInput } from "./schema.ts";
import {
  MIN_QUESTIONS,
  MAX_QUESTIONS,
  MIN_OPTIONS,
  MAX_OPTIONS,
} from "./schema.ts";

type ValidationResult = { valid: true } | { valid: false; error: string };

export function validateQuestions(
  questions: QuestionInput[],
): ValidationResult {
  if (questions.length === 0) {
    return {
      valid: false,
      error: `Questionnaire must include at least ${MIN_QUESTIONS} question.`,
    };
  }
  if (questions.length > MAX_QUESTIONS) {
    return {
      valid: false,
      error: `Questionnaire supports at most ${MAX_QUESTIONS} questions.`,
    };
  }

  const idSet = new Set<string>();

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const trimmedId = q.id.trim();
    const questionNumber = i + 1;

    if (!trimmedId) {
      return {
        valid: false,
        error: `Question ${questionNumber} has an empty id.`,
      };
    }
    if (idSet.has(trimmedId)) {
      return { valid: false, error: `Duplicate question id: "${trimmedId}".` };
    }
    idSet.add(trimmedId);

    if (!q.header.trim()) {
      return {
        valid: false,
        error: `Question "${trimmedId}" has an empty header.`,
      };
    }
    if (!q.prompt.trim()) {
      return {
        valid: false,
        error: `Question "${trimmedId}" has an empty prompt.`,
      };
    }

    if (q.options.length < MIN_OPTIONS || q.options.length > MAX_OPTIONS) {
      return {
        valid: false,
        error: `Question "${trimmedId}" must have ${MIN_OPTIONS}-${MAX_OPTIONS} options.`,
      };
    }

    const valueSet = new Set<string>();
    for (const opt of q.options) {
      const trimmedValue = (opt.value ?? opt.label).trim();
      if (!trimmedValue) {
        return {
          valid: false,
          error: `Question "${trimmedId}" has an option with an empty value.`,
        };
      }
      if (!opt.label.trim()) {
        return {
          valid: false,
          error: `Question "${trimmedId}" has an option with an empty label.`,
        };
      }
      if (valueSet.has(trimmedValue)) {
        return {
          valid: false,
          error: `Question "${trimmedId}" has duplicate option value "${trimmedValue}".`,
        };
      }
      valueSet.add(trimmedValue);
    }

    if (q.recommendation !== undefined) {
      const optionValues = new Set(
        q.options.map((o) => (o.value ?? o.label).trim()),
      );
      if (!optionValues.has(q.recommendation.trim())) {
        return {
          valid: false,
          error: `Question "${trimmedId}" recommendation "${q.recommendation.trim()}" does not match any option value.`,
        };
      }
    }
  }

  return { valid: true };
}
```

Key changes:

- Removed `if (q.type === "single-choice" || q.type === "multi-choice")` guard — all questions now share the same validation path.
- Option value uses `(opt.value ?? opt.label).trim()` to handle optional `value`.
- Recommendation validation is a single path (always `string`, no array).

---

### Task 5: Update `src/core/index.ts`

**Files:**

- Modify: `src/core/index.ts`

- [ ] **Step 1: Replace the barrel file**

Replace the contents of `src/core/index.ts` with:

```ts
export {
  QuestionnaireParamsSchema,
  MIN_QUESTIONS,
  MAX_QUESTIONS,
  MIN_OPTIONS,
  MAX_OPTIONS,
} from "./schema.ts";
export type { QuestionOption, QuestionInput } from "./schema.ts";
export type {
  NormalizedQuestion,
  QuestionnaireResult,
  QuestionResponse,
  QuestionSelection,
  SelectedOption,
} from "./types.ts";
export { processQuestions } from "./process.ts";
export type { ProcessResult } from "./process.ts";
export {
  formatContentSummary,
  formatAnswerForRender,
  formatModelLine,
  formatNoteLine,
} from "./format.ts";
```

Key changes:

- Removed `SingleChoiceQuestionInput`, `MultiChoiceQuestionInput` type exports.
- Removed `NormalizedSingleChoiceQuestion`, `NormalizedMultiChoiceQuestion` type exports.

---

### Task 6: Update `src/tui/state.ts`

**Files:**

- Modify: `src/tui/state.ts`

- [ ] **Step 1: Update `visibleRowCount`**

Change the type check from `question.type === "single-choice"` to `!question.multiSelect`:

```ts
export function visibleRowCount(question: NormalizedQuestion): number {
  if (!question.multiSelect) {
    return (
      question.options.length +
      (question.allowOther ? 1 : 0) +
      (question.allowChat ? 1 : 0)
    );
  }
  // multi-select: options + chat? + Next
  return question.options.length + (question.allowChat ? 1 : 0) + 1;
}
```

- [ ] **Step 2: Update `cursorTarget`**

Change the type check from `question.type === "single-choice"` to `!question.multiSelect`:

```ts
export function cursorTarget(
  question: NormalizedQuestion,
  cursor: number,
): CursorTarget {
  if (cursor < question.options.length) {
    return { kind: "option", index: cursor };
  }

  let sentinel = question.options.length;

  if (!question.multiSelect) {
    if (question.allowOther && cursor === sentinel) return { kind: "other" };
    if (question.allowOther) sentinel++;
    if (question.allowChat && cursor === sentinel) return { kind: "chat" };
    return { kind: "option", index: question.options.length - 1 };
  }

  // multi-select
  if (question.allowChat && cursor === sentinel) return { kind: "chat" };
  if (question.allowChat) sentinel++;
  if (cursor === sentinel) return { kind: "next" };
  return { kind: "option", index: question.options.length - 1 };
}
```

- [ ] **Step 3: Update `initState`**

Change the type check from `q.type === "multi-choice"` to `q.multiSelect`, and update recommendation from `Set(q.recommendation)` (array) to `Set(q.recommendation ? [q.recommendation] : [])` (single string):

```ts
export function initState(questions: NormalizedQuestion[]): QuestionnaireState {
  const multiChecked = new Map<string, Set<string>>();

  for (const q of questions) {
    if (q.multiSelect) {
      multiChecked.set(
        q.id,
        new Set(q.recommendation ? [q.recommendation] : []),
      );
    }
  }

  return {
    activeTab: 0,
    optionCursor: 0,
    reviewCursor: 0,
    answers: new Map(),
    multiChecked,
    inputMode: "navigate",
    editingQuestionId: null,
    customText: new Map(),
    notes: new Map(),
  };
}
```

- [ ] **Step 4: Update `reduce` — toggleCheckbox case**

Change the type check from `q?.type === "multi-choice"` to `q?.multiSelect`:

```ts
    case "toggleCheckbox": {
      const checked = next.multiChecked.get(action.questionId) ?? new Set();
      if (checked.has(action.value)) {
        checked.delete(action.value);
      } else {
        checked.add(action.value);
      }
      next.multiChecked.set(action.questionId, checked);
      // Sync answer
      const q = questions.find((q) => q.id === action.questionId);
      if (q?.multiSelect) {
        const selected = q.options
          .filter((o) => checked.has(o.value))
          .map((o) => ({ value: o.value, label: o.label }));
        if (selected.length > 0) {
          next.answers.set(action.questionId, { kind: "options", selected });
        } else {
          next.answers.delete(action.questionId);
        }
      }
      return next;
    }
```

---

### Task 7: Update `src/tui/input.ts`

**Files:**

- Modify: `src/tui/input.ts`

- [ ] **Step 1: Update single-choice / multi-choice branching**

Change `q.type === "single-choice"` to `!q.multiSelect` in the `mapInput` function. Replace:

```ts
  // Single-choice
  if (q.type === "single-choice") {
```

With:

```ts
  // Single-select
  if (!q.multiSelect) {
```

This is the only change needed. The rest of the function body (multi-choice fallthrough at the end) stays the same.

---

### Task 8: Update `src/tui/render-question.ts`

**Files:**

- Modify: `src/tui/render-question.ts`

- [ ] **Step 1: Update imports**

Replace:

```ts
import type {
  NormalizedSingleChoiceQuestion,
  NormalizedMultiChoiceQuestion,
} from "../core/types.ts";
```

With:

```ts
import type { NormalizedQuestion } from "../core/types.ts";
```

- [ ] **Step 2: Update `renderSingleChoiceQuestion` parameter type**

Change the first parameter type from `NormalizedSingleChoiceQuestion` to `NormalizedQuestion`:

```ts
export function renderSingleChoiceQuestion(
  question: NormalizedQuestion,
  cursor: number,
  selectedValue: string | null,
  customText: string | null,
  inputMode: "navigate" | "typing" | "notes",
  editorLines: string[],
  theme: RenderTheme,
  width: number,
): string[] {
```

No changes to the function body — `recommendation`, `allowOther`, `allowChat` are accessed the same way.

- [ ] **Step 3: Update `renderMultiChoiceQuestion` parameter type and recommendation access**

Change the first parameter type from `NormalizedMultiChoiceQuestion` to `NormalizedQuestion`:

```ts
export function renderMultiChoiceQuestion(
  question: NormalizedQuestion,
  cursor: number,
  checked: Set<string>,
  theme: RenderTheme,
  width: number,
): string[] {
```

Inside the function body, change the recommendation check from `.includes()` (array method) to `===` (string comparison). Replace:

```ts
const recSuffix = question.recommendation.includes(opt.value)
  ? " [recommended]"
  : "";
```

With:

```ts
const recSuffix = question.recommendation === opt.value ? " [recommended]" : "";
```

---

### Task 9: Update `src/tui/render.ts`

**Files:**

- Modify: `src/tui/render.ts`

- [ ] **Step 1: Replace the switch statement with if/else**

In `renderQuestionnaire`, replace the `switch (q.type)` block:

```ts
  } else if (q) {
    switch (q.type) {
      case "single-choice":
        lines.push(
          ...renderSingleChoiceQuestion(
            q,
            state.optionCursor,
            getSelectedValue(state, q.id),
            state.customText.get(q.id) ?? null,
            state.inputMode,
            editorLines,
            theme,
            renderWidth,
          ),
        );
        break;
      case "multi-choice": {
        const checked = state.multiChecked.get(q.id) ?? new Set();
        lines.push(
          ...renderMultiChoiceQuestion(
            q,
            state.optionCursor,
            checked,
            theme,
            renderWidth,
          ),
        );
        break;
      }
    }
  }
```

With:

```ts
  } else if (q) {
    if (q.multiSelect) {
      const checked = state.multiChecked.get(q.id) ?? new Set();
      lines.push(
        ...renderMultiChoiceQuestion(
          q,
          state.optionCursor,
          checked,
          theme,
          renderWidth,
        ),
      );
    } else {
      lines.push(
        ...renderSingleChoiceQuestion(
          q,
          state.optionCursor,
          getSelectedValue(state, q.id),
          state.customText.get(q.id) ?? null,
          state.inputMode,
          editorLines,
          theme,
          renderWidth,
        ),
      );
    }
  }
```

- [ ] **Step 2: Update the hint bar type check**

Replace:

```ts
  } else if (q?.type === "multi-choice") {
```

With:

```ts
  } else if (q?.multiSelect) {
```

---

### Task 10: Update `tests/core/normalize.test.ts`

**Files:**

- Modify: `tests/core/normalize.test.ts`

- [ ] **Step 1: Replace test file**

Replace the contents of `tests/core/normalize.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import type { QuestionInput } from "../../src/core/schema.ts";
import { normalizeQuestions } from "../../src/core/normalize.ts";

describe("normalizeQuestions", () => {
  it("trims id, header, prompt on questions", () => {
    const input: QuestionInput[] = [
      {
        id: "  scope  ",
        header: "  Scope  ",
        prompt: "  Pick one  ",
        options: [
          { label: " A ", value: " a ", description: " desc " },
          { label: "B", value: "b" },
        ],
      },
    ];
    const result = normalizeQuestions(input);
    expect(result[0].id).toBe("scope");
    expect(result[0].header).toBe("Scope");
    expect(result[0].prompt).toBe("Pick one");
    expect(result[0].options[0].value).toBe("a");
    expect(result[0].options[0].label).toBe("A");
    expect(result[0].options[0].description).toBe("desc");
  });

  it("defaults value to label when value is omitted", () => {
    const input: QuestionInput[] = [
      {
        id: "q1",
        header: "Q1",
        prompt: "Pick",
        options: [{ label: "Alpha" }, { label: "Beta" }],
      },
    ];
    const result = normalizeQuestions(input);
    expect(result[0].options[0].value).toBe("Alpha");
    expect(result[0].options[1].value).toBe("Beta");
  });

  it("uses explicit value when provided", () => {
    const input: QuestionInput[] = [
      {
        id: "q1",
        header: "Q1",
        prompt: "Pick",
        options: [
          { label: "Alpha", value: "a" },
          { label: "Beta", value: "b" },
        ],
      },
    ];
    const result = normalizeQuestions(input);
    expect(result[0].options[0].value).toBe("a");
    expect(result[0].options[1].value).toBe("b");
  });

  it("sets recommendation to null when not provided", () => {
    const input: QuestionInput[] = [
      {
        id: "q1",
        header: "Q1",
        prompt: "Pick",
        options: [
          { label: "A", value: "a" },
          { label: "B", value: "b" },
        ],
      },
    ];
    const result = normalizeQuestions(input);
    expect(result[0].recommendation).toBeNull();
  });

  it("preserves recommendation value when provided", () => {
    const input: QuestionInput[] = [
      {
        id: "q1",
        header: "Q1",
        prompt: "Pick",
        options: [
          { label: "A", value: "a" },
          { label: "B", value: "b" },
        ],
        recommendation: "a",
      },
    ];
    const result = normalizeQuestions(input);
    expect(result[0].recommendation).toBe("a");
  });

  it("defaults multiSelect to false when omitted", () => {
    const input: QuestionInput[] = [
      {
        id: "q1",
        header: "Q1",
        prompt: "Pick",
        options: [
          { label: "A", value: "a" },
          { label: "B", value: "b" },
        ],
      },
    ];
    const result = normalizeQuestions(input);
    expect(result[0].multiSelect).toBe(false);
  });

  it("preserves multiSelect: true", () => {
    const input: QuestionInput[] = [
      {
        id: "q1",
        header: "Q1",
        prompt: "Pick",
        options: [
          { label: "A", value: "a" },
          { label: "B", value: "b" },
        ],
        multiSelect: true,
      },
    ];
    const result = normalizeQuestions(input);
    expect(result[0].multiSelect).toBe(true);
  });

  it("defaults allowOther to true", () => {
    const input: QuestionInput[] = [
      {
        id: "q1",
        header: "Q1",
        prompt: "Pick",
        options: [
          { label: "A", value: "a" },
          { label: "B", value: "b" },
        ],
      },
    ];
    const result = normalizeQuestions(input);
    expect(result[0].allowOther).toBe(true);
  });

  it("preserves allowOther: false", () => {
    const input: QuestionInput[] = [
      {
        id: "q1",
        header: "Q1",
        prompt: "Pick",
        options: [
          { label: "A", value: "a" },
          { label: "B", value: "b" },
        ],
        allowOther: false,
      },
    ];
    const result = normalizeQuestions(input);
    expect(result[0].allowOther).toBe(false);
  });

  it("defaults allowChat to true", () => {
    const input: QuestionInput[] = [
      {
        id: "q1",
        header: "Q1",
        prompt: "Pick",
        options: [
          { label: "A", value: "a" },
          { label: "B", value: "b" },
        ],
      },
    ];
    const result = normalizeQuestions(input);
    expect(result[0].allowChat).toBe(true);
  });

  it("preserves allowChat: false", () => {
    const input: QuestionInput[] = [
      {
        id: "q1",
        header: "Q1",
        prompt: "Pick",
        options: [
          { label: "A", value: "a" },
          { label: "B", value: "b" },
        ],
        allowChat: false,
      },
    ];
    const result = normalizeQuestions(input);
    expect(result[0].allowChat).toBe(false);
  });

  it("strips undefined descriptions from options", () => {
    const input: QuestionInput[] = [
      {
        id: "q1",
        header: "Q1",
        prompt: "Pick",
        options: [
          { label: "A", value: "a" },
          { label: "B", value: "b" },
        ],
      },
    ];
    const result = normalizeQuestions(input);
    expect(result[0].options[0].description).toBeUndefined();
  });
});
```

---

### Task 11: Update `tests/core/validate.test.ts`

**Files:**

- Modify: `tests/core/validate.test.ts`

- [ ] **Step 1: Replace test file**

Replace the contents of `tests/core/validate.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import type { QuestionInput } from "../../src/core/schema.ts";
import { validateQuestions } from "../../src/core/validate.ts";

function singleQ(overrides: Partial<QuestionInput> = {}): QuestionInput {
  return {
    id: "q1",
    header: "Q1",
    prompt: "Pick one",
    options: [
      { label: "A", value: "a" },
      { label: "B", value: "b" },
    ],
    ...overrides,
  };
}

function multiQ(overrides: Partial<QuestionInput> = {}): QuestionInput {
  return {
    id: "q1",
    header: "Q1",
    prompt: "Pick many",
    multiSelect: true,
    options: [
      { label: "A", value: "a" },
      { label: "B", value: "b" },
    ],
    ...overrides,
  };
}

describe("validateQuestions", () => {
  it("accepts a valid single-select question", () => {
    const result = validateQuestions([singleQ()]);
    expect(result).toEqual({ valid: true });
  });

  it("accepts a valid multi-select question", () => {
    const result = validateQuestions([multiQ()]);
    expect(result).toEqual({ valid: true });
  });

  it("rejects empty questions array", () => {
    const result = validateQuestions([]);
    expect(result).toEqual({
      valid: false,
      error: "Questionnaire must include at least 1 question.",
    });
  });

  it("rejects more than 10 questions", () => {
    const qs = Array.from({ length: 11 }, (_, i) => singleQ({ id: `q${i}` }));
    const result = validateQuestions(qs);
    expect(result).toEqual({
      valid: false,
      error: "Questionnaire supports at most 10 questions.",
    });
  });

  it("rejects duplicate question ids", () => {
    const result = validateQuestions([
      singleQ({ id: "dup" }),
      multiQ({ id: "dup" }),
    ]);
    expect(result).toEqual({
      valid: false,
      error: 'Duplicate question id: "dup".',
    });
  });

  it("rejects empty question id", () => {
    const result = validateQuestions([singleQ({ id: "  " })]);
    expect(result).toEqual({
      valid: false,
      error: "Question 1 has an empty id.",
    });
  });

  it("rejects empty question header", () => {
    const result = validateQuestions([singleQ({ header: "" })]);
    expect(result).toEqual({
      valid: false,
      error: 'Question "q1" has an empty header.',
    });
  });

  it("rejects empty question prompt", () => {
    const result = validateQuestions([singleQ({ prompt: "  " })]);
    expect(result).toEqual({
      valid: false,
      error: 'Question "q1" has an empty prompt.',
    });
  });

  it("rejects question with fewer than 2 options", () => {
    const result = validateQuestions([
      singleQ({ options: [{ label: "A", value: "a" }] }),
    ]);
    expect(result).toEqual({
      valid: false,
      error: 'Question "q1" must have 2-12 options.',
    });
  });

  it("rejects question with more than 12 options", () => {
    const options = Array.from({ length: 13 }, (_, i) => ({
      label: `L${i}`,
      value: `v${i}`,
    }));
    const result = validateQuestions([singleQ({ options })]);
    expect(result).toEqual({
      valid: false,
      error: 'Question "q1" must have 2-12 options.',
    });
  });

  it("rejects duplicate option values", () => {
    const result = validateQuestions([
      singleQ({
        options: [
          { label: "A", value: "same" },
          { label: "B", value: "same" },
        ],
      }),
    ]);
    expect(result).toEqual({
      valid: false,
      error: 'Question "q1" has duplicate option value "same".',
    });
  });

  it("rejects empty option value", () => {
    const result = validateQuestions([
      singleQ({
        options: [
          { label: "A", value: "" },
          { label: "B", value: "b" },
        ],
      }),
    ]);
    expect(result).toEqual({
      valid: false,
      error: 'Question "q1" has an option with an empty value.',
    });
  });

  it("rejects empty option label", () => {
    const result = validateQuestions([
      singleQ({
        options: [
          { label: "  ", value: "a" },
          { label: "B", value: "b" },
        ],
      }),
    ]);
    expect(result).toEqual({
      valid: false,
      error: 'Question "q1" has an option with an empty label.',
    });
  });

  it("rejects recommendation not matching any option", () => {
    const result = validateQuestions([singleQ({ recommendation: "nope" })]);
    expect(result).toEqual({
      valid: false,
      error:
        'Question "q1" recommendation "nope" does not match any option value.',
    });
  });

  it("accepts question with valid recommendation", () => {
    const result = validateQuestions([singleQ({ recommendation: "a" })]);
    expect(result).toEqual({ valid: true });
  });

  it("accepts multi-select with valid recommendation", () => {
    const result = validateQuestions([multiQ({ recommendation: "a" })]);
    expect(result).toEqual({ valid: true });
  });

  it("rejects multi-select recommendation not matching any option", () => {
    const result = validateQuestions([multiQ({ recommendation: "nope" })]);
    expect(result).toEqual({
      valid: false,
      error:
        'Question "q1" recommendation "nope" does not match any option value.',
    });
  });

  it("accepts options with value omitted (defaults to label)", () => {
    const result = validateQuestions([
      singleQ({
        options: [{ label: "Alpha" }, { label: "Beta" }],
      }),
    ]);
    expect(result).toEqual({ valid: true });
  });

  it("rejects duplicate effective values when value omitted", () => {
    const result = validateQuestions([
      singleQ({
        options: [{ label: "Same" }, { label: "Same" }],
      }),
    ]);
    expect(result).toEqual({
      valid: false,
      error: 'Question "q1" has duplicate option value "Same".',
    });
  });
});
```

---

### Task 12: Update `tests/core/process.test.ts`

**Files:**

- Modify: `tests/core/process.test.ts`

- [ ] **Step 1: Replace test file**

Replace the contents of `tests/core/process.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import type { QuestionInput } from "../../src/core/schema.ts";
import { processQuestions } from "../../src/core/process.ts";

function singleQ(overrides: Partial<QuestionInput> = {}): QuestionInput {
  return {
    id: "q1",
    header: "Q1",
    prompt: "Pick one",
    options: [
      { label: "A", value: "a" },
      { label: "B", value: "b" },
    ],
    ...overrides,
  };
}

describe("processQuestions", () => {
  it("returns ok with normalized questions for valid input", () => {
    const result = processQuestions([
      singleQ({ id: "  scope  ", header: "  Scope  " }),
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].id).toBe("scope");
      expect(result.questions[0].header).toBe("Scope");
    }
  });

  it("returns error for invalid input", () => {
    const result = processQuestions([]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("at least");
    }
  });

  it("returns error for duplicate ids", () => {
    const result = processQuestions([
      singleQ({ id: "dup" }),
      singleQ({ id: "dup" }),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Duplicate");
    }
  });

  it("normalizes trimmed fields when valid", () => {
    const result = processQuestions([
      singleQ({
        id: "  q1  ",
        prompt: "  Pick  ",
        options: [
          { label: " A ", value: " a " },
          { label: "B", value: "b" },
        ],
      }),
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const q = result.questions[0];
      expect(q.prompt).toBe("Pick");
      expect(q.options[0].value).toBe("a");
      expect(q.options[0].label).toBe("A");
    }
  });
});
```

---

### Task 13: Update `tests/core/format.test.ts`

**Files:**

- Modify: `tests/core/format.test.ts`

- [ ] **Step 1: Update fixture objects**

Replace the `singleQ` and `multiQ` fixture definitions at the top of the file. Replace:

```ts
const singleQ: NormalizedQuestion = {
  type: "single-choice",
  id: "scope",
  header: "Scope",
  prompt: "Pick scope",
  options: [
    { value: "small", label: "Small" },
    { value: "large", label: "Large" },
  ],
  recommendation: null,
  allowOther: false,
  allowChat: false,
};

const multiQ: NormalizedQuestion = {
  type: "multi-choice",
  id: "features",
  header: "Features",
  prompt: "Select features",
  options: [
    { value: "auth", label: "Auth" },
    { value: "logging", label: "Logging" },
    { value: "cache", label: "Cache" },
  ],
  recommendation: [],
  allowChat: false,
};
```

With:

```ts
const singleQ: NormalizedQuestion = {
  id: "scope",
  header: "Scope",
  prompt: "Pick scope",
  options: [
    { value: "small", label: "Small" },
    { value: "large", label: "Large" },
  ],
  multiSelect: false,
  recommendation: null,
  allowOther: false,
  allowChat: false,
};

const multiQ: NormalizedQuestion = {
  id: "features",
  header: "Features",
  prompt: "Select features",
  options: [
    { value: "auth", label: "Auth" },
    { value: "logging", label: "Logging" },
    { value: "cache", label: "Cache" },
  ],
  multiSelect: true,
  recommendation: null,
  allowOther: false,
  allowChat: false,
};
```

No test body changes needed — `format.ts` only accesses `header` and `options` which are unchanged.

---

### Task 14: Update TUI test fixtures

**Files:**

- Modify: `tests/tui/state.test.ts`
- Modify: `tests/tui/input.test.ts`
- Modify: `tests/tui/render-question.test.ts`
- Modify: `tests/tui/render-review.test.ts`
- Modify: `tests/tui/render-tabs.test.ts`
- Modify: `tests/tui/render.test.ts`

All TUI test files use `NormalizedQuestion` fixtures with the old union shape. Apply these transformations across all files:

**Fixture shape transformation:**

| Old field                             | New field                |
| ------------------------------------- | ------------------------ |
| `type: "single-choice"`               | `multiSelect: false`     |
| `type: "multi-choice"`                | `multiSelect: true`      |
| `recommendation: []` (on multi)       | `recommendation: null`   |
| `recommendation: ["auth"]` (on multi) | `recommendation: "auth"` |
| (missing `allowOther` on multi)       | `allowOther: false`      |

**Import transformation:**

| Old import                       | New import           |
| -------------------------------- | -------------------- |
| `NormalizedSingleChoiceQuestion` | `NormalizedQuestion` |
| `NormalizedMultiChoiceQuestion`  | `NormalizedQuestion` |

**Type annotation transformation:**

| Old annotation                                      | New annotation                          |
| --------------------------------------------------- | --------------------------------------- |
| `const x: NormalizedSingleChoiceQuestion = { ... }` | `const x: NormalizedQuestion = { ... }` |
| `const x: NormalizedMultiChoiceQuestion = { ... }`  | `const x: NormalizedQuestion = { ... }` |

**Assertion transformation:**

Any test checking `result[0].type === "single-choice"` changes to check `result[0].multiSelect === false`.

- [ ] **Step 1: Update `tests/tui/state.test.ts`**

Apply the fixture transformations above. Key changes:

- All `type: "single-choice"` → `multiSelect: false` + add `allowOther: false` (or `true` as appropriate)
- All `type: "multi-choice"` → `multiSelect: true` + add `allowOther: false`
- `recommendation: ["auth"]` → `recommendation: "auth"`
- `recommendation: []` → `recommendation: null`

The `initState` test "pre-populates multiChecked from recommendations" expects `checked?.has("auth")` to be true. With the new single-string recommendation `"auth"`, `initState` creates `new Set(["auth"])`, so this assertion still holds.

- [ ] **Step 2: Update `tests/tui/input.test.ts`**

Apply the fixture transformations. Replace imports of `NormalizedSingleChoiceQuestion` and `NormalizedMultiChoiceQuestion` with `NormalizedQuestion`. Update all type annotations and fixture objects.

- [ ] **Step 3: Update `tests/tui/render-question.test.ts`**

Apply the fixture transformations. Replace imports and type annotations. The `renderMultiChoiceQuestion` test fixture with `recommendation: ["auth"]` becomes `recommendation: "auth"`.

- [ ] **Step 4: Update `tests/tui/render-review.test.ts`**

Apply the fixture transformations.

- [ ] **Step 5: Update `tests/tui/render-tabs.test.ts`**

Apply the fixture transformations.

- [ ] **Step 6: Update `tests/tui/render.test.ts`**

Apply the fixture transformations.

---

### Task 15: Verify and commit

- [ ] **Step 1: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (zero errors).

- [ ] **Step 2: Run linter**

Run: `npx biome lint .`
Expected: PASS.

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: flatten question schema into single type with multiSelect boolean

Replace SingleChoiceQuestionSchema/MultiChoiceQuestionSchema union with
a single flat QuestionSchema. The type discriminator is replaced by
multiSelect: boolean (defaults to false).

- Make option value optional (defaults to label during normalization)
- Simplify recommendation from string|string[] to string|null
- Merge NormalizedSingleChoiceQuestion/NormalizedMultiChoiceQuestion into
  one NormalizedQuestion interface
- Update all consumers: validation, normalization, TUI, tests

This eliminates all anyOf constructs from the compiled JSON Schema,
resolving MiniMax-M3 guided decoding failures.

BREAKING CHANGE: Schema input contract changed. Models must use
multiSelect: true instead of type: 'multi-choice'. Result contract
is unchanged."
```
