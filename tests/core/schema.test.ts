import { describe, expect, it } from "vitest";
import {
  MAX_OPTIONS,
  MAX_QUESTIONS,
  MIN_OPTIONS,
  MIN_QUESTIONS,
  QuestionnaireParamsSchema,
} from "../../src/core/schema.ts";

describe("schema constraint constants", () => {
  it("exports MIN_QUESTIONS as 1", () => {
    expect(MIN_QUESTIONS).toBe(1);
  });

  it("exports MAX_QUESTIONS as 10", () => {
    expect(MAX_QUESTIONS).toBe(10);
  });

  it("exports MIN_OPTIONS as 2", () => {
    expect(MIN_OPTIONS).toBe(2);
  });

  it("exports MAX_OPTIONS as 12", () => {
    expect(MAX_OPTIONS).toBe(12);
  });
});

describe("compiled JSON Schema", () => {
  it("contains no anyOf constructs", () => {
    const json = JSON.stringify(QuestionnaireParamsSchema);
    expect(json).not.toContain("anyOf");
  });
});
