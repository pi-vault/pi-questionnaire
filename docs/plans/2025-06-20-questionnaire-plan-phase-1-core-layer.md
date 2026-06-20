# Phase 1: Core Layer (pure functions, no pi-tui dependency)

> Part of [questionnaire-plan.md](./2025-06-20-questionnaire-plan.md)

This phase builds all business logic. After this phase the core is fully testable and the extension entry point compiles (returning stub results).

**Verification command:** `pnpm check` (runs biome lint + typecheck + vitest)

---

## Task 1: Types

**Files:**
- Create: `src/core/types.ts`

- [ ] **Step 1: Write `src/core/types.ts`**

```ts
export interface QuestionOption {
  value: string;
  label: string;
  description?: string;
}

export interface ChoiceQuestionInput {
  type: "choice";
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

export type QuestionInput = ChoiceQuestionInput | MultiChoiceQuestionInput | TextQuestionInput;

export interface NormalizedChoiceQuestion {
  type: "choice";
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
  | NormalizedChoiceQuestion
  | NormalizedMultiChoiceQuestion
  | NormalizedTextQuestion;

export interface SelectedOption {
  value: string;
  label: string;
}

export interface ChoiceAnswer {
  type: "choice";
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

export type NormalizedAnswer = ChoiceAnswer | MultiChoiceAnswer | TextAnswer;

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

## Task 2: Schema

**Files:**
- Create: `src/core/schema.ts`

- [ ] **Step 1: Write `src/core/schema.ts`**

```ts
import { Type } from "typebox";

const QuestionOptionSchema = Type.Object({
  value: Type.String({ description: "Stable value returned when this option is selected" }),
  label: Type.String({ description: "User-facing label for this option" }),
  description: Type.Optional(Type.String({ description: "Optional helper text shown below the label" })),
});

const ChoiceQuestionSchema = Type.Object({
  type: Type.Literal("choice"),
  id: Type.String({ description: "Unique question identifier" }),
  header: Type.String({ description: "Short label shown in tabs and summaries" }),
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
  header: Type.String({ description: "Short label shown in tabs and summaries" }),
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
  header: Type.String({ description: "Short label shown in tabs and summaries" }),
  prompt: Type.String({ description: "Full question text shown to the user" }),
  recommendation: Type.Optional(
    Type.String({ description: "Prefilled editor value" }),
  ),
});

const QuestionSchema = Type.Union([ChoiceQuestionSchema, MultiChoiceQuestionSchema, TextQuestionSchema]);

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

## Task 3: Validation

**Files:**
- Create: `src/core/validate.ts`
- Create: `tests/core/validate.test.ts`

