# Questionnaire Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the questionnaire to remove free-text questions, add sentinel options ("Type something." / "Chat about this"), add per-question notes via Tab, and remap tab-navigation to Left/Right.

**Architecture:** Evolve the existing pure-function state machine. Five atomic phases (9-13), each producing a fully usable questionnaire. Core layer changes first, then TUI layer changes. Each phase has its own detailed plan file in `docs/plans/`.

**Tech Stack:** TypeScript 6, Vitest 4, Biome 2.5, pi-tui, pi-coding-agent, TypeBox

**Spec:** `docs/specs/2026-06-21-questionnaire-refactor-design.md`

**Verification:** After each phase, run `pnpm check` (lint + typecheck + tests). All must pass before committing.

---

## Phase Overview

| Phase | What it does                                          | Plan file                                                           | Usable after?                  |
| ----- | ----------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------ |
| 9     | Remove text question type, introduce new result shape | `2026-06-21-questionnaire-refactor-plan-phase-9-remove-text.md`     | Yes — single/multi-choice work |
| 10    | Remap keys: Left/Right for tabs, unbind Tab/Shift+Tab | `2026-06-21-questionnaire-refactor-plan-phase-10-key-remap.md`      | Yes — new key mapping active   |
| 11    | Add "Type something." sentinel to single-choice       | `2026-06-21-questionnaire-refactor-plan-phase-11-type-something.md` | Yes — custom text input works  |
| 12    | Add "Chat about this" + "Next" sentinels              | `2026-06-21-questionnaire-refactor-plan-phase-12-chat-next.md`      | Yes — all sentinels work       |
| 13    | Add per-question notes via Tab                        | `2026-06-21-questionnaire-refactor-plan-phase-13-notes.md`          | Yes — full spec complete       |

---

## Phase 9: Remove Text Question Type + New Result Shape

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

Remove any test cases that use `type: "text"` questions. Search for `"text"` in the test file and remove those test blocks. Keep all single-choice and multi-choice tests unchanged.

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

Update all test assertions that reference `NormalizedAnswer` shapes to use `QuestionSelection` shapes. For example, where tests check `state.answers.get("scope")` expecting `{ type: "single-choice", ... }`, change to `{ kind: "option", ... }`.

Remove all test cases for `submitText` action and `textValues`.

Remove text question fixtures from the `questions` array used in tests.

Update `buildResult` test assertions from `answers: [...]` to `responses: [...]` with new shapes.

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

Remove all test cases for text question input (the `"text"` describe block and any text question fixtures). Remove tests for `forward-to-editor` result type.

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

Update test fixtures in `tests/tui/render.test.ts`, `tests/tui/render-question.test.ts`, and `tests/tui/render-review.test.ts`:

- Remove text question fixtures and test cases
- Update `renderQuestionnaire` calls to remove `editorLines` parameter
- Update review screen tests for new `QuestionSelection` type

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

Remove text-question test cases, update result assertions for new shape.

- [ ] **Step 4: Run full check**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && pnpm check`
Expected: All lint, typecheck, and tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/ tests/
git commit -m "refactor: remove text question type, introduce QuestionResponse result shape"
```

---

## Phase 10: Key Remapping

Remap tab-navigation from Tab/Shift+Tab to Left/Right. Tab becomes unbound (reserved for Phase 13 notes). Left/Right now works on all question types.

### Task 10.1: Update Input Mapping

**Files:**

- Modify: `src/tui/input.ts`
- Test: `tests/tui/input.test.ts`

- [ ] **Step 1: Rewrite key routing in `mapInput`**

Replace Tab/Shift+Tab tab-navigation with Left/Right. Remove the Tab/Shift+Tab bindings. Left/Right now always does tab navigation (they were previously guarded by `q?.type !== "text"` which is gone).

Updated `mapInput`:

