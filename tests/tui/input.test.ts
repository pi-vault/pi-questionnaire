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
  notesEditorText = "",
): InputContext {
  return {
    state: { ...initState(qs), ...stateOverrides },
    questions: qs,
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
    const effects = interpret("\r", { state, questions, notesEditorText: "" });
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

  it("Esc in typing mode returns cancelTyping + set-editor-text empty", () => {
    const effects = interpret(
      "\x1b",
      ctx(questionsWithOther, {
        inputMode: "typing",
        editingQuestionId: "scope",
      }),
    );
    expect(effects).toEqual([
      { type: "dispatch", action: { type: "cancelTyping" } },
      { type: "set-editor-text", text: "" },
    ]);
  });

  it("Up in typing mode returns cancelTyping + set-editor-text empty", () => {
    const effects = interpret(
      "\x1b[A",
      ctx(questionsWithOther, {
        inputMode: "typing",
        editingQuestionId: "scope",
      }),
    );
    expect(effects).toEqual([
      { type: "dispatch", action: { type: "cancelTyping" } },
      { type: "set-editor-text", text: "" },
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

  it("Esc in notes mode returns cancelNotes + set-notes-editor-text empty", () => {
    const effects = interpret(
      "\x1b",
      ctx(questions, { inputMode: "notes", editingQuestionId: "scope" }),
    );
    expect(effects).toEqual([
      { type: "dispatch", action: { type: "cancelNotes" } },
      { type: "set-notes-editor-text", text: "" },
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
      ctx(questions, { inputMode: "notes", editingQuestionId: "scope" }, "my note"),
    );
    expect(effects).toEqual([
      { type: "dispatch", action: { type: "submitNotes", questionId: "scope", value: "my note" } },
      { type: "dispatch", action: { type: "moveCursor", direction: "up" } },
      { type: "set-notes-editor-text", text: "" },
    ]);
  });

  it("Down in notes mode saves notes and moves cursor down", () => {
    const effects = interpret(
      "\x1b[B",
      ctx(questions, { inputMode: "notes", editingQuestionId: "scope" }, "  note  "),
    );
    expect(effects).toEqual([
      { type: "dispatch", action: { type: "submitNotes", questionId: "scope", value: "note" } },
      { type: "dispatch", action: { type: "moveCursor", direction: "down" } },
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
      notesEditorText: "",
    });
    expect(effects).toEqual([
      { type: "dispatch", action: { type: "enterNotes", questionId: "scope" } },
      { type: "set-notes-editor-text", text: "existing note" },
    ]);
  });

  it.each([0, 1])("Tab opens notes for unanswered question tab %i", (activeTab) => {
    const question = questions[activeTab]!;
    expect(interpret("\t", ctx(questions, { activeTab }))).toEqual([
      { type: "dispatch", action: { type: "enterNotes", questionId: question.id } },
      { type: "set-notes-editor-text", text: "" },
    ]);
  });

  it("Tab on review tab returns empty effects", () => {
    const effects = interpret(
      "\t",
      ctx(questions, { activeTab: questions.length }),
    );
    expect(effects).toEqual([]);
  });
});