- [ ] **Step 1: Write the test file `tests/core/validate.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type { QuestionInput } from "../../src/core/types.ts";
import { validateQuestions } from "../../src/core/validate.ts";

function choiceQ(overrides: Partial<QuestionInput & { type: "choice" }> = {}): QuestionInput {
  return {
    type: "choice",
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

function multiQ(overrides: Partial<QuestionInput & { type: "multi-choice" }> = {}): QuestionInput {
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

function textQ(overrides: Partial<QuestionInput & { type: "text" }> = {}): QuestionInput {
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
    expect(result).toEqual({ valid: false, error: "Questionnaire must include at least 1 question." });
  });

  it("rejects more than 10 questions", () => {
    const qs = Array.from({ length: 11 }, (_, i) => choiceQ({ id: `q${i}` }));
    const result = validateQuestions(qs);
    expect(result).toEqual({ valid: false, error: "Questionnaire supports at most 10 questions." });
  });

  it("rejects duplicate question ids", () => {
    const result = validateQuestions([choiceQ({ id: "dup" }), textQ({ id: "dup" })]);
    expect(result).toEqual({ valid: false, error: 'Duplicate question id: "dup".' });
  });

  it("rejects empty question id", () => {
    const result = validateQuestions([choiceQ({ id: "  " })]);
    expect(result).toEqual({ valid: false, error: "Question 1 has an empty id." });
  });

  it("rejects empty question header", () => {
    const result = validateQuestions([choiceQ({ header: "" })]);
    expect(result).toEqual({ valid: false, error: 'Question "q1" has an empty header.' });
  });

  it("rejects empty question prompt", () => {
    const result = validateQuestions([choiceQ({ prompt: "  " })]);
    expect(result).toEqual({ valid: false, error: 'Question "q1" has an empty prompt.' });
  });

  it("rejects choice with fewer than 2 options", () => {
    const result = validateQuestions([choiceQ({ options: [{ value: "a", label: "A" }] })]);
    expect(result).toEqual({ valid: false, error: 'Question "q1" must have 2-12 options.' });
  });

  it("rejects choice with more than 12 options", () => {
    const options = Array.from({ length: 13 }, (_, i) => ({ value: `v${i}`, label: `L${i}` }));
    const result = validateQuestions([choiceQ({ options })]);
    expect(result).toEqual({ valid: false, error: 'Question "q1" must have 2-12 options.' });
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
    expect(result).toEqual({ valid: false, error: 'Question "q1" has an option with an empty value.' });
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
    expect(result).toEqual({ valid: false, error: 'Question "q1" has an option with an empty label.' });
  });

  it("rejects choice recommendation not matching any option", () => {
    const result = validateQuestions([choiceQ({ recommendation: "nope" })]);
    expect(result).toEqual({
      valid: false,
      error: 'Question "q1" recommendation "nope" does not match any option value.',
    });
  });

  it("accepts choice with valid recommendation", () => {
    const result = validateQuestions([choiceQ({ recommendation: "a" })]);
    expect(result).toEqual({ valid: true });
  });

  it("rejects multi-choice recommendation not matching any option", () => {
    const result = validateQuestions([multiQ({ recommendation: ["a", "nope"] })]);
    expect(result).toEqual({
      valid: false,
      error: 'Question "q1" recommendation "nope" does not match any option value.',
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

export function validateQuestions(questions: QuestionInput[]): ValidationResult {
  if (questions.length === 0) {
    return { valid: false, error: "Questionnaire must include at least 1 question." };
  }
  if (questions.length > 10) {
    return { valid: false, error: "Questionnaire supports at most 10 questions." };
  }

  const idSet = new Set<string>();

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const trimmedId = q.id.trim();
    const questionNumber = i + 1;

    if (!trimmedId) {
      return { valid: false, error: `Question ${questionNumber} has an empty id.` };
    }
    if (idSet.has(trimmedId)) {
      return { valid: false, error: `Duplicate question id: "${trimmedId}".` };
    }
    idSet.add(trimmedId);

    if (!q.header.trim()) {
      return { valid: false, error: `Question "${trimmedId}" has an empty header.` };
    }
    if (!q.prompt.trim()) {
      return { valid: false, error: `Question "${trimmedId}" has an empty prompt.` };
    }

    if (q.type === "choice" || q.type === "multi-choice") {
      if (q.options.length < 2 || q.options.length > 12) {
        return { valid: false, error: `Question "${trimmedId}" must have 2-12 options.` };
      }

      const valueSet = new Set<string>();
      for (const opt of q.options) {
        const trimmedValue = opt.value.trim();
        if (!trimmedValue) {
          return { valid: false, error: `Question "${trimmedId}" has an option with an empty value.` };
        }
        if (!opt.label.trim()) {
          return { valid: false, error: `Question "${trimmedId}" has an option with an empty label.` };
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

      if (q.type === "choice" && q.recommendation !== undefined) {
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

## Task 4: Normalization

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
        type: "choice",
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
    if (result[0].type === "choice") {
      expect(result[0].options[0].value).toBe("a");
      expect(result[0].options[0].label).toBe("A");
      expect(result[0].options[0].description).toBe("desc");
    }
  });

  it("sets recommendation to null when not provided on choice", () => {
    const input: QuestionInput[] = [
      {
        type: "choice",
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
    if (result[0].type === "choice") {
      expect(result[0].recommendation).toBeNull();
    }
  });

  it("preserves recommendation value on choice when provided", () => {
    const input: QuestionInput[] = [
      {
        type: "choice",
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
    if (result[0].type === "choice") {
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
        type: "choice",
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
    if (result[0].type === "choice") {
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
  NormalizedChoiceQuestion,
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

function normalizeChoice(q: QuestionInput & { type: "choice" }): NormalizedChoiceQuestion {
  return {
    type: "choice",
    id: q.id.trim(),
    header: q.header.trim(),
    prompt: q.prompt.trim(),
    options: normalizeOptions(q.options),
    recommendation: q.recommendation?.trim() ?? null,
  };
}

function normalizeMultiChoice(q: QuestionInput & { type: "multi-choice" }): NormalizedMultiChoiceQuestion {
  return {
    type: "multi-choice",
    id: q.id.trim(),
    header: q.header.trim(),
    prompt: q.prompt.trim(),
    options: normalizeOptions(q.options),
    recommendation: q.recommendation?.map((r) => r.trim()) ?? [],
  };
}

function normalizeText(q: QuestionInput & { type: "text" }): NormalizedTextQuestion {
  return {
    type: "text",
    id: q.id.trim(),
    header: q.header.trim(),
    prompt: q.prompt.trim(),
    recommendation: q.recommendation?.trim() || null,
  };
}

export function normalizeQuestions(questions: QuestionInput[]): NormalizedQuestion[] {
  return questions.map((q) => {
    switch (q.type) {
      case "choice":
        return normalizeChoice(q);
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

## Task 5: Formatting

**Files:**
- Create: `src/core/format.ts`
- Create: `tests/core/format.test.ts`

- [ ] **Step 1: Write the test file `tests/core/format.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type {
  ChoiceAnswer,
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
  type: "choice",
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
    const answer: ChoiceAnswer = { type: "choice", questionId: "scope", value: "small", label: "Small" };
    expect(formatModelLine(choiceQ, answer)).toBe("Scope: user selected: 1. Small");
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
    expect(formatModelLine(multiQ, answer)).toBe("Features: user selected: 1. Auth, 3. Caching");
  });

  it("formats text answer", () => {
    const answer: TextAnswer = { type: "text", questionId: "notes", value: "Keep it simple" };
    expect(formatModelLine(textQ, answer)).toBe('Notes: user wrote: "Keep it simple"');
  });

  it("formats empty text answer", () => {
    const answer: TextAnswer = { type: "text", questionId: "notes", value: "" };
    expect(formatModelLine(textQ, answer)).toBe("Notes: (empty response)");
  });
});

