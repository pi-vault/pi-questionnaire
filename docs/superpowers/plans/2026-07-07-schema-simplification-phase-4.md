# Phase 4: Exports and Remaining Tests

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up barrel exports (remove deleted type names) and update remaining test fixtures that still reference the old `type` discriminator.

**Architecture:** Mechanical fixture replacement in test files plus export cleanup in `src/core/index.ts`.

**Tech Stack:** TypeScript, Vitest

---

### Task 1: Update `src/core/index.ts` exports

**Files:**

- Modify: `src/core/index.ts`

- [ ] **Step 1: Replace the barrel exports**

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

Changes from old file:

- Removed `SingleChoiceQuestionInput`, `MultiChoiceQuestionInput` type exports (these types no longer exist).
- Removed `NormalizedMultiChoiceQuestion`, `NormalizedSingleChoiceQuestion` type exports (merged into `NormalizedQuestion`).

---

### Task 2: Update `tests/core/format.test.ts` fixtures

**Files:**

- Modify: `tests/core/format.test.ts`

- [ ] **Step 1: Replace fixture objects**

In `tests/core/format.test.ts`, replace the two fixture objects at the top of the file:

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

with:

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

- [ ] **Step 2: Run format tests**

Run: `npx vitest run tests/core/format.test.ts`
Expected: ALL PASS

---

### Task 3: Update `tests/tui/render.test.ts` fixtures

**Files:**

- Modify: `tests/tui/render.test.ts`

- [ ] **Step 1: Replace fixture objects**

In `tests/tui/render.test.ts`, replace the fixture array:

```ts
const questions: NormalizedQuestion[] = [
  {
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
  },
  {
    type: "multi-choice",
    id: "features",
    header: "Features",
    prompt: "Pick features",
    options: [
      { value: "auth", label: "Auth" },
      { value: "log", label: "Logging" },
    ],
    recommendation: [],
    allowChat: false,
  },
];
```

with:

```ts
const questions: NormalizedQuestion[] = [
  {
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
  },
  {
    id: "features",
    header: "Features",
    prompt: "Pick features",
    options: [
      { value: "auth", label: "Auth" },
      { value: "log", label: "Logging" },
    ],
    multiSelect: true,
    recommendation: null,
    allowOther: false,
    allowChat: false,
  },
];
```

- [ ] **Step 2: Run render tests**

Run: `npx vitest run tests/tui/render.test.ts`
Expected: ALL PASS

---

### Task 4: Update `tests/tui/render-tabs.test.ts` fixtures

**Files:**

- Modify: `tests/tui/render-tabs.test.ts`

- [ ] **Step 1: Replace fixture objects**

In `tests/tui/render-tabs.test.ts`, replace the fixture array:

```ts
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
    allowOther: false,
    allowChat: false,
  },
  {
    type: "multi-choice",
    id: "notes",
    header: "Notes",
    prompt: "Pick some",
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
    recommendation: [],
    allowChat: false,
  },
];
```

with:

```ts
const questions: NormalizedQuestion[] = [
  {
    id: "scope",
    header: "Scope",
    prompt: "Pick",
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
    multiSelect: false,
    recommendation: null,
    allowOther: false,
    allowChat: false,
  },
  {
    id: "notes",
    header: "Notes",
    prompt: "Pick some",
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
    multiSelect: true,
    recommendation: null,
    allowOther: false,
    allowChat: false,
  },
];
```

- [ ] **Step 2: Run render-tabs tests**

Run: `npx vitest run tests/tui/render-tabs.test.ts`
Expected: ALL PASS

---

### Task 5: Update `tests/tui/render-review.test.ts` fixtures

**Files:**

- Modify: `tests/tui/render-review.test.ts`

- [ ] **Step 1: Replace fixture objects**

In `tests/tui/render-review.test.ts`, replace the fixture array:

```ts
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
    allowOther: false,
    allowChat: false,
  },
  {
    type: "multi-choice",
    id: "features",
    header: "Features",
    prompt: "Pick features",
    options: [
      { value: "auth", label: "Auth" },
      { value: "log", label: "Logging" },
    ],
    recommendation: [],
    allowChat: false,
  },
];
```

with:

```ts
const questions: NormalizedQuestion[] = [
  {
    id: "scope",
    header: "Scope",
    prompt: "Pick",
    options: [
      { value: "small", label: "Small" },
      { value: "large", label: "Large" },
    ],
    multiSelect: false,
    recommendation: null,
    allowOther: false,
    allowChat: false,
  },
  {
    id: "features",
    header: "Features",
    prompt: "Pick features",
    options: [
      { value: "auth", label: "Auth" },
      { value: "log", label: "Logging" },
    ],
    multiSelect: true,
    recommendation: null,
    allowOther: false,
    allowChat: false,
  },
];
```

- [ ] **Step 2: Run render-review tests**

Run: `npx vitest run tests/tui/render-review.test.ts`
Expected: ALL PASS

---

### Task 6: Update tool description in `src/index.ts`

**Files:**

- Modify: `src/index.ts`

- [ ] **Step 1: Update the tool description**

In `src/index.ts`, replace:

```ts
    description:
      "Ask the user 1-10 structured questions. Supports single-choice and multi-choice questions. Use for clarifying requirements, getting preferences, or confirming decisions.",
```

with:

```ts
    description:
      "Ask the user 1-10 structured questions. Each question can be single-select or multi-select. Use for clarifying requirements, getting preferences, or confirming decisions.",
```

---

### Task 7: Full verification

- [ ] **Step 1: Run full check**

Run: `pnpm check`
Expected: lint, typecheck, and all tests pass clean.

- [ ] **Step 2: Commit**

```bash
git add src/core/index.ts src/index.ts tests/core/format.test.ts tests/tui/render.test.ts tests/tui/render-tabs.test.ts tests/tui/render-review.test.ts
git commit -m "chore: clean up exports and update remaining test fixtures"
```
