import { describe, expect, it } from "vitest";
import type { NormalizedQuestion } from "../../src/core/types.ts";
import {
  advanceToNextTab,
  allAnswered,
  answeredIds,
  buildResult,
  currentQuestion,
  cursorTarget,
  getSelectedValue,
  initState,
  reduce,
  rowLayout,
  visibleRowCount,
} from "../../src/tui/state.ts";

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
    recommendation: "small",
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
    recommendation: "auth",
    allowOther: false,
    allowChat: false,
  },
];

const singleWithOther: NormalizedQuestion = {
  multiSelect: false,
  id: "scope-other",
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

const singleWithChat: NormalizedQuestion = {
  multiSelect: false,
  id: "scope-chat",
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

const singleWithOtherAndChat: NormalizedQuestion = {
  multiSelect: false,
  id: "scope-other-chat",
  header: "Scope",
  prompt: "Pick scope",
  options: [
    { value: "small", label: "Small" },
    { value: "large", label: "Large" },
  ],
  recommendation: null,
  allowOther: true,
  allowChat: true,
};

const multiWithChat: NormalizedQuestion = {
  multiSelect: true,
  id: "features-chat",
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

const multiWithOther: NormalizedQuestion = {
  multiSelect: true,
  id: "features-other",
  header: "Features",
  prompt: "Pick features",
  options: [
    { value: "auth", label: "Auth" },
    { value: "log", label: "Logging" },
  ],
  recommendation: "auth",
  allowOther: true,
  allowChat: true,
};

// Questions used for selectChat / confirmMulti reducer tests
const questionsWithChat: NormalizedQuestion[] = [
  {
    multiSelect: false,
    id: "q1",
    header: "Q1",
    prompt: "Pick one",
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
    recommendation: null,
    allowOther: false,
    allowChat: true,
  },
  {
    multiSelect: true,
    id: "q2",
    header: "Q2",
    prompt: "Pick many",
    options: [
      { value: "x", label: "X" },
      { value: "y", label: "Y" },
    ],
    recommendation: null,
    allowOther: false,
    allowChat: true,
  },
];

describe("rowLayout", () => {
  it("returns option slots for plain single-select (no sentinels)", () => {
    const slots = rowLayout(questions[0]); // allowOther: false, allowChat: false
    expect(slots).toEqual([
      { kind: "option", index: 0 },
      { kind: "option", index: 1 },
    ]);
  });

  it("includes other slot for single-select with allowOther", () => {
    const slots = rowLayout(singleWithOther);
    expect(slots).toEqual([
      { kind: "option", index: 0 },
      { kind: "option", index: 1 },
      { kind: "other" },
    ]);
  });

  it("includes chat slot for single-select with allowChat", () => {
    const slots = rowLayout(singleWithChat);
    expect(slots).toEqual([
      { kind: "option", index: 0 },
      { kind: "option", index: 1 },
      { kind: "chat" },
    ]);
  });

  it("includes other then chat for single-select with both", () => {
    const slots = rowLayout(singleWithOtherAndChat);
    expect(slots).toEqual([
      { kind: "option", index: 0 },
      { kind: "option", index: 1 },
      { kind: "other" },
      { kind: "chat" },
    ]);
  });

  it("includes next slot for multi-select (no chat)", () => {
    const slots = rowLayout(questions[1]); // allowChat: false
    expect(slots).toEqual([
      { kind: "option", index: 0 },
      { kind: "option", index: 1 },
      { kind: "next" },
    ]);
  });

  it("includes chat then next for multi-select with allowChat", () => {
    const slots = rowLayout(multiWithChat);
    expect(slots).toEqual([
      { kind: "option", index: 0 },
      { kind: "option", index: 1 },
      { kind: "chat" },
      { kind: "next" },
    ]);
  });

  it("orders other before chat and Next for multi-select", () => {
    expect(rowLayout(multiWithOther)).toEqual([
      { kind: "option", index: 0 },
      { kind: "option", index: 1 },
      { kind: "other" },
      { kind: "chat" },
      { kind: "next" },
    ]);
  });
});

describe("initState", () => {
  it("starts on tab 0 with cursors at 0", () => {
    const state = initState(questions);
    expect(state.activeTab).toBe(0);
    expect(state.optionCursor).toBe(0);
    expect(state.reviewCursor).toBe(0);
  });

  it("starts with no answers", () => {
    const state = initState(questions);
    expect(state.answers.size).toBe(0);
  });

  it("pre-populates multiChecked from recommendations", () => {
    const state = initState(questions);
    const checked = state.multiChecked.get("features");
    expect(checked).toBeDefined();
    expect(checked?.has("auth")).toBe(true);
    expect(checked?.has("log")).toBe(false);
  });

  it("initializes inputMode to navigate", () => {
    const state = initState(questions);
    expect(state.inputMode).toBe("navigate");
    expect(state.editingQuestionId).toBeNull();
    expect(state.customText.size).toBe(0);
  });
});

describe("allAnswered", () => {
  it("returns false when no answers", () => {
    const state = initState(questions);
    expect(allAnswered(state, questions)).toBe(false);
  });

  it("returns true when all questions have answers", () => {
    const state = initState(questions);
    state.answers.set("scope", { kind: "option", value: "small", label: "Small" });
    state.answers.set("features", {
      kind: "options",
      selected: [{ value: "auth", label: "Auth" }],
    });
    expect(allAnswered(state, questions)).toBe(true);
  });
});

describe("answeredIds", () => {
  it("returns empty set when no answers", () => {
    const state = initState(questions);
    expect(answeredIds(state).size).toBe(0);
  });

  it("returns ids of answered questions", () => {
    const state = initState(questions);
    state.answers.set("scope", { kind: "option", value: "small", label: "Small" });
    const ids = answeredIds(state);
    expect(ids.has("scope")).toBe(true);
    expect(ids.size).toBe(1);
  });
});

describe("currentQuestion", () => {
  it("returns question at activeTab", () => {
    const state = initState(questions);
    expect(currentQuestion(state, questions)?.id).toBe("scope");
  });

  it("returns undefined when on review tab", () => {
    const state = { ...initState(questions), activeTab: questions.length };
    expect(currentQuestion(state, questions)).toBeUndefined();
  });
});

describe("advanceToNextTab", () => {
  it("advances to next unanswered question", () => {
    const state = initState(questions);
    state.answers.set("scope", { kind: "option", value: "small", label: "Small" });
    const next = advanceToNextTab(state, questions);
    expect(next).toBe(1); // features
  });

  it("goes to review when all answered", () => {
    const state = initState(questions);
    state.answers.set("scope", { kind: "option", value: "small", label: "Small" });
    state.answers.set("features", {
      kind: "options",
      selected: [{ value: "auth", label: "Auth" }],
    });
    const next = advanceToNextTab(state, questions);
    expect(next).toBe(questions.length); // review tab
  });
});

describe("getSelectedValue", () => {
  it("returns null when no answer", () => {
    const state = initState(questions);
    expect(getSelectedValue(state, "scope")).toBeNull();
  });

  it("returns selected value for option answer", () => {
    const state = initState(questions);
    state.answers.set("scope", { kind: "option", value: "small", label: "Small" });
    expect(getSelectedValue(state, "scope")).toBe("small");
  });
});

describe("buildResult", () => {
  it("builds result with responses in question order", () => {
    const state = initState(questions);
    state.answers.set("features", {
      kind: "options",
      selected: [{ value: "auth", label: "Auth" }],
    });
    state.answers.set("scope", { kind: "option", value: "small", label: "Small" });
    const result = buildResult(state, questions, false);
    expect(result.cancelled).toBe(false);
    expect(result.responses).toHaveLength(2);
    expect(result.responses[0].questionId).toBe("scope"); // question order
    expect(result.responses[0].selection).toEqual({ kind: "option", value: "small", label: "Small" });
    expect(result.responses[1].questionId).toBe("features");
  });

  it("builds cancelled result", () => {
    const state = initState(questions);
    const result = buildResult(state, questions, true);
    expect(result.cancelled).toBe(true);
    expect(result.responses).toHaveLength(0);
  });
});

describe("reduce", () => {
  it("switchTab changes active tab and resets cursors", () => {
    const state = { ...initState(questions), optionCursor: 2, reviewCursor: 1 };
    const next = reduce(state, { type: "switchTab", tab: 1 }, questions);
    expect(next.activeTab).toBe(1);
    expect(next.optionCursor).toBe(0);
    expect(next.reviewCursor).toBe(0);
  });

  it("switchTab does not mutate original state", () => {
    const state = initState(questions);
    const next = reduce(state, { type: "switchTab", tab: 1 }, questions);
    expect(state.activeTab).toBe(0);
    expect(next.activeTab).toBe(1);
  });

  it("moveCursor up decrements optionCursor", () => {
    const state = { ...initState(questions), optionCursor: 1 };
    const next = reduce(state, { type: "moveCursor", direction: "up" }, questions);
    expect(next.optionCursor).toBe(0);
  });

  it("moveCursor down increments optionCursor", () => {
    const state = initState(questions);
    const next = reduce(state, { type: "moveCursor", direction: "down" }, questions);
    expect(next.optionCursor).toBe(1);
  });

  it("wraps question rows", () => {
    const questions = [singleWithOther];
    const rowCount = visibleRowCount(singleWithOther);

    expect(
      reduce(initState(questions), { type: "moveCursor", direction: "up" }, questions)
        .optionCursor,
    ).toBe(rowCount - 1);

    expect(
      reduce(
        { ...initState(questions), optionCursor: rowCount - 1 },
        { type: "moveCursor", direction: "down" },
        questions,
      ).optionCursor,
    ).toBe(0);
  });

  it("moveCursor on review tab moves reviewCursor", () => {
    const state = { ...initState(questions), activeTab: questions.length };
    const next = reduce(state, { type: "moveCursor", direction: "down" }, questions);
    expect(next.reviewCursor).toBe(1);
  });

  it("selectOption records answer as option selection and advances", () => {
    const state = initState(questions);
    const next = reduce(
      state,
      { type: "selectOption", questionId: "scope", value: "small", label: "Small" },
      questions,
    );
    const answer = next.answers.get("scope");
    expect(answer?.kind).toBe("option");
    expect(next.activeTab).toBe(1); // advanced to next unanswered
  });

  it("toggleCheckbox adds value and syncs answer as options selection", () => {
    const state = initState(questions);
    const next = reduce(
      state,
      { type: "toggleCheckbox", questionId: "features", value: "log" },
      questions,
    );
    expect(next.multiChecked.get("features")?.has("log")).toBe(true);
    expect(next.multiChecked.get("features")?.has("auth")).toBe(true); // from recommendation
    const answer = next.answers.get("features");
    expect(answer?.kind).toBe("options");
    if (answer?.kind === "options") {
      expect(answer.selected).toHaveLength(2);
    }
  });

  it("toggleCheckbox removes value when already checked", () => {
    const state = initState(questions);
    const next = reduce(
      state,
      { type: "toggleCheckbox", questionId: "features", value: "auth" },
      questions,
    );
    expect(next.multiChecked.get("features")?.has("auth")).toBe(false);
    // No selections left — answer should be removed
    expect(next.answers.has("features")).toBe(false);
  });

  it("resetCursors zeros both cursors", () => {
    const state = { ...initState(questions), optionCursor: 3, reviewCursor: 2 };
    const next = reduce(state, { type: "resetCursors" }, questions);
    expect(next.optionCursor).toBe(0);
    expect(next.reviewCursor).toBe(0);
  });

  it("moveCursor on review tab clamps reviewCursor at 0", () => {
    const state = { ...initState(questions), activeTab: questions.length };
    const next = reduce(state, { type: "moveCursor", direction: "up" }, questions);
    expect(next.reviewCursor).toBe(0);
  });

  it("moveCursor on review tab clamps at last question", () => {
    const state = {
      ...initState(questions),
      activeTab: questions.length,
      reviewCursor: questions.length - 1,
    };
    const next = reduce(state, { type: "moveCursor", direction: "down" }, questions);
    expect(next.reviewCursor).toBe(questions.length - 1);
  });

  it("selectOption advances to review when all answered", () => {
    const state = initState(questions);
    state.answers.set("features", {
      kind: "options",
      selected: [{ value: "auth", label: "Auth" }],
    });
    const next = reduce(
      state,
      { type: "selectOption", questionId: "scope", value: "small", label: "Small" },
      questions,
    );
    expect(next.activeTab).toBe(questions.length); // review tab
  });

  it("selectOption resets cursors after advancing", () => {
    const state = { ...initState(questions), optionCursor: 1 };
    const next = reduce(
      state,
      { type: "selectOption", questionId: "scope", value: "small", label: "Small" },
      questions,
    );
    expect(next.optionCursor).toBe(0);
    expect(next.reviewCursor).toBe(0);
  });

  it("toggleCheckbox with multiple selections preserves question order", () => {
    const state = initState(questions);
    const next = reduce(
      state,
      { type: "toggleCheckbox", questionId: "features", value: "log" },
      questions,
    );
    const answer = next.answers.get("features");
    if (answer?.kind === "options") {
      // auth (from recommendation) comes before log in options array
      expect(answer.selected[0].value).toBe("auth");
      expect(answer.selected[1].value).toBe("log");
    }
  });

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
});

describe("visibleRowCount", () => {
  it("includes sentinel for single-choice with allowOther", () => {
    expect(visibleRowCount(singleWithOther)).toBe(3); // 2 options + 1 sentinel
  });

  it("excludes sentinel when allowOther is false", () => {
    expect(visibleRowCount(questions[0])).toBe(2); // 2 options, no sentinel, no chat
  });

  it("always includes Next row for multi-choice", () => {
    expect(visibleRowCount(questions[1])).toBe(3); // 2 options + Next
  });

  it("includes chat row for single-choice with allowChat (no allowOther)", () => {
    expect(visibleRowCount(singleWithChat)).toBe(3); // 2 options + chat
  });

  it("includes other and chat rows for single-choice with allowOther and allowChat", () => {
    expect(visibleRowCount(singleWithOtherAndChat)).toBe(4); // 2 options + other + chat
  });

  it("includes chat and Next rows for multi-choice with allowChat", () => {
    expect(visibleRowCount(multiWithChat)).toBe(4); // 2 options + chat + Next
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

  it("returns chat for cursor at options.length on single-choice with allowChat (no allowOther)", () => {
    expect(cursorTarget(singleWithChat, 2)).toEqual({ kind: "chat" });
  });

  it("returns other for cursor at options.length on single-choice with allowOther and allowChat", () => {
    expect(cursorTarget(singleWithOtherAndChat, 2)).toEqual({ kind: "other" });
  });

  it("returns chat for cursor at options.length+1 on single-choice with allowOther and allowChat", () => {
    expect(cursorTarget(singleWithOtherAndChat, 3)).toEqual({ kind: "chat" });
  });

  it("returns chat for cursor at options.length on multi-choice with allowChat", () => {
    expect(cursorTarget(multiWithChat, 2)).toEqual({ kind: "chat" });
  });

  it("returns next for cursor at options.length+1 on multi-choice with allowChat", () => {
    expect(cursorTarget(multiWithChat, 3)).toEqual({ kind: "next" });
  });

  it("returns next for cursor at options.length on multi-choice without allowChat", () => {
    expect(cursorTarget(questions[1], 2)).toEqual({ kind: "next" });
  });
});

describe("selectChat action", () => {
  it("sets chat answer and advances to next tab", () => {
    const state = initState(questionsWithChat);
    const next = reduce(
      state,
      { type: "selectChat", questionId: "q1" },
      questionsWithChat,
    );
    expect(next.answers.get("q1")).toEqual({ kind: "chat" });
    expect(next.activeTab).toBe(1); // advanced to q2 (unanswered)
    expect(next.optionCursor).toBe(0);
    expect(next.reviewCursor).toBe(0);
  });

  it("clears multiChecked when selecting chat on multi-choice question", () => {
    const state = initState(questionsWithChat);
    state.activeTab = 1;
    state.answers.set("q1", { kind: "chat" }); // q1 already answered
    state.multiChecked.get("q2")?.add("x"); // simulate prior toggleCheckbox

    const next = reduce(
      state,
      { type: "selectChat", questionId: "q2" },
      questionsWithChat,
    );
    expect(next.answers.get("q2")).toEqual({ kind: "chat" });
    expect(next.multiChecked.get("q2")?.size).toBe(0);
  });

  it("advances to review tab when all questions answered via chat", () => {
    const state = initState(questionsWithChat);
    state.answers.set("q2", { kind: "options", selected: [{ value: "x", label: "X" }] });
    const next = reduce(
      state,
      { type: "selectChat", questionId: "q1" },
      questionsWithChat,
    );
    expect(next.activeTab).toBe(questionsWithChat.length); // review tab
  });
});

describe("confirmMulti action", () => {
  it("advances to next unanswered tab without changing the answer", () => {
    const state = initState(questionsWithChat);
    state.activeTab = 1;
    // Answer already synced via prior toggleCheckbox
    state.answers.set("q2", { kind: "options", selected: [{ value: "x", label: "X" }] });

    const next = reduce(
      state,
      { type: "confirmMulti", questionId: "q2" },
      questionsWithChat,
    );
    // q1 is unanswered, so advance there
    expect(next.activeTab).toBe(0);
    expect(next.optionCursor).toBe(0);
    expect(next.reviewCursor).toBe(0);
    // Answer is unchanged
    expect(next.answers.get("q2")).toEqual({
      kind: "options",
      selected: [{ value: "x", label: "X" }],
    });
  });

  it("advances to review tab when all questions are answered", () => {
    const state = initState(questionsWithChat);
    state.activeTab = 1;
    state.answers.set("q1", { kind: "chat" });
    state.answers.set("q2", { kind: "options", selected: [{ value: "x", label: "X" }] });

    const next = reduce(
      state,
      { type: "confirmMulti", questionId: "q2" },
      questionsWithChat,
    );
    expect(next.activeTab).toBe(questionsWithChat.length); // review tab
  });
});

describe("notes actions", () => {
  it("enterNotes sets inputMode to notes and editingQuestionId", () => {
    const state = initState(questions);
    const next = reduce(
      state,
      { type: "enterNotes", questionId: "scope" },
      questions,
    );
    expect(next.inputMode).toBe("notes");
    expect(next.editingQuestionId).toBe("scope");
  });

  it("submitNotes stores trimmed note and returns to navigate", () => {
    const state = initState(questions);
    state.inputMode = "notes";
    state.editingQuestionId = "scope";
    const next = reduce(
      state,
      { type: "submitNotes", questionId: "scope", value: "  my note  " },
      questions,
    );
    expect(next.notes.get("scope")).toBe("my note");
    expect(next.inputMode).toBe("navigate");
    expect(next.editingQuestionId).toBeNull();
  });

  it("submitNotes with empty string deletes existing note", () => {
    const state = initState(questions);
    state.notes.set("scope", "old note");
    state.inputMode = "notes";
    state.editingQuestionId = "scope";
    const next = reduce(
      state,
      { type: "submitNotes", questionId: "scope", value: "   " },
      questions,
    );
    expect(next.notes.has("scope")).toBe(false);
    expect(next.inputMode).toBe("navigate");
  });

  it("cancelNotes returns to navigate without modifying notes", () => {
    const state = initState(questions);
    state.notes.set("scope", "existing note");
    state.inputMode = "notes";
    state.editingQuestionId = "scope";
    const next = reduce(state, { type: "cancelNotes" }, questions);
    expect(next.inputMode).toBe("navigate");
    expect(next.editingQuestionId).toBeNull();
    expect(next.notes.get("scope")).toBe("existing note");
  });

  it("switchTab resets inputMode when in notes mode", () => {
    const state = initState(questions);
    state.inputMode = "notes";
    state.editingQuestionId = "scope";
    const next = reduce(state, { type: "switchTab", tab: 1 }, questions);
    expect(next.inputMode).toBe("navigate");
    expect(next.editingQuestionId).toBeNull();
  });
});

describe("buildResult with notes", () => {
  it("includes notes in response when present", () => {
    const state = initState(questions);
    state.answers.set("scope", { kind: "option", value: "small", label: "Small" });
    state.notes.set("scope", "important note");
    const result = buildResult(state, questions, false);
    expect(result.responses[0].notes).toBe("important note");
  });

  it("omits notes field when question has no note", () => {
    const state = initState(questions);
    state.answers.set("scope", { kind: "option", value: "small", label: "Small" });
    const result = buildResult(state, questions, false);
    expect(result.responses[0].notes).toBeUndefined();
  });
});