describe("formatContentSummary", () => {
  it("returns cancelled message when cancelled", () => {
    const result: QuestionnaireResult = { questions: [], answers: [], cancelled: true };
    expect(formatContentSummary(result)).toBe("User cancelled the questionnaire");
  });

  it("joins answer lines for submitted result", () => {
    const result: QuestionnaireResult = {
      questions: [choiceQ, textQ],
      answers: [
        { type: "choice", questionId: "scope", value: "small", label: "Small" },
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
    const answer: ChoiceAnswer = { type: "choice", questionId: "scope", value: "small", label: "Small" };
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
    const answer: TextAnswer = { type: "text", questionId: "notes", value: "hello" };
    expect(formatAnswerForRender(textQ, answer)).toBe("(wrote) hello");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/core/format.test.ts`
Expected: FAIL

- [ ] **Step 3: Write `src/core/format.ts`**

```ts
import type { NormalizedAnswer, NormalizedQuestion, QuestionnaireResult } from "./types.ts";

function optionIndex(question: NormalizedQuestion, value: string): number {
  if (question.type === "text") return -1;
  return question.options.findIndex((o) => o.value === value) + 1;
}

export function formatModelLine(question: NormalizedQuestion, answer: NormalizedAnswer): string {
  switch (answer.type) {
    case "choice": {
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

export function formatAnswerForRender(question: NormalizedQuestion, answer: NormalizedAnswer): string {
  switch (answer.type) {
    case "choice": {
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

## Task 6: Core barrel export

**Files:**
- Create: `src/core/index.ts`

- [ ] **Step 1: Write `src/core/index.ts`**

```ts
export { QuestionnaireParamsSchema } from "./schema.ts";
export type {
  ChoiceAnswer,
  MultiChoiceAnswer,
  NormalizedAnswer,
  NormalizedChoiceQuestion,
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
export { formatContentSummary, formatAnswerForRender, formatModelLine } from "./format.ts";
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
