# Phase 11: "Type Something." Sentinel for Single-Choice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `allowOther` field, `inputMode` state, inline editor, and "Type something." sentinel row to single-choice questions.

**Architecture:** Single-choice questions gain an optional sentinel row ("Type something.") that opens an inline `Editor` from `@earendil-works/pi-tui`. The state machine gains three new actions (`enterTyping` / `submitTyping` / `cancelTyping`) and an `inputMode` field. Input routing short-circuits to the editor while typing; Esc/Up/Down cancel back to navigate mode. Custom answers are stored as `{ kind: "custom", value }` selections.

**Tech Stack:** TypeScript, Vitest, Typebox (schema), `@earendil-works/pi-tui` (Editor, Key, matchesKey)

**Spec:** `docs/specs/2026-06-21-questionnaire-refactor-design.md`

**Master plan:** `docs/plans/2026-06-21-questionnaire-refactor-plan.md`

**Prerequisite:** Phase 10 complete (key remapping done).

**Verification:** After completing all tasks, run `pnpm check` (lint + typecheck + tests). All must pass before committing.

---

### Task 11.1: Add `allowOther` to Schema, Types, Normalize, and Existing Fixtures

**Files:**

- Modify: `src/core/schema.ts`
- Modify: `src/core/types.ts`
- Modify: `src/core/normalize.ts`
- Test: `tests/core/normalize.test.ts`
- Modify: `tests/tui/state.test.ts` (fixture update)
- Modify: `tests/tui/input.test.ts` (fixture update)
- Modify: `tests/tui/render-question.test.ts` (fixture update)
- Modify: `tests/tui/render.test.ts` (fixture update)

- [ ] **Step 1: Add `allowOther` to `SingleChoiceQuestionSchema`**

In `src/core/schema.ts`, add inside `SingleChoiceQuestionSchema` after the `recommendation` field:

```ts
allowOther: Type.Optional(
  Type.Boolean({
    description:
      'Append a "Type something." option for custom text input (default: true)',
  }),
),
```

- [ ] **Step 2: Add `allowOther` to `NormalizedSingleChoiceQuestion`**

In `src/core/types.ts`, add to the `NormalizedSingleChoiceQuestion` interface after `recommendation`:

```ts
allowOther: boolean;
```

The full interface becomes:

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

In `src/core/normalize.ts`, add to the return object in `normalizeSingleChoice` after `recommendation`:

```ts
allowOther: q.allowOther !== false,
```

The full function becomes:

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

- [ ] **Step 4: Add normalize tests**

In `tests/core/normalize.test.ts`, add inside the `describe("normalizeQuestions")` block:

```ts
it("defaults allowOther to true for single-choice", () => {
  const input: QuestionInput[] = [
    {
      type: "single-choice",
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
  if (result[0].type === "single-choice") {
    expect(result[0].allowOther).toBe(true);
  }
});

it("preserves allowOther: false for single-choice", () => {
  const input: QuestionInput[] = [
    {
      type: "single-choice",
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
  if (result[0].type === "single-choice") {
    expect(result[0].allowOther).toBe(false);
  }
});
```

- [ ] **Step 5: Update all existing `NormalizedSingleChoiceQuestion` fixtures**

Adding `allowOther: boolean` to the interface makes it required. All existing test fixtures that construct `NormalizedSingleChoiceQuestion` objects must be updated. Set `allowOther: false` on all existing fixtures to preserve their current behavior (no sentinel row, cursor clamping unchanged).

**`tests/tui/state.test.ts`** — the `questions` array, first element (around line 15). Add after `recommendation: "small"`:

```ts
allowOther: false,
```

**`tests/tui/input.test.ts`** — the `questions` array, first element (around line 8). Add after `recommendation: null`:

```ts
allowOther: false,
```

**`tests/tui/render-question.test.ts`** — the `question` constant inside the `renderSingleChoiceQuestion` describe (around line 13). Add after `recommendation: "small"`:

```ts
allowOther: false,
```

**`tests/tui/render.test.ts`** — the `questions` array, first element (around line 9). Add after `recommendation: null`:

```ts
allowOther: false,
```

- [ ] **Step 6: Run tests**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run`
Expected: PASS — all existing tests pass, new normalize tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/core/ tests/
git commit -m "feat: add allowOther field to single-choice schema, types, and normalization"
```

---

### Task 11.2: Add Sentinel Helpers and State Changes

**Files:**

- Modify: `src/tui/state.ts`
- Test: `tests/tui/state.test.ts`

- [ ] **Step 1: Add `CursorTarget` type and helper functions**

In `src/tui/state.ts`, add after the imports (before the `QuestionnaireState` interface):

```ts
export type CursorTarget =
  | { kind: "option"; index: number }
  | { kind: "other" };

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

- [ ] **Step 2: Write tests for helpers**

In `tests/tui/state.test.ts`, add the following imports to the existing import from `../../src/tui/state.ts`:

```ts
visibleRowCount,
cursorTarget,
```

Add a standalone fixture (after the `questions` array, outside any describe block):

```ts
const singleWithOther: NormalizedQuestion = {
  type: "single-choice",
  id: "scope-other",
  header: "Scope",
  prompt: "Pick scope",
  options: [
    { value: "small", label: "Small" },
    { value: "large", label: "Large" },
  ],
  recommendation: null,
  allowOther: true,
};
```

Add these describe blocks after the existing describes:

```ts
describe("visibleRowCount", () => {
  it("includes sentinel for single-choice with allowOther", () => {
    expect(visibleRowCount(singleWithOther)).toBe(3); // 2 options + 1 sentinel
  });

  it("excludes sentinel when allowOther is false", () => {
    expect(visibleRowCount(questions[0])).toBe(2); // 2 options, no sentinel
  });

  it("returns options.length for multi-choice", () => {
    expect(visibleRowCount(questions[1])).toBe(2);
  });
});

describe("cursorTarget", () => {
  it("returns option for cursor within options range", () => {
    expect(cursorTarget(singleWithOther, 0)).toEqual({
      kind: "option",
      index: 0,
    });
    expect(cursorTarget(singleWithOther, 1)).toEqual({
      kind: "option",
      index: 1,
    });
  });

  it("returns other for cursor at sentinel position", () => {
    expect(cursorTarget(singleWithOther, 2)).toEqual({ kind: "other" });
  });

  it("clamps to last option when cursor overflows without sentinel", () => {
    expect(cursorTarget(questions[0], 5)).toEqual({
      kind: "option",
      index: 1,
    });
  });
});
```

- [ ] **Step 3: Run helper tests**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/tui/state.test.ts`
Expected: PASS

- [ ] **Step 4: Add new state fields and actions**

In `src/tui/state.ts`, update the `QuestionnaireState` interface:

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

Update the `Action` type — add three new variants:

```ts
export type Action =
  | { type: "switchTab"; tab: number }
  | { type: "moveCursor"; direction: "up" | "down" }
  | { type: "selectOption"; questionId: string; value: string; label: string }
  | { type: "toggleCheckbox"; questionId: string; value: string }
  | { type: "resetCursors" }
  | { type: "enterTyping"; questionId: string }
  | { type: "submitTyping"; questionId: string; value: string }
  | { type: "cancelTyping" };
```

- [ ] **Step 5: Update `initState` and `cloneState`**

Update `initState` — add new field initializers:

