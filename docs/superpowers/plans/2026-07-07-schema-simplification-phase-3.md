# Phase 3: TUI Logic (state, input, render)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all `question.type === "single-choice" | "multi-choice"` checks in TUI files with `question.multiSelect`, update render function signatures and test fixtures.

**Architecture:** Mechanical replacement — every `q.type === "single-choice"` becomes `!q.multiSelect`, every `q.type === "multi-choice"` becomes `q.multiSelect`. Render functions change param types from `NormalizedSingleChoiceQuestion` / `NormalizedMultiChoiceQuestion` to `NormalizedQuestion`.

**Tech Stack:** TypeScript, Vitest

---

### Task 1: Update `src/tui/state.ts`

**Files:**

- Modify: `src/tui/state.ts`

There are 4 type-discriminator checks to replace.

- [ ] **Step 1: Update `visibleRowCount`**

In `src/tui/state.ts`, replace:

```ts
export function visibleRowCount(question: NormalizedQuestion): number {
  if (question.type === "single-choice") {
    return (
      question.options.length +
      (question.allowOther ? 1 : 0) +
      (question.allowChat ? 1 : 0)
    );
  }
  // multi-choice: options + chat? + Next
  return question.options.length + (question.allowChat ? 1 : 0) + 1;
}
```

with:

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

In `src/tui/state.ts`, replace:

```ts
if (question.type === "single-choice") {
  if (question.allowOther && cursor === sentinel) return { kind: "other" };
  if (question.allowOther) sentinel++;
  if (question.allowChat && cursor === sentinel) return { kind: "chat" };
  return { kind: "option", index: question.options.length - 1 };
}

// multi-choice
```

with:

```ts
if (!question.multiSelect) {
  if (question.allowOther && cursor === sentinel) return { kind: "other" };
  if (question.allowOther) sentinel++;
  if (question.allowChat && cursor === sentinel) return { kind: "chat" };
  return { kind: "option", index: question.options.length - 1 };
}

// multi-select
```

- [ ] **Step 3: Update `initState`**

In `src/tui/state.ts`, replace:

```ts
for (const q of questions) {
  if (q.type === "multi-choice") {
    multiChecked.set(q.id, new Set(q.recommendation));
  }
}
```

with:

```ts
for (const q of questions) {
  if (q.multiSelect) {
    const initial = q.recommendation
      ? new Set([q.recommendation])
      : new Set<string>();
    multiChecked.set(q.id, initial);
  }
}
```

Note: `recommendation` is now always `string | null` (not `string[]`). When present on a multi-select question, it seeds the checked set as a single-element set. When `null`, the set starts empty.

- [ ] **Step 4: Update `reduce` toggleCheckbox case**

In `src/tui/state.ts`, inside the `toggleCheckbox` case, replace:

```ts
      const q = questions.find((q) => q.id === action.questionId);
      if (q?.type === "multi-choice") {
```

with:

```ts
      const q = questions.find((q) => q.id === action.questionId);
      if (q?.multiSelect) {
```

---

### Task 2: Update `src/tui/input.ts`

**Files:**

- Modify: `src/tui/input.ts`

One type-discriminator check to replace.

- [ ] **Step 1: Replace the type check**

In `src/tui/input.ts`, replace:

```ts
  // Single-choice
  if (q.type === "single-choice") {
```

with:

```ts
  // Single-select
  if (!q.multiSelect) {
```

---

### Task 3: Update `src/tui/render.ts`

**Files:**

- Modify: `src/tui/render.ts`

One `switch` block and one `q?.type` check to replace.

- [ ] **Step 1: Replace the render dispatch**

In `src/tui/render.ts`, replace:

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

with:

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

- [ ] **Step 2: Replace the hint bar type check**

In `src/tui/render.ts`, replace:

```ts
  } else if (q?.type === "multi-choice") {
```

with:

```ts
  } else if (q?.multiSelect) {
```

---

### Task 4: Update `src/tui/render-question.ts`

**Files:**

- Modify: `src/tui/render-question.ts`

Change param types from the removed specific interfaces to `NormalizedQuestion`.

- [ ] **Step 1: Update imports and function signatures**

In `src/tui/render-question.ts`, replace:

```ts
import type {
  NormalizedSingleChoiceQuestion,
  NormalizedMultiChoiceQuestion,
} from "../core/types.ts";
```

with:

```ts
import type { NormalizedQuestion } from "../core/types.ts";
```

Then replace the `renderSingleChoiceQuestion` signature:

```ts
export function renderSingleChoiceQuestion(
  question: NormalizedSingleChoiceQuestion,
```

with:

```ts
export function renderSingleChoiceQuestion(
  question: NormalizedQuestion,
```

And the `renderMultiChoiceQuestion` signature:

```ts
export function renderMultiChoiceQuestion(
  question: NormalizedMultiChoiceQuestion,
```

with:

```ts
export function renderMultiChoiceQuestion(
  question: NormalizedQuestion,
```

- [ ] **Step 2: Update recommendation check in renderMultiChoiceQuestion**

In `renderMultiChoiceQuestion`, the recommendation suffix uses `.includes()` on what was `string[]`. Now `recommendation` is `string | null`. Replace:

```ts
const recSuffix = question.recommendation.includes(opt.value)
  ? " [recommended]"
  : "";
```

with:

```ts
const recSuffix = question.recommendation === opt.value ? " [recommended]" : "";
```

- [ ] **Step 3: Verify the project compiles**

Run: `npx tsc --noEmit`
Expected: No errors. All type references resolved.

- [ ] **Step 4: Commit**

```bash
git add src/tui/state.ts src/tui/input.ts src/tui/render.ts src/tui/render-question.ts
git commit -m "refactor: replace type discriminator with multiSelect in TUI"
```

---

### Task 5: Update `tests/tui/state.test.ts`

**Files:**

- Modify: `tests/tui/state.test.ts`

All fixture objects need `type` replaced with `multiSelect` and `recommendation` changed from `string[]` to `string | null`.

- [ ] **Step 1: Update fixture objects at the top of the file**

Replace the fixture block (lines 17-127) with:

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
    recommendation: "small",
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
    recommendation: "auth",
    allowOther: false,
    allowChat: false,
  },
];

const singleWithOther: NormalizedQuestion = {
  id: "scope-other",
  header: "Scope",
  prompt: "Pick scope",
  options: [
    { value: "small", label: "Small" },
    { value: "large", label: "Large" },
  ],
  multiSelect: false,
  recommendation: null,
  allowOther: true,
  allowChat: false,
};

const singleWithChat: NormalizedQuestion = {
  id: "scope-chat",
  header: "Scope",
  prompt: "Pick scope",
  options: [
    { value: "small", label: "Small" },
    { value: "large", label: "Large" },
  ],
  multiSelect: false,
  recommendation: null,
  allowOther: false,
  allowChat: true,
};

const singleWithOtherAndChat: NormalizedQuestion = {
  id: "scope-other-chat",
  header: "Scope",
  prompt: "Pick scope",
  options: [
    { value: "small", label: "Small" },
    { value: "large", label: "Large" },
  ],
  multiSelect: false,
  recommendation: null,
  allowOther: true,
  allowChat: true,
};

const multiWithChat: NormalizedQuestion = {
  id: "features-chat",
  header: "Features",
  prompt: "Pick features",
  options: [
    { value: "auth", label: "Auth" },
    { value: "log", label: "Logging" },
  ],
  multiSelect: true,
  recommendation: null,
  allowOther: false,
  allowChat: true,
};

const questionsWithChat: NormalizedQuestion[] = [
  {
    id: "q1",
    header: "Q1",
    prompt: "Pick one",
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
    multiSelect: false,
    recommendation: null,
    allowOther: false,
    allowChat: true,
  },
  {
    id: "q2",
    header: "Q2",
    prompt: "Pick many",
    options: [
      { value: "x", label: "X" },
      { value: "y", label: "Y" },
    ],
    multiSelect: true,
    recommendation: null,
    allowOther: false,
    allowChat: true,
  },
];
```

- [ ] **Step 2: Update the initState multiChecked test**

The `initState` test "pre-populates multiChecked from recommendations" expects `auth` to be pre-checked. With the new schema, `recommendation` is `"auth"` (a string, not array), and `initState` seeds it as `new Set(["auth"])`. Update the test expectation — the behavior is the same, so **no test change needed here** if the fixture `recommendation: "auth"` is correct (it is).

- [ ] **Step 3: Run state tests**

Run: `npx vitest run tests/tui/state.test.ts`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add tests/tui/state.test.ts
git commit -m "test: update state test fixtures for flat schema"
```

