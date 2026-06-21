# Phase 11: "Type Something." Sentinel for Single-Choice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `allowOther` field, `inputMode` state, inline editor, and "Type something." sentinel row to single-choice questions.

**Spec:** `docs/specs/2026-06-21-questionnaire-refactor-design.md`

**Master plan:** `docs/plans/2026-06-21-questionnaire-refactor-plan.md`

**Prerequisite:** Phase 10 complete (key remapping done).

**Verification:** After completing all tasks, run `pnpm check` (lint + typecheck + tests). All must pass before committing.

---

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