```ts
export function initState(questions: NormalizedQuestion[]): QuestionnaireState {
  const multiChecked = new Map<string, Set<string>>();

  for (const q of questions) {
    if (q.type === "multi-choice") {
      multiChecked.set(q.id, new Set(q.recommendation));
    }
  }

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
}
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

- [ ] **Step 6: Update `moveCursor` reducer case**

Replace the `moveCursor` case body to use `visibleRowCount`:

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

- [ ] **Step 7: Update `switchTab` to reset inputMode**

Replace the `switchTab` case body:

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

- [ ] **Step 8: Add reducer cases for typing actions**

Add these cases inside the `switch (action.type)` block, before the closing `}`:

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

- [ ] **Step 9: Write tests for new state fields and actions**

In `tests/tui/state.test.ts`, add inside the `describe("initState")` block:

```ts
it("initializes inputMode to navigate", () => {
  const state = initState(questions);
  expect(state.inputMode).toBe("navigate");
  expect(state.editingQuestionId).toBeNull();
  expect(state.customText.size).toBe(0);
});
```

Add inside the `describe("reduce")` block:

```ts
it("enterTyping sets inputMode and editingQuestionId", () => {
  const state = initState(questions);
  const next = reduce(
    state,
    { type: "enterTyping", questionId: "scope" },
    questions,
  );
  expect(next.inputMode).toBe("typing");
  expect(next.editingQuestionId).toBe("scope");
});

it("submitTyping stores custom text, sets answer, and advances tab", () => {
  const state = initState(questions);
  state.inputMode = "typing";
  state.editingQuestionId = "scope";
  const next = reduce(
    state,
    { type: "submitTyping", questionId: "scope", value: "My answer" },
    questions,
  );
  expect(next.customText.get("scope")).toBe("My answer");
  expect(next.answers.get("scope")).toEqual({
    kind: "custom",
    value: "My answer",
  });
  expect(next.inputMode).toBe("navigate");
  expect(next.editingQuestionId).toBeNull();
  expect(next.activeTab).toBe(1); // advanced to next unanswered
});

it("submitTyping with empty string does not record answer", () => {
  const state = initState(questions);
  state.inputMode = "typing";
  state.editingQuestionId = "scope";
  const next = reduce(
    state,
    { type: "submitTyping", questionId: "scope", value: "   " },
    questions,
  );
  expect(next.answers.has("scope")).toBe(false);
  expect(next.inputMode).toBe("navigate");
});

it("cancelTyping resets inputMode without recording answer", () => {
  const state = initState(questions);
  state.inputMode = "typing";
  state.editingQuestionId = "scope";
  const next = reduce(state, { type: "cancelTyping" }, questions);
  expect(next.inputMode).toBe("navigate");
  expect(next.editingQuestionId).toBeNull();
  expect(next.answers.has("scope")).toBe(false);
});

it("switchTab resets inputMode when in typing mode", () => {
  const state = initState(questions);
  state.inputMode = "typing";
  state.editingQuestionId = "scope";
  const next = reduce(state, { type: "switchTab", tab: 1 }, questions);
  expect(next.inputMode).toBe("navigate");
  expect(next.editingQuestionId).toBeNull();
});
```

- [ ] **Step 10: Run tests**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/tui/state.test.ts`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add src/tui/state.ts tests/tui/state.test.ts
git commit -m "feat: add sentinel helpers, typing state, and reducer actions"
```

---

### Task 11.3: Update Input Mapping for Typing Mode

**Files:**

- Modify: `src/tui/input.ts`
- Test: `tests/tui/input.test.ts`

- [ ] **Step 1: Update `InputResult` and add typing mode routing**

In `src/tui/input.ts`:

Add `cursorTarget` to the import from `./state.ts`:

```ts
import {
  type Action,
  type QuestionnaireState,
  allAnswered,
  currentQuestion,
  cursorTarget,
} from "./state.ts";
```

Update the `InputResult` type to include `forward-to-editor`:

```ts
export type InputResult =
  | { type: "action"; action: Action }
  | { type: "finalize"; cancelled: boolean }
  | { type: "forward-to-editor" }
  | { type: "none" };
```

Add typing mode routing at the **very top** of the `mapInput` function body, **before** the `// Global Esc` check:

```ts
// Typing mode — forward most keys to the inline editor
if (state.inputMode === "typing") {
  if (matchesKey(data, Key.escape)) {
    return action({ type: "cancelTyping" });
  }
  if (matchesKey(data, Key.up)) {
    return action({ type: "cancelTyping" });
  }
  if (matchesKey(data, Key.down)) {
    return action({ type: "cancelTyping" });
  }
  // Enter, Left, Right, and all other keys → forward to editor
  return { type: "forward-to-editor" };
}
```

**Why Enter goes to the editor:** The `Editor` from `@earendil-works/pi-tui` calls its `onSubmit` callback when it receives Enter. The `questionnaire-ui.ts` wires that callback to dispatch `submitTyping`. Returning `none` would swallow the Enter key and break submission.

- [ ] **Step 2: Update single-choice Enter/Space to detect sentinel**

Replace the existing single-choice `Enter/Space` handler (the `if (matchesKey(data, Key.enter) || matchesKey(data, Key.space))` block and the `const opt = q.options[state.optionCursor]` line inside it):

```ts
// Single-choice
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

- [ ] **Step 3: Write tests for typing mode input**

In `tests/tui/input.test.ts`, add `NormalizedSingleChoiceQuestion` to the type import:

```ts
import type {
  NormalizedQuestion,
  NormalizedSingleChoiceQuestion,
} from "../../src/core/types.ts";
```

Add a fixture for a question with `allowOther: true` (after the `questions` array):

```ts
const singleWithOther: NormalizedSingleChoiceQuestion = {
  type: "single-choice",
  id: "scope",
  header: "Scope",
  prompt: "Pick scope",
  options: [
    { value: "small", label: "Small" },
    { value: "large", label: "Large" },
  ],
  recommendation: null,
  allowOther: true,
};
const questionsWithOther: NormalizedQuestion[] = [singleWithOther];
```

Add these tests inside the `describe("mapInput")` block:

```ts
it("Esc in typing mode returns cancelTyping", () => {
  const state = {
    ...initState(questionsWithOther),
    inputMode: "typing" as const,
    editingQuestionId: "scope",
  };
  const result = mapInput("\x1b", state, questionsWithOther);
  expect(result.type).toBe("action");
  if (result.type === "action") {
    expect(result.action).toEqual({ type: "cancelTyping" });
  }
});

it("Up in typing mode returns cancelTyping", () => {
  const state = {
    ...initState(questionsWithOther),
    inputMode: "typing" as const,
    editingQuestionId: "scope",
  };
  const result = mapInput("\x1b[A", state, questionsWithOther);
  expect(result.type).toBe("action");
  if (result.type === "action") {
    expect(result.action).toEqual({ type: "cancelTyping" });
  }
});

it("Down in typing mode returns cancelTyping", () => {
  const state = {
    ...initState(questionsWithOther),
    inputMode: "typing" as const,
    editingQuestionId: "scope",
  };
  const result = mapInput("\x1b[B", state, questionsWithOther);
  expect(result.type).toBe("action");
  if (result.type === "action") {
    expect(result.action).toEqual({ type: "cancelTyping" });
  }
});

it("forwards Enter to editor in typing mode", () => {
  const state = {
    ...initState(questionsWithOther),
    inputMode: "typing" as const,
    editingQuestionId: "scope",
  };
  const result = mapInput("\r", state, questionsWithOther);
  expect(result).toEqual({ type: "forward-to-editor" });
});

it("forwards character keys to editor in typing mode", () => {
  const state = {
    ...initState(questionsWithOther),
    inputMode: "typing" as const,
    editingQuestionId: "scope",
  };
  const result = mapInput("a", state, questionsWithOther);
  expect(result).toEqual({ type: "forward-to-editor" });
});

it("Space on sentinel returns enterTyping", () => {
  const state = {
    ...initState(questionsWithOther),
    optionCursor: 2, // sentinel position (2 options)
  };
  const result = mapInput(" ", state, questionsWithOther);
  expect(result.type).toBe("action");
  if (result.type === "action") {
    expect(result.action).toEqual({
      type: "enterTyping",
      questionId: "scope",
    });
  }
});