```ts
import { Key, matchesKey } from "@earendil-works/pi-tui";
import type { NormalizedQuestion } from "../core/types.ts";
import {
  type Action,
  type QuestionnaireState,
  allAnswered,
  currentQuestion,
} from "./state.ts";

export type InputResult =
  | { type: "action"; action: Action }
  | { type: "finalize"; cancelled: boolean }
  | { type: "none" };

function action(a: Action): InputResult {
  return { type: "action", action: a };
}

export function mapInput(
  data: string,
  state: QuestionnaireState,
  questions: NormalizedQuestion[],
): InputResult {
  const reviewTabIndex = questions.length;
  const totalTabs = questions.length + 1;
  const q = currentQuestion(state, questions);

  // Global Esc
  if (matchesKey(data, Key.escape)) {
    return { type: "finalize", cancelled: true };
  }

  // Tab navigation via Left/Right
  if (matchesKey(data, Key.right)) {
    return action({
      type: "switchTab",
      tab: (state.activeTab + 1) % totalTabs,
    });
  }
  if (matchesKey(data, Key.left)) {
    return action({
      type: "switchTab",
      tab: (state.activeTab - 1 + totalTabs) % totalTabs,
    });
  }

  // Review tab
  if (state.activeTab === reviewTabIndex) {
    if (matchesKey(data, Key.up)) {
      return action({ type: "moveCursor", direction: "up" });
    }
    if (matchesKey(data, Key.down)) {
      return action({ type: "moveCursor", direction: "down" });
    }
    if (matchesKey(data, Key.enter) && allAnswered(state, questions)) {
      return { type: "finalize", cancelled: false };
    }
    if (matchesKey(data, Key.space) || matchesKey(data, Key.enter)) {
      if (state.reviewCursor < questions.length) {
        return action({ type: "switchTab", tab: state.reviewCursor });
      }
    }
    return { type: "none" };
  }

  if (!q) return { type: "none" };

  // Single-choice
  if (q.type === "single-choice") {
    if (matchesKey(data, Key.up)) {
      return action({ type: "moveCursor", direction: "up" });
    }
    if (matchesKey(data, Key.down)) {
      return action({ type: "moveCursor", direction: "down" });
    }
    if (matchesKey(data, Key.enter) || matchesKey(data, Key.space)) {
      const opt = q.options[state.optionCursor];
      return action({
        type: "selectOption",
        questionId: q.id,
        value: opt.value,
        label: opt.label,
      });
    }
    return { type: "none" };
  }

  // Multi-choice
  if (q.type === "multi-choice") {
    if (matchesKey(data, Key.up)) {
      return action({ type: "moveCursor", direction: "up" });
    }
    if (matchesKey(data, Key.down)) {
      return action({ type: "moveCursor", direction: "down" });
    }
    if (matchesKey(data, Key.space)) {
      const opt = q.options[state.optionCursor];
      return action({
        type: "toggleCheckbox",
        questionId: q.id,
        value: opt.value,
      });
    }
    if (matchesKey(data, Key.enter)) {
      return { type: "none" };
    }
    return { type: "none" };
  }

  return { type: "none" };
}
```

- [ ] **Step 2: Update tests**

In `tests/tui/input.test.ts`:

- Replace all Tab key tests with Left/Right key tests for tab navigation
- Remove Shift+Tab tests, replace with Left key tests
- Remove any `q?.type !== "text"` conditional test logic
- Verify Left/Right switches tabs on both single-choice and multi-choice

- [ ] **Step 3: Run tests**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/tui/input.test.ts`
Expected: PASS

### Task 10.2: Update Hint Bar

**Files:**

- Modify: `src/tui/render.ts`
- Test: `tests/tui/render.test.ts`

- [ ] **Step 1: Update hint text in `render.ts`**

Change the hint strings to reflect new key mapping:

```ts
const hint =
  state.activeTab === reviewTabIndex
    ? "Left/Right tabs | Enter submit | Space edit | Esc cancel"
    : q?.type === "multi-choice"
      ? "Left/Right tabs | Up/Down move | Space toggle | Esc cancel"
      : "Left/Right tabs | Up/Down move | Space/Enter select | Esc cancel";
```

- [ ] **Step 2: Update render tests**

Update any hint-bar assertions to match new key labels.

- [ ] **Step 3: Run full check**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && pnpm check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/ tests/
git commit -m "refactor: remap tab navigation from Tab/Shift+Tab to Left/Right"
```

---

## Phase 11: "Type Something." Sentinel for Single-Choice

Add the `allowOther` field, `inputMode` state, inline editor, and "Type something." sentinel row to single-choice questions.

### Task 11.1: Add `allowOther` to Schema and Types

**Files:**

- Modify: `src/core/schema.ts`
- Modify: `src/core/types.ts`
- Modify: `src/core/normalize.ts`
- Test: `tests/core/normalize.test.ts`

- [ ] **Step 1: Add `allowOther` to `SingleChoiceQuestionSchema`**

In `src/core/schema.ts`, add to `SingleChoiceQuestionSchema`:

```ts
allowOther: Type.Optional(
  Type.Boolean({
    description:
      'Append a "Type something." option for custom text input (default: true)',
  }),
),
```

- [ ] **Step 2: Add `allowOther` to `NormalizedSingleChoiceQuestion`**

In `src/core/types.ts`:

```ts
export interface NormalizedSingleChoiceQuestion {
  type: "single-choice";
  id: string;
  header: string;
  prompt: string;
  options: QuestionOption[];
  recommendation: string | null;
  allowOther: boolean;
}
```

- [ ] **Step 3: Update normalization**

In `src/core/normalize.ts`, update `normalizeSingleChoice`:

```ts
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
    allowOther: q.allowOther !== false,
  };
}
```

- [ ] **Step 4: Update normalize tests**

Add test: `it("defaults allowOther to true for single-choice")` and `it("preserves allowOther: false")`.

- [ ] **Step 5: Run tests**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/core/normalize.test.ts`
Expected: PASS

### Task 11.2: Add Sentinel Helpers and State Changes

**Files:**

- Modify: `src/tui/state.ts`
- Test: `tests/tui/state.test.ts`

- [ ] **Step 1: Add `CursorTarget` type and `visibleRowCount`/`cursorTarget` helpers**

Add at the top of `src/tui/state.ts` (after imports):

```ts
export type CursorTarget =
  | { kind: "option"; index: number }
  | { kind: "other" }
  | { kind: "chat" }
  | { kind: "next" };

export function visibleRowCount(question: NormalizedQuestion): number {
  if (question.type === "single-choice") {
    return question.options.length + (question.allowOther ? 1 : 0);
  }
  return question.options.length;
}

