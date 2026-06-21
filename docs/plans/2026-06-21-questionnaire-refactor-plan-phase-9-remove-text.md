# Phase 9: Remove Text Question Type + New Result Shape — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the free-text question type and migrate the result shape from `NormalizedAnswer[]` to `QuestionResponse[]`.

**Spec:** `docs/specs/2026-06-21-questionnaire-refactor-design.md`

**Master plan:** `docs/plans/2026-06-21-questionnaire-refactor-plan.md`

**Verification:** After completing all tasks, run `pnpm check` (lint + typecheck + tests). All must pass before committing.

---

This phase removes the `text` question type from schema, types, validation, normalization, state, input, rendering, and formatting. It also migrates the result shape from `NormalizedAnswer[]` to `QuestionResponse[]`.

### Task 9.1: Update Core Types

**Files:**

- Modify: `src/core/types.ts`
- Test: `tests/core/format.test.ts` (will break until format.ts is updated)

- [ ] **Step 1: Replace types in `src/core/types.ts`**

Replace the entire file content with:

```ts
import type { QuestionOption } from "./schema.ts";

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

export type NormalizedQuestion =
  | NormalizedSingleChoiceQuestion
  | NormalizedMultiChoiceQuestion;

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

### Task 9.2: Update Schema

**Files:**

- Modify: `src/core/schema.ts`

- [ ] **Step 1: Remove `TextQuestionSchema` and its type export**

In `src/core/schema.ts`, remove the `TextQuestionSchema` definition (lines 54-64), remove it from the `QuestionSchema` union, and remove the `TextQuestionInput` type export.

The `QuestionSchema` union becomes:

```ts
const QuestionSchema = Type.Union([
  SingleChoiceQuestionSchema,
  MultiChoiceQuestionSchema,
]);
```

Remove the `TextQuestionInput` type alias. The type exports section becomes:

```ts
export type QuestionOption = Static<typeof QuestionOptionSchema>;
export type SingleChoiceQuestionInput = Static<
  typeof SingleChoiceQuestionSchema
>;
export type MultiChoiceQuestionInput = Static<typeof MultiChoiceQuestionSchema>;
export type QuestionInput = Static<typeof QuestionSchema>;
```

### Task 9.3: Update Validation

**Files:**

- Modify: `src/core/validate.ts`
- Test: `tests/core/validate.test.ts`

- [ ] **Step 1: Remove text-question handling from `validateQuestions`**

The current code has an `if (q.type === "single-choice" || q.type === "multi-choice")` block that handles option validation. Since text is removed, the condition check remains the same (the compiler will ensure only those two types exist), but confirm there is no `else` branch for text that needs removal.

No actual code change needed in validate.ts — the `if` block already handles only choice types, and text questions passed through with no validation. The TypeBox schema change in Task 9.2 prevents text questions from being accepted.

- [ ] **Step 2: Update tests in `tests/core/validate.test.ts`**

Remove the `textQ` helper function. Remove test cases that only test text questions:

- "accepts a valid text question"
- "does not validate recommendation for text questions"

Update tests that use `textQ` for non-text-specific purposes:

- "rejects duplicate question ids" — replace `textQ({ id: "dup" })` with `multiQ({ id: "dup" })`

Keep all single-choice and multi-choice tests unchanged.

- [ ] **Step 3: Run tests**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/core/validate.test.ts`
Expected: All remaining tests pass.

### Task 9.4: Update Normalization

**Files:**

- Modify: `src/core/normalize.ts`
- Test: `tests/core/normalize.test.ts`

- [ ] **Step 1: Remove `normalizeText` function and text branch**

Remove the `normalizeText` function and the `NormalizedTextQuestion` import. Update the `normalizeQuestions` function:

```ts
import type { QuestionInput, QuestionOption } from "./schema.ts";
import type {
  NormalizedMultiChoiceQuestion,
  NormalizedQuestion,
  NormalizedSingleChoiceQuestion,
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

export function normalizeQuestions(
  questions: QuestionInput[],
): NormalizedQuestion[] {
  return questions.map((q) => {
    if (q.type === "single-choice") return normalizeSingleChoice(q);
    return normalizeMultiChoice(q);
  });
}
```

