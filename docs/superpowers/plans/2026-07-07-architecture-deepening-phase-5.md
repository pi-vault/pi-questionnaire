# Phase 5: Deepen the Input Interpreter

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** All "what does this keypress do?" logic concentrates in `input.ts`. The UI adapter (`questionnaire-ui.ts`) becomes a dumb effect applier.

**Architecture:** Rename `mapInput` to `interpret`. Accept `InputContext` (includes editor buffer text). Return `Effect[]` instead of a single `InputResult`. Absorb notes-mode Up/Down interception and post-dispatch editor loading from `questionnaire-ui.ts`.

**Tech Stack:** TypeScript 6, Vitest, Biome

---

### Task 1: Define the new types in input.ts

**Files:**
- Modify: `src/tui/input.ts:1-20`

- [ ] **Step 1: Replace the InputResult type and add new types**

In `src/tui/input.ts`, replace the existing types and imports (lines 1-20):

```ts
import { Key, matchesKey } from "@earendil-works/pi-tui";
import type { NormalizedQuestion } from "../core/types.ts";
import {
  type Action,
  type QuestionnaireState,
  allAnswered,
  currentQuestion,
  cursorTarget,
} from "./state.ts";

export type InputResult =
  | { type: "action"; action: Action }
  | { type: "finalize"; cancelled: boolean }
  | { type: "forward-to-editor" }
  | { type: "forward-to-notes-editor" }
  | { type: "none" };

function action(a: Action): InputResult {
  return { type: "action", action: a };
}
```

with:

```ts
import { Key, matchesKey } from "@earendil-works/pi-tui";
import type { NormalizedQuestion } from "../core/types.ts";
import {
  type Action,
  type QuestionnaireState,
  allAnswered,
  currentQuestion,
  cursorTarget,
} from "./state.ts";

export interface InputContext {
  state: QuestionnaireState;
  questions: NormalizedQuestion[];
  editorText: string;
  notesEditorText: string;
}

export type Effect =
  | { type: "dispatch"; action: Action }
  | { type: "finalize"; cancelled: boolean }
  | { type: "forward-to-editor" }
  | { type: "forward-to-notes-editor" }
  | { type: "set-editor-text"; text: string }
  | { type: "set-notes-editor-text"; text: string }
  | { type: "clear-editor" }
  | { type: "clear-notes-editor" };

function dispatch(a: Action): Effect {
  return { type: "dispatch", action: a };
}
```

- [ ] **Step 2: Run typecheck to see what breaks**

```bash
pnpm typecheck
```

Expected: errors — `mapInput` still references the old types, and callers import the old names.

### Task 2: Rewrite the interpret function

**Files:**
- Modify: `src/tui/input.ts:22-152`

- [ ] **Step 1: Replace mapInput with interpret**

Replace the `mapInput` function (everything after the helper) with:

```ts
export function interpret(data: string, ctx: InputContext): Effect[] {
  const { state, questions } = ctx;
  const reviewTabIndex = questions.length;
  const totalTabs = questions.length + 1;
  const q = currentQuestion(state, questions);

  // Typing mode
  if (state.inputMode === "typing") {
    if (matchesKey(data, Key.escape) || matchesKey(data, Key.up) || matchesKey(data, Key.down)) {
      return [dispatch({ type: "cancelTyping" }), { type: "clear-editor" }];
    }
    return [{ type: "forward-to-editor" }];
  }

  // Notes mode — Up/Down save-and-exit (previously in questionnaire-ui.ts)
  if (state.inputMode === "notes" && state.editingQuestionId) {
    if (matchesKey(data, Key.escape)) {
      return [dispatch({ type: "cancelNotes" }), { type: "clear-notes-editor" }];
    }
    if (matchesKey(data, Key.up) || matchesKey(data, Key.down)) {
      return [
        dispatch({
          type: "submitNotes",
          questionId: state.editingQuestionId,
          value: ctx.notesEditorText.trim(),
        }),
        dispatch({
          type: "moveCursor",
          direction: matchesKey(data, Key.up) ? "up" : "down",
        }),
        { type: "clear-notes-editor" },
      ];
    }
    return [{ type: "forward-to-notes-editor" }];
  }

  // Global Esc
  if (matchesKey(data, Key.escape)) {
    return [{ type: "finalize", cancelled: true }];
  }

  // Tab — open notes editor (only if question has a selection)
  if (matchesKey(data, Key.tab)) {
    if (q && state.answers.has(q.id)) {
      return [
        dispatch({ type: "enterNotes", questionId: q.id }),
        { type: "set-notes-editor-text", text: state.notes.get(q.id) ?? "" },
      ];
    }
    return [];
  }

  // Left/Right navigate tabs
  if (matchesKey(data, Key.right)) {
    return [dispatch({ type: "switchTab", tab: (state.activeTab + 1) % totalTabs })];
  }
  if (matchesKey(data, Key.left)) {
    return [dispatch({ type: "switchTab", tab: (state.activeTab - 1 + totalTabs) % totalTabs })];
  }

  // Review tab
  if (state.activeTab === reviewTabIndex) {
    if (matchesKey(data, Key.up)) {
      return [dispatch({ type: "moveCursor", direction: "up" })];
    }
    if (matchesKey(data, Key.down)) {
      return [dispatch({ type: "moveCursor", direction: "down" })];
    }
    if (matchesKey(data, Key.enter) && allAnswered(state, questions)) {
      return [{ type: "finalize", cancelled: false }];
    }
    if (matchesKey(data, Key.space) || matchesKey(data, Key.enter)) {
      if (state.reviewCursor < questions.length) {
        return [dispatch({ type: "switchTab", tab: state.reviewCursor })];
      }
    }
    return [];
  }

  if (!q) return [];

  // Single-select
  if (!q.multiSelect) {
    if (matchesKey(data, Key.up)) {
      return [dispatch({ type: "moveCursor", direction: "up" })];
    }
    if (matchesKey(data, Key.down)) {
      return [dispatch({ type: "moveCursor", direction: "down" })];
    }
    if (matchesKey(data, Key.enter) || matchesKey(data, Key.space)) {
      const target = cursorTarget(q, state.optionCursor);
      if (target.kind === "option") {
        const opt = q.options[target.index];
        return [dispatch({
          type: "selectOption",
          questionId: q.id,
          value: opt.value,
          label: opt.label,
        })];
      }
      if (target.kind === "other") {
        return [
          dispatch({ type: "enterTyping", questionId: q.id }),
          { type: "set-editor-text", text: state.customText.get(q.id) ?? "" },
        ];
      }
      if (target.kind === "chat") {
        return [dispatch({ type: "selectChat", questionId: q.id })];
      }
    }
    return [];
  }

  // Multi-choice
  if (matchesKey(data, Key.up)) {
    return [dispatch({ type: "moveCursor", direction: "up" })];
  }
  if (matchesKey(data, Key.down)) {
    return [dispatch({ type: "moveCursor", direction: "down" })];
  }
  if (matchesKey(data, Key.space) || matchesKey(data, Key.enter)) {
    const target = cursorTarget(q, state.optionCursor);
    if (target.kind === "option") {
      const opt = q.options[target.index];
      return [dispatch({
        type: "toggleCheckbox",
        questionId: q.id,
        value: opt.value,
      })];
    }
    if (target.kind === "chat") {
      return [dispatch({ type: "selectChat", questionId: q.id })];
    }
    if (target.kind === "next") {
      return [dispatch({ type: "confirmMulti", questionId: q.id })];
    }
  }

  return [];
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: errors in `questionnaire-ui.ts` and `tests/tui/input.test.ts` — they still import `mapInput` and `InputResult`.

### Task 3: Rewrite the input tests

**Files:**
- Modify: `tests/tui/input.test.ts`

- [ ] **Step 1: Replace the entire test file**

Replace the entire content of `tests/tui/input.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import type { NormalizedQuestion } from "../../src/core/types.ts";
import { initState } from "../../src/tui/state.ts";
import { interpret, type Effect, type InputContext } from "../../src/tui/input.ts";