it("Enter on sentinel returns enterTyping", () => {
  const state = {
    ...initState(questionsWithOther),
    optionCursor: 2, // sentinel position (2 options)
  };
  const result = mapInput("\r", state, questionsWithOther);
  expect(result.type).toBe("action");
  if (result.type === "action") {
    expect(result.action).toEqual({
      type: "enterTyping",
      questionId: "scope",
    });
  }
});
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/tui/input.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tui/input.ts tests/tui/input.test.ts
git commit -m "feat: add typing mode input routing and sentinel detection"
```

---

### Task 11.4: Update Rendering for "Type Something."

**Files:**

- Modify: `src/tui/render-question.ts`
- Modify: `src/tui/render.ts`
- Modify: `src/tui/questionnaire-ui.ts`
- Test: `tests/tui/render-question.test.ts`
- Test: `tests/tui/render.test.ts`

- [ ] **Step 1: Update `renderSingleChoiceQuestion` signature and add sentinel rendering**

In `src/tui/render-question.ts`, replace the `renderSingleChoiceQuestion` function entirely:

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
): string[] {
  const lines: string[] = [];

  pushWrapped(lines, theme.fg("text", question.prompt), width);
  lines.push("");

  for (let i = 0; i < question.options.length; i++) {
    const opt = question.options[i];
    const isCursor = i === cursor;
    const isSelected = selectedValue === opt.value;
    const recSuffix =
      question.recommendation === opt.value ? " [recommended]" : "";
    const label = `${i + 1}. ${opt.label}${recSuffix}`;

    let prefix: string;
    let color: string;
    if (isCursor) {
      prefix = theme.fg("accent", "\u25B8 ");
      color = "accent";
    } else if (isSelected) {
      prefix = theme.fg("success", "\u2022 ");
      color = "success";
    } else {
      prefix = "  ";
      color = "text";
    }

    pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
    if (opt.description) {
      pushWrappedWithPrefix(
        lines,
        "     ",
        theme.fg("muted", opt.description),
        width,
      );
    }
  }

  // "Type something." sentinel
  if (question.allowOther) {
    const sentinelIndex = question.options.length;
    const isCursor = sentinelIndex === cursor;
    const prefix = isCursor ? theme.fg("accent", "\u25B8 ") : "  ";

    if (inputMode === "typing") {
      const editorContent = editorLines.join("") || "";
      const label = `${sentinelIndex + 1}. ${editorContent}`;
      pushWrappedWithPrefix(lines, prefix, theme.fg("accent", label), width);
    } else if (customText) {
      const label = `${sentinelIndex + 1}. "${customText}"`;
      const color = isCursor ? "accent" : "text";
      pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
    } else {
      const label = `${sentinelIndex + 1}. Type something.`;
      const color = isCursor ? "accent" : "muted";
      pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
    }
  }

  return lines;
}
```

- [ ] **Step 2: Update existing `renderSingleChoiceQuestion` test calls**

In `tests/tui/render-question.test.ts`, every existing call to `renderSingleChoiceQuestion` has 5 arguments. They all need 3 new arguments inserted **before** `noopTheme`: `null` (customText), `"navigate"` (inputMode), `[]` (editorLines).

Replace each call pattern:

```ts
// Old (5 args):
renderSingleChoiceQuestion(question, CURSOR, SELECTED, noopTheme, 80);
// New (8 args):
renderSingleChoiceQuestion(
  question,
  CURSOR,
  SELECTED,
  null,
  "navigate",
  [],
  noopTheme,
  80,
);
```

There are 6 existing calls to update (in the tests at approximate lines 26, 40, 52, 64, 76, 91). Update all of them.

- [ ] **Step 3: Add sentinel rendering tests**