export function cursorTarget(
  question: NormalizedQuestion,
  cursor: number,
): CursorTarget {
  if (cursor < question.options.length) {
    return { kind: "option", index: cursor };
  }
  if (
    question.type === "single-choice" &&
    question.allowOther &&
    cursor === question.options.length
  ) {
    return { kind: "other" };
  }
  return {
    kind: "option",
    index: Math.min(cursor, question.options.length - 1),
  };
}
```

- [ ] **Step 2: Add new state fields and actions**

Update `QuestionnaireState`:

```ts
export interface QuestionnaireState {
  activeTab: number;
  optionCursor: number;
  reviewCursor: number;
  answers: Map<string, QuestionSelection>;
  multiChecked: Map<string, Set<string>>;
  inputMode: "navigate" | "typing" | "notes";
  editingQuestionId: string | null;
  customText: Map<string, string>;
}
```

Update `Action` union — add:

```ts
| { type: "enterTyping"; questionId: string }
| { type: "submitTyping"; questionId: string; value: string }
| { type: "cancelTyping" }
```

Update `initState` — initialize new fields:

```ts
return {
  activeTab: 0,
  optionCursor: 0,
  reviewCursor: 0,
  answers: new Map(),
  multiChecked,
  inputMode: "navigate",
  editingQuestionId: null,
  customText: new Map(),
};
```

Update `cloneState`:

```ts
function cloneState(state: QuestionnaireState): QuestionnaireState {
  return {
    activeTab: state.activeTab,
    optionCursor: state.optionCursor,
    reviewCursor: state.reviewCursor,
    answers: new Map(state.answers),
    multiChecked: new Map(
      [...state.multiChecked].map(([k, v]) => [k, new Set(v)]),
    ),
    inputMode: state.inputMode,
    editingQuestionId: state.editingQuestionId,
    customText: new Map(state.customText),
  };
}
```

- [ ] **Step 3: Update `moveCursor` in reducer**

Use `visibleRowCount` for cursor clamping:

```ts
case "moveCursor": {
  const q = currentQuestion(next, questions);
  if (!q) {
    // Review tab
    if (action.direction === "up") {
      next.reviewCursor = Math.max(0, next.reviewCursor - 1);
    } else {
      next.reviewCursor = Math.min(
        questions.length - 1,
        next.reviewCursor + 1,
      );
    }
    return next;
  }
  const rowCount = visibleRowCount(q);
  if (action.direction === "up") {
    next.optionCursor = Math.max(0, next.optionCursor - 1);
  } else {
    next.optionCursor = Math.min(rowCount - 1, next.optionCursor + 1);
  }
  return next;
}
```

- [ ] **Step 4: Add reducer cases for typing actions**

```ts
case "enterTyping": {
  next.inputMode = "typing";
  next.editingQuestionId = action.questionId;
  return next;
}
case "submitTyping": {
  const trimmed = action.value.trim();
  if (trimmed) {
    next.customText.set(action.questionId, trimmed);
    next.answers.set(action.questionId, {
      kind: "custom",
      value: trimmed,
    });
    const nextTab = advanceToNextTab(next, questions);
    next.activeTab = nextTab;
    next.optionCursor = 0;
    next.reviewCursor = 0;
  }
  next.inputMode = "navigate";
  next.editingQuestionId = null;
  return next;
}
case "cancelTyping": {
  next.inputMode = "navigate";
  next.editingQuestionId = null;
  return next;
}
```

- [ ] **Step 5: Update `switchTab` to reset inputMode**

```ts
case "switchTab": {
  next.activeTab = action.tab;
  next.optionCursor = 0;
  next.reviewCursor = 0;
  next.inputMode = "navigate";
  next.editingQuestionId = null;
  return next;
}
```

- [ ] **Step 6: Write tests for new helpers and actions**

Add tests in `tests/tui/state.test.ts`:

```ts
describe("visibleRowCount", () => {
  it("includes other sentinel for single-choice", () => {
    const q = { ...singleQ, allowOther: true };
    expect(visibleRowCount(q)).toBe(q.options.length + 1);
  });

  it("excludes other sentinel when allowOther is false", () => {
    const q = { ...singleQ, allowOther: false };
    expect(visibleRowCount(q)).toBe(q.options.length);
  });
});

describe("cursorTarget", () => {
  it("returns option for cursor within options range", () => {
    const q = { ...singleQ, allowOther: true };
    expect(cursorTarget(q, 0)).toEqual({ kind: "option", index: 0 });
    expect(cursorTarget(q, 1)).toEqual({ kind: "option", index: 1 });
  });

  it("returns other for cursor at options.length", () => {
    const q = { ...singleQ, allowOther: true };
    expect(cursorTarget(q, q.options.length)).toEqual({ kind: "other" });
  });
});
```

Add tests for `enterTyping`, `submitTyping`, `cancelTyping` actions in the `reduce` describe block.

- [ ] **Step 7: Run tests**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/tui/state.test.ts`
Expected: PASS

### Task 11.3: Update Input Mapping for Typing Mode

**Files:**

- Modify: `src/tui/input.ts`
- Test: `tests/tui/input.test.ts`

- [ ] **Step 1: Add `forward-to-editor` back and typing mode routing**

Update `InputResult`:

```ts
export type InputResult =
  | { type: "action"; action: Action }
  | { type: "finalize"; cancelled: boolean }
  | { type: "forward-to-editor" }
  | { type: "none" };
```