const questions: NormalizedQuestion[] = [
  {
    multiSelect: false,
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
    multiSelect: true,
    id: "features",
    header: "Features",
    prompt: "Pick features",
    options: [
      { value: "auth", label: "Auth" },
      { value: "log", label: "Logging" },
    ],
    recommendation: null,
    allowOther: false,
    allowChat: false,
  },
];

const singleWithOther: NormalizedQuestion = {
  multiSelect: false,
  id: "scope",
  header: "Scope",
  prompt: "Pick scope",
  options: [
    { value: "small", label: "Small" },
    { value: "large", label: "Large" },
  ],
  recommendation: null,
  allowOther: true,
  allowChat: false,
};
const questionsWithOther: NormalizedQuestion[] = [singleWithOther];

const singleWithChat: NormalizedQuestion = {
  multiSelect: false,
  id: "scope",
  header: "Scope",
  prompt: "Pick scope",
  options: [
    { value: "small", label: "Small" },
    { value: "large", label: "Large" },
  ],
  recommendation: null,
  allowOther: false,
  allowChat: true,
};
const questionsWithChat: NormalizedQuestion[] = [singleWithChat];

const multiWithChat: NormalizedQuestion = {
  multiSelect: true,
  id: "features",
  header: "Features",
  prompt: "Pick features",
  options: [
    { value: "auth", label: "Auth" },
    { value: "log", label: "Logging" },
  ],
  recommendation: null,
  allowOther: false,
  allowChat: true,
};
const questionsMultiWithChat: NormalizedQuestion[] = [multiWithChat];

function ctx(
  qs: NormalizedQuestion[],
  stateOverrides: Partial<ReturnType<typeof initState>> = {},
  editorText = "",
  notesEditorText = "",
): InputContext {
  return {
    state: { ...initState(qs), ...stateOverrides },
    questions: qs,
    editorText,
    notesEditorText,
  };
}

function dispatched(effects: Effect[]) {
  return effects
    .filter((e): e is Extract<Effect, { type: "dispatch" }> => e.type === "dispatch")
    .map((e) => e.action);
}