- [ ] **Step 2: Update tests in `tests/core/normalize.test.ts`**

Remove test cases that use `type: "text"` questions.

- [ ] **Step 3: Run tests**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/core/normalize.test.ts`
Expected: PASS

### Task 9.5: Update Format

**Files:**

- Modify: `src/core/format.ts`
- Test: `tests/core/format.test.ts`

- [ ] **Step 1: Rewrite `src/core/format.ts` for `QuestionResponse`**

```ts
import type {
  NormalizedQuestion,
  QuestionResponse,
  QuestionSelection,
  QuestionnaireResult,
} from "./types.ts";

function optionIndex(question: NormalizedQuestion, value: string): number {
  return question.options.findIndex((o) => o.value === value) + 1;
}

export function formatModelLine(
  question: NormalizedQuestion,
  response: QuestionResponse,
): string {
  const sel = response.selection;
  switch (sel.kind) {
    case "option": {
      const idx = optionIndex(question, sel.value);
      return `${question.header}: user selected: ${idx}. ${sel.label}`;
    }
    case "options": {
      const parts = sel.selected.map((s) => {
        const idx = optionIndex(question, s.value);
        return `${idx}. ${s.label}`;
      });
      return `${question.header}: user selected: ${parts.join(", ")}`;
    }
    case "custom":
      return `${question.header}: user wrote: "${sel.value}"`;
    case "chat":
      return `${question.header}: user wants to discuss this question`;
  }
}

export function formatNoteLine(
  question: NormalizedQuestion,
  response: QuestionResponse,
): string | null {
  if (!response.notes) return null;
  return `${question.header} note: "${response.notes}"`;
}

export function formatContentSummary(result: QuestionnaireResult): string {
  if (result.cancelled) {
    return "User cancelled the questionnaire";
  }
  const lines: string[] = [];
  for (const response of result.responses) {
    const question = result.questions.find((q) => q.id === response.questionId);
    if (!question) {
      lines.push(`${response.questionId}: (unknown question)`);
      continue;
    }
    lines.push(formatModelLine(question, response));
    const note = formatNoteLine(question, response);
    if (note) lines.push(note);
  }
  return lines.join("\n");
}

export function formatAnswerForRender(
  question: NormalizedQuestion,
  selection: QuestionSelection,
): string {
  switch (selection.kind) {
    case "option": {
      const idx = optionIndex(question, selection.value);
      return `${idx}. ${selection.label}`;
    }
    case "options":
      return selection.selected
        .map((s) => {
          const idx = optionIndex(question, s.value);
          return `${idx}. ${s.label}`;
        })
        .join(", ");
    case "custom":
      return `(wrote) "${selection.value}"`;
    case "chat":
      return "chat";
  }
}
```

- [ ] **Step 2: Rewrite `tests/core/format.test.ts`**

Replace test fixtures and assertions to use `QuestionResponse` instead of `NormalizedAnswer`. Cover all four selection kinds (`option`, `options`, `custom`, `chat`) plus notes. Example:

```ts
import { describe, it, expect } from "vitest";
import {
  formatModelLine,
  formatContentSummary,
  formatAnswerForRender,
  formatNoteLine,
} from "../../src/core/format.ts";
import type {
  NormalizedQuestion,
  QuestionResponse,
  QuestionnaireResult,
} from "../../src/core/types.ts";

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
};

