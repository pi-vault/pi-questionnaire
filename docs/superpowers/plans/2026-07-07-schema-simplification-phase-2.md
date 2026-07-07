# Phase 2: Normalize, Validate, Process

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update core logic (normalize, validate, process) and their tests to use the flat `QuestionSchema` from Phase 1.

**Architecture:** Single normalization path (no branching on `type`), default `value` to `label`, simplify validation to use `multiSelect` instead of `type` discriminator.

**Tech Stack:** TypeScript, TypeBox, Vitest

---

### Task 1: Rewrite `src/core/normalize.ts`

**Files:**

- Modify: `src/core/normalize.ts`

- [ ] **Step 1: Replace the normalize file**

Replace the contents of `src/core/normalize.ts` with:

```ts
import type { QuestionInput } from "./schema.ts";
import type { NormalizedQuestion } from "./types.ts";

export function normalizeQuestions(
  questions: QuestionInput[],
): NormalizedQuestion[] {
  return questions.map((q) => ({
    id: q.id.trim(),
    header: q.header.trim(),
    prompt: q.prompt.trim(),
    options: q.options.map((opt) => ({
      value: (opt.value ?? opt.label).trim(),
      label: opt.label.trim(),
      description: opt.description?.trim() || undefined,
    })),
    multiSelect: q.multiSelect ?? false,
    recommendation: q.recommendation?.trim() ?? null,
    allowOther: q.multiSelect ? false : q.allowOther !== false,
    allowChat: q.allowChat !== false,
  }));
}
```

Key changes:

- Removed `normalizeSingleChoice`, `normalizeMultiChoice`, and the type-based branching.
- Option `value` defaults to `label` via `opt.value ?? opt.label`.
- `multiSelect` defaults to `false`.
- `allowOther` defaults to `true` only for single-select (when `multiSelect` is falsy). Multi-select always sets `allowOther: false` (matching current behavior where multi-choice had no `allowOther`).
- `recommendation` is always `string | null` (no array normalization).

---

### Task 2: Rewrite `tests/core/normalize.test.ts`

**Files:**

- Modify: `tests/core/normalize.test.ts`

