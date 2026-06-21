# Phase 6: Derive TypeScript Types from TypeBox Schema

> Part of [architecture-deepening-design.md](../specs/2025-06-20-architecture-deepening-design.md)
>
> **Depends on:** Phase 1 must be complete before starting this phase.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `schema.ts` the single source of truth for input question shapes by deriving TypeScript types from TypeBox schemas, and extract constraint constants so validate.ts uses named values instead of magic numbers.

**Architecture:** TypeBox's `Static<typeof Schema>` produces TypeScript types from runtime schemas. Named type aliases preserve readability. Constraint constants are exported from schema.ts and imported by validate.ts.

**Tech Stack:** TypeScript 6, TypeBox 1.2, Vitest 4, Biome 2.5

**Spec:** `docs/specs/2025-06-20-architecture-deepening-design.md` — Phase 2

**Verification command:** `pnpm check` (runs biome lint + typecheck + vitest)

---

## File Structure

```
src/core/
  schema.ts         # EDIT — add constraint constants, export schemas, add Static type aliases
  types.ts          # EDIT — remove input-side interfaces (keep normalized + answer types)
  validate.ts       # EDIT — import constraint constants, replace magic numbers
  index.ts          # EDIT — re-export input types from schema.ts
tests/core/
  validate.test.ts  # EDIT — update QuestionInput import path
  normalize.test.ts # EDIT — update QuestionInput import path
```

---

### Task 6: Add constraint constants and Static type aliases to schema.ts

**Files:**

- Edit: `src/core/schema.ts`

- [ ] **Step 1: Rewrite `src/core/schema.ts` with exported schemas, constants, and type aliases**

```ts
import { Type } from "typebox";
import type { Static } from "typebox";

// Constraint constants — single source of truth
export const MIN_QUESTIONS = 1;
export const MAX_QUESTIONS = 10;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 12;

export const QuestionOptionSchema = Type.Object({
  value: Type.String({
    description: "Stable value returned when this option is selected",
  }),
  label: Type.String({ description: "User-facing label for this option" }),
  description: Type.Optional(
    Type.String({ description: "Optional helper text shown below the label" }),
  ),
});

export const SingleChoiceQuestionSchema = Type.Object({
  type: Type.Literal("single-choice"),
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
  recommendation: Type.Optional(
    Type.String({ description: "Value of the recommended option" }),
  ),
});

export const MultiChoiceQuestionSchema = Type.Object({
  type: Type.Literal("multi-choice"),
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
  recommendation: Type.Optional(
    Type.Array(Type.String(), { description: "Values of recommended options" }),
  ),
});

export const TextQuestionSchema = Type.Object({
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
    minItems: MIN_QUESTIONS,
    maxItems: MAX_QUESTIONS,
    description: `${MIN_QUESTIONS}-${MAX_QUESTIONS} questions to ask the user`,
  }),
});

// Static type aliases — derived from schemas
export type QuestionOption = Static<typeof QuestionOptionSchema>;
export type SingleChoiceQuestionInput = Static<
  typeof SingleChoiceQuestionSchema
>;
export type MultiChoiceQuestionInput = Static<typeof MultiChoiceQuestionSchema>;
export type TextQuestionInput = Static<typeof TextQuestionSchema>;
export type QuestionInput = Static<typeof QuestionSchema>;
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/core/schema.ts
git commit -m "feat: export constraint constants and Static type aliases from schema"
```

---

### Task 7: Remove input types from types.ts

**Files:**

- Edit: `src/core/types.ts`

- [ ] **Step 1: Remove input-side interfaces from `src/core/types.ts`**

Delete the input interfaces (`SingleChoiceQuestionInput`, `MultiChoiceQuestionInput`, `TextQuestionInput`, `QuestionInput` union, and the local `QuestionOption` interface). The normalized types reference `QuestionOption` for their `options` field — import it from `schema.ts` instead of redefining it.

Rewrite `src/core/types.ts` to:

```ts
import type { QuestionOption } from "./schema.ts";

export type { QuestionOption } from "./schema.ts";

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

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`
Expected: May fail — downstream files import `QuestionInput` from `types.ts`. Fix in next tasks.

- [ ] **Step 3: Commit**

```bash
git add src/core/types.ts
git commit -m "refactor: remove input-side interfaces from types.ts"
```

---

### Task 8: Update barrel export and fix import paths

**Files:**

- Edit: `src/core/index.ts`
- Edit: `src/core/validate.ts`
- Edit: `src/core/normalize.ts`
- Edit: `tests/core/validate.test.ts`
- Edit: `tests/core/normalize.test.ts`

- [ ] **Step 1: Rewrite `src/core/index.ts` to re-export input types from schema**

```ts
export {
  QuestionnaireParamsSchema,
  MIN_QUESTIONS,
  MAX_QUESTIONS,
  MIN_OPTIONS,
  MAX_OPTIONS,
} from "./schema.ts";
export type {
  QuestionOption,
  SingleChoiceQuestionInput,
  MultiChoiceQuestionInput,
  TextQuestionInput,
  QuestionInput,
} from "./schema.ts";
export type {
  MultiChoiceAnswer,
  NormalizedAnswer,
  NormalizedMultiChoiceQuestion,
  NormalizedQuestion,
  NormalizedSingleChoiceQuestion,
  NormalizedTextQuestion,
  QuestionnaireResult,
  SelectedOption,
  SingleChoiceAnswer,
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

- [ ] **Step 2: Update `src/core/validate.ts` imports**

Replace:

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
```

With:

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
```

Also replace the options range check (around line 53):

Replace:

```ts
      if (q.options.length < 2 || q.options.length > 12) {
        return {
          valid: false,
          error: `Question "${trimmedId}" must have 2-12 options.`,
        };
```

With:

```ts
      if (q.options.length < MIN_OPTIONS || q.options.length > MAX_OPTIONS) {
        return {
          valid: false,
          error: `Question "${trimmedId}" must have ${MIN_OPTIONS}-${MAX_OPTIONS} options.`,
        };
```

- [ ] **Step 3: Update `src/core/normalize.ts` import**

Replace:

```ts
import type {
  NormalizedMultiChoiceQuestion,
  NormalizedQuestion,
  NormalizedSingleChoiceQuestion,
  NormalizedTextQuestion,
  QuestionInput,
  QuestionOption,
} from "./types.ts";
```

With:

```ts
import type { QuestionInput, QuestionOption } from "./schema.ts";
import type {
  NormalizedMultiChoiceQuestion,
  NormalizedQuestion,
  NormalizedSingleChoiceQuestion,
  NormalizedTextQuestion,
} from "./types.ts";
```

- [ ] **Step 4: Update `tests/core/validate.test.ts` import**

Replace:

```ts
import type { QuestionInput } from "../../src/core/types.ts";
```

With:

```ts
import type { QuestionInput } from "../../src/core/schema.ts";
```

- [ ] **Step 5: Update `tests/core/normalize.test.ts` import**

Replace:

```ts
import type { QuestionInput } from "../../src/core/types.ts";
```

With:

```ts
import type { QuestionInput } from "../../src/core/schema.ts";
```

- [ ] **Step 6: Run full check**

Run: `pnpm check`
Expected: PASS (all 52 tests green)

- [ ] **Step 7: Commit**

```bash
git add src/core/index.ts src/core/validate.ts src/core/normalize.ts tests/core/validate.test.ts tests/core/normalize.test.ts
git commit -m "refactor: derive input types from TypeBox schema, use constraint constants"
```