---

### Task 6: Update `tests/tui/input.test.ts`

**Files:**

- Modify: `tests/tui/input.test.ts`

- [ ] **Step 1: Update imports and all fixture objects**

Replace the import block:

```ts
import type {
  NormalizedMultiChoiceQuestion,
  NormalizedQuestion,
  NormalizedSingleChoiceQuestion,
} from "../../src/core/types.ts";
```

with:

```ts
import type { NormalizedQuestion } from "../../src/core/types.ts";
```

Then replace all fixture objects (lines 10-80) with:

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

const singleWithOther: NormalizedQuestion = {
  id: "scope",
  header: "Scope",
  prompt: "Pick scope",
  options: [
    { value: "small", label: "Small" },
    { value: "large", label: "Large" },
  ],
  multiSelect: false,
  recommendation: null,
  allowOther: true,
  allowChat: false,
};
const questionsWithOther: NormalizedQuestion[] = [singleWithOther];

const singleWithChat: NormalizedQuestion = {
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
  allowChat: true,
};
const questionsWithChat: NormalizedQuestion[] = [singleWithChat];

const multiWithChat: NormalizedQuestion = {
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
  allowChat: true,
};
const questionsMultiWithChat: NormalizedQuestion[] = [multiWithChat];
```

- [ ] **Step 2: Run input tests**

Run: `npx vitest run tests/tui/input.test.ts`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add tests/tui/input.test.ts
git commit -m "test: update input test fixtures for flat schema"
```

---

### Task 7: Update `tests/tui/render-question.test.ts`

**Files:**

- Modify: `tests/tui/render-question.test.ts`

- [ ] **Step 1: Update imports and fixture objects**

Replace the import:

```ts
import type {
  NormalizedSingleChoiceQuestion,
  NormalizedMultiChoiceQuestion,
} from "../../src/core/types.ts";
```

with:

```ts
import type { NormalizedQuestion } from "../../src/core/types.ts";
```

Replace the single-choice fixture (line 13):

```ts
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
  allowOther: false,
  allowChat: false,
};
```

with:

```ts
const question: NormalizedQuestion = {
  id: "scope",
  header: "Scope",
  prompt: "What scope?",
  options: [
    { value: "small", label: "Small" },
    { value: "large", label: "Large", description: "Very large" },
  ],
  multiSelect: false,
  recommendation: "small",
  allowOther: false,
  allowChat: false,
};
```

Replace the multi-choice fixture (line 209):

```ts
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
  allowChat: false,
};
```

with:

```ts
const question: NormalizedQuestion = {
  id: "features",
  header: "Features",
  prompt: "Which features?",
  options: [
    { value: "auth", label: "Auth" },
    { value: "log", label: "Logging" },
  ],
  multiSelect: true,
  recommendation: "auth",
  allowOther: false,
  allowChat: false,
};
```

Replace the chat sentinel test fixture (line 282):

```ts
const baseQuestion: NormalizedSingleChoiceQuestion = {
  type: "single-choice",
  id: "scope",
  header: "Scope",
  prompt: "What scope?",
  options: [
    { value: "small", label: "Small" },
    { value: "large", label: "Large" },
  ],
  recommendation: null,
  allowOther: false,
  allowChat: false,
};
```

with:

```ts
const baseQuestion: NormalizedQuestion = {
  id: "scope",
  header: "Scope",
  prompt: "What scope?",
  options: [
    { value: "small", label: "Small" },
    { value: "large", label: "Large" },
  ],
  multiSelect: false,
  recommendation: null,
  allowOther: false,
  allowChat: false,
};
```

- [ ] **Step 2: Run render-question tests**

Run: `npx vitest run tests/tui/render-question.test.ts`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add tests/tui/render-question.test.ts
git commit -m "test: update render-question test fixtures for flat schema"
```
