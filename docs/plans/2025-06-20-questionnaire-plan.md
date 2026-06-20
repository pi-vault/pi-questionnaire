# Questionnaire Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a Pi extension that registers a `questionnaire` tool for collecting 1-10 structured user answers via an interactive TUI, supporting choice, multi-choice, and text question types with a mandatory review screen.

**Architecture:** Pure-Function Core + Thin UI. All business logic (schema, validation, normalization, formatting) lives in `src/core/` as pure functions with zero pi-tui dependency. The TUI layer in `src/tui/` owns the `ctx.ui.custom()` closure. The extension entry point `src/index.ts` wires them together via `pi.registerTool()`.

**Tech Stack:** TypeScript 6, TypeBox (schema), pi-tui (Editor, Text, Key, matchesKey, wrapTextWithAnsi, truncateToWidth, visibleWidth), pi-coding-agent (ExtensionAPI, ExtensionContext, Theme), Vitest 4, Biome 2.5

**Spec:** `docs/specs/2025-06-20-questionnaire-design.md`

**Verification command:** `pnpm check` (runs biome lint + typecheck + vitest)

---

## File Structure

```
src/
  index.ts                    # Extension entry: registerTool, renderCall, renderResult
  core/
    index.ts                  # Barrel re-export of schema, types, validate, normalize, format
    schema.ts                 # TypeBox parameter schemas (model-facing)
    types.ts                  # Internal types: NormalizedQuestion, NormalizedAnswer, QuestionnaireResult
    validate.ts               # validateQuestions(): strict pre-normalization validation
    normalize.ts              # normalizeQuestions(): raw params -> NormalizedQuestion[]
    format.ts                 # formatAnswerLine(), formatContentSummary(), formatAnswerForRender()
  tui/
    index.ts                  # Barrel re-export: runQuestionnaireUI
    questionnaire-ui.ts       # ctx.ui.custom() entry: state init, handleInput dispatch, render dispatch
    render-tabs.ts            # renderTabBar(): tab bar string[] for given state
    render-question.ts        # renderChoiceQuestion(), renderMultiChoiceQuestion(), renderTextQuestion()
    render-review.ts          # renderReviewScreen(): review/submit screen
    helpers.ts                # pushWrapped(), pushWrappedWithPrefix(): shared line-wrapping utilities
tests/
  core/
    validate.test.ts
    normalize.test.ts
    format.test.ts
  tui/
    render-tabs.test.ts
    render-question.test.ts
    render-review.test.ts
  index.test.ts               # Already exists -- will be updated
```

---

## Phase 1: Core Layer (pure functions, no pi-tui dependency)

This phase builds all business logic. After this phase the core is fully testable and the extension entry point compiles (returning stub results).

### Task 1: Types

**Files:**

- Create: `src/core/types.ts`
- Test: `tests/core/validate.test.ts` (created empty to verify import)

- [ ] **Step 1: Write `src/core/types.ts`**

```ts
export interface QuestionOption {
  value: string;
  label: string;
  description?: string;
}

export interface SingleChoiceQuestionInput {
  type: "single-choice";
  id: string;
  header: string;
  prompt: string;
  options: QuestionOption[];
  recommendation?: string;
}

export interface MultiChoiceQuestionInput {
  type: "multi-choice";
  id: string;
  header: string;
  prompt: string;
  options: QuestionOption[];
  recommendation?: string[];
}

export interface TextQuestionInput {
  type: "text";
  id: string;
  header: string;
  prompt: string;
  recommendation?: string;
}

export type QuestionInput =
  | SingleChoiceQuestionInput
  | MultiChoiceQuestionInput
  | TextQuestionInput;

export interface NormalizedSingleChoiceQuestion {
  type: "single-choice";
  id: string;
  header: string;
  prompt: string;
  options: QuestionOption[];
  recommendation: string | null;
}

export interface NormalizedMultiChoiceQuestion {
  type: "multi-choice";
  id: string;
  header: string;
  prompt: string;
  options: QuestionOption[];
  recommendation: string[];
}

export interface NormalizedTextQuestion {
  type: "text";
  id: string;
  header: string;
  prompt: string;
  recommendation: string | null;
}

export type NormalizedQuestion =
  | NormalizedSingleChoiceQuestion
  | NormalizedMultiChoiceQuestion
  | NormalizedTextQuestion;

export interface SelectedOption {
  value: string;
  label: string;
}

export interface SingleChoiceAnswer {
  type: "single-choice";
  questionId: string;
  value: string;
  label: string;
}

export interface MultiChoiceAnswer {
  type: "multi-choice";
  questionId: string;
  selected: SelectedOption[];
}

export interface TextAnswer {
  type: "text";
  questionId: string;
  value: string;
}

export type NormalizedAnswer =
  | SingleChoiceAnswer
  | MultiChoiceAnswer
  | TextAnswer;

export interface QuestionnaireResult {
  questions: NormalizedQuestion[];
  answers: NormalizedAnswer[];
  cancelled: boolean;
  error?: string;
}
```

- [ ] **Step 2: Verify types compile**

Run: `pnpm typecheck`
Expected: PASS (no errors from new file)

- [ ] **Step 3: Commit**

```bash
git add src/core/types.ts
git commit -m "feat: add core type definitions for questionnaire"
```

---

### Task 2: Schema

**Files:**

- Create: `src/core/schema.ts`

- [ ] **Step 1: Write `src/core/schema.ts`**

```ts
import { Type } from "typebox";

const QuestionOptionSchema = Type.Object({
  value: Type.String({
    description: "Stable value returned when this option is selected",
  }),
  label: Type.String({ description: "User-facing label for this option" }),
  description: Type.Optional(
    Type.String({ description: "Optional helper text shown below the label" }),
  ),
});

const SingleChoiceQuestionSchema = Type.Object({
  type: Type.Literal("single-choice"),
  id: Type.String({ description: "Unique question identifier" }),
  header: Type.String({
    description: "Short label shown in tabs and summaries",
  }),
  prompt: Type.String({ description: "Full question text shown to the user" }),
  options: Type.Array(QuestionOptionSchema, {
    minItems: 2,
    maxItems: 12,
    description: "Available options (2-12)",
  }),
  recommendation: Type.Optional(
    Type.String({ description: "Value of the recommended option" }),
  ),
});

const MultiChoiceQuestionSchema = Type.Object({
  type: Type.Literal("multi-choice"),
  id: Type.String({ description: "Unique question identifier" }),
  header: Type.String({
    description: "Short label shown in tabs and summaries",
  }),
  prompt: Type.String({ description: "Full question text shown to the user" }),
  options: Type.Array(QuestionOptionSchema, {
    minItems: 2,
    maxItems: 12,
    description: "Available options (2-12)",
  }),
  recommendation: Type.Optional(
    Type.Array(Type.String(), { description: "Values of recommended options" }),
  ),
});

const TextQuestionSchema = Type.Object({
  type: Type.Literal("text"),
  id: Type.String({ description: "Unique question identifier" }),
  header: Type.String({
    description: "Short label shown in tabs and summaries",
  }),
  prompt: Type.String({ description: "Full question text shown to the user" }),
  recommendation: Type.Optional(
    Type.String({ description: "Prefilled editor value" }),
  ),
});

const QuestionSchema = Type.Union([
  SingleChoiceQuestionSchema,
  MultiChoiceQuestionSchema,
  TextQuestionSchema,
]);

export const QuestionnaireParamsSchema = Type.Object({
  questions: Type.Array(QuestionSchema, {
    minItems: 1,
    maxItems: 10,
    description: "1-10 questions to ask the user",
  }),
});
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/core/schema.ts
git commit -m "feat: add TypeBox parameter schemas for questionnaire tool"
```

