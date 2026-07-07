import { describe, expect, it } from "vitest";
import type { QuestionInput } from "../../src/core/schema.ts";
import { validateQuestions } from "../../src/core/validate.ts";

function singleQ(
  overrides: Partial<QuestionInput> = {},
): QuestionInput {
  return {
    id: "q1",
    header: "Q1",
    prompt: "Pick one",
    options: [
      { label: "A", value: "a" },
      { label: "B", value: "b" },
    ],
    ...overrides,
  };
}

function multiQ(
  overrides: Partial<QuestionInput> = {},
): QuestionInput {
  return {
    id: "q1",
    header: "Q1",
    prompt: "Pick many",
    multiSelect: true,
    options: [
      { label: "A", value: "a" },
      { label: "B", value: "b" },
    ],
    ...overrides,
  };
}

describe("validateQuestions", () => {
  it("accepts a valid single-select question", () => {
    const result = validateQuestions([singleQ()]);
    expect(result).toEqual({ valid: true });
  });

  it("accepts a valid multi-select question", () => {
    const result = validateQuestions([multiQ()]);
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
    const qs = Array.from({ length: 11 }, (_, i) => singleQ({ id: `q${i}` }));
    const result = validateQuestions(qs);
    expect(result).toEqual({
      valid: false,
      error: "Questionnaire supports at most 10 questions.",
    });
  });

  it("rejects duplicate question ids", () => {
    const result = validateQuestions([
      singleQ({ id: "dup" }),
      multiQ({ id: "dup" }),
    ]);
    expect(result).toEqual({
      valid: false,
      error: 'Duplicate question id: "dup".',
    });
  });

  it("rejects empty question id", () => {
    const result = validateQuestions([singleQ({ id: "  " })]);
    expect(result).toEqual({
      valid: false,
      error: "Question 1 has an empty id.",
    });
  });

  it("rejects empty question header", () => {
    const result = validateQuestions([singleQ({ header: "" })]);
    expect(result).toEqual({
      valid: false,
      error: 'Question "q1" has an empty header.',
    });
  });

  it("rejects empty question prompt", () => {
    const result = validateQuestions([singleQ({ prompt: "  " })]);
    expect(result).toEqual({
      valid: false,
      error: 'Question "q1" has an empty prompt.',
    });
  });

  it("rejects question with fewer than 2 options", () => {
    const result = validateQuestions([
      singleQ({ options: [{ label: "A", value: "a" }] }),
    ]);
    expect(result).toEqual({
      valid: false,
      error: 'Question "q1" must have 2-12 options.',
    });
  });

  it("rejects question with more than 12 options", () => {
    const options = Array.from({ length: 13 }, (_, i) => ({
      label: `L${i}`,
      value: `v${i}`,
    }));
    const result = validateQuestions([singleQ({ options })]);
    expect(result).toEqual({
      valid: false,
      error: 'Question "q1" must have 2-12 options.',
    });
  });

  it("rejects duplicate option values", () => {
    const result = validateQuestions([
      singleQ({
        options: [
          { label: "A", value: "same" },
          { label: "B", value: "same" },
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
      singleQ({
        options: [
          { label: "A", value: "" },
          { label: "B", value: "b" },
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
      singleQ({
        options: [
          { label: "  ", value: "a" },
          { label: "B", value: "b" },
        ],
      }),
    ]);
    expect(result).toEqual({
      valid: false,
      error: 'Question "q1" has an option with an empty label.',
    });
  });

  it("rejects recommendation not matching any option", () => {
    const result = validateQuestions([singleQ({ recommendation: "nope" })]);
    expect(result).toEqual({
      valid: false,
      error:
        'Question "q1" recommendation "nope" does not match any option value.',
    });
  });

  it("accepts question with valid recommendation", () => {
    const result = validateQuestions([singleQ({ recommendation: "a" })]);
    expect(result).toEqual({ valid: true });
  });

  it("accepts multi-select with valid recommendation", () => {
    const result = validateQuestions([multiQ({ recommendation: "a" })]);
    expect(result).toEqual({ valid: true });
  });

  it("rejects multi-select recommendation not matching any option", () => {
    const result = validateQuestions([multiQ({ recommendation: "nope" })]);
    expect(result).toEqual({
      valid: false,
      error:
        'Question "q1" recommendation "nope" does not match any option value.',
    });
  });

  it("accepts options with value omitted (defaults to label)", () => {
    const result = validateQuestions([
      singleQ({
        options: [{ label: "Alpha" }, { label: "Beta" }],
      }),
    ]);
    expect(result).toEqual({ valid: true });
  });

  it("rejects duplicate effective values when value omitted", () => {
    const result = validateQuestions([
      singleQ({
        options: [{ label: "Same" }, { label: "Same" }],
      }),
    ]);
    expect(result).toEqual({
      valid: false,
      error: 'Question "q1" has duplicate option value "Same".',
    });
  });
});
