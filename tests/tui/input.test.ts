import { describe, expect, it } from "vitest";
import type {
  NormalizedMultiChoiceQuestion,
  NormalizedQuestion,
  NormalizedSingleChoiceQuestion,
} from "../../src/core/types.ts";
import { initState } from "../../src/tui/state.ts";
import { mapInput } from "../../src/tui/input.ts";

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
  allowChat: false,
};
const questionsWithOther: NormalizedQuestion[] = [singleWithOther];

const singleWithChat: NormalizedSingleChoiceQuestion = {
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
  allowChat: true,
};
const questionsWithChat: NormalizedQuestion[] = [singleWithChat];

const multiWithChat: NormalizedMultiChoiceQuestion = {
  type: "multi-choice",
  id: "features",
  header: "Features",
  prompt: "Pick features",
  options: [
    { value: "auth", label: "Auth" },
    { value: "log", label: "Logging" },
  ],
  recommendation: [],
  allowChat: true,
};
const questionsMultiWithChat: NormalizedQuestion[] = [multiWithChat];

describe("mapInput", () => {
  it("Esc returns finalize cancelled", () => {
    const state = initState(questions);
    const result = mapInput("\x1b", state, questions);
    expect(result).toEqual({ type: "finalize", cancelled: true });
  });

  it("Up on single-choice returns moveCursor up", () => {
    const state = { ...initState(questions), optionCursor: 1 };
    const result = mapInput("\x1b[A", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action).toEqual({ type: "moveCursor", direction: "up" });
    }
  });

  it("Space on single-choice returns selectOption", () => {
    const state = initState(questions);
    const result = mapInput(" ", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action.type).toBe("selectOption");
    }
  });

  it("Space on multi-choice returns toggleCheckbox", () => {
    const state = { ...initState(questions), activeTab: 1 };
    const result = mapInput(" ", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action.type).toBe("toggleCheckbox");
    }
  });

  it("Enter on review with all answered returns finalize submitted", () => {
    const state = { ...initState(questions), activeTab: questions.length };
    state.answers.set("scope", { kind: "option", value: "small", label: "Small" });
    state.answers.set("features", {
      kind: "options",
      selected: [{ value: "auth", label: "Auth" }],
    });
    const result = mapInput("\r", state, questions);
    expect(result).toEqual({ type: "finalize", cancelled: false });
  });

  it("Space on review navigates to question tab", () => {
    const state = {
      ...initState(questions),
      activeTab: questions.length,
      reviewCursor: 1,
    };
    const result = mapInput(" ", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action).toEqual({ type: "switchTab", tab: 1 });
    }
  });

  it("Down on single-choice returns moveCursor down", () => {
    const state = initState(questions);
    const result = mapInput("\x1b[B", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action).toEqual({ type: "moveCursor", direction: "down" });
    }
  });

  it("Enter on single-choice returns selectOption", () => {
    const state = initState(questions);
    const result = mapInput("\r", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action.type).toBe("selectOption");
      if (result.action.type === "selectOption") {
        expect(result.action.questionId).toBe("scope");
        expect(result.action.value).toBe("small");
      }
    }
  });

  it("Up on review returns moveCursor up", () => {
    const state = {
      ...initState(questions),
      activeTab: questions.length,
      reviewCursor: 1,
    };
    const result = mapInput("\x1b[A", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action).toEqual({ type: "moveCursor", direction: "up" });
    }
  });

  it("Down on review returns moveCursor down", () => {
    const state = { ...initState(questions), activeTab: questions.length };
    const result = mapInput("\x1b[B", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action).toEqual({ type: "moveCursor", direction: "down" });
    }
  });

  it("Enter on review without all answered navigates to question at cursor", () => {
    const state = { ...initState(questions), activeTab: questions.length };
    const result = mapInput("\r", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action).toEqual({ type: "switchTab", tab: 0 });
    }
  });

  it("Up on multi-choice returns moveCursor up", () => {
    const state = { ...initState(questions), activeTab: 1, optionCursor: 1 };
    const result = mapInput("\x1b[A", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action).toEqual({ type: "moveCursor", direction: "up" });
    }
  });

  it("Enter on multi-choice option returns toggleCheckbox", () => {
    const state = { ...initState(questions), activeTab: 1, optionCursor: 0 };
    const result = mapInput("\r", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action).toEqual({
        type: "toggleCheckbox",
        questionId: "features",
        value: "auth",
      });
    }
  });

  it("Right arrow on single-choice returns switchTab to next", () => {
    const state = initState(questions);
    const result = mapInput("\x1b[C", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action).toEqual({ type: "switchTab", tab: 1 });
    }
  });

  it("Left arrow on single-choice returns switchTab to previous", () => {
    const state = { ...initState(questions), activeTab: 1 };
    const result = mapInput("\x1b[D", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action).toEqual({ type: "switchTab", tab: 0 });
    }
  });

  it("Right arrow wraps from last question tab to review", () => {
    const state = {
      ...initState(questions),
      activeTab: questions.length - 1,
    };
    const result = mapInput("\x1b[C", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action).toEqual({
        type: "switchTab",
        tab: questions.length,
      });
    }
  });

  it("Left arrow on review tab returns switchTab", () => {
    const state = { ...initState(questions), activeTab: questions.length };
    const result = mapInput("\x1b[D", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action).toEqual({
        type: "switchTab",
        tab: questions.length - 1,
      });
    }
  });

  it("unrecognized key on single-choice returns none", () => {
    const state = initState(questions);
    const result = mapInput("x", state, questions);
    expect(result).toEqual({ type: "none" });
  });

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

  it("Space on chat sentinel (single-choice) returns selectChat", () => {
    const state = {
      ...initState(questionsWithChat),
      optionCursor: 2, // chat sentinel (2 options, no allowOther)
    };
    const result = mapInput(" ", state, questionsWithChat);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action).toEqual({
        type: "selectChat",
        questionId: "scope",
      });
    }
  });

  it("Enter on chat sentinel (single-choice) returns selectChat", () => {
    const state = {
      ...initState(questionsWithChat),
      optionCursor: 2, // chat sentinel (2 options, no allowOther)
    };
    const result = mapInput("\r", state, questionsWithChat);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action).toEqual({
        type: "selectChat",
        questionId: "scope",
      });
    }
  });

  it("Space on chat sentinel (multi-choice) returns selectChat", () => {
    const state = {
      ...initState(questionsMultiWithChat),
      optionCursor: 2, // chat sentinel (2 options, allowChat: true)
    };
    const result = mapInput(" ", state, questionsMultiWithChat);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action).toEqual({
        type: "selectChat",
        questionId: "features",
      });
    }
  });

  it("Enter on chat sentinel (multi-choice) returns selectChat", () => {
    const state = {
      ...initState(questionsMultiWithChat),
      optionCursor: 2, // chat sentinel (2 options, allowChat: true)
    };
    const result = mapInput("\r", state, questionsMultiWithChat);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action).toEqual({
        type: "selectChat",
        questionId: "features",
      });
    }
  });

  it("Space on Next row (multi-choice) returns confirmMulti", () => {
    // questions[1] has allowChat: false, so Next is at cursor 2 (options.length)
    const state = {
      ...initState(questions),
      activeTab: 1,
      optionCursor: 2, // Next row
    };
    const result = mapInput(" ", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action).toEqual({
        type: "confirmMulti",
        questionId: "features",
      });
    }
  });

  it("Enter on Next row (multi-choice) returns confirmMulti", () => {
    // questions[1] has allowChat: false, so Next is at cursor 2 (options.length)
    const state = {
      ...initState(questions),
      activeTab: 1,
      optionCursor: 2, // Next row
    };
    const result = mapInput("\r", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action).toEqual({
        type: "confirmMulti",
        questionId: "features",
      });
    }
  });
});