---

### Task 3: Validation

**Files:**

- Create: `src/core/validate.ts`
- Create: `tests/core/validate.test.ts`

- [ ] **Step 1: Write the test file `tests/core/validate.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type { QuestionInput } from "../../src/core/types.ts";
import { validateQuestions } from "../../src/core/validate.ts";

function choiceQ(
  overrides: Partial<QuestionInput & { type: "single-choice" }> = {},
): QuestionInput {
  return {
    type: "single-choice",
    id: "q1",
    header: "Q1",
    prompt: "Pick one",
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
    ...overrides,
  };
}

function multiQ(
  overrides: Partial<QuestionInput & { type: "multi-choice" }> = {},
): QuestionInput {
  return {
    type: "multi-choice",
    id: "q1",
    header: "Q1",
    prompt: "Pick many",
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
    ...overrides,
  };
}

function textQ(
  overrides: Partial<QuestionInput & { type: "text" }> = {},
): QuestionInput {
  return {
    type: "text",
    id: "q1",
    header: "Q1",
    prompt: "Type something",
    ...overrides,
  };
}

describe("validateQuestions", () => {
  it("accepts a valid single choice question", () => {
    const result = validateQuestions([choiceQ()]);
    expect(result).toEqual({ valid: true });
  });

  it("accepts a valid multi-choice question", () => {
    const result = validateQuestions([multiQ()]);
    expect(result).toEqual({ valid: true });
  });

  it("accepts a valid text question", () => {
    const result = validateQuestions([textQ()]);
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
    const qs = Array.from({ length: 11 }, (_, i) => choiceQ({ id: `q${i}` }));
    const result = validateQuestions(qs);
    expect(result).toEqual({
      valid: false,
      error: "Questionnaire supports at most 10 questions.",
    });
  });

  it("rejects duplicate question ids", () => {
    const result = validateQuestions([
      choiceQ({ id: "dup" }),
      textQ({ id: "dup" }),
    ]);
    expect(result).toEqual({
      valid: false,
      error: 'Duplicate question id: "dup".',
    });
  });

  it("rejects empty question id", () => {
    const result = validateQuestions([choiceQ({ id: "  " })]);
    expect(result).toEqual({
      valid: false,
      error: "Question 1 has an empty id.",
    });
  });

  it("rejects empty question header", () => {
    const result = validateQuestions([choiceQ({ header: "" })]);
    expect(result).toEqual({
      valid: false,
      error: 'Question "q1" has an empty header.',
    });
  });

  it("rejects empty question prompt", () => {
    const result = validateQuestions([choiceQ({ prompt: "  " })]);
    expect(result).toEqual({
      valid: false,
      error: 'Question "q1" has an empty prompt.',
    });
  });

  it("rejects choice with fewer than 2 options", () => {
    const result = validateQuestions([
      choiceQ({ options: [{ value: "a", label: "A" }] }),
    ]);
    expect(result).toEqual({
      valid: false,
      error: 'Question "q1" must have 2-12 options.',
    });
  });

  it("rejects choice with more than 12 options", () => {
    const options = Array.from({ length: 13 }, (_, i) => ({
      value: `v${i}`,
      label: `L${i}`,
    }));
    const result = validateQuestions([choiceQ({ options })]);
    expect(result).toEqual({
      valid: false,
      error: 'Question "q1" must have 2-12 options.',
    });
  });

  it("rejects duplicate option values", () => {
    const result = validateQuestions([
      choiceQ({
        options: [
          { value: "same", label: "A" },
          { value: "same", label: "B" },
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
      choiceQ({
        options: [
          { value: "", label: "A" },
          { value: "b", label: "B" },
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
      choiceQ({
        options: [
          { value: "a", label: "  " },
          { value: "b", label: "B" },
        ],
      }),
    ]);
    expect(result).toEqual({
      valid: false,
      error: 'Question "q1" has an option with an empty label.',
    });
  });

  it("rejects choice recommendation not matching any option", () => {
    const result = validateQuestions([choiceQ({ recommendation: "nope" })]);
    expect(result).toEqual({
      valid: false,
      error:
        'Question "q1" recommendation "nope" does not match any option value.',
    });
  });

  it("accepts choice with valid recommendation", () => {
    const result = validateQuestions([choiceQ({ recommendation: "a" })]);
    expect(result).toEqual({ valid: true });
  });

  it("rejects multi-choice recommendation not matching any option", () => {
    const result = validateQuestions([
      multiQ({ recommendation: ["a", "nope"] }),
    ]);
    expect(result).toEqual({
      valid: false,
      error:
        'Question "q1" recommendation "nope" does not match any option value.',
    });
  });

  it("does not validate recommendation for text questions", () => {
    const result = validateQuestions([textQ({ recommendation: "anything" })]);
    expect(result).toEqual({ valid: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/core/validate.test.ts`
Expected: FAIL (module `../../src/core/validate.ts` not found)

- [ ] **Step 3: Write `src/core/validate.ts`**

```ts
import type { QuestionInput } from "./types.ts";

type ValidationResult = { valid: true } | { valid: false; error: string };

export function validateQuestions(
  questions: QuestionInput[],
): ValidationResult {
  if (questions.length === 0) {
    return {
      valid: false,
      error: "Questionnaire must include at least 1 question.",
    };
  }
  if (questions.length > 10) {
    return {
      valid: false,
      error: "Questionnaire supports at most 10 questions.",
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

    if (q.type === "single-choice" || q.type === "multi-choice") {
      if (q.options.length < 2 || q.options.length > 12) {
        return {
          valid: false,
          error: `Question "${trimmedId}" must have 2-12 options.`,
        };
      }

      const valueSet = new Set<string>();
      for (const opt of q.options) {
        const trimmedValue = opt.value.trim();
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

      const optionValues = new Set(q.options.map((o) => o.value.trim()));

      if (q.type === "single-choice" && q.recommendation !== undefined) {
        if (!optionValues.has(q.recommendation.trim())) {
          return {
            valid: false,
            error: `Question "${trimmedId}" recommendation "${q.recommendation.trim()}" does not match any option value.`,
          };
        }
      }

      if (q.type === "multi-choice" && q.recommendation !== undefined) {
        for (const rec of q.recommendation) {
          if (!optionValues.has(rec.trim())) {
            return {
              valid: false,
              error: `Question "${trimmedId}" recommendation "${rec.trim()}" does not match any option value.`,
            };
          }
        }
      }
    }
  }

  return { valid: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/core/validate.test.ts`
Expected: PASS (all tests green)

- [ ] **Step 5: Commit**

```bash
git add src/core/validate.ts tests/core/validate.test.ts
git commit -m "feat: add strict validation for questionnaire params"
```

---

### Task 4: Normalization

**Files:**

