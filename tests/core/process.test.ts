import { describe, expect, it } from "vitest";
import type { QuestionInput } from "../../src/core/schema.ts";
import { processQuestions } from "../../src/core/process.ts";

function choiceQ(overrides: Partial<QuestionInput> = {}): QuestionInput {
  return {
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

describe("processQuestions", () => {
  it("returns ok with normalized questions for valid input", () => {
    const result = processQuestions([
      choiceQ({ id: "  scope  ", header: "  Scope  " }),
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].id).toBe("scope");
      expect(result.questions[0].header).toBe("Scope");
    }
  });

  it("returns error for invalid input", () => {
    const result = processQuestions([]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("at least");
    }
  });

  it("returns error for duplicate ids", () => {
    const result = processQuestions([
      choiceQ({ id: "dup" }),
      choiceQ({ id: "dup" }),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Duplicate");
    }
  });

  it("normalizes trimmed fields when valid", () => {
    const result = processQuestions([
      choiceQ({
        id: "  q1  ",
        prompt: "  Pick  ",
        options: [
          { value: " a ", label: " A " },
          { value: "b", label: "B" },
        ],
      }),
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const q = result.questions[0];
      expect(q.prompt).toBe("Pick");
      expect(q.options[0].value).toBe("a");
      expect(q.options[0].label).toBe("A");
    }
  });

  it("sets multiSelect false by default", () => {
    const result = processQuestions([choiceQ()]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.questions[0].multiSelect).toBe(false);
    }
  });

  it("preserves multiSelect: true", () => {
    const result = processQuestions([choiceQ({ multiSelect: true })]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.questions[0].multiSelect).toBe(true);
    }
  });
});
