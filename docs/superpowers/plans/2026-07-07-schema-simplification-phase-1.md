# Phase 1: Schema and Types

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the union-based schema with a single flat `QuestionSchema` and merge the two normalized question interfaces into one.

**Architecture:** Remove `SingleChoiceQuestionSchema`, `MultiChoiceQuestionSchema`, and their `Type.Union`. Create one `QuestionSchema` with `multiSelect: boolean`. Make option `value` optional. Merge `NormalizedSingleChoiceQuestion` and `NormalizedMultiChoiceQuestion` into `NormalizedQuestion`.

**Tech Stack:** TypeScript, TypeBox

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

Key changes from the old file:

- `SingleChoiceQuestionSchema` and `MultiChoiceQuestionSchema` are gone.
- No `Type.Union` anywhere.
- `QuestionOptionSchema.value` is now `Type.Optional`.
- `recommendation` is always `Type.Optional(Type.String())` (no array variant).
- `multiSelect` replaces the `type: "single-choice" | "multi-choice"` discriminator.
- Removed exports: `SingleChoiceQuestionInput`, `MultiChoiceQuestionInput`.

- [ ] **Step 2: Verify schema test still passes**

Run: `npx vitest run tests/core/schema.test.ts`
Expected: PASS (it only tests the four constraint constants which are unchanged).

- [ ] **Step 3: Commit**

```bash
git add src/core/schema.ts
git commit -m "refactor: flatten question schema into single type with multiSelect boolean"
```

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

Key changes from the old file:

- `NormalizedSingleChoiceQuestion` and `NormalizedMultiChoiceQuestion` are gone.
- `NormalizedQuestion` is no longer a union — it's a single interface with `multiSelect: boolean`.
- `recommendation` is always `string | null` (no `string[]` variant).
- `allowOther` is present on all questions (previously only on single-choice).

- [ ] **Step 2: Commit**

```bash
git add src/core/types.ts
git commit -m "refactor: merge normalized question interfaces into single type"
```

Note: The project will NOT compile after this phase because `normalize.ts`, `validate.ts`, `render-question.ts`, `state.ts`, `input.ts`, `render.ts`, and `index.ts` still reference removed types. This is expected — Phase 2 and 3 fix them.