Add typing mode handling at the top of `mapInput`, before any other key checks:

```ts
// Typing mode — editor active for "Type something."
if (state.inputMode === "typing") {
  if (matchesKey(data, Key.enter)) {
    return { type: "none" }; // editor.onSubmit handles this
  }
  if (matchesKey(data, Key.escape)) {
    return action({ type: "cancelTyping" });
  }
  if (matchesKey(data, Key.up)) {
    return action({ type: "cancelTyping" });
  }
  if (matchesKey(data, Key.down)) {
    return action({ type: "cancelTyping" });
  }
  // Left/Right and all other keys → forward to editor
  return { type: "forward-to-editor" };
}
```

Note: Enter in typing mode is handled by `editor.onSubmit` in `questionnaire-ui.ts`, not by `mapInput`. So `mapInput` returns `none` for Enter. The `cancelTyping` action on Up/Down returns navigate mode, and the cursor movement will be handled on the next keypress.

Update the single-choice Space/Enter handler to detect sentinel rows:

```ts
if (q.type === "single-choice") {
  if (matchesKey(data, Key.up)) {
    return action({ type: "moveCursor", direction: "up" });
  }
  if (matchesKey(data, Key.down)) {
    return action({ type: "moveCursor", direction: "down" });
  }
  if (matchesKey(data, Key.enter) || matchesKey(data, Key.space)) {
    const target = cursorTarget(q, state.optionCursor);
    if (target.kind === "option") {
      const opt = q.options[target.index];
      return action({
        type: "selectOption",
        questionId: q.id,
        value: opt.value,
        label: opt.label,
      });
    }
    if (target.kind === "other") {
      return action({ type: "enterTyping", questionId: q.id });
    }
  }
  return { type: "none" };
}
```

Add import for `cursorTarget` from state.

- [ ] **Step 2: Write tests for typing mode input**

Add tests:

- `it("forwards keys to editor in typing mode")`
- `it("Esc in typing mode returns cancelTyping action")`
- `it("Up in typing mode returns cancelTyping action")`
- `it("Down in typing mode returns cancelTyping action")`
- `it("Enter/Space on 'other' sentinel returns enterTyping")`

- [ ] **Step 3: Run tests**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/tui/input.test.ts`
Expected: PASS

### Task 11.4: Update Rendering for "Type Something."

**Files:**

- Modify: `src/tui/render-question.ts`
- Modify: `src/tui/render.ts`
- Modify: `src/tui/questionnaire-ui.ts`
- Test: `tests/tui/render-question.test.ts`, `tests/tui/render.test.ts`

- [ ] **Step 1: Add sentinel row rendering to `renderSingleChoiceQuestion`**

Update the function signature to accept new parameters:

```ts
export function renderSingleChoiceQuestion(
  question: NormalizedSingleChoiceQuestion,
  cursor: number,
  selectedValue: string | null,
  customText: string | null,
  inputMode: "navigate" | "typing" | "notes",
  editorLines: string[],
  theme: RenderTheme,
  width: number,
): string[];
```

After the options loop, add sentinel rendering:

```ts
// "Type something." sentinel
if (question.allowOther) {
  const sentinelIndex = question.options.length;
  const isCursor = sentinelIndex === cursor;
  const prefix = isCursor ? theme.fg("accent", "\u25B8 ") : "  ";

  if (inputMode === "typing") {
    // Inline editor replaces the sentinel text
    const editorContent = editorLines.join("") || "";
    const label = `${sentinelIndex + 1}. ${editorContent}`;
    pushWrappedWithPrefix(lines, prefix, theme.fg("accent", label), width);
  } else if (customText) {
    // Show persisted custom text
    const label = `${sentinelIndex + 1}. "${customText}"`;
    const color = isCursor ? "accent" : "text";
    pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
  } else {
    const label = `${sentinelIndex + 1}. Type something.`;
    const color = isCursor ? "accent" : "muted";
    pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
  }
}
```

- [ ] **Step 2: Update `render.ts`**

Add `editorLines` parameter back to `renderQuestionnaire`. Pass `customText`, `inputMode`, and `editorLines` to `renderSingleChoiceQuestion`:

```ts
export function renderQuestionnaire(
  state: QuestionnaireState,
  questions: NormalizedQuestion[],
  editorLines: string[],
  theme: RenderTheme,
  width: number,
): string[];
```

In the single-choice case:

```ts
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
```

Update the hint bar to show typing mode hints:

```ts
lines.push("");
let hint: string;
if (state.inputMode === "typing") {
  hint = "Enter submit | Esc cancel | Up/Down exit";
} else if (state.activeTab === reviewTabIndex) {
  hint = "Left/Right tabs | Enter submit | Space edit | Esc cancel";
} else if (q?.type === "multi-choice") {
  hint = "Left/Right tabs | Up/Down move | Space toggle | Esc cancel";
} else {
  hint = "Left/Right tabs | Up/Down move | Space/Enter select | Esc cancel";
}
pushWrapped(lines, theme.fg("dim", hint), renderWidth);
```

- [ ] **Step 3: Update `questionnaire-ui.ts`**

Reintroduce the Editor for typing mode:

```ts
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Editor, type EditorTheme } from "@earendil-works/pi-tui";
import type { NormalizedQuestion, QuestionnaireResult } from "../core/types.ts";
import { initState, reduce, buildResult, currentQuestion } from "./state.ts";
import { mapInput } from "./input.ts";
import { renderQuestionnaire } from "./render.ts";