describe("formatModelLine", () => {
  it("formats option selection", () => {
    const response: QuestionResponse = {
      questionId: "scope",
      selection: { kind: "option", value: "small", label: "Small" },
    };
    expect(formatModelLine(singleQ, response)).toBe(
      "Scope: user selected: 1. Small",
    );
  });

  it("formats multi-choice options", () => {
    const response: QuestionResponse = {
      questionId: "features",
      selection: {
        kind: "options",
        selected: [
          { value: "auth", label: "Auth" },
          { value: "logging", label: "Logging" },
        ],
      },
    };
    expect(formatModelLine(multiQ, response)).toBe(
      "Features: user selected: 1. Auth, 2. Logging",
    );
  });

  it("formats custom text", () => {
    const response: QuestionResponse = {
      questionId: "scope",
      selection: { kind: "custom", value: "micro-service only" },
    };
    expect(formatModelLine(singleQ, response)).toBe(
      'Scope: user wrote: "micro-service only"',
    );
  });

  it("formats chat signal", () => {
    const response: QuestionResponse = {
      questionId: "scope",
      selection: { kind: "chat" },
    };
    expect(formatModelLine(singleQ, response)).toBe(
      "Scope: user wants to discuss this question",
    );
  });
});

describe("formatNoteLine", () => {
  it("returns null when no notes", () => {
    const response: QuestionResponse = {
      questionId: "scope",
      selection: { kind: "option", value: "small", label: "Small" },
    };
    expect(formatNoteLine(singleQ, response)).toBeNull();
  });

  it("formats note when present", () => {
    const response: QuestionResponse = {
      questionId: "scope",
      selection: { kind: "option", value: "small", label: "Small" },
      notes: "prefer minimal scope",
    };
    expect(formatNoteLine(singleQ, response)).toBe(
      'Scope note: "prefer minimal scope"',
    );
  });
});

describe("formatContentSummary", () => {
  it("formats cancelled result", () => {
    const result: QuestionnaireResult = {
      questions: [singleQ],
      responses: [],
      cancelled: true,
    };
    expect(formatContentSummary(result)).toBe(
      "User cancelled the questionnaire",
    );
  });

  it("formats responses with notes", () => {
    const result: QuestionnaireResult = {
      questions: [singleQ, multiQ],
      responses: [
        {
          questionId: "scope",
          selection: { kind: "option", value: "small", label: "Small" },
          notes: "keep it simple",
        },
        {
          questionId: "features",
          selection: {
            kind: "options",
            selected: [{ value: "auth", label: "Auth" }],
          },
        },
      ],
      cancelled: false,
    };
    const summary = formatContentSummary(result);
    expect(summary).toContain("Scope: user selected: 1. Small");
    expect(summary).toContain('Scope note: "keep it simple"');
    expect(summary).toContain("Features: user selected: 1. Auth");
  });
});

