# Phase 7: Fuse Validate + Normalize into processQuestions

> Part of [architecture-deepening-design.md](../specs/2025-06-20-architecture-deepening-design.md)
>
> **Depends on:** Phases 1-2 must be complete before starting this phase.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the implicit validate-then-normalize two-step with a single `processQuestions` function that enforces the ordering contract internally.

**Architecture:** A new `process.ts` module exports `processQuestions(raw) → ProcessResult`. It calls `validateQuestions` then `normalizeQuestions` internally. The barrel export removes the individual functions and exposes only `processQuestions`. Existing test files for validate and normalize remain unchanged (they import directly from source files).

**Tech Stack:** TypeScript 6, Vitest 4, Biome 2.5

**Spec:** `docs/specs/2025-06-20-architecture-deepening-design.md` — Phase 3

**Verification command:** `pnpm check` (runs biome lint + typecheck + vitest)

---

## File Structure

```
src/core/
  process.ts        # NEW — processQuestions function
  index.ts          # EDIT — replace validate/normalize exports with processQuestions
src/
  index.ts          # EDIT — use processQuestions instead of validate + normalize
tests/core/
  process.test.ts   # NEW — integration tests
```

---

### Task 9: Write process.test.ts (failing tests first)

**Files:**

- Create: `tests/core/process.test.ts`

- [ ] **Step 1: Write `tests/core/process.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type { QuestionInput } from "../../src/core/schema.ts";
import { processQuestions } from "../../src/core/process.ts";

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

describe("processQuestions", () => {
  it("returns ok with normalized questions for valid input", () => {
    const result = processQuestions([
      choiceQ({ id: "  scope  ", header: "  Scope  " }),
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
      choiceQ({ id: "dup" }),
      choiceQ({ id: "dup" }),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Duplicate");
    }
  });

  it("normalizes trimmed fields when valid", () => {
    const result = processQuestions([
      choiceQ({
        id: "  q1  ",
        prompt: "  Pick  ",
        options: [
          { value: " a ", label: " A " },
          { value: "b", label: "B" },
        ],
      }),
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const q = result.questions[0];
      expect(q.prompt).toBe("Pick");
      if (q.type === "single-choice") {
        expect(q.options[0].value).toBe("a");
        expect(q.options[0].label).toBe("A");
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/core/process.test.ts`
Expected: FAIL (module `../../src/core/process.ts` not found)

- [ ] **Step 3: Commit**

```bash
git add tests/core/process.test.ts
git commit -m "test: add process.test.ts (red)"
```

---

### Task 10: Implement processQuestions

**Files:**

- Create: `src/core/process.ts`

- [ ] **Step 1: Write `src/core/process.ts`**

```ts
import type { QuestionInput } from "./schema.ts";
import type { NormalizedQuestion } from "./types.ts";
import { validateQuestions } from "./validate.ts";
import { normalizeQuestions } from "./normalize.ts";

export type ProcessResult =
  | { ok: true; questions: NormalizedQuestion[] }
  | { ok: false; error: string };

export function processQuestions(raw: QuestionInput[]): ProcessResult {
  const validation = validateQuestions(raw);
  if (!validation.valid) {
    return { ok: false, error: validation.error };
  }
  return { ok: true, questions: normalizeQuestions(raw) };
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm test -- tests/core/process.test.ts`
Expected: PASS (all 4 tests green)

- [ ] **Step 3: Commit**

```bash
git add src/core/process.ts
git commit -m "feat: add processQuestions function"
```

---

### Task 11: Update barrel export and entry point

**Files:**

- Edit: `src/core/index.ts`
- Edit: `src/index.ts`

- [ ] **Step 1: Update `src/core/index.ts` — remove validate/normalize, add processQuestions**

Replace:

```ts
export { validateQuestions } from "./validate.ts";
export { normalizeQuestions } from "./normalize.ts";
```

With:

```ts
export { processQuestions } from "./process.ts";
export type { ProcessResult } from "./process.ts";
```

- [ ] **Step 2: Update `src/index.ts` — use processQuestions**

Replace the imports at the top:

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

With:

```ts
import {
  QuestionnaireParamsSchema,
  processQuestions,
  formatContentSummary,
  formatAnswerForRender,
} from "./core/index.ts";
import type { QuestionInput, QuestionnaireResult } from "./core/index.ts";
```

Then replace the execute body (the validate + normalize two-step):

Replace:

```ts
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const validation = validateQuestions(params.questions);
      if (!validation.valid) {
        return errorResult(validation.error);
      }

      const normalized = normalizeQuestions(params.questions);

      if (ctx.mode !== "tui") {
```

With:

```ts
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = processQuestions(params.questions);
      if (!result.ok) {
        return errorResult(result.error);
      }

      if (ctx.mode !== "tui") {
```

And update the reference from `normalized` to `result.questions`:

Replace:

```ts
const result = await runQuestionnaireUI(ctx, normalized);
```

With:

```ts
const uiResult = await runQuestionnaireUI(ctx, result.questions);
```

And update the return to use `uiResult`:

Replace:

```ts
return {
  content: [{ type: "text", text: formatContentSummary(result) }],
  details: result,
};
```

With:

```ts
return {
  content: [{ type: "text", text: formatContentSummary(uiResult) }],
  details: uiResult,
};
```

- [ ] **Step 3: Run full check**

Run: `pnpm check`
Expected: PASS (all tests green — now 56 tests with 4 new process tests)

- [ ] **Step 4: Commit**

```bash
git add src/core/index.ts src/index.ts
git commit -m "refactor: wire processQuestions into barrel and entry point"
```
