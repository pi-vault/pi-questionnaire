import { describe, expect, it } from "vitest";
import type {
  ChoiceAnswer,
  MultiChoiceAnswer,
  NormalizedAnswer,
  NormalizedQuestion,
  QuestionnaireResult,
  TextAnswer,
} from "../../src/core/types.ts";
import {
  formatAnswerForRender,
  formatContentSummary,
  formatModelLine,
} from "../../src/core/format.ts";

const choiceQ: NormalizedQuestion = {
  type: "single-choice",
  id: "scope",
  header: "Scope",
  prompt: "Pick scope",
  options: [
    { value: "small", label: "Small" },
    { value: "large", label: "Large" },
  ],
  recommendation: null,
};

const multiQ: NormalizedQuestion = {
  type: "multi-choice",
  id: "features",
  header: "Features",
  prompt: "Pick features",
  options: [
    { value: "auth", label: "Auth" },
    { value: "log", label: "Logging" },
    { value: "cache", label: "Caching" },
  ],
  recommendation: [],
};

const textQ: NormalizedQuestion = {
  type: "text",
  id: "notes",
  header: "Notes",
  prompt: "Any notes?",
  recommendation: null,
};

describe("formatModelLine", () => {
  it("formats choice answer", () => {
    const answer: ChoiceAnswer = {
      type: "single-choice",
      questionId: "scope",
      value: "small",
      label: "Small",
    };
    expect(formatModelLine(choiceQ, answer)).toBe(
      "Scope: user selected: 1. Small",
    );
  });

  it("formats multi-choice answer", () => {
    const answer: MultiChoiceAnswer = {
      type: "multi-choice",
      questionId: "features",
      selected: [
        { value: "auth", label: "Auth" },
        { value: "cache", label: "Caching" },
      ],
    };
    expect(formatModelLine(multiQ, answer)).toBe(
      "Features: user selected: 1. Auth, 3. Caching",
    );
  });

  it("formats text answer", () => {
    const answer: TextAnswer = {
      type: "text",
      questionId: "notes",
      value: "Keep it simple",
    };
    expect(formatModelLine(textQ, answer)).toBe(
      'Notes: user wrote: "Keep it simple"',
    );
  });

  it("formats empty text answer", () => {
    const answer: TextAnswer = { type: "text", questionId: "notes", value: "" };
    expect(formatModelLine(textQ, answer)).toBe("Notes: (empty response)");
  });
});

describe("formatContentSummary", () => {
  it("returns cancelled message when cancelled", () => {
    const result: QuestionnaireResult = {
      questions: [],
      answers: [],
      cancelled: true,
    };
    expect(formatContentSummary(result)).toBe(
      "User cancelled the questionnaire",
    );
  });

  it("joins answer lines for submitted result", () => {
    const result: QuestionnaireResult = {
      questions: [choiceQ, textQ],
      answers: [
        {
          type: "single-choice",
          questionId: "scope",
          value: "small",
          label: "Small",
        },
        { type: "text", questionId: "notes", value: "ok" },
      ],
      cancelled: false,
    };
    expect(formatContentSummary(result)).toBe(
      'Scope: user selected: 1. Small\nNotes: user wrote: "ok"',
    );
  });
});

describe("formatAnswerForRender", () => {
  it("formats choice for display", () => {
    const answer: ChoiceAnswer = {
      type: "single-choice",
      questionId: "scope",
      value: "small",
      label: "Small",
    };
    expect(formatAnswerForRender(choiceQ, answer)).toBe("1. Small");
  });

  it("formats multi-choice for display", () => {
    const answer: MultiChoiceAnswer = {
      type: "multi-choice",
      questionId: "features",
      selected: [{ value: "auth", label: "Auth" }],
    };
    expect(formatAnswerForRender(multiQ, answer)).toBe("1. Auth");
  });

  it("formats text for display", () => {
    const answer: TextAnswer = {
      type: "text",
      questionId: "notes",
      value: "hello",
    };
    expect(formatAnswerForRender(textQ, answer)).toBe("(wrote) hello");
  });
});