describe("interpret", () => {
  it("Esc returns finalize cancelled", () => {
    const effects = interpret("\x1b", ctx(questions));
    expect(effects).toEqual([{ type: "finalize", cancelled: true }]);
  });

  it("Up on single-choice returns moveCursor up", () => {
    const effects = interpret("\x1b[A", ctx(questions, { optionCursor: 1 }));
    expect(dispatched(effects)).toEqual([{ type: "moveCursor", direction: "up" }]);
  });

  it("Space on single-choice returns selectOption", () => {
    const effects = interpret(" ", ctx(questions));
    const actions = dispatched(effects);
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("selectOption");
  });

  it("Space on multi-choice returns toggleCheckbox", () => {
    const effects = interpret(" ", ctx(questions, { activeTab: 1 }));
    const actions = dispatched(effects);
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("toggleCheckbox");
  });

  it("Enter on review with all answered returns finalize submitted", () => {
    const state = { ...initState(questions), activeTab: questions.length };
    state.answers.set("scope", { kind: "option" as const, value: "small", label: "Small" });
    state.answers.set("features", {
      kind: "options" as const,
      selected: [{ value: "auth", label: "Auth" }],
    });
    const effects = interpret("\r", { state, questions, editorText: "", notesEditorText: "" });
    expect(effects).toEqual([{ type: "finalize", cancelled: false }]);
  });

  it("Space on review navigates to question tab", () => {
    const effects = interpret(
      " ",
      ctx(questions, { activeTab: questions.length, reviewCursor: 1 }),
    );
    expect(dispatched(effects)).toEqual([{ type: "switchTab", tab: 1 }]);
  });

  it("Down on single-choice returns moveCursor down", () => {
    const effects = interpret("\x1b[B", ctx(questions));
    expect(dispatched(effects)).toEqual([{ type: "moveCursor", direction: "down" }]);
  });

  it("Enter on single-choice returns selectOption with correct values", () => {
    const effects = interpret("\r", ctx(questions));
    const actions = dispatched(effects);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({
      type: "selectOption",
      questionId: "scope",
      value: "small",
      label: "Small",
    });
  });

  it("Up on review returns moveCursor up", () => {
    const effects = interpret(
      "\x1b[A",
      ctx(questions, { activeTab: questions.length, reviewCursor: 1 }),
    );
    expect(dispatched(effects)).toEqual([{ type: "moveCursor", direction: "up" }]);
  });

  it("Down on review returns moveCursor down", () => {
    const effects = interpret(
      "\x1b[B",
      ctx(questions, { activeTab: questions.length }),
    );
    expect(dispatched(effects)).toEqual([{ type: "moveCursor", direction: "down" }]);
  });

  it("Enter on review without all answered navigates to question at cursor", () => {
    const effects = interpret(
      "\r",
      ctx(questions, { activeTab: questions.length }),
    );
    expect(dispatched(effects)).toEqual([{ type: "switchTab", tab: 0 }]);
  });

  it("Up on multi-choice returns moveCursor up", () => {
    const effects = interpret(
      "\x1b[A",
      ctx(questions, { activeTab: 1, optionCursor: 1 }),
    );
    expect(dispatched(effects)).toEqual([{ type: "moveCursor", direction: "up" }]);
  });

  it("Enter on multi-choice option returns toggleCheckbox", () => {
    const effects = interpret(
      "\r",
      ctx(questions, { activeTab: 1, optionCursor: 0 }),
    );
    expect(dispatched(effects)).toEqual([{
      type: "toggleCheckbox",
      questionId: "features",
      value: "auth",
    }]);
  });

  it("Right arrow returns switchTab to next", () => {
    const effects = interpret("\x1b[C", ctx(questions));
    expect(dispatched(effects)).toEqual([{ type: "switchTab", tab: 1 }]);
  });

  it("Left arrow returns switchTab to previous", () => {
    const effects = interpret("\x1b[D", ctx(questions, { activeTab: 1 }));
    expect(dispatched(effects)).toEqual([{ type: "switchTab", tab: 0 }]);
  });

  it("Right arrow wraps from last question tab to review", () => {
    const effects = interpret(
      "\x1b[C",
      ctx(questions, { activeTab: questions.length - 1 }),
    );
    expect(dispatched(effects)).toEqual([{ type: "switchTab", tab: questions.length }]);
  });

  it("Left arrow on review returns switchTab", () => {
    const effects = interpret(
      "\x1b[D",
      ctx(questions, { activeTab: questions.length }),
    );
    expect(dispatched(effects)).toEqual([{
      type: "switchTab",
      tab: questions.length - 1,
    }]);
  });

  it("unrecognized key on single-choice returns empty effects", () => {
    const effects = interpret("x", ctx(questions));
    expect(effects).toEqual([]);
  });

  it("Esc in typing mode returns cancelTyping + clear-editor", () => {
    const effects = interpret(
      "\x1b",
      ctx(questionsWithOther, {
        inputMode: "typing",
        editingQuestionId: "scope",
      }),
    );
    expect(effects).toEqual([
      { type: "dispatch", action: { type: "cancelTyping" } },
      { type: "clear-editor" },
    ]);
  });

  it("Up in typing mode returns cancelTyping + clear-editor", () => {
    const effects = interpret(
      "\x1b[A",
      ctx(questionsWithOther, {
        inputMode: "typing",
        editingQuestionId: "scope",
      }),
    );
    expect(effects).toEqual([
      { type: "dispatch", action: { type: "cancelTyping" } },
      { type: "clear-editor" },
    ]);
  });

  it("forwards Enter to editor in typing mode", () => {
    const effects = interpret(
      "\r",
      ctx(questionsWithOther, {
        inputMode: "typing",
        editingQuestionId: "scope",
      }),
    );
    expect(effects).toEqual([{ type: "forward-to-editor" }]);
  });

  it("forwards character keys to editor in typing mode", () => {
    const effects = interpret(
      "a",
      ctx(questionsWithOther, {
        inputMode: "typing",
        editingQuestionId: "scope",
      }),
    );
    expect(effects).toEqual([{ type: "forward-to-editor" }]);
  });

  it("Space on other sentinel returns enterTyping + set-editor-text", () => {
    const effects = interpret(
      " ",
      ctx(questionsWithOther, { optionCursor: 2 }),
    );
    expect(effects).toEqual([
      { type: "dispatch", action: { type: "enterTyping", questionId: "scope" } },
      { type: "set-editor-text", text: "" },
    ]);
  });

  it("Space on other sentinel loads existing custom text", () => {
    const state = { ...initState(questionsWithOther), optionCursor: 2 };
    state.customText.set("scope", "existing text");
    const effects = interpret(" ", {
      state,
      questions: questionsWithOther,
      editorText: "",
      notesEditorText: "",
    });
    expect(effects).toEqual([
      { type: "dispatch", action: { type: "enterTyping", questionId: "scope" } },
      { type: "set-editor-text", text: "existing text" },
    ]);
  });

  it("Space on chat sentinel (single-choice) returns selectChat", () => {
    const effects = interpret(
      " ",
      ctx(questionsWithChat, { optionCursor: 2 }),
    );
    expect(dispatched(effects)).toEqual([{ type: "selectChat", questionId: "scope" }]);
  });

  it("Space on chat sentinel (multi-choice) returns selectChat", () => {
    const effects = interpret(
      " ",
      ctx(questionsMultiWithChat, { optionCursor: 2 }),
    );
    expect(dispatched(effects)).toEqual([{ type: "selectChat", questionId: "features" }]);
  });

  it("Space on Next row (multi-choice) returns confirmMulti", () => {
    const effects = interpret(
      " ",
      ctx(questions, { activeTab: 1, optionCursor: 2 }),
    );
    expect(dispatched(effects)).toEqual([{
      type: "confirmMulti",
      questionId: "features",
    }]);
  });

  it("Esc in notes mode returns cancelNotes + clear-notes-editor", () => {
    const effects = interpret(
      "\x1b",
      ctx(questions, { inputMode: "notes", editingQuestionId: "scope" }),
    );
    expect(effects).toEqual([
      { type: "dispatch", action: { type: "cancelNotes" } },
      { type: "clear-notes-editor" },
    ]);
  });

  it("Enter in notes mode returns forward-to-notes-editor", () => {
    const effects = interpret(
      "\r",
      ctx(questions, { inputMode: "notes", editingQuestionId: "scope" }),
    );
    expect(effects).toEqual([{ type: "forward-to-notes-editor" }]);
  });

  it("character keys in notes mode return forward-to-notes-editor", () => {
    const effects = interpret(
      "a",
      ctx(questions, { inputMode: "notes", editingQuestionId: "scope" }),
    );
    expect(effects).toEqual([{ type: "forward-to-notes-editor" }]);
  });

  it("Up in notes mode saves notes and moves cursor up", () => {
    const effects = interpret(
      "\x1b[A",
      ctx(questions, { inputMode: "notes", editingQuestionId: "scope" }, "", "my note"),
    );
    expect(effects).toEqual([
      { type: "dispatch", action: { type: "submitNotes", questionId: "scope", value: "my note" } },
      { type: "dispatch", action: { type: "moveCursor", direction: "up" } },
      { type: "clear-notes-editor" },
    ]);
  });

  it("Down in notes mode saves notes and moves cursor down", () => {
    const effects = interpret(
      "\x1b[B",
      ctx(questions, { inputMode: "notes", editingQuestionId: "scope" }, "", "  note  "),
    );
    expect(effects).toEqual([
      { type: "dispatch", action: { type: "submitNotes", questionId: "scope", value: "note" } },
      { type: "dispatch", action: { type: "moveCursor", direction: "down" } },
      { type: "clear-notes-editor" },
    ]);
  });

  it("Tab on answered question returns enterNotes + set-notes-editor-text", () => {
    const state = initState(questions);
    state.answers.set("scope", { kind: "option", value: "small", label: "Small" });
    const effects = interpret("\t", {
      state,
      questions,
      editorText: "",
      notesEditorText: "",
    });
    expect(effects).toEqual([
      { type: "dispatch", action: { type: "enterNotes", questionId: "scope" } },
      { type: "set-notes-editor-text", text: "" },
    ]);
  });

  it("Tab on answered question with existing note loads it", () => {
    const state = initState(questions);
    state.answers.set("scope", { kind: "option", value: "small", label: "Small" });
    state.notes.set("scope", "existing note");
    const effects = interpret("\t", {
      state,
      questions,
      editorText: "",
      notesEditorText: "",
    });
    expect(effects).toEqual([
      { type: "dispatch", action: { type: "enterNotes", questionId: "scope" } },
      { type: "set-notes-editor-text", text: "existing note" },
    ]);
  });

  it("Tab on unanswered question returns empty effects", () => {
    const effects = interpret("\t", ctx(questions));
    expect(effects).toEqual([]);
  });

  it("Tab on review tab returns empty effects", () => {
    const effects = interpret(
      "\t",
      ctx(questions, { activeTab: questions.length }),
    );
    expect(effects).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the input tests**

```bash
pnpm vitest run tests/tui/input.test.ts
```

Expected: all pass.

### Task 4: Update questionnaire-ui.ts to use the effect applier

**Files:**
- Modify: `src/tui/questionnaire-ui.ts`

- [ ] **Step 1: Replace the entire content of questionnaire-ui.ts**

Replace the entire content of `src/tui/questionnaire-ui.ts` with:

```ts
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Editor, type EditorTheme } from "@earendil-works/pi-tui";
import type { NormalizedQuestion, QuestionnaireResult } from "../core/types.ts";
import { initState, reduce, buildResult } from "./state.ts";
import { interpret } from "./input.ts";
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
    const notesEditor = new Editor(tui, editorTheme);

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

    function handleInput(data: string) {
      const effects = interpret(data, {
        state,
        questions,
        editorText: editor.getText(),
        notesEditorText: notesEditor.getText(),
      });

      for (const effect of effects) {
        switch (effect.type) {
          case "dispatch":
            state = reduce(state, effect.action, questions);
            break;
          case "finalize":
            done(buildResult(state, questions, effect.cancelled));
            return;
          case "forward-to-editor":
            editor.handleInput(data);
            break;
          case "forward-to-notes-editor":
            notesEditor.handleInput(data);
            break;
          case "set-editor-text":
            editor.setText(effect.text);
            break;
          case "set-notes-editor-text":
            notesEditor.setText(effect.text);
            break;
          case "clear-editor":
            editor.setText("");
            break;
          case "clear-notes-editor":
            notesEditor.setText("");
            break;
        }
      }

      if (effects.length > 0) {
        tui.requestRender();
      }
    }

    function render(width: number): string[] {
      const editorLines =
        state.inputMode === "typing"
          ? editor.render(Math.max(1, width - 4))
          : [];
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

    return {
      render,
      invalidate: () => {},
      handleInput,
    };
  });
}
```

- [ ] **Step 2: Run the full check suite**

```bash
pnpm check
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor(tui): deepen input interpreter to own editor effects

Rename mapInput to interpret. Accept InputContext with editor buffer text.
Return Effect[] instead of single InputResult. Notes-mode Up/Down and
editor-text loading move from questionnaire-ui.ts into input.ts.
questionnaire-ui.ts becomes a dumb effect applier.

Generated with [Devin](https://devin.ai)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>"
```
