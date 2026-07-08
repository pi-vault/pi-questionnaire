# Phase 2: Inline process.ts

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the thin `process.ts` orchestrator — inline the validate-then-normalize composition into the single call site.

**Architecture:** `processQuestions` is 16 lines composing `validateQuestions` + `normalizeQuestions`. The composition moves to `src/index.ts`. The barrel exports the two functions directly.

**Tech Stack:** TypeScript 6, Vitest, Biome

---

### Task 1: Update the barrel to export validate and normalize

**Files:**

- Modify: `src/core/index.ts`

- [ ] **Step 1: Replace process.ts exports with validate + normalize exports**

In `src/core/index.ts`, replace these two lines:

```ts
export { processQuestions } from "./process.ts";
export type { ProcessResult } from "./process.ts";
```

with:

```ts
export { validateQuestions } from "./validate.ts";
export { normalizeQuestions } from "./normalize.ts";
```

- [ ] **Step 2: Run typecheck to see what breaks**

```bash
pnpm typecheck
```

Expected: error in `src/index.ts` — it imports `processQuestions` which no longer exists in the barrel.

### Task 2: Inline the composition in src/index.ts

**Files:**

- Modify: `src/index.ts:3-8,41-44`

- [ ] **Step 1: Update imports in src/index.ts**

In `src/index.ts`, change the imports from:

```ts
import {
  QuestionnaireParamsSchema,
  processQuestions,
  formatContentSummary,
  formatAnswerForRender,
} from "./core/index.ts";
import type { QuestionInput, QuestionnaireResult } from "./core/index.ts";
```

to:

```ts
import {
  QuestionnaireParamsSchema,
  validateQuestions,
  normalizeQuestions,
  formatContentSummary,
  formatAnswerForRender,
} from "./core/index.ts";
import type { QuestionInput, QuestionnaireResult } from "./core/index.ts";
```

- [ ] **Step 2: Replace the processQuestions call with inline composition**

In `src/index.ts`, inside the `execute` method, replace:

```ts
const result = processQuestions(params.questions);
if (!result.ok) {
  return errorResult(result.error);
}

if (ctx.mode !== "tui") {
  return errorResult("Questionnaire requires interactive mode.");
}

const uiResult = await runQuestionnaireUI(ctx, result.questions);
```

with:

```ts
const validation = validateQuestions(params.questions);
if (!validation.valid) {
  return errorResult(validation.error);
}

if (ctx.mode !== "tui") {
  return errorResult("Questionnaire requires interactive mode.");
}

const questions = normalizeQuestions(params.questions);
const uiResult = await runQuestionnaireUI(ctx, questions);
```

- [ ] **Step 3: Run typecheck to verify**

```bash
pnpm typecheck
```

Expected: passes. The `validation` result uses `{ valid: true } | { valid: false; error: string }` which TypeScript narrows correctly.

### Task 3: Delete process.ts and its tests

**Files:**

- Delete: `src/core/process.ts`
- Delete: `tests/core/process.test.ts`

- [ ] **Step 1: Delete the files**

```bash
rm src/core/process.ts tests/core/process.test.ts
```

- [ ] **Step 2: Run the full check suite**

```bash
pnpm check
```

Expected: all lint, typecheck, and tests pass. The validate and normalize functions are already tested independently in `tests/core/validate.test.ts` and `tests/core/normalize.test.ts`.

### Task 4: Commit

- [ ] **Step 1: Commit the change**

```bash
git add -A
git commit -m "refactor(core): inline process.ts pass-through

Inline validate-then-normalize into the single call site (src/index.ts).
Export validateQuestions and normalizeQuestions directly from the barrel.
Delete the 16-line orchestrator and its tests.

Generated with [Devin](https://devin.ai)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>"
```
