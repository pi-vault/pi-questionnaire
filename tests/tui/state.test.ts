import { describe, expect, it } from "vitest";
import type { NormalizedQuestion } from "../../src/core/types.ts";
import {
  initState,
  reduce,
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
    const next = reduce(
      state,
      { type: "moveCursor", direction: "up" },
      questions,
    );
    expect(next.optionCursor).toBe(0);
  });

  it("moveCursor down increments optionCursor", () => {
    const state = initState(questions);
    const next = reduce(
      state,
      { type: "moveCursor", direction: "down" },
      questions,
    );
    expect(next.optionCursor).toBe(1);
  });

  it("moveCursor clamps at bounds", () => {
    const state = initState(questions);
    const next = reduce(
      state,
      { type: "moveCursor", direction: "up" },
      questions,
    );
    expect(next.optionCursor).toBe(0);
  });

  it("moveCursor on review tab moves reviewCursor", () => {
    const state = { ...initState(questions), activeTab: questions.length };
    const next = reduce(
      state,
      { type: "moveCursor", direction: "down" },
      questions,
    );
    expect(next.reviewCursor).toBe(1);
  });

  it("selectOption records answer and advances", () => {
    const state = initState(questions);
    const next = reduce(
      state,
      {
        type: "selectOption",
        questionId: "scope",
        value: "small",
        label: "Small",
      },
      questions,
    );
    const answer = next.answers.get("scope");
    expect(answer?.type).toBe("single-choice");
    expect(next.activeTab).toBe(1); // advanced to next unanswered
  });

  it("toggleCheckbox adds value and syncs answer", () => {
    const state = initState(questions);
    const next = reduce(
      state,
      { type: "toggleCheckbox", questionId: "features", value: "log" },
      questions,
    );
    expect(next.multiChecked.get("features")?.has("log")).toBe(true);
    expect(next.multiChecked.get("features")?.has("auth")).toBe(true); // from recommendation
    const answer = next.answers.get("features");
    expect(answer?.type).toBe("multi-choice");
    if (answer?.type === "multi-choice") {
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

  it("submitText records text answer", () => {
    const state = initState(questions);
    const next = reduce(
      state,
      { type: "submitText", questionId: "notes", value: "my notes" },
      questions,
    );
    expect(next.textValues.get("notes")).toBe("my notes");
    const answer = next.answers.get("notes");
    expect(answer?.type).toBe("text");
    if (answer?.type === "text") {
      expect(answer.value).toBe("my notes");
    }
  });

  it("resetCursors zeros both cursors", () => {
    const state = {
      ...initState(questions),
      optionCursor: 3,
      reviewCursor: 2,
    };
    const next = reduce(state, { type: "resetCursors" }, questions);
    expect(next.optionCursor).toBe(0);
    expect(next.reviewCursor).toBe(0);
  });

  it("moveCursor down clamps at last option", () => {
    const state = { ...initState(questions), optionCursor: 1 };
    // scope has 2 options, so max index is 1
    const next = reduce(
      state,
      { type: "moveCursor", direction: "down" },
      questions,
    );
    expect(next.optionCursor).toBe(1);
  });

  it("moveCursor on review tab clamps reviewCursor at 0", () => {
    const state = { ...initState(questions), activeTab: questions.length };
    const next = reduce(
      state,
      { type: "moveCursor", direction: "up" },
      questions,
    );
    expect(next.reviewCursor).toBe(0);
  });

  it("moveCursor on review tab clamps at last question", () => {
    const state = {
      ...initState(questions),
      activeTab: questions.length,
      reviewCursor: questions.length - 1,
    };
    const next = reduce(
      state,
      { type: "moveCursor", direction: "down" },
      questions,
    );
    expect(next.reviewCursor).toBe(questions.length - 1);
  });

  it("selectOption advances to review when all answered", () => {
    const state = initState(questions);
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
    const next = reduce(
      state,
      {
        type: "selectOption",
        questionId: "scope",
        value: "small",
        label: "Small",
      },
      questions,
    );
    expect(next.activeTab).toBe(questions.length); // review tab
  });

  it("selectOption resets cursors after advancing", () => {
    const state = { ...initState(questions), optionCursor: 1 };
    const next = reduce(
      state,
      {
        type: "selectOption",
        questionId: "scope",
        value: "small",
        label: "Small",
      },
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
    if (answer?.type === "multi-choice") {
      // auth (from recommendation) comes before log in options array
      expect(answer.selected[0].value).toBe("auth");
      expect(answer.selected[1].value).toBe("log");
    }
  });

  it("submitText overwrites previous text value", () => {
    const state = initState(questions);
    let next = reduce(
      state,
      { type: "submitText", questionId: "notes", value: "first" },
      questions,
    );
    next = reduce(
      next,
      { type: "submitText", questionId: "notes", value: "second" },
      questions,
    );
    expect(next.textValues.get("notes")).toBe("second");
  });

  it("moveCursor ignores text questions", () => {
    const state = { ...initState(questions), activeTab: 2 }; // text tab
    const next = reduce(
      state,
      { type: "moveCursor", direction: "down" },
      questions,
    );
    expect(next.optionCursor).toBe(0); // unchanged
  });
});
