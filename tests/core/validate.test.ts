import { describe, expect, it } from "vitest";
import type { QuestionInput } from "../../src/core/schema.ts";
import { validateQuestions } from "../../src/core/validate.ts";

function choiceQ(
  overrides: Partial<QuestionInput & { type: "single-choice" }> = {},
): QuestionInput {
  return {
    type: "single-choice",
    id: "q1",
    header: "Q1",
    prompt: "Pick one",
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
    ...overrides,
  };
}

function multiQ(
  overrides: Partial<QuestionInput & { type: "multi-choice" }> = {},
): QuestionInput {
  return {
    type: "multi-choice",
    id: "q1",
    header: "Q1",
    prompt: "Pick many",
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
    ...overrides,
  };
}

function textQ(
  overrides: Partial<QuestionInput & { type: "text" }> = {},
): QuestionInput {
  return {
    type: "text",
    id: "q1",
    header: "Q1",
    prompt: "Type something",
    ...overrides,
  };
}

describe("validateQuestions", () => {
  it("accepts a valid single choice question", () => {
    const result = validateQuestions([choiceQ()]);
    expect(result).toEqual({ valid: true });
  });

  it("accepts a valid multi-choice question", () => {
    const result = validateQuestions([multiQ()]);
    expect(result).toEqual({ valid: true });
  });

  it("accepts a valid text question", () => {
    const result = validateQuestions([textQ()]);
    expect(result).toEqual({ valid: true });
  });

  it("rejects empty questions array", () => {
    const result = validateQuestions([]);
    expect(result).toEqual({
      valid: false,
      error: "Questionnaire must include at least 1 question.",
    });
  });

  it("rejects more than 10 questions", () => {
    const qs = Array.from({ length: 11 }, (_, i) => choiceQ({ id: `q${i}` }));
    const result = validateQuestions(qs);
    expect(result).toEqual({
      valid: false,
      error: "Questionnaire supports at most 10 questions.",
    });
  });

  it("rejects duplicate question ids", () => {
    const result = validateQuestions([
      choiceQ({ id: "dup" }),
      textQ({ id: "dup" }),
    ]);
    expect(result).toEqual({
      valid: false,
      error: 'Duplicate question id: "dup".',
    });
  });

  it("rejects empty question id", () => {
    const result = validateQuestions([choiceQ({ id: "  " })]);
    expect(result).toEqual({
      valid: false,
      error: "Question 1 has an empty id.",
    });
  });

  it("rejects empty question header", () => {
    const result = validateQuestions([choiceQ({ header: "" })]);
    expect(result).toEqual({
      valid: false,
      error: 'Question "q1" has an empty header.',
    });
  });

  it("rejects empty question prompt", () => {
    const result = validateQuestions([choiceQ({ prompt: "  " })]);
    expect(result).toEqual({
      valid: false,
      error: 'Question "q1" has an empty prompt.',
    });
  });

  it("rejects choice with fewer than 2 options", () => {
    const result = validateQuestions([
      choiceQ({ options: [{ value: "a", label: "A" }] }),
    ]);
    expect(result).toEqual({
      valid: false,
      error: 'Question "q1" must have 2-12 options.',
    });
  });

  it("rejects choice with more than 12 options", () => {
    const options = Array.from({ length: 13 }, (_, i) => ({
      value: `v${i}`,
      label: `L${i}`,
    }));
    const result = validateQuestions([choiceQ({ options })]);
    expect(result).toEqual({
      valid: false,
      error: 'Question "q1" must have 2-12 options.',
    });
  });

  it("rejects duplicate option values", () => {
    const result = validateQuestions([
      choiceQ({
        options: [
          { value: "same", label: "A" },
          { value: "same", label: "B" },
        ],
      }),
    ]);
    expect(result).toEqual({
      valid: false,
      error: 'Question "q1" has duplicate option value "same".',
    });
  });

  it("rejects empty option value", () => {
    const result = validateQuestions([
      choiceQ({
        options: [
          { value: "", label: "A" },
          { value: "b", label: "B" },
        ],
      }),
    ]);
    expect(result).toEqual({
      valid: false,
      error: 'Question "q1" has an option with an empty value.',
    });
  });

  it("rejects empty option label", () => {
    const result = validateQuestions([
      choiceQ({
        options: [
          { value: "a", label: "  " },
          { value: "b", label: "B" },
        ],
      }),
    ]);
    expect(result).toEqual({
      valid: false,
      error: 'Question "q1" has an option with an empty label.',
    });
  });

  it("rejects choice recommendation not matching any option", () => {
    const result = validateQuestions([choiceQ({ recommendation: "nope" })]);
    expect(result).toEqual({
      valid: false,
      error:
        'Question "q1" recommendation "nope" does not match any option value.',
    });
  });

  it("accepts choice with valid recommendation", () => {
    const result = validateQuestions([choiceQ({ recommendation: "a" })]);
    expect(result).toEqual({ valid: true });
  });

  it("rejects multi-choice recommendation not matching any option", () => {
    const result = validateQuestions([
      multiQ({ recommendation: ["a", "nope"] }),
    ]);
    expect(result).toEqual({
      valid: false,
      error:
        'Question "q1" recommendation "nope" does not match any option value.',
    });
  });

  it("does not validate recommendation for text questions", () => {
    const result = validateQuestions([textQ({ recommendation: "anything" })]);
    expect(result).toEqual({ valid: true });
  });
});