export async function runQuestionnaireUI(
  ctx: Pick<ExtensionContext, "ui">,
  questions: NormalizedQuestion[],
): Promise<QuestionnaireResult> {
  return ctx.ui.custom<QuestionnaireResult>((tui, theme, _kb, done) => {
    let state = initState(questions);

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
      if (state.inputMode === "typing" && state.editingQuestionId) {
        state = reduce(
          state,
          {
            type: "submitTyping",
            questionId: state.editingQuestionId,
            value: value.trim(),
          },
          questions,
        );
        editor.setText("");
        tui.requestRender();
      }
    };

    function handleInput(data: string) {
      const result = mapInput(data, state, questions);
      switch (result.type) {
        case "action":
          state = reduce(state, result.action, questions);
          // Sync editor when entering typing mode
          if (state.inputMode === "typing" && state.editingQuestionId) {
            editor.setText(state.customText.get(state.editingQuestionId) ?? "");
          }
          tui.requestRender();
          break;
        case "finalize":
          done(buildResult(state, questions, result.cancelled));
          break;
        case "forward-to-editor":
          editor.handleInput(data);
          tui.requestRender();
          break;
        case "none":
          break;
      }
    }

    function render(width: number): string[] {
      const editorLines =
        state.inputMode === "typing"
          ? editor.render(Math.max(1, width - 4))
          : [];
      return renderQuestionnaire(state, questions, editorLines, theme, width);
    }

    return {
      render,
      invalidate: () => {},
      handleInput,
    };
  });
}
```

- [ ] **Step 4: Update render tests**

Add tests for sentinel row rendering in `tests/tui/render-question.test.ts`:

- `it("renders 'Type something.' sentinel when allowOther is true")`
- `it("does not render sentinel when allowOther is false")`
- `it("renders custom text when set")`
- `it("renders inline editor in typing mode")`

Update `renderQuestionnaire` calls in `tests/tui/render.test.ts` to pass `editorLines`.

- [ ] **Step 5: Run full check**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && pnpm check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/ tests/
git commit -m "feat: add 'Type something.' sentinel to single-choice questions"
```

---

## Phase 12: "Chat About This" + "Next" Sentinels

Add `allowChat` field to both question types, the "Chat about this" sentinel to both, and the "Next" row to multi-choice.

### Task 12.1: Add `allowChat` to Schema, Types, Normalization

**Files:**

- Modify: `src/core/schema.ts`
- Modify: `src/core/types.ts`
- Modify: `src/core/normalize.ts`
- Test: `tests/core/normalize.test.ts`

- [ ] **Step 1: Add `allowChat` to both question schemas**

In `src/core/schema.ts`, add to both `SingleChoiceQuestionSchema` and `MultiChoiceQuestionSchema`:

```ts
allowChat: Type.Optional(
  Type.Boolean({
    description:
      'Append a "Chat about this" option to signal the agent for discussion (default: true)',
  }),
),
```

- [ ] **Step 2: Add `allowChat` to normalized types**

In `src/core/types.ts`:

```ts
export interface NormalizedSingleChoiceQuestion {
  type: "single-choice";
  id: string;
  header: string;
  prompt: string;
  options: QuestionOption[];
  recommendation: string | null;
  allowOther: boolean;
  allowChat: boolean;
}

export interface NormalizedMultiChoiceQuestion {
  type: "multi-choice";
  id: string;
  header: string;
  prompt: string;
  options: QuestionOption[];
  recommendation: string[];
  allowChat: boolean;
}
```

- [ ] **Step 3: Update normalization**

In `normalizeSingleChoice`, add: `allowChat: q.allowChat !== false,`

In `normalizeMultiChoice`, add: `allowChat: q.allowChat !== false,`

- [ ] **Step 4: Update normalize tests and run**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/core/normalize.test.ts`
Expected: PASS

### Task 12.2: Update State Helpers for Chat and Next

**Files:**

- Modify: `src/tui/state.ts`
- Test: `tests/tui/state.test.ts`

- [ ] **Step 1: Update `visibleRowCount` and `cursorTarget`**

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

export function cursorTarget(
  question: NormalizedQuestion,
  cursor: number,
): CursorTarget {
  if (cursor < question.options.length) {
    return { kind: "option", index: cursor };
  }

  let sentinel = question.options.length;

  if (question.type === "single-choice") {
    if (question.allowOther && cursor === sentinel) return { kind: "other" };
    if (question.allowOther) sentinel++;
    if (question.allowChat && cursor === sentinel) return { kind: "chat" };
    return { kind: "option", index: question.options.length - 1 };
  }

  // multi-choice
  if (question.allowChat && cursor === sentinel) return { kind: "chat" };
  if (question.allowChat) sentinel++;
  if (cursor === sentinel) return { kind: "next" };
  return { kind: "option", index: question.options.length - 1 };
}
```

- [ ] **Step 2: Add `selectChat` action to reducer**

Add to `Action` type:

```ts
| { type: "selectChat"; questionId: string }
```

Add reducer case:

```ts
case "selectChat": {
  // Chat replaces any existing selection; for multi-choice, clear checked
  next.answers.set(action.questionId, { kind: "chat" });
  const checked = next.multiChecked.get(action.questionId);
  if (checked) checked.clear();
  return next;
}
```

- [ ] **Step 3: Add multi-choice confirm action**

For the "Next" row, we reuse the existing answer sync behavior. When the user presses Enter/Space on "Next", the multi-choice answer (from toggled checkboxes) is already synced. We just need to advance:

Add to `Action` type:

```ts
| { type: "confirmMulti"; questionId: string }
```

Add reducer case:

```ts
case "confirmMulti": {
  // Answer already synced via toggleCheckbox. Just advance.
  const nextTab = advanceToNextTab(next, questions);
  next.activeTab = nextTab;
  next.optionCursor = 0;
  next.reviewCursor = 0;
  return next;
}
```

- [ ] **Step 4: Write tests for new helpers and actions**

Add tests for `visibleRowCount` with `allowChat`, `cursorTarget` with `chat` and `next` kinds, `selectChat` action, `confirmMulti` action.

- [ ] **Step 5: Run tests**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/tui/state.test.ts`
Expected: PASS

### Task 12.3: Update Input Mapping for Chat and Next

**Files:**

- Modify: `src/tui/input.ts`
- Test: `tests/tui/input.test.ts`

- [ ] **Step 1: Update single-choice Enter/Space handler**

```ts
if (q.type === "single-choice") {
  // ... Up/Down unchanged ...
  if (matchesKey(data, Key.enter) || matchesKey(data, Key.space)) {
    const target = cursorTarget(q, state.optionCursor);
    if (target.kind === "option") {
      const opt = q.options[target.index];
      return action({
        type: "selectOption",
        questionId: q.id,
        value: opt.value,
        label: opt.label,
      });
    }
    if (target.kind === "other") {
      return action({ type: "enterTyping", questionId: q.id });
    }
    if (target.kind === "chat") {
      return action({ type: "selectChat", questionId: q.id });
    }
  }
  return { type: "none" };
}
```

- [ ] **Step 2: Update multi-choice handler**

```ts
if (q.type === "multi-choice") {
  // ... Up/Down unchanged ...
  if (matchesKey(data, Key.space) || matchesKey(data, Key.enter)) {
    const target = cursorTarget(q, state.optionCursor);
    if (target.kind === "option") {
      const opt = q.options[target.index];
      return action({
        type: "toggleCheckbox",
        questionId: q.id,
        value: opt.value,
      });
    }
    if (target.kind === "chat") {
      return action({ type: "selectChat", questionId: q.id });
    }
    if (target.kind === "next") {
      return action({ type: "confirmMulti", questionId: q.id });
    }
  }
  return { type: "none" };
}
```

- [ ] **Step 3: Write tests and run**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/tui/input.test.ts`
Expected: PASS

### Task 12.4: Update Rendering for Chat and Next

**Files:**

- Modify: `src/tui/render-question.ts`
- Test: `tests/tui/render-question.test.ts`

- [ ] **Step 1: Add chat sentinel rendering to `renderSingleChoiceQuestion`**

After the "Type something." sentinel block, add:

```ts
// "Chat about this" sentinel
if (question.allowChat) {
  const chatIndex = question.options.length + (question.allowOther ? 1 : 0);
  const isCursor = chatIndex === cursor;
  const prefix = isCursor ? theme.fg("accent", "\u25B8 ") : "  ";
  const label = `${chatIndex + 1}. Chat about this`;
  const color = isCursor ? "accent" : "muted";
  pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
}
```

- [ ] **Step 2: Add chat and Next sentinel rendering to `renderMultiChoiceQuestion`**

Update the function signature to accept `allowChat`:

```ts
export function renderMultiChoiceQuestion(
  question: NormalizedMultiChoiceQuestion,
  cursor: number,
  checked: Set<string>,
  theme: RenderTheme,
  width: number,
): string[];
```

After the options loop, add:

```ts
// "Chat about this" sentinel
if (question.allowChat) {
  const chatIndex = question.options.length;
  const isCursor = chatIndex === cursor;
  const prefix = isCursor ? theme.fg("accent", "\u25B8 ") : "  ";
  const isChecked = false; // chat is never "checked"
  const marker = "[ ]";
  const label = `${marker} Chat about this`;
  const color = isCursor ? "accent" : "muted";
  pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
}

// "Next" sentinel
{
  const nextIndex = question.options.length + (question.allowChat ? 1 : 0);
  const isCursor = nextIndex === cursor;
  const prefix = isCursor ? theme.fg("accent", "\u25B8 ") : "  ";
  const label = "\u2500\u2500 Next";
  const color = isCursor ? "accent" : "dim";
  pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
}
```

