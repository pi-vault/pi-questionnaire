import { describe, expect, it } from "vitest";
import type { QuestionInput } from "../../src/core/schema.ts";
import { normalizeQuestions } from "../../src/core/normalize.ts";

function baseQ(overrides: Partial<QuestionInput> = {}): QuestionInput {
  return {
    id: "q1",
    header: "Q1",
    prompt: "Pick",
    options: [
      { label: "A", value: "a" },
      { label: "B", value: "b" },
    ],
    ...overrides,
  };
}

describe("normalizeQuestions", () => {
  it("trims id, header, prompt on questions", () => {
    const result = normalizeQuestions([
      baseQ({
        id: "  scope  ",
        header: "  Scope  ",
        prompt: "  Pick one  ",
        options: [
          { label: " A ", value: " a ", description: " desc " },
          { label: "B", value: "b" },
        ],
      }),
    ]);
    expect(result[0].id).toBe("scope");
    expect(result[0].header).toBe("Scope");
    expect(result[0].prompt).toBe("Pick one");
    expect(result[0].options[0].value).toBe("a");
    expect(result[0].options[0].label).toBe("A");
    expect(result[0].options[0].description).toBe("desc");
  });

  it("defaults value to label when value is omitted", () => {
    const result = normalizeQuestions([
      baseQ({ options: [{ label: "Alpha" }, { label: "Beta" }] }),
    ]);
    expect(result[0].options[0].value).toBe("Alpha");
    expect(result[0].options[1].value).toBe("Beta");
  });

  it("uses explicit value when provided", () => {
    const result = normalizeQuestions([baseQ()]);
    expect(result[0].options[0].value).toBe("a");
    expect(result[0].options[1].value).toBe("b");
  });

  it("sets recommendation to null when not provided", () => {
    const result = normalizeQuestions([baseQ()]);
    expect(result[0].recommendation).toBeNull();
  });

  it("preserves recommendation value when provided", () => {
    const result = normalizeQuestions([baseQ({ recommendation: "a" })]);
    expect(result[0].recommendation).toBe("a");
  });

  it("defaults multiSelect to false when omitted", () => {
    const result = normalizeQuestions([baseQ()]);
    expect(result[0].multiSelect).toBe(false);
  });

  it("preserves multiSelect: true", () => {
    const result = normalizeQuestions([baseQ({ multiSelect: true })]);
    expect(result[0].multiSelect).toBe(true);
  });

  it("defaults allowOther to true", () => {
    const result = normalizeQuestions([baseQ()]);
    expect(result[0].allowOther).toBe(true);
  });

  it("preserves allowOther: false", () => {
    const result = normalizeQuestions([baseQ({ allowOther: false })]);
    expect(result[0].allowOther).toBe(false);
  });

  it("defaults allowChat to true", () => {
    const result = normalizeQuestions([baseQ()]);
    expect(result[0].allowChat).toBe(true);
  });

  it("preserves allowChat: false", () => {
    const result = normalizeQuestions([baseQ({ allowChat: false })]);
    expect(result[0].allowChat).toBe(false);
  });

  it("strips undefined descriptions from options", () => {
    const result = normalizeQuestions([baseQ()]);
    expect(result[0].options[0].description).toBeUndefined();
  });
});