describe("formatAnswerForRender", () => {
  it("formats option for review", () => {
    expect(
      formatAnswerForRender(singleQ, {
        kind: "option",
        value: "small",
        label: "Small",
      }),
    ).toBe("1. Small");
  });

  it("formats custom for review", () => {
    expect(
      formatAnswerForRender(singleQ, { kind: "custom", value: "micro" }),
    ).toBe('(wrote) "micro"');
  });

  it("formats chat for review", () => {
    expect(formatAnswerForRender(singleQ, { kind: "chat" })).toBe("chat");
  });

  it("formats multi-options for review", () => {
    expect(
      formatAnswerForRender(multiQ, {
        kind: "options",
        selected: [
          { value: "auth", label: "Auth" },
          { value: "cache", label: "Cache" },
        ],
      }),
    ).toBe("1. Auth, 3. Cache");
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/core/format.test.ts`
Expected: PASS

### Task 9.6: Update State Machine

**Files:**

- Modify: `src/tui/state.ts`
- Test: `tests/tui/state.test.ts`

- [ ] **Step 1: Update state.ts**

Remove `textValues` from state, remove `submitText` action, update `answers` map type from `Map<string, NormalizedAnswer>` to `Map<string, QuestionSelection>`, update `buildResult` to produce `QuestionResponse[]`.

Key changes:

1. Replace imports: use `QuestionSelection`, `QuestionResponse`, `QuestionnaireResult` instead of `NormalizedAnswer`.
2. Remove `textValues` from `QuestionnaireState` interface.
3. Remove `textValues` initialization from `initState`.
4. Remove `textValues` from `cloneState`.
5. Update `answers` type: `Map<string, QuestionSelection>`.
6. Remove `submitText` case from `reduce`.
7. Update `selectOption` to store `QuestionSelection`:
   ```ts
   next.answers.set(action.questionId, {
     kind: "option",
     value: action.value,
     label: action.label,
   });
   ```
8. Update `toggleCheckbox` to store `QuestionSelection`:
   ```ts
   const selected = q.options
     .filter((o) => checked.has(o.value))
     .map((o) => ({ value: o.value, label: o.label }));
   if (selected.length > 0) {
     next.answers.set(action.questionId, {
       kind: "options",
       selected,
     });
   } else {
     next.answers.delete(action.questionId);
   }
   ```
9. Update `getSelectedValue` to read from `QuestionSelection`:
   ```ts
   export function getSelectedValue(
     state: QuestionnaireState,
     questionId: string,
   ): string | null {
     const sel = state.answers.get(questionId);
     if (sel?.kind === "option") return sel.value;
     return null;
   }
   ```
10. Update `buildResult`:
    ```ts
    export function buildResult(
      state: QuestionnaireState,
      questions: NormalizedQuestion[],
      cancelled: boolean,
    ): QuestionnaireResult {
      const responses: QuestionResponse[] = questions
        .map((q) => {
          const selection = state.answers.get(q.id);
          if (!selection) return undefined;
          return { questionId: q.id, selection };
        })
        .filter((r): r is QuestionResponse => r !== undefined);
      return { questions, responses, cancelled };
    }
    ```

- [ ] **Step 2: Update `tests/tui/state.test.ts`**

**Fixture change:** Remove the text question (`id: "notes"`) from the `questions` array. This changes `questions.length` from 3 to 2, which shifts the review tab index from 3 to 2.

**Remove tests:**

- "pre-populates textValues from recommendations"
- "does not pre-populate textValues when no recommendation"
- "submitText records text answer"
- "submitText overwrites previous text value"
- "moveCursor ignores text questions"

**Update answer shapes** throughout — replace `NormalizedAnswer` shapes with `QuestionSelection` shapes:

- `{ type: "single-choice", questionId: "scope", value: "small", label: "Small" }` → `{ kind: "option", value: "small", label: "Small" }`
- `{ type: "multi-choice", questionId: "features", selected: [...] }` → `{ kind: "options", selected: [...] }`
- Remove any `{ type: "text", ... }` answer entries

**Update tests that fill all answers** (since there are now 2 questions, not 3):

- "returns true when all questions have answers" — remove the `notes` answer, keep `scope` and `features`
- "goes to review when all answered" — remove the `notes` answer
- "selectOption advances to review when all answered" — remove the `notes` answer
- "moveCursor on review tab clamps at last question" — `questions.length - 1` is now 1, not 2

**Update `buildResult` assertions:**

- Change `result.answers` to `result.responses`
- Update response shapes from `{ type: "...", questionId: "..." }` to `{ questionId: "...", selection: { kind: "..." } }`

**Update `selectOption` assertion:** The `answer?.type` check becomes `answer?.kind` — e.g., `expect(answer?.kind).toBe("option")`.

- [ ] **Step 3: Run tests**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/tui/state.test.ts`
Expected: PASS

### Task 9.7: Update Input Mapping

**Files:**

- Modify: `src/tui/input.ts`
- Test: `tests/tui/input.test.ts`

- [ ] **Step 1: Remove text question handling from `mapInput`**

Remove the entire `if (q.type === "text")` block (lines 128-133). Remove the `forward-to-editor` result type for now (it will be reintroduced in Phase 11 for typing mode). The `InputResult` type becomes:

```ts
export type InputResult =
  | { type: "action"; action: Action }
  | { type: "finalize"; cancelled: boolean }
  | { type: "none" };
```

Also remove the condition `q?.type !== "text"` from the Esc handler (line 30) and Left/Right handler (line 49) — all question types now support Esc and Left/Right the same way.

- [ ] **Step 2: Update `tests/tui/input.test.ts`**

**Fixture change:** Remove the text question (`id: "notes"`) from the `questions` array. This changes `questions.length` from 3 to 2 (review tab index becomes 2).

**Remove tests:**

- "text question forwards non-nav keys to editor"
- "Esc on text question returns finalize cancelled"
- "Tab on text question still switches tabs"
- "Left arrow on text question forwards to editor"
- "Right arrow on text question forwards to editor"

**Update tests that fill all answers** for review submission (now need 2 answers, not 3):

- "Enter on review with all answered returns finalize submitted" — remove the `notes` answer entry

**No other changes** — review tab navigation tests already use `questions.length` dynamically.

- [ ] **Step 3: Run tests**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/tui/input.test.ts`
Expected: PASS

### Task 9.8: Update Rendering

**Files:**

- Modify: `src/tui/render-question.ts`
- Modify: `src/tui/render.ts`
- Modify: `src/tui/render-review.ts`
- Test: `tests/tui/render.test.ts`, `tests/tui/render-question.test.ts`, `tests/tui/render-review.test.ts`

- [ ] **Step 1: Remove `renderTextQuestion` from `render-question.ts`**

Remove the `renderTextQuestion` function and the `NormalizedTextQuestion` import.

- [ ] **Step 2: Update `render.ts`**

Remove the `case "text"` branch and the `renderTextQuestion` import. Remove the `editorLines` parameter from `renderQuestionnaire` (will be reintroduced in Phase 11). Update the hint bar — remove the `q?.type !== "text"` condition (hints now always show).

Updated signature:

```ts
export function renderQuestionnaire(
  state: QuestionnaireState,
  questions: NormalizedQuestion[],
  theme: RenderTheme,
  width: number,
): string[];
```

- [ ] **Step 3: Update `render-review.ts`**

Change the `answers` parameter type from `Map<string, NormalizedAnswer>` to `Map<string, QuestionSelection>`. Update `formatAnswerForRender` call — it now takes `(question, selection)` instead of `(question, answer)`:

```ts
import type { NormalizedQuestion, QuestionSelection } from "../core/types.ts";
import { formatAnswerForRender } from "../core/format.ts";
import { pushWrapped, pushWrappedWithPrefix } from "./helpers.ts";
import type { RenderTheme } from "./theme.ts";

export function renderReviewScreen(
  questions: NormalizedQuestion[],
  answers: Map<string, QuestionSelection>,
  cursor: number,
  theme: RenderTheme,
  width: number,
): string[] {
  const lines: string[] = [];
  const allAnswered = questions.every((q) => answers.has(q.id));

  pushWrapped(lines, theme.fg("accent", theme.bold("Review answers")), width);
  lines.push("");

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const selection = answers.get(q.id);
    const isCursor = i === cursor;
    const prefix = isCursor ? theme.fg("accent", "\u25B8 ") : "  ";
    const marker = selection
      ? theme.fg("success", "\u25A0")
      : theme.fg("warning", "\u25A1");
    const value = selection
      ? formatAnswerForRender(q, selection)
      : "(unanswered)";
    const valueColor = selection ? "text" : "muted";

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

- [ ] **Step 4: Update `questionnaire-ui.ts`**

Remove editor-related code for text questions. Remove the `editorLines` parameter from `renderQuestionnaire` call. Remove `editor.onSubmit` handler for text. Remove `forward-to-editor` case. Remove editor text sync on tab switch for text questions.

The adapter becomes much simpler for now (editor will be reintroduced in Phase 11):

```ts
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { NormalizedQuestion, QuestionnaireResult } from "../core/types.ts";
import { initState, reduce, buildResult } from "./state.ts";
import { mapInput } from "./input.ts";
import { renderQuestionnaire } from "./render.ts";

export async function runQuestionnaireUI(
  ctx: Pick<ExtensionContext, "ui">,
  questions: NormalizedQuestion[],
): Promise<QuestionnaireResult> {
  return ctx.ui.custom<QuestionnaireResult>((tui, theme, _kb, done) => {
    let state = initState(questions);

    function handleInput(data: string) {
      const result = mapInput(data, state, questions);
      switch (result.type) {
        case "action":
          state = reduce(state, result.action, questions);
          tui.requestRender();
          break;
        case "finalize":
          done(buildResult(state, questions, result.cancelled));
          break;
        case "none":
          break;
      }
    }

    function render(width: number): string[] {
      return renderQuestionnaire(state, questions, theme, width);
    }

    return {
      render,
      invalidate: () => {},
      handleInput,
    };
  });
}
```

- [ ] **Step 5: Update render tests**

**`tests/tui/render-question.test.ts`:**

- Remove `NormalizedTextQuestion` import and `renderTextQuestion` import
- Remove the entire `"renderTextQuestion"` describe block (lines 147-168)
- Keep `renderSingleChoiceQuestion` and `renderMultiChoiceQuestion` tests unchanged

**`tests/tui/render.test.ts`:**

- **Fixture change:** Remove the text question from the `questions` array (currently has `[single-choice, text]`). Replace it with a multi-choice question so the fixture has 2 questions (keeps review tab tests meaningful).
- Remove `editorLines` parameter from ALL `renderQuestionnaire` calls — signature is now `(state, questions, theme, width)`
- Remove tests: "renders text question with editor lines", "does not include choice hint bar for text questions"
- Update remaining tests to match the new 4-parameter signature

**`tests/tui/render-review.test.ts`:**

- **Fixture change:** Replace the text question with a multi-choice question so the fixture has 2 questions
- Change `NormalizedAnswer` type import to `QuestionSelection` from types
- Update `Map<string, NormalizedAnswer>` to `Map<string, QuestionSelection>`
- Update answer entries from `{ type: "single-choice", questionId: "scope", value: "small", label: "Small" }` to `{ kind: "option", value: "small", label: "Small" }`
- Replace the text answer entry (`{ type: "text", ... }`) with a multi-choice selection (`{ kind: "options", selected: [...] }`)

- [ ] **Step 6: Run all render tests**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/tui/`
Expected: PASS

### Task 9.9: Update Barrel Exports and Entry Point

**Files:**

- Modify: `src/core/index.ts`
- Modify: `src/index.ts`
- Test: `tests/index.test.ts`

- [ ] **Step 1: Update `src/core/index.ts`**

Remove exports for `NormalizedTextQuestion`, `TextAnswer`, `TextQuestionInput`. Add exports for `QuestionSelection`, `QuestionResponse`. Change `NormalizedAnswer` references to the new types:

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
  QuestionInput,
} from "./schema.ts";
export type {
  NormalizedMultiChoiceQuestion,
  NormalizedQuestion,
  NormalizedSingleChoiceQuestion,
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

- [ ] **Step 2: Update `src/index.ts` (entry point)**

Update tool description to remove "free-text" mention. Update `promptGuidelines` to remove text-question guidance. Update `renderResult` to use `QuestionResponse[]`:

In the description, change to:

```ts
description:
  "Ask the user 1-10 structured questions. Supports single-choice and multi-choice questions. Use for clarifying requirements, getting preferences, or confirming decisions.",
```

Remove the guideline: `"Use choice/multi-choice when options are enumerable; use text for open-ended input."`.

In `renderResult`, update to iterate `details.responses` instead of `details.answers`:

```ts
const lines = details.responses.map((r) => {
  const q = details.questions.find((q) => q.id === r.questionId);
  if (!q) return `${theme.fg("success", "\u2713 ")}${r.questionId}`;
  const display = formatAnswerForRender(q, r.selection);
  return `${theme.fg("success", "\u2713 ")}${theme.fg("accent", `${q.header}:`)} ${display}`;
});
```

Also update `errorResult` to use `responses: []` instead of `answers: []`.

- [ ] **Step 3: Update `tests/index.test.ts`**

No changes needed — the existing tests only check export type and tool registration name, which are unaffected by this phase.

- [ ] **Step 4: Run full check**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && pnpm check`
Expected: All lint, typecheck, and tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/ tests/
git commit -m "refactor: remove text question type, introduce QuestionResponse result shape"
```