- [ ] **Step 3: Write tests and run full check**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && pnpm check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/ tests/
git commit -m "feat: add 'Chat about this' and 'Next' sentinels"
```

---

## Phase 13: Per-Question Notes via Tab

Add `notes` state, `enterNotes`/`submitNotes`/`cancelNotes` actions, Tab key routing, notes editor, and `[n]` indicator in tab bar and review screen.

### Task 13.1: Add Notes State and Actions

**Files:**

- Modify: `src/tui/state.ts`
- Test: `tests/tui/state.test.ts`

- [ ] **Step 1: Add `notes` to state and `hasSelection` helper**

In `QuestionnaireState`, add:

```ts
notes: Map<string, string>;
```

In `initState`:

```ts
notes: new Map(),
```

In `cloneState`:

```ts
notes: new Map(state.notes),
```

Add helper:

```ts
export function hasSelection(
  state: QuestionnaireState,
  questionId: string,
): boolean {
  return state.answers.has(questionId);
}
```

- [ ] **Step 2: Add notes actions to Action type**

```ts
| { type: "enterNotes"; questionId: string }
| { type: "submitNotes"; questionId: string; value: string }
| { type: "cancelNotes" }
```

- [ ] **Step 3: Add reducer cases**

```ts
case "enterNotes": {
  next.inputMode = "notes";
  next.editingQuestionId = action.questionId;
  return next;
}
case "submitNotes": {
  const trimmed = action.value.trim();
  if (trimmed) {
    next.notes.set(action.questionId, trimmed);
  } else {
    next.notes.delete(action.questionId);
  }
  next.inputMode = "navigate";
  next.editingQuestionId = null;
  return next;
}
case "cancelNotes": {
  next.inputMode = "navigate";
  next.editingQuestionId = null;
  return next;
}
```

- [ ] **Step 4: Update `buildResult` to include notes**

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
      const notes = state.notes.get(q.id);
      const response: QuestionResponse = { questionId: q.id, selection };
      if (notes) response.notes = notes;
      return response;
    })
    .filter((r): r is QuestionResponse => r !== undefined);
  return { questions, responses, cancelled };
}
```

- [ ] **Step 5: Write tests and run**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/tui/state.test.ts`
Expected: PASS

### Task 13.2: Update Input Mapping for Notes

**Files:**

- Modify: `src/tui/input.ts`
- Test: `tests/tui/input.test.ts`

- [ ] **Step 1: Add `forward-to-notes-editor` and notes mode routing**

Update `InputResult`:

```ts
export type InputResult =
  | { type: "action"; action: Action }
  | { type: "finalize"; cancelled: boolean }
  | { type: "forward-to-editor" }
  | { type: "forward-to-notes-editor" }
  | { type: "none" };
```

Add notes mode handling after typing mode and before navigate mode. `mapInput` is pure and cannot access the editor buffer, so Up/Down save-and-exit is handled by the UI adapter (which intercepts Up/Down before calling `mapInput`). Esc dispatches `cancelNotes`. All other keys forward to the notes editor (Enter is handled by `editor.onSubmit`):

```ts
// Notes mode
if (state.inputMode === "notes") {
  if (matchesKey(data, Key.escape)) {
    return action({ type: "cancelNotes" });
  }
  // Enter, Up, Down, and all other keys → forward to notes editor
  // The UI adapter intercepts Up/Down before reaching mapInput to save-and-exit
  return { type: "forward-to-notes-editor" };
}
```

- [ ] **Step 2: Add Tab key handling in navigate mode**

After the Esc handler and before Left/Right, add:

```ts
// Tab — open notes editor (only if question has a selection)
if (matchesKey(data, Key.tab)) {
  if (q && hasSelection(state, q.id)) {
    return action({ type: "enterNotes", questionId: q.id });
  }
  return { type: "none" };
}
```

Import `hasSelection` from state.

- [ ] **Step 3: Write tests and run**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/tui/input.test.ts`
Expected: PASS

### Task 13.3: Update UI Adapter for Notes Editor

**Files:**

- Modify: `src/tui/questionnaire-ui.ts`

- [ ] **Step 1: Add notes editor to `questionnaire-ui.ts`**

Add a second `Editor` instance for notes. The pi-tui `Editor` exposes `getText(): string` for reading the current buffer. Use this for Up/Down save-and-exit. Add `Key` and `matchesKey` imports from `@earendil-works/pi-tui` (already used in `input.ts`).

```ts
const notesEditor = new Editor(tui, editorTheme);

notesEditor.onSubmit = (value) => {
  if (state.inputMode === "notes" && state.editingQuestionId) {
    state = reduce(
      state,
      {
        type: "submitNotes",
        questionId: state.editingQuestionId,
        value: value.trim(),
      },
      questions,
    );
    notesEditor.setText("");
    tui.requestRender();
  }
};
```

In `handleInput`, intercept notes-mode Up/Down before calling `mapInput` to save the current buffer and exit:

```ts
function handleInput(data: string) {
  // Notes mode: intercept Up/Down to save-and-exit
  if (state.inputMode === "notes" && state.editingQuestionId) {
    if (matchesKey(data, Key.up) || matchesKey(data, Key.down)) {
      const notesValue = notesEditor.getText();
      state = reduce(
        state,
        {
          type: "submitNotes",
          questionId: state.editingQuestionId,
          value: notesValue.trim(),
        },
        questions,
      );
      state = reduce(
        state,
        {
          type: "moveCursor",
          direction: matchesKey(data, Key.up) ? "up" : "down",
        },
        questions,
      );
      notesEditor.setText("");
      tui.requestRender();
      return;
    }
  }

  const result = mapInput(data, state, questions);
  switch (result.type) {
    case "action":
      state = reduce(state, result.action, questions);
      // Sync editor when entering typing mode
      if (state.inputMode === "typing" && state.editingQuestionId) {
        editor.setText(state.customText.get(state.editingQuestionId) ?? "");
      }
      // Sync notes editor when entering notes mode
      if (state.inputMode === "notes" && state.editingQuestionId) {
        notesEditor.setText(state.notes.get(state.editingQuestionId) ?? "");
      }
      tui.requestRender();
      break;
    case "finalize":
      done(buildResult(state, questions, result.cancelled));
      break;
    case "forward-to-editor":
      editor.handleInput(data);
      tui.requestRender();
      break;
    case "forward-to-notes-editor":
      notesEditor.handleInput(data);
      tui.requestRender();
      break;
    case "none":
      break;
  }
}
```

