import { describe, expect, it } from "vitest";
import {
  formatAnswerForRender,
  formatContentSummary,
  formatModelLine,
  formatNoteLine,
} from "../../src/core/format.ts";
import type {
  NormalizedQuestion,
  QuestionResponse,
  QuestionnaireResult,
} from "../../src/core/types.ts";

const singleQ: NormalizedQuestion = {
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
};

const multiQ: NormalizedQuestion = {
  type: "multi-choice",
  id: "features",
  header: "Features",
  prompt: "Select features",
  options: [
    { value: "auth", label: "Auth" },
    { value: "logging", label: "Logging" },
    { value: "cache", label: "Cache" },
  ],
  recommendation: [],
};

describe("formatModelLine", () => {
  it("formats option selection", () => {
    const response: QuestionResponse = {
      questionId: "scope",
      selection: { kind: "option", value: "small", label: "Small" },
    };
    expect(formatModelLine(singleQ, response)).toBe(
      "Scope: user selected: 1. Small",
    );
  });

  it("formats multi-choice options", () => {
    const response: QuestionResponse = {
      questionId: "features",
      selection: {
        kind: "options",
        selected: [
          { value: "auth", label: "Auth" },
          { value: "logging", label: "Logging" },
        ],
      },
    };
    expect(formatModelLine(multiQ, response)).toBe(
      "Features: user selected: 1. Auth, 2. Logging",
    );
  });

  it("formats custom text", () => {
    const response: QuestionResponse = {
      questionId: "scope",
      selection: { kind: "custom", value: "micro-service only" },
    };
    expect(formatModelLine(singleQ, response)).toBe(
      'Scope: user wrote: "micro-service only"',
    );
  });

  it("formats chat signal", () => {
    const response: QuestionResponse = {
      questionId: "scope",
      selection: { kind: "chat" },
    };
    expect(formatModelLine(singleQ, response)).toBe(
      "Scope: user wants to discuss this question",
    );
  });
});

describe("formatNoteLine", () => {
  it("returns null when no notes", () => {
    const response: QuestionResponse = {
      questionId: "scope",
      selection: { kind: "option", value: "small", label: "Small" },
    };
    expect(formatNoteLine(singleQ, response)).toBeNull();
  });

  it("formats note when present", () => {
    const response: QuestionResponse = {
      questionId: "scope",
      selection: { kind: "option", value: "small", label: "Small" },
      notes: "prefer minimal scope",
    };
    expect(formatNoteLine(singleQ, response)).toBe(
      'Scope note: "prefer minimal scope"',
    );
  });
});

describe("formatContentSummary", () => {
  it("formats cancelled result", () => {
    const result: QuestionnaireResult = {
      questions: [singleQ],
      responses: [],
      cancelled: true,
    };
    expect(formatContentSummary(result)).toBe(
      "User cancelled the questionnaire",
    );
  });

  it("formats responses with notes", () => {
    const result: QuestionnaireResult = {
      questions: [singleQ, multiQ],
      responses: [
        {
          questionId: "scope",
          selection: { kind: "option", value: "small", label: "Small" },
          notes: "keep it simple",
        },
        {
          questionId: "features",
          selection: {
            kind: "options",
            selected: [{ value: "auth", label: "Auth" }],
          },
        },
      ],
      cancelled: false,
    };
    const summary = formatContentSummary(result);
    expect(summary).toContain("Scope: user selected: 1. Small");
    expect(summary).toContain('Scope note: "keep it simple"');
    expect(summary).toContain("Features: user selected: 1. Auth");
  });
});

describe("formatAnswerForRender", () => {
  it("formats option for review", () => {
    expect(
      formatAnswerForRender(singleQ, {
        kind: "option",
        value: "small",
        label: "Small",
      }),
    ).toBe("1. Small");
  });

  it("formats custom for review", () => {
    expect(
      formatAnswerForRender(singleQ, { kind: "custom", value: "micro" }),
    ).toBe('(wrote) "micro"');
  });

  it("formats chat for review", () => {
    expect(formatAnswerForRender(singleQ, { kind: "chat" })).toBe("chat");
  });

  it("formats multi-options for review", () => {
    expect(
      formatAnswerForRender(multiQ, {
        kind: "options",
        selected: [
          { value: "auth", label: "Auth" },
          { value: "cache", label: "Cache" },
        ],
      }),
    ).toBe("1. Auth, 3. Cache");
  });
});