In `tests/tui/render-question.test.ts`, add inside the `describe("renderSingleChoiceQuestion")` block:

```ts
it("renders 'Type something.' sentinel when allowOther is true", () => {
  const q = { ...question, allowOther: true };
  const lines = renderSingleChoiceQuestion(
    q,
    0,
    null,
    null,
    "navigate",
    [],
    noopTheme,
    80,
  );
  const text = lines.join("\n");
  expect(text).toContain("3. Type something.");
});

it("does not render sentinel when allowOther is false", () => {
  const lines = renderSingleChoiceQuestion(
    question,
    0,
    null,
    null,
    "navigate",
    [],
    noopTheme,
    80,
  );
  const text = lines.join("\n");
  expect(text).not.toContain("Type something.");
});

it("renders custom text when set", () => {
  const q = { ...question, allowOther: true };
  const lines = renderSingleChoiceQuestion(
    q,
    0,
    null,
    "My custom answer",
    "navigate",
    [],
    noopTheme,
    80,
  );
  const text = lines.join("\n");
  expect(text).toContain('"My custom answer"');
});

it("renders editor content in typing mode", () => {
  const q = { ...question, allowOther: true };
  const lines = renderSingleChoiceQuestion(
    q,
    q.options.length,
    null,
    null,
    "typing",
    ["hello"],
    noopTheme,
    80,
  );
  const text = lines.join("\n");
  expect(text).toContain("hello");
});
```

- [ ] **Step 4: Run render-question tests**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/tui/render-question.test.ts`
Expected: PASS

- [ ] **Step 5: Update `renderQuestionnaire` signature and body**

In `src/tui/render.ts`, update the function signature to add `editorLines` after `questions`:

```ts
export function renderQuestionnaire(
  state: QuestionnaireState,
  questions: NormalizedQuestion[],
  editorLines: string[],
  theme: RenderTheme,
  width: number,
): string[] {
```

Update the single-choice case to pass the new arguments:

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

Replace the hint bar section (from `// Hint bar` through `pushWrapped(lines, theme.fg("dim", hint), renderWidth);`):

```ts
// Hint bar
lines.push("");
let hint: string;
if (state.inputMode === "typing") {
  hint = "Enter submit | Esc cancel | Up/Down exit";
} else if (state.activeTab === reviewTabIndex) {
  hint =
    "Left/Right tabs | Up/Down move | Space jump | Enter submit | Esc cancel";
} else if (q?.type === "multi-choice") {
  hint = "Left/Right tabs | Up/Down move | Space toggle | Esc cancel";
} else {
  hint = "Left/Right tabs | Up/Down move | Space/Enter select | Esc cancel";
}
pushWrapped(lines, theme.fg("dim", hint), renderWidth);
```

- [ ] **Step 6: Update existing `renderQuestionnaire` test calls**

In `tests/tui/render.test.ts`, every call to `renderQuestionnaire` has 4 arguments. They all need `[]` (editorLines) inserted after `questions`:

```ts
// Old (4 args):
renderQuestionnaire(state, questions, noopTheme, 80);
// New (5 args):
renderQuestionnaire(state, questions, [], noopTheme, 80);
```

There are 4 existing calls to update.

- [ ] **Step 7: Run render tests**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/tui/render-question.test.ts tests/tui/render.test.ts`
Expected: PASS

- [ ] **Step 8: Update `questionnaire-ui.ts` with Editor integration**

Replace the entire contents of `src/tui/questionnaire-ui.ts`:

```ts
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Editor, type EditorTheme } from "@earendil-works/pi-tui";
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
          // Load existing custom text into editor when entering typing mode
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

- [ ] **Step 9: Run full check**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && pnpm check`
Expected: PASS (lint + typecheck + tests all pass)

- [ ] **Step 10: Commit**

```bash
git add src/tui/ tests/tui/
git commit -m "feat: add 'Type something.' sentinel rendering and Editor integration"
```

---
