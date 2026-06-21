import { describe, expect, it } from "vitest";
import type { NormalizedQuestion } from "../../src/core/types.ts";
import {
  advanceToNextTab,
  allAnswered,
  answeredIds,
  buildResult,
  currentQuestion,
  getSelectedValue,
  initState,
  reduce,
} from "../../src/tui/state.ts";

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
    recommendation: "small",
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
    recommendation: ["auth"],
  },
];

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

  it("moveCursor clamps at bounds", () => {
    const state = initState(questions);
    const next = reduce(state, { type: "moveCursor", direction: "up" }, questions);
    expect(next.optionCursor).toBe(0);
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

  it("moveCursor down clamps at last option", () => {
    const state = { ...initState(questions), optionCursor: 1 };
    // scope has 2 options, so max index is 1
    const next = reduce(state, { type: "moveCursor", direction: "down" }, questions);
    expect(next.optionCursor).toBe(1);
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
});