- Create: `src/core/normalize.ts`
- Create: `tests/core/normalize.test.ts`

- [ ] **Step 1: Write the test file `tests/core/normalize.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type { QuestionInput } from "../../src/core/types.ts";
import { normalizeQuestions } from "../../src/core/normalize.ts";

describe("normalizeQuestions", () => {
  it("trims id, header, prompt on choice questions", () => {
    const input: QuestionInput[] = [
      {
        type: "single-choice",
        id: "  scope  ",
        header: "  Scope  ",
        prompt: "  Pick one  ",
        options: [
          { value: " a ", label: " A ", description: " desc " },
          { value: "b", label: "B" },
        ],
      },
    ];
    const result = normalizeQuestions(input);
    expect(result[0].id).toBe("scope");
    expect(result[0].header).toBe("Scope");
    expect(result[0].prompt).toBe("Pick one");
    if (result[0].type === "single-choice") {
      expect(result[0].options[0].value).toBe("a");
      expect(result[0].options[0].label).toBe("A");
      expect(result[0].options[0].description).toBe("desc");
    }
  });

  it("sets recommendation to null when not provided on choice", () => {
    const input: QuestionInput[] = [
      {
        type: "single-choice",
        id: "q1",
        header: "Q1",
        prompt: "Pick",
        options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ],
      },
    ];
    const result = normalizeQuestions(input);
    if (result[0].type === "single-choice") {
      expect(result[0].recommendation).toBeNull();
    }
  });

  it("preserves recommendation value on choice when provided", () => {
    const input: QuestionInput[] = [
      {
        type: "single-choice",
        id: "q1",
        header: "Q1",
        prompt: "Pick",
        options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ],
        recommendation: "a",
      },
    ];
    const result = normalizeQuestions(input);
    if (result[0].type === "single-choice") {
      expect(result[0].recommendation).toBe("a");
    }
  });

  it("defaults multi-choice recommendation to empty array", () => {
    const input: QuestionInput[] = [
      {
        type: "multi-choice",
        id: "q1",
        header: "Q1",
        prompt: "Pick",
        options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ],
      },
    ];
    const result = normalizeQuestions(input);
    if (result[0].type === "multi-choice") {
      expect(result[0].recommendation).toEqual([]);
    }
  });

  it("normalizes text question with recommendation", () => {
    const input: QuestionInput[] = [
      {
        type: "text",
        id: "notes",
        header: "Notes",
        prompt: "Type something",
        recommendation: "  default  ",
      },
    ];
    const result = normalizeQuestions(input);
    if (result[0].type === "text") {
      expect(result[0].recommendation).toBe("default");
    }
  });

  it("sets text recommendation to null when not provided", () => {
    const input: QuestionInput[] = [
      { type: "text", id: "notes", header: "Notes", prompt: "Type" },
    ];
    const result = normalizeQuestions(input);
    if (result[0].type === "text") {
      expect(result[0].recommendation).toBeNull();
    }
  });

  it("strips undefined descriptions from options", () => {
    const input: QuestionInput[] = [
      {
        type: "single-choice",
        id: "q1",
        header: "Q1",
        prompt: "Pick",
        options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ],
      },
    ];
    const result = normalizeQuestions(input);
    if (result[0].type === "single-choice") {
      expect(result[0].options[0].description).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/core/normalize.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Write `src/core/normalize.ts`**

```ts
import type {
  NormalizedSingleChoiceQuestion,
  NormalizedMultiChoiceQuestion,
  NormalizedQuestion,
  NormalizedTextQuestion,
  QuestionInput,
  QuestionOption,
} from "./types.ts";

function normalizeOptions(options: QuestionOption[]): QuestionOption[] {
  return options.map((opt) => ({
    value: opt.value.trim(),
    label: opt.label.trim(),
    description: opt.description?.trim() || undefined,
  }));
}

function normalizeSingleChoice(
  q: QuestionInput & { type: "single-choice" },
): NormalizedSingleChoiceQuestion {
  return {
    type: "single-choice",
    id: q.id.trim(),
    header: q.header.trim(),
    prompt: q.prompt.trim(),
    options: normalizeOptions(q.options),
    recommendation: q.recommendation?.trim() ?? null,
  };
}

function normalizeMultiChoice(
  q: QuestionInput & { type: "multi-choice" },
): NormalizedMultiChoiceQuestion {
  return {
    type: "multi-choice",
    id: q.id.trim(),
    header: q.header.trim(),
    prompt: q.prompt.trim(),
    options: normalizeOptions(q.options),
    recommendation: q.recommendation?.map((r) => r.trim()) ?? [],
  };
}

function normalizeText(
  q: QuestionInput & { type: "text" },
): NormalizedTextQuestion {
  return {
    type: "text",
    id: q.id.trim(),
    header: q.header.trim(),
    prompt: q.prompt.trim(),
    recommendation: q.recommendation?.trim() || null,
  };
}