- [ ] **Step 2: Update render call to pass notes editor lines**

```ts
function render(width: number): string[] {
  const editorLines =
    state.inputMode === "typing" ? editor.render(Math.max(1, width - 4)) : [];
  const notesEditorLines =
    state.inputMode === "notes"
      ? notesEditor.render(Math.max(1, width - 4))
      : [];
  return renderQuestionnaire(
    state,
    questions,
    editorLines,
    notesEditorLines,
    theme,
    width,
  );
}
```

### Task 13.4: Update Rendering for Notes

**Files:**

- Modify: `src/tui/render.ts`
- Modify: `src/tui/render-tabs.ts`
- Modify: `src/tui/render-review.ts`
- Test: `tests/tui/render-tabs.test.ts`, `tests/tui/render-review.test.ts`, `tests/tui/render.test.ts`

- [ ] **Step 1: Update `renderQuestionnaire` signature**

Add `notesEditorLines` parameter:

```ts
export function renderQuestionnaire(
  state: QuestionnaireState,
  questions: NormalizedQuestion[],
  editorLines: string[],
  notesEditorLines: string[],
  theme: RenderTheme,
  width: number,
): string[];
```

When `state.inputMode === "notes"`, render the notes editor below the question content:

```ts
// After question content rendering, before hint bar:
if (state.inputMode === "notes") {
  lines.push("");
  pushWrapped(lines, theme.fg("muted", "Note for this question:"), renderWidth);
  for (const line of notesEditorLines) {
    lines.push(` ${line}`);
  }
}
```

Update the hint bar to include notes mode:

```ts
let hint: string;
if (state.inputMode === "typing") {
  hint = "Enter submit | Esc cancel | Up/Down exit";
} else if (state.inputMode === "notes") {
  hint = "Enter save | Esc discard";
} else if (state.activeTab === reviewTabIndex) {
  hint = "Left/Right tabs | Enter submit | Space edit | Esc cancel";
} else if (q?.type === "multi-choice") {
  hint =
    "Left/Right tabs | Up/Down move | Space toggle | Tab notes | Esc cancel";
} else {
  hint =
    "Left/Right tabs | Up/Down move | Space/Enter select | Tab notes | Esc cancel";
}
```

Note: "Tab notes" only shows when it's relevant. For simplicity, always show it in the hint. The actual Tab key is a no-op when there's no selection.

- [ ] **Step 2: Update tab bar with notes indicator**

In `src/tui/render-tabs.ts`, update signature to accept `notes`:

```ts
export function renderTabBar(
  questions: NormalizedQuestion[],
  activeTab: number,
  answeredIds: Set<string>,
  notedIds: Set<string>,
  theme: RenderTheme,
  _width: number,
): string[];
```

Add `[n]` marker:

```ts
const noted = notedIds.has(q.id);
const noteSuffix = noted ? " [n]" : "";
const text = ` ${marker} ${q.header}${noteSuffix} `;
```

Update the caller in `render.ts` to pass `notedIds`:

```ts
const notedIds = new Set(state.notes.keys());
lines.push(
  ...renderTabBar(
    questions,
    state.activeTab,
    answeredIds(state),
    notedIds,
    theme,
    renderWidth,
  ),
);
```

- [ ] **Step 3: Update review screen with notes indicator**

In `src/tui/render-review.ts`, add `notes` parameter:

```ts
export function renderReviewScreen(
  questions: NormalizedQuestion[],
  answers: Map<string, QuestionSelection>,
  notes: Map<string, string>,
  cursor: number,
  theme: RenderTheme,
  width: number,
): string[];
```

Add `[n]` after the answer value:

```ts
const hasNote = notes.has(q.id);
const noteSuffix = hasNote ? " [n]" : "";
const value = selection
  ? formatAnswerForRender(q, selection) + noteSuffix
  : "(unanswered)";
```

Update the caller in `render.ts`:

```ts
lines.push(
  ...renderReviewScreen(
    questions,
    state.answers,
    state.notes,
    state.reviewCursor,
    theme,
    renderWidth,
  ),
);
```

- [ ] **Step 4: Update all tests**

Update test files to pass new parameters and verify notes indicators.

- [ ] **Step 5: Run full check**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && pnpm check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/ tests/
git commit -m "feat: add per-question notes via Tab key"
```

---

## Final Verification

After all phases:

- [ ] Run `pnpm check` — lint, typecheck, all tests pass
- [ ] Manually verify the questionnaire works end-to-end (if pi TUI environment is available)
- [ ] Review the full diff for any leftover dead code or stale references
