import { describe, expect, it } from "vitest";
import type { NormalizedQuestion } from "../../src/core/types.ts";
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
  },
];

describe("mapInput", () => {
  it("Esc returns finalize cancelled", () => {
    const state = initState(questions);
    const result = mapInput("\x1b", state, questions);
    expect(result).toEqual({ type: "finalize", cancelled: true });
  });

  it("Tab returns switchTab to next", () => {
    const state = initState(questions);
    const result = mapInput("\t", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action.type).toBe("switchTab");
      if (result.action.type === "switchTab") {
        expect(result.action.tab).toBe(1);
      }
    }
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

  it("Enter on multi-choice returns none", () => {
    const state = { ...initState(questions), activeTab: 1 };
    const result = mapInput("\r", state, questions);
    expect(result).toEqual({ type: "none" });
  });

  it("Shift+Tab returns switchTab to previous", () => {
    const state = { ...initState(questions), activeTab: 1 };
    const result = mapInput("\x1b[Z", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action).toEqual({ type: "switchTab", tab: 0 });
    }
  });

  it("Shift+Tab wraps from first tab to review", () => {
    const state = initState(questions);
    const result = mapInput("\x1b[Z", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action).toEqual({
        type: "switchTab",
        tab: questions.length,
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
});