export function normalizeQuestions(
  questions: QuestionInput[],
): NormalizedQuestion[] {
  return questions.map((q) => {
    switch (q.type) {
      case "single-choice":
        return normalizeSingleChoice(q);
      case "multi-choice":
        return normalizeMultiChoice(q);
      case "text":
        return normalizeText(q);
    }
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/core/normalize.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/normalize.ts tests/core/normalize.test.ts
git commit -m "feat: add normalization for questionnaire params"
```

---

### Task 5: Formatting

**Files:**

- Create: `src/core/format.ts`
- Create: `tests/core/format.test.ts`

- [ ] **Step 1: Write the test file `tests/core/format.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type {
  SingleChoiceAnswer,
  MultiChoiceAnswer,
  NormalizedAnswer,
  NormalizedQuestion,
  QuestionnaireResult,
  TextAnswer,
} from "../../src/core/types.ts";
import {
  formatAnswerForRender,
  formatContentSummary,
  formatModelLine,
} from "../../src/core/format.ts";

const choiceQ: NormalizedQuestion = {
  type: "single-choice",
  id: "scope",
  header: "Scope",
  prompt: "Pick scope",
  options: [
    { value: "small", label: "Small" },
    { value: "large", label: "Large" },
  ],
  recommendation: null,
};

const multiQ: NormalizedQuestion = {
  type: "multi-choice",
  id: "features",
  header: "Features",
  prompt: "Pick features",
  options: [
    { value: "auth", label: "Auth" },
    { value: "log", label: "Logging" },
    { value: "cache", label: "Caching" },
  ],
  recommendation: [],
};

const textQ: NormalizedQuestion = {
  type: "text",
  id: "notes",
  header: "Notes",
  prompt: "Any notes?",
  recommendation: null,
};

describe("formatModelLine", () => {
  it("formats choice answer", () => {
    const answer: SingleChoiceAnswer = {
      type: "single-choice",
      questionId: "scope",
      value: "small",
      label: "Small",
    };
    expect(formatModelLine(choiceQ, answer)).toBe(
      "Scope: user selected: 1. Small",
    );
  });

  it("formats multi-choice answer", () => {
    const answer: MultiChoiceAnswer = {
      type: "multi-choice",
      questionId: "features",
      selected: [
        { value: "auth", label: "Auth" },
        { value: "cache", label: "Caching" },
      ],
    };
    expect(formatModelLine(multiQ, answer)).toBe(
      "Features: user selected: 1. Auth, 3. Caching",
    );
  });

  it("formats text answer", () => {
    const answer: TextAnswer = {
      type: "text",
      questionId: "notes",
      value: "Keep it simple",
    };
    expect(formatModelLine(textQ, answer)).toBe(
      'Notes: user wrote: "Keep it simple"',
    );
  });

  it("formats empty text answer", () => {
    const answer: TextAnswer = { type: "text", questionId: "notes", value: "" };
    expect(formatModelLine(textQ, answer)).toBe("Notes: (empty response)");
  });
});

describe("formatContentSummary", () => {
  it("returns cancelled message when cancelled", () => {
    const result: QuestionnaireResult = {
      questions: [],
      answers: [],
      cancelled: true,
    };
    expect(formatContentSummary(result)).toBe(
      "User cancelled the questionnaire",
    );
  });

  it("joins answer lines for submitted result", () => {
    const result: QuestionnaireResult = {
      questions: [choiceQ, textQ],
      answers: [
        {
          type: "single-choice",
          questionId: "scope",
          value: "small",
          label: "Small",
        },
        { type: "text", questionId: "notes", value: "ok" },
      ],
      cancelled: false,
    };
    expect(formatContentSummary(result)).toBe(
      'Scope: user selected: 1. Small\nNotes: user wrote: "ok"',
    );
  });
});

describe("formatAnswerForRender", () => {
  it("formats choice for display", () => {
    const answer: SingleChoiceAnswer = {
      type: "single-choice",
      questionId: "scope",
      value: "small",
      label: "Small",
    };
    expect(formatAnswerForRender(choiceQ, answer)).toBe("1. Small");
  });

  it("formats multi-choice for display", () => {
    const answer: MultiChoiceAnswer = {
      type: "multi-choice",
      questionId: "features",
      selected: [{ value: "auth", label: "Auth" }],
    };
    expect(formatAnswerForRender(multiQ, answer)).toBe("1. Auth");
  });

  it("formats text for display", () => {
    const answer: TextAnswer = {
      type: "text",
      questionId: "notes",
      value: "hello",
    };
    expect(formatAnswerForRender(textQ, answer)).toBe("(wrote) hello");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/core/format.test.ts`
Expected: FAIL

- [ ] **Step 3: Write `src/core/format.ts`**

```ts
import type {
  NormalizedAnswer,
  NormalizedQuestion,
  QuestionnaireResult,
} from "./types.ts";

function optionIndex(question: NormalizedQuestion, value: string): number {
  if (question.type === "text") return -1;
  return question.options.findIndex((o) => o.value === value) + 1;
}

export function formatModelLine(
  question: NormalizedQuestion,
  answer: NormalizedAnswer,
): string {
  switch (answer.type) {
    case "single-choice": {
      const idx = optionIndex(question, answer.value);
      return `${question.header}: user selected: ${idx}. ${answer.label}`;
    }
    case "multi-choice": {
      const parts = answer.selected.map((s) => {
        const idx = optionIndex(question, s.value);
        return `${idx}. ${s.label}`;
      });
      return `${question.header}: user selected: ${parts.join(", ")}`;
    }
    case "text": {
      if (!answer.value) {
        return `${question.header}: (empty response)`;
      }
      return `${question.header}: user wrote: "${answer.value}"`;
    }
  }
}

export function formatContentSummary(result: QuestionnaireResult): string {
  if (result.cancelled) {
    return "User cancelled the questionnaire";
  }
  return result.answers
    .map((answer) => {
      const question = result.questions.find((q) => q.id === answer.questionId);
      if (!question) return `${answer.questionId}: (unknown question)`;
      return formatModelLine(question, answer);
    })
    .join("\n");
}

export function formatAnswerForRender(
  question: NormalizedQuestion,
  answer: NormalizedAnswer,
): string {
  switch (answer.type) {
    case "single-choice": {
      const idx = optionIndex(question, answer.value);
      return `${idx}. ${answer.label}`;
    }
    case "multi-choice": {
      return answer.selected
        .map((s) => {
          const idx = optionIndex(question, s.value);
          return `${idx}. ${s.label}`;
        })
        .join(", ");
    }
    case "text": {
      return `(wrote) ${answer.value}`;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/core/format.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/format.ts tests/core/format.test.ts
git commit -m "feat: add answer formatting for model output and display"
```

---

### Task 6: Core barrel export

**Files:**

- Create: `src/core/index.ts`

- [ ] **Step 1: Write `src/core/index.ts`**

```ts
export { QuestionnaireParamsSchema } from "./schema.ts";
export type {
  SingleChoiceAnswer,
  MultiChoiceAnswer,
  NormalizedAnswer,
  NormalizedSingleChoiceQuestion,
  NormalizedMultiChoiceQuestion,
  NormalizedQuestion,
  NormalizedTextQuestion,
  QuestionInput,
  QuestionnaireResult,
  QuestionOption,
  SelectedOption,
  TextAnswer,
} from "./types.ts";
export { validateQuestions } from "./validate.ts";
export { normalizeQuestions } from "./normalize.ts";
export {
  formatContentSummary,
  formatAnswerForRender,
  formatModelLine,
} from "./format.ts";
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Run all core tests**

Run: `pnpm test -- tests/core/`
Expected: PASS (all tests in validate, normalize, format)

- [ ] **Step 4: Commit**

```bash
git add src/core/index.ts
git commit -m "feat: add core barrel export"
```

---

## Phase 2: TUI Layer (interactive rendering)

This phase builds the TUI components. After this phase the full questionnaire UI works end-to-end.

### Task 7: TUI helpers

**Files:**

- Create: `src/tui/helpers.ts`

- [ ] **Step 1: Write `src/tui/helpers.ts`**

```ts
import {
  truncateToWidth,
  visibleWidth,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";

export function pushWrapped(
  lines: string[],
  text: string,
  width: number,
): void {
  for (const line of wrapTextWithAnsi(text, Math.max(1, width))) {
    lines.push(truncateToWidth(line, width));
  }
}

export function pushWrappedWithPrefix(
  lines: string[],
  prefix: string,
  text: string,
  width: number,
): void {
  const prefixWidth = visibleWidth(prefix);
  const contentWidth = Math.max(1, width - prefixWidth);
  const wrapped = wrapTextWithAnsi(text, contentWidth);
  const continuation = " ".repeat(prefixWidth);

  for (let i = 0; i < wrapped.length; i++) {
    const p = i === 0 ? prefix : continuation;
    lines.push(truncateToWidth(`${p}${wrapped[i]}`, width));
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/tui/helpers.ts
git commit -m "feat: add shared TUI line-wrapping helpers"
```

---

### Task 8: Tab bar rendering

**Files:**

- Create: `src/tui/render-tabs.ts`
- Create: `tests/tui/render-tabs.test.ts`

- [ ] **Step 1: Write the test file `tests/tui/render-tabs.test.ts`**

These tests verify the tab bar logic without depending on pi-tui theme colors. We create a stub theme that passes text through unchanged.

```ts
import { describe, expect, it } from "vitest";
import type { NormalizedQuestion } from "../../src/core/types.ts";
import { renderTabBar } from "../../src/tui/render-tabs.ts";

const noopTheme = {
  fg: (_color: string, text: string) => text,
  bg: (_color: string, text: string) => `[${text}]`,
  bold: (text: string) => text,
};

const questions: NormalizedQuestion[] = [
  {
    type: "single-choice",
    id: "scope",
    header: "Scope",
    prompt: "Pick",
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
    recommendation: null,
  },
  {
    type: "text",
    id: "notes",
    header: "Notes",
    prompt: "Type",
    recommendation: null,
  },
];

describe("renderTabBar", () => {
  it("renders tab labels with answered/unanswered markers", () => {
    const answeredIds = new Set<string>();
    const lines = renderTabBar(questions, 0, answeredIds, noopTheme, 80);
    const joined = lines.join("");
    expect(joined).toContain("Scope");
    expect(joined).toContain("Notes");
    expect(joined).toContain("Review");
  });

  it("marks answered questions with filled marker", () => {
    const answeredIds = new Set(["scope"]);
    const lines = renderTabBar(questions, 0, answeredIds, noopTheme, 80);
    const joined = lines.join("");
    // Filled marker for answered
    expect(joined).toContain("\u25A0 Scope");
    // Empty marker for unanswered
    expect(joined).toContain("\u25A1 Notes");
  });

  it("highlights active tab with bg wrapper", () => {
    const answeredIds = new Set<string>();
    const lines = renderTabBar(questions, 0, answeredIds, noopTheme, 80);
    const joined = lines.join("");
    // Active tab (index 0 = Scope) gets bg wrap: [text]
    expect(joined).toContain("[ \u25A1 Scope ]");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/tui/render-tabs.test.ts`
Expected: FAIL

- [ ] **Step 3: Write `src/tui/render-tabs.ts`**

```ts
import type { NormalizedQuestion } from "../core/types.ts";

interface TabBarTheme {
  fg: (color: string, text: string) => string;
  bg: (color: string, text: string) => string;
  bold: (text: string) => string;
}

export function renderTabBar(
  questions: NormalizedQuestion[],
  activeTab: number,
  answeredIds: Set<string>,
  theme: TabBarTheme,
  _width: number,
): string[] {
  const reviewTabIndex = questions.length;
  const allAnswered = questions.every((q) => answeredIds.has(q.id));

  const tabs: string[] = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const answered = answeredIds.has(q.id);
    const marker = answered ? "\u25A0" : "\u25A1";
    const text = ` ${marker} ${q.header} `;
    if (i === activeTab) {
      tabs.push(theme.bg("selectedBg", theme.fg("text", text)));
    } else {
      tabs.push(theme.fg(answered ? "success" : "muted", text));
    }
  }

  const reviewMarker = allAnswered ? "\u2713" : "\u25A1";
  const reviewText = ` ${reviewMarker} Review `;
  if (activeTab === reviewTabIndex) {
    tabs.push(theme.bg("selectedBg", theme.fg("text", reviewText)));
  } else {
    tabs.push(theme.fg(allAnswered ? "success" : "muted", reviewText));
  }

  return [tabs.join(" "), ""];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/tui/render-tabs.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tui/render-tabs.ts tests/tui/render-tabs.test.ts
git commit -m "feat: add tab bar rendering"
```

---

### Task 9: Question rendering

**Files:**

- Create: `src/tui/render-question.ts`
- Create: `tests/tui/render-question.test.ts`

- [ ] **Step 1: Write the test file `tests/tui/render-question.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type {
  NormalizedSingleChoiceQuestion,
  NormalizedMultiChoiceQuestion,
  NormalizedTextQuestion,
} from "../../src/core/types.ts";
import {
  renderChoiceQuestion,
  renderMultiChoiceQuestion,
  renderTextQuestion,
} from "../../src/tui/render-question.ts";

const noopTheme = {
  fg: (_color: string, text: string) => text,
  bg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};

describe("renderChoiceQuestion", () => {
  const question: NormalizedSingleChoiceQuestion = {
    type: "single-choice",
    id: "scope",
    header: "Scope",
    prompt: "What scope?",
    options: [
      { value: "small", label: "Small" },
      { value: "large", label: "Large", description: "Very large" },
    ],
    recommendation: "small",
  };

  it("renders prompt and all options", () => {
    const lines = renderChoiceQuestion(question, 0, noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("What scope?");
    expect(text).toContain("1. Small");
    expect(text).toContain("2. Large");
  });

  it("shows cursor indicator on focused option", () => {
    const lines = renderChoiceQuestion(question, 0, noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("> ");
  });

  it("shows recommendation suffix", () => {
    const lines = renderChoiceQuestion(question, 0, noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("[recommended]");
  });

  it("shows option description", () => {
    const lines = renderChoiceQuestion(question, 1, noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("Very large");
  });
});

describe("renderMultiChoiceQuestion", () => {
  const question: NormalizedMultiChoiceQuestion = {
    type: "multi-choice",
    id: "features",
    header: "Features",
    prompt: "Which features?",
    options: [
      { value: "auth", label: "Auth" },
      { value: "log", label: "Logging" },
    ],
    recommendation: ["auth"],
  };

  it("renders checkboxes", () => {
    const checked = new Set(["auth"]);
    const lines = renderMultiChoiceQuestion(
      question,
      0,
      checked,
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain("[x] 1. Auth");
    expect(text).toContain("[ ] 2. Logging");
  });

  it("shows recommendation suffix on recommended options", () => {
    const checked = new Set<string>();
    const lines = renderMultiChoiceQuestion(
      question,
      0,
      checked,
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain("[recommended]");
  });
});

describe("renderTextQuestion", () => {
  const question: NormalizedTextQuestion = {
    type: "text",
    id: "notes",
    header: "Notes",
    prompt: "Any notes?",
    recommendation: null,
  };

  it("renders prompt", () => {
    const lines = renderTextQuestion(question, [], noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("Any notes?");
  });

  it("includes editor lines", () => {
    const editorLines = ["| some text |"];
    const lines = renderTextQuestion(question, editorLines, noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("| some text |");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/tui/render-question.test.ts`
Expected: FAIL

- [ ] **Step 3: Write `src/tui/render-question.ts`**

```ts
import type {
  NormalizedSingleChoiceQuestion,
  NormalizedMultiChoiceQuestion,
  NormalizedTextQuestion,
} from "../core/types.ts";
import { pushWrapped, pushWrappedWithPrefix } from "./helpers.ts";

interface QuestionTheme {
  fg: (color: string, text: string) => string;
  bg: (color: string, text: string) => string;
  bold: (text: string) => string;
}

export function renderChoiceQuestion(
  question: NormalizedSingleChoiceQuestion,
  cursor: number,
  theme: QuestionTheme,
  width: number,
): string[] {
  const lines: string[] = [];

  pushWrapped(lines, theme.fg("text", question.prompt), width);
  lines.push("");

  for (let i = 0; i < question.options.length; i++) {
    const opt = question.options[i];
    const isCursor = i === cursor;
    const prefix = isCursor ? theme.fg("accent", "> ") : "  ";
    const recSuffix =
      question.recommendation === opt.value ? " [recommended]" : "";
    const label = `${i + 1}. ${opt.label}${recSuffix}`;
    const color = isCursor ? "accent" : "text";

    pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
    if (opt.description) {
      pushWrappedWithPrefix(
        lines,
        "     ",
        theme.fg("muted", opt.description),
        width,
      );
    }
  }

  return lines;
}

export function renderMultiChoiceQuestion(
  question: NormalizedMultiChoiceQuestion,
  cursor: number,
  checked: Set<string>,
  theme: QuestionTheme,
  width: number,
): string[] {
  const lines: string[] = [];

  pushWrapped(lines, theme.fg("text", question.prompt), width);
  lines.push("");

  for (let i = 0; i < question.options.length; i++) {
    const opt = question.options[i];
    const isCursor = i === cursor;
    const isChecked = checked.has(opt.value);
    const prefix = isCursor ? theme.fg("accent", "> ") : "  ";
    const marker = isChecked ? "[x]" : "[ ]";
    const recSuffix = question.recommendation.includes(opt.value)
      ? " [recommended]"
      : "";
    const label = `${marker} ${i + 1}. ${opt.label}${recSuffix}`;
    const color = isCursor ? "accent" : isChecked ? "success" : "text";

    pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
    if (opt.description) {
      pushWrappedWithPrefix(
        lines,
        "       ",
        theme.fg("muted", opt.description),
        width,
      );
    }
  }

  return lines;
}

export function renderTextQuestion(
  question: NormalizedTextQuestion,
  editorLines: string[],
  theme: QuestionTheme,
  width: number,
): string[] {
  const lines: string[] = [];

  pushWrapped(lines, theme.fg("text", question.prompt), width);
  lines.push("");

  for (const line of editorLines) {
    lines.push(` ${line}`);
  }

  lines.push("");
  pushWrapped(
    lines,
    theme.fg("dim", "Enter submit | Tab/Shift+Tab navigate tabs"),
    width,
  );

  return lines;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/tui/render-question.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tui/render-question.ts tests/tui/render-question.test.ts
git commit -m "feat: add question rendering for choice, multi-choice, and text"
```

---

### Task 10: Review screen rendering

**Files:**

- Create: `src/tui/render-review.ts`
- Create: `tests/tui/render-review.test.ts`

- [ ] **Step 1: Write the test file `tests/tui/render-review.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type {
  NormalizedAnswer,
  NormalizedQuestion,
} from "../../src/core/types.ts";
import { renderReviewScreen } from "../../src/tui/render-review.ts";

const noopTheme = {
  fg: (_color: string, text: string) => text,
  bg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};

const questions: NormalizedQuestion[] = [
  {
    type: "single-choice",
    id: "scope",
    header: "Scope",
    prompt: "Pick",
    options: [
      { value: "small", label: "Small" },
      { value: "large", label: "Large" },
    ],
    recommendation: null,
  },
  {
    type: "text",
    id: "notes",
    header: "Notes",
    prompt: "Type",
    recommendation: null,
  },
];

describe("renderReviewScreen", () => {
  it("shows answered and unanswered rows", () => {
    const answers = new Map<string, NormalizedAnswer>([
      [
        "scope",
        {
          type: "single-choice",
          questionId: "scope",
          value: "small",
          label: "Small",
        },
      ],
    ]);
    const lines = renderReviewScreen(questions, answers, 0, noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("Scope");
    expect(text).toContain("Small");
    expect(text).toContain("(unanswered)");
  });

  it("shows submit prompt when all answered", () => {
    const answers = new Map<string, NormalizedAnswer>([
      [
        "scope",
        {
          type: "single-choice",
          questionId: "scope",
          value: "small",
          label: "Small",
        },
      ],
      ["notes", { type: "text", questionId: "notes", value: "ok" }],
    ]);
    const lines = renderReviewScreen(questions, answers, 0, noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("Enter submit");
  });

  it("shows warning when not all answered", () => {
    const answers = new Map<string, NormalizedAnswer>();
    const lines = renderReviewScreen(questions, answers, 0, noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("Answer all questions");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/tui/render-review.test.ts`
Expected: FAIL

- [ ] **Step 3: Write `src/tui/render-review.ts`**

```ts
import type { NormalizedAnswer, NormalizedQuestion } from "../core/types.ts";
import { formatAnswerForRender } from "../core/format.ts";
import { pushWrapped, pushWrappedWithPrefix } from "./helpers.ts";

interface ReviewTheme {
  fg: (color: string, text: string) => string;
  bg: (color: string, text: string) => string;
  bold: (text: string) => string;
}

export function renderReviewScreen(
  questions: NormalizedQuestion[],
  answers: Map<string, NormalizedAnswer>,
  cursor: number,
  theme: ReviewTheme,
  width: number,
): string[] {
  const lines: string[] = [];
  const allAnswered = questions.every((q) => answers.has(q.id));

  pushWrapped(lines, theme.fg("accent", theme.bold("Review answers")), width);
  lines.push("");

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const answer = answers.get(q.id);
    const isCursor = i === cursor;
    const prefix = isCursor ? theme.fg("accent", "> ") : "  ";
    const marker = answer
      ? theme.fg("success", "\u25A0")
      : theme.fg("warning", "\u25A1");
    const value = answer ? formatAnswerForRender(q, answer) : "(unanswered)";
    const valueColor = answer ? "text" : "muted";

    pushWrappedWithPrefix(
      lines,
      prefix,
      `${marker} ${theme.fg("accent", `${q.header}:`)} ${theme.fg(valueColor, value)}`,
      width,
    );
  }

  lines.push("");
  if (allAnswered) {
    pushWrapped(
      lines,
      theme.fg("success", "Enter submit | Space edit | Esc cancel"),
      width,
    );
  } else {
    pushWrapped(
      lines,
      theme.fg("warning", "Answer all questions before submitting."),
      width,
    );
    pushWrapped(lines, theme.fg("dim", "Space edit | Esc cancel"), width);
  }

  return lines;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/tui/render-review.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tui/render-review.ts tests/tui/render-review.test.ts
git commit -m "feat: add review screen rendering"
```

---

### Task 11: Questionnaire UI orchestrator

**Files:**

- Create: `src/tui/questionnaire-ui.ts`

This is the main TUI entry point: it creates the `ctx.ui.custom()` closure, owns all mutable state, routes input, and delegates rendering to the render functions from Tasks 8-10.

- [ ] **Step 1: Write `src/tui/questionnaire-ui.ts`**

```ts
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  Editor,
  type EditorTheme,
  Key,
  matchesKey,
} from "@earendil-works/pi-tui";
import type {
  NormalizedAnswer,
  NormalizedQuestion,
  QuestionnaireResult,
} from "../core/types.ts";
import { renderTabBar } from "./render-tabs.ts";
import {
  renderChoiceQuestion,
  renderMultiChoiceQuestion,
  renderTextQuestion,
} from "./render-question.ts";
import { renderReviewScreen } from "./render-review.ts";
import { pushWrapped } from "./helpers.ts";

export async function runQuestionnaireUI(
  ctx: Pick<ExtensionContext, "ui">,
  questions: NormalizedQuestion[],
): Promise<QuestionnaireResult> {
  const reviewTabIndex = questions.length;

  return ctx.ui.custom<QuestionnaireResult>((tui, theme, _kb, done) => {
    // State
    let activeTab = 0;
    let optionCursor = 0;
    const answers = new Map<string, NormalizedAnswer>();
    const multiChecked = new Map<string, Set<string>>();
    const textValues = new Map<string, string>();
    let reviewCursor = 0;
    let cachedLines: string[] | undefined;

    // Initialize multi-checked sets and text values from recommendations
    for (const q of questions) {
      if (q.type === "multi-choice") {
        multiChecked.set(q.id, new Set(q.recommendation));
      }
      if (q.type === "text" && q.recommendation) {
        textValues.set(q.id, q.recommendation);
      }
    }

    // Editor for text questions
    const editorTheme: EditorTheme = {
      borderColor: (s) => theme.fg("accent", s),
      selectList: {
        selectedPrefix: (t) => theme.fg("accent", t),
        selectedText: (t) => theme.fg("accent", t),
        description: (t) => theme.fg("muted", t),
        scrollInfo: (t) => theme.fg("dim", t),
        noMatch: (t) => theme.fg("warning", t),
      },
    };
    const editor = new Editor(tui, editorTheme);

    editor.onSubmit = (value) => {
      const q = currentQuestion();
      if (!q || q.type !== "text") return;
      const trimmed = value.trim();
      textValues.set(q.id, trimmed);
      answers.set(q.id, { type: "text", questionId: q.id, value: trimmed });
      invalidate();
    };

    // Helpers
    function invalidate() {
      cachedLines = undefined;
      tui.requestRender();
    }

    function currentQuestion(): NormalizedQuestion | undefined {
      if (activeTab >= questions.length) return undefined;
      return questions[activeTab];
    }

    function answeredIds(): Set<string> {
      return new Set(answers.keys());
    }

    function allAnswered(): boolean {
      return questions.every((q) => answers.has(q.id));
    }

    function switchTab(nextTab: number) {
      activeTab = nextTab;
      optionCursor = 0;
      reviewCursor = 0;

      // Sync editor with text value for the new tab
      const q = currentQuestion();
      if (q?.type === "text") {
        editor.setText(textValues.get(q.id) ?? "");
      }

      invalidate();
    }

    function finalize(cancelled: boolean) {
      done({
        questions,
        answers: questions
          .map((q) => answers.get(q.id))
          .filter((a): a is NormalizedAnswer => a !== undefined),
        cancelled,
      });
    }

    // Input handling
    function handleTabNavigation(data: string): boolean {
      const totalTabs = questions.length + 1;
      if (matchesKey(data, Key.tab) || matchesKey(data, Key.right)) {
        switchTab((activeTab + 1) % totalTabs);
        return true;
      }
      if (matchesKey(data, Key.shift("tab")) || matchesKey(data, Key.left)) {
        switchTab((activeTab - 1 + totalTabs) % totalTabs);
        return true;
      }
      return false;
    }

    function handleChoiceInput(
      data: string,
      q: NormalizedQuestion & { type: "single-choice" },
    ) {
      const optCount = q.options.length;

      if (matchesKey(data, Key.up)) {
        optionCursor = Math.max(0, optionCursor - 1);
        invalidate();
        return;
      }
      if (matchesKey(data, Key.down)) {
        optionCursor = Math.min(optCount - 1, optionCursor + 1);
        invalidate();
        return;
      }
      if (matchesKey(data, Key.enter) || matchesKey(data, Key.space)) {
        const opt = q.options[optionCursor];
        answers.set(q.id, {
          type: "single-choice",
          questionId: q.id,
          value: opt.value,
          label: opt.label,
        });
        invalidate();
        return;
      }
    }

    function handleMultiChoiceInput(
      data: string,
      q: NormalizedQuestion & { type: "multi-choice" },
    ) {
      const optCount = q.options.length;
      const checked = multiChecked.get(q.id) ?? new Set();

      if (matchesKey(data, Key.up)) {
        optionCursor = Math.max(0, optionCursor - 1);
        invalidate();
        return;
      }
      if (matchesKey(data, Key.down)) {
        optionCursor = Math.min(optCount - 1, optionCursor + 1);
        invalidate();
        return;
      }
      if (matchesKey(data, Key.space)) {
        const opt = q.options[optionCursor];
        if (checked.has(opt.value)) {
          checked.delete(opt.value);
        } else {
          checked.add(opt.value);
        }
        multiChecked.set(q.id, checked);
        // Sync answer
        const selected = q.options
          .filter((o) => checked.has(o.value))
          .map((o) => ({ value: o.value, label: o.label }));
        if (selected.length > 0) {
          answers.set(q.id, {
            type: "multi-choice",
            questionId: q.id,
            selected,
          });
        } else {
          answers.delete(q.id);
        }
        invalidate();
        return;
      }
      if (matchesKey(data, Key.enter)) {
        // Confirm current selection (no-op if nothing selected, answer already synced)
        invalidate();
        return;
      }
    }

    function handleTextInput(data: string) {
      // Tab navigation is intercepted first (before editor)
      // Esc cancels the questionnaire
      if (matchesKey(data, Key.escape)) {
        finalize(true);
        return;
      }
      // Forward everything else to the editor
      editor.handleInput(data);
      invalidate();
    }

    function handleReviewInput(data: string) {
      if (matchesKey(data, Key.up)) {
        reviewCursor = Math.max(0, reviewCursor - 1);
        invalidate();
        return;
      }
      if (matchesKey(data, Key.down)) {
        reviewCursor = Math.min(questions.length - 1, reviewCursor + 1);
        invalidate();
        return;
      }
      if (matchesKey(data, Key.space) || matchesKey(data, Key.enter)) {
        // If on a question row, jump to that question
        if (reviewCursor < questions.length) {
          // But if all answered and Enter, submit
          if (matchesKey(data, Key.enter) && allAnswered()) {
            finalize(false);
            return;
          }
          switchTab(reviewCursor);
          return;
        }
      }
    }

    function handleInput(data: string) {
      // Global: Esc cancels (except text questions handle their own Esc)
      const q = currentQuestion();
      if (q?.type !== "text" && matchesKey(data, Key.escape)) {
        finalize(true);
        return;
      }

      // Tab navigation (intercepted before everything, including text editor)
      if (handleTabNavigation(data)) return;

      // Question-specific handling
      if (activeTab === reviewTabIndex) {
        handleReviewInput(data);
        return;
      }

      if (!q) return;

      switch (q.type) {
        case "single-choice":
          handleChoiceInput(data, q);
          return;
        case "multi-choice":
          handleMultiChoiceInput(data, q);
          return;
        case "text":
          handleTextInput(data);
          return;
      }
    }

    // Rendering
    function render(width: number): string[] {
      if (cachedLines) return cachedLines;

      const lines: string[] = [];
      const renderWidth = Math.max(1, width);

      lines.push(theme.fg("accent", "\u2500".repeat(renderWidth)));

      // Tab bar
      lines.push(
        ...renderTabBar(
          questions,
          activeTab,
          answeredIds(),
          theme,
          renderWidth,
        ),
      );

      // Content
      if (activeTab === reviewTabIndex) {
        lines.push(
          ...renderReviewScreen(
            questions,
            answers,
            reviewCursor,
            theme,
            renderWidth,
          ),
        );
      } else {
        const q = currentQuestion();
        if (q) {
          switch (q.type) {
            case "single-choice":
              lines.push(
                ...renderChoiceQuestion(q, optionCursor, theme, renderWidth),
              );
              break;
            case "multi-choice": {
              const checked = multiChecked.get(q.id) ?? new Set();
              lines.push(
                ...renderMultiChoiceQuestion(
                  q,
                  optionCursor,
                  checked,
                  theme,
                  renderWidth,
                ),
              );
              break;
            }
            case "text": {
              const editorLines = editor.render(Math.max(1, renderWidth - 2));
              lines.push(
                ...renderTextQuestion(q, editorLines, theme, renderWidth),
              );
              break;
            }
          }
        }
      }

      // Hint bar (non-text questions only, text question hint is in renderTextQuestion)
      const q = currentQuestion();
      if (q?.type !== "text") {
        lines.push("");
        const hint =
          activeTab === reviewTabIndex
            ? "Tab navigate | Enter submit | Space edit | Esc cancel"
            : q?.type === "multi-choice"
              ? "Tab navigate | Up/Down move | Space toggle | Esc cancel"
              : "Tab navigate | Up/Down move | Space/Enter select | Esc cancel";
        pushWrapped(lines, theme.fg("dim", hint), renderWidth);
      }

      lines.push(theme.fg("accent", "\u2500".repeat(renderWidth)));

      cachedLines = lines;
      return lines;
    }

    return {
      render,
      invalidate: () => {
        cachedLines = undefined;
      },
      handleInput,
    };
  });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/tui/questionnaire-ui.ts
git commit -m "feat: add questionnaire UI orchestrator with state and input routing"
```

---

### Task 12: TUI barrel export

**Files:**

- Create: `src/tui/index.ts`

- [ ] **Step 1: Write `src/tui/index.ts`**

```ts
export { runQuestionnaireUI } from "./questionnaire-ui.ts";
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/tui/index.ts
git commit -m "feat: add TUI barrel export"
```

---

## Phase 3: Extension Entry Point

This phase wires core + TUI into the tool registration. After this phase the extension is fully functional.

### Task 13: Extension entry point

**Files:**

- Modify: `src/index.ts`
- Modify: `tests/index.test.ts`

- [ ] **Step 1: Update `tests/index.test.ts`**

Replace the existing test with one that verifies the extension registers a tool:

```ts
import { describe, expect, it, vi } from "vitest";
import createExtension from "../src/index.ts";

describe("questionnaire extension", () => {
  it("exports a function", () => {
    expect(typeof createExtension).toBe("function");
  });

  it("registers a tool named 'questionnaire'", () => {
    const registerTool = vi.fn();
    const pi = { registerTool } as any;
    createExtension(pi);
    expect(registerTool).toHaveBeenCalledTimes(1);
    expect(registerTool.mock.calls[0][0].name).toBe("questionnaire");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/index.test.ts`
Expected: FAIL (registerTool not called because `src/index.ts` is still a stub)

- [ ] **Step 3: Write the full `src/index.ts`**

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import {
  QuestionnaireParamsSchema,
  validateQuestions,
  normalizeQuestions,
  formatContentSummary,
  formatAnswerForRender,
} from "./core/index.ts";
import type { QuestionInput, QuestionnaireResult } from "./core/index.ts";
import { runQuestionnaireUI } from "./tui/index.ts";

function errorResult(error: string): {
  content: { type: "text"; text: string }[];
  details: QuestionnaireResult;
  isError: true;
} {
  return {
    content: [{ type: "text", text: `Error: ${error}` }],
    details: { questions: [], answers: [], cancelled: true, error },
    isError: true,
  };
}

export default function createExtension(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "questionnaire",
    label: "Questionnaire",
    description:
      "Ask the user 1-10 structured questions. Supports single-choice, multi-choice, and free-text questions. Use for clarifying requirements, getting preferences, or confirming decisions.",
    promptSnippet:
      "Use this tool to collect structured user decisions before proceeding with implementation or planning.",
    promptGuidelines: [
      "Batch related clarification questions into one questionnaire call.",
      "Prefer this tool over guessing when requirements or preferences are unclear.",
      "Use choice/multi-choice when options are enumerable; use text for open-ended input.",
      "Place the recommended option's value in the recommendation field instead of modifying the label.",
      "Keep questions to 1-5 per call unless a decision genuinely requires more context.",
    ],
    parameters: QuestionnaireParamsSchema,

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const validation = validateQuestions(params.questions);
      if (!validation.valid) {
        return errorResult(validation.error);
      }

      const normalized = normalizeQuestions(params.questions);

      if (!ctx.hasUI) {
        return errorResult("Questionnaire requires interactive mode.");
      }

      const result = await runQuestionnaireUI(ctx, normalized);

      return {
        content: [{ type: "text", text: formatContentSummary(result) }],
        details: result,
      };
    },

    renderCall(args, theme, _context) {
      const qs = (args.questions as QuestionInput[]) || [];
      const count = qs.length;
      const labels = qs.map((q) => q.header || q.id).join(", ");
      let text = theme.fg("toolTitle", theme.bold("questionnaire "));
      text += theme.fg("muted", `${count} question${count !== 1 ? "s" : ""}`);
      if (labels) {
        text += theme.fg("dim", ` (${labels})`);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme, _context) {
      const details = result.details as QuestionnaireResult | undefined;
      if (!details) {
        const first = result.content[0];
        return new Text(first?.type === "text" ? first.text : "", 0, 0);
      }

      if (details.error) {
        return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
      }

      if (details.cancelled) {
        return new Text(theme.fg("warning", "Cancelled"), 0, 0);
      }

      const lines = details.answers.map((a) => {
        const q = details.questions.find((q) => q.id === a.questionId);
        if (!q) return `${theme.fg("success", "\u2713 ")}${a.questionId}`;
        const display = formatAnswerForRender(q, a);
        return `${theme.fg("success", "\u2713 ")}${theme.fg("accent", q.header + ":")} ${display}`;
      });

      return new Text(lines.join("\n"), 0, 0);
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/index.test.ts`
Expected: PASS

- [ ] **Step 5: Run full verification**

Run: `pnpm check`
Expected: PASS (lint + typecheck + all tests)

- [ ] **Step 6: Commit**

```bash
git add src/index.ts tests/index.test.ts
git commit -m "feat: wire questionnaire tool registration with core + TUI"
```

---

## Phase 4: Verification

### Task 14: Full verification and cleanup

- [ ] **Step 1: Run full check**

Run: `pnpm check`
Expected: PASS (biome lint + typecheck + all tests)

- [ ] **Step 2: Delete the placeholder test that was in `tests/index.test.ts` before (already replaced in Task 13)**

Already done.

- [ ] **Step 3: Run `pnpm pack:dry-run` to verify the package structure**

Run: `pnpm pack:dry-run`
Expected: Lists files under `src/` including the new `core/` and `tui/` directories

- [ ] **Step 4: Review git log**

Run: `git log --oneline -15`
Verify the commit history is clean and each commit is atomic.

- [ ] **Step 5: Final commit (if any formatting changes from biome)**

If biome made auto-format changes:

```bash
git add -A
git commit -m "style: apply biome formatting"
```