- [ ] **Step 1: Replace the normalize test file**

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
          { value: " a ", label: " A ", description: " desc " },
          { value: "b", label: "B" },
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
        options: [{ label: "Alpha" }, { label: " Beta " }],
      },
    ];
    const result = normalizeQuestions(input);
    expect(result[0].options[0].value).toBe("Alpha");
    expect(result[0].options[0].label).toBe("Alpha");
    expect(result[0].options[1].value).toBe("Beta");
    expect(result[0].options[1].label).toBe("Beta");
  });

  it("uses explicit value when provided", () => {
    const input: QuestionInput[] = [
      {
        id: "q1",
        header: "Q1",
        prompt: "Pick",
        options: [{ value: "val-a", label: "Alpha" }, { label: "Beta" }],
      },
    ];
    const result = normalizeQuestions(input);
    expect(result[0].options[0].value).toBe("val-a");
    expect(result[0].options[1].value).toBe("Beta");
  });

  it("sets recommendation to null when not provided", () => {
    const input: QuestionInput[] = [
      {
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
    expect(result[0].recommendation).toBeNull();
  });

  it("preserves recommendation value when provided", () => {
    const input: QuestionInput[] = [
      {
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
    expect(result[0].recommendation).toBe("a");
  });

  it("defaults multiSelect to false", () => {
    const input: QuestionInput[] = [
      {
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
    expect(result[0].multiSelect).toBe(false);
  });

  it("preserves multiSelect: true", () => {
    const input: QuestionInput[] = [
      {
        id: "q1",
        header: "Q1",
        prompt: "Pick",
        options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ],
        multiSelect: true,
      },
    ];
    const result = normalizeQuestions(input);
    expect(result[0].multiSelect).toBe(true);
  });

  it("defaults allowOther to true for single-select", () => {
    const input: QuestionInput[] = [
      {
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
    expect(result[0].allowOther).toBe(true);
  });

  it("preserves allowOther: false for single-select", () => {
    const input: QuestionInput[] = [
      {
        id: "q1",
        header: "Q1",
        prompt: "Pick",
        options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ],
        allowOther: false,
      },
    ];
    const result = normalizeQuestions(input);
    expect(result[0].allowOther).toBe(false);
  });

  it("forces allowOther to false for multi-select", () => {
    const input: QuestionInput[] = [
      {
        id: "q1",
        header: "Q1",
        prompt: "Pick",
        options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ],
        multiSelect: true,
        allowOther: true,
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
          { value: "a", label: "A" },
          { value: "b", label: "B" },
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
          { value: "a", label: "A" },
          { value: "b", label: "B" },
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
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ],
      },
    ];
    const result = normalizeQuestions(input);
    expect(result[0].options[0].description).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run normalize tests**

Run: `npx vitest run tests/core/normalize.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/core/normalize.ts tests/core/normalize.test.ts
git commit -m "refactor: single normalization path with value-defaults-to-label"
```

---

### Task 3: Rewrite `src/core/validate.ts`

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

- Removed the `if (q.type === "single-choice" || q.type === "multi-choice")` guard — all questions have options now.
- Option value resolution uses `opt.value ?? opt.label` (matching the optional-value schema).
- Recommendation validation is a single block (no separate single/multi paths). `recommendation` is always a string.

---

### Task 4: Rewrite `tests/core/validate.test.ts`

**Files:**

- Modify: `tests/core/validate.test.ts`

- [ ] **Step 1: Replace the validate test file**

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
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
    ...overrides,
  };
}

function multiQ(overrides: Partial<QuestionInput> = {}): QuestionInput {
  return {
    id: "q1",
    header: "Q1",
    prompt: "Pick many",
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
    multiSelect: true,
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
      singleQ({ options: [{ value: "a", label: "A" }] }),
    ]);
    expect(result).toEqual({
      valid: false,
      error: 'Question "q1" must have 2-12 options.',
    });
  });

  it("rejects question with more than 12 options", () => {
    const options = Array.from({ length: 13 }, (_, i) => ({
      value: `v${i}`,
      label: `L${i}`,
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
      singleQ({
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
      singleQ({
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

  it("rejects recommendation not matching any option", () => {
    const result = validateQuestions([singleQ({ recommendation: "nope" })]);
    expect(result).toEqual({
      valid: false,
      error:
        'Question "q1" recommendation "nope" does not match any option value.',
    });
  });

  it("accepts valid recommendation", () => {
    const result = validateQuestions([singleQ({ recommendation: "a" })]);
    expect(result).toEqual({ valid: true });
  });

  it("accepts valid recommendation on multi-select", () => {
    const result = validateQuestions([multiQ({ recommendation: "a" })]);
    expect(result).toEqual({ valid: true });
  });

  it("detects duplicate values when value defaults to label", () => {
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

  it("validates recommendation against defaulted values", () => {
    const result = validateQuestions([
      singleQ({
        options: [{ label: "Alpha" }, { label: "Beta" }],
        recommendation: "Alpha",
      }),
    ]);
    expect(result).toEqual({ valid: true });
  });
});
```

- [ ] **Step 2: Run validate tests**

Run: `npx vitest run tests/core/validate.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/core/validate.ts tests/core/validate.test.ts
git commit -m "refactor: simplify validation to use flat question schema"
```

---

### Task 5: Update `tests/core/process.test.ts`

**Files:**

- Modify: `tests/core/process.test.ts`

`src/core/process.ts` needs no changes — it only calls `validateQuestions` and `normalizeQuestions`. But its test fixtures reference the old `type` field.

- [ ] **Step 1: Replace the process test file**

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
      { value: "a", label: "A" },
      { value: "b", label: "B" },
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
          { value: " a ", label: " A " },
          { value: "b", label: "B" },
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

- [ ] **Step 2: Run all core tests**

Run: `npx vitest run tests/core/`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add tests/core/process.test.ts
git commit -m "test: update process test fixtures for flat schema"
```
