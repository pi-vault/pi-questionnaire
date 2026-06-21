import { describe, expect, it } from "vitest";
import type { NormalizedQuestion } from "../../src/core/types.ts";
import {
  initState,
  allAnswered,
  answeredIds,
  currentQuestion,
  advanceToNextTab,
  getSelectedValue,
  buildResult,
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
  {
    type: "text",
    id: "notes",
    header: "Notes",
    prompt: "Any notes?",
    recommendation: "prefilled",
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

  it("pre-populates textValues from recommendations", () => {
    const state = initState(questions);
    expect(state.textValues.get("notes")).toBe("prefilled");
  });

  it("does not pre-populate textValues when no recommendation", () => {
    const noRecQuestions: NormalizedQuestion[] = [
      {
        type: "text",
        id: "notes",
        header: "Notes",
        prompt: "Any notes?",
        recommendation: null,
      },
    ];
    const state = initState(noRecQuestions);
    expect(state.textValues.has("notes")).toBe(false);
  });
});

describe("allAnswered", () => {
  it("returns false when no answers", () => {
    const state = initState(questions);
    expect(allAnswered(state, questions)).toBe(false);
  });

  it("returns true when all questions have answers", () => {
    const state = initState(questions);
    state.answers.set("scope", {
      type: "single-choice",
      questionId: "scope",
      value: "small",
      label: "Small",
    });
    state.answers.set("features", {
      type: "multi-choice",
      questionId: "features",
      selected: [{ value: "auth", label: "Auth" }],
    });
    state.answers.set("notes", {
      type: "text",
      questionId: "notes",
      value: "ok",
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
    state.answers.set("scope", {
      type: "single-choice",
      questionId: "scope",
      value: "small",
      label: "Small",
    });
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
    state.answers.set("scope", {
      type: "single-choice",
      questionId: "scope",
      value: "small",
      label: "Small",
    });
    const next = advanceToNextTab(state, questions);
    expect(next).toBe(1); // features
  });

  it("goes to review when all answered", () => {
    const state = initState(questions);
    state.answers.set("scope", {
      type: "single-choice",
      questionId: "scope",
      value: "small",
      label: "Small",
    });
    state.answers.set("features", {
      type: "multi-choice",
      questionId: "features",
      selected: [{ value: "auth", label: "Auth" }],
    });
    state.answers.set("notes", {
      type: "text",
      questionId: "notes",
      value: "ok",
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

  it("returns selected value for single-choice answer", () => {
    const state = initState(questions);
    state.answers.set("scope", {
      type: "single-choice",
      questionId: "scope",
      value: "small",
      label: "Small",
    });
    expect(getSelectedValue(state, "scope")).toBe("small");
  });
});

describe("buildResult", () => {
  it("builds result with answers in question order", () => {
    const state = initState(questions);
    state.answers.set("notes", {
      type: "text",
      questionId: "notes",
      value: "ok",
    });
    state.answers.set("scope", {
      type: "single-choice",
      questionId: "scope",
      value: "small",
      label: "Small",
    });
    const result = buildResult(state, questions, false);
    expect(result.cancelled).toBe(false);
    expect(result.answers).toHaveLength(2);
    expect(result.answers[0].questionId).toBe("scope"); // question order
    expect(result.answers[1].questionId).toBe("notes");
  });

  it("builds cancelled result", () => {
    const state = initState(questions);
    const result = buildResult(state, questions, true);
    expect(result.cancelled).toBe(true);
    expect(result.answers).toHaveLength(0);
  });
});
