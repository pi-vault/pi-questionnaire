import { describe, expect, it } from "vitest";
import type { QuestionInput } from "../../src/core/types.ts";
import { normalizeQuestions } from "../../src/core/normalize.ts";

describe("normalizeQuestions", () => {
  it("trims id, header, prompt on choice questions", () => {
    const input: QuestionInput[] = [
      {
        type: "single-choice",
        id: "  scope  ",
        header: "  Scope  ",
        prompt: "  Pick one  ",
        options: [
          { value: " a ", label: " A ", description: " desc " },
          { value: "b", label: "B" },
        ],
      },
    ];
    const result = normalizeQuestions(input);
    expect(result[0].id).toBe("scope");
    expect(result[0].header).toBe("Scope");
    expect(result[0].prompt).toBe("Pick one");
    if (result[0].type === "single-choice") {
      expect(result[0].options[0].value).toBe("a");
      expect(result[0].options[0].label).toBe("A");
      expect(result[0].options[0].description).toBe("desc");
    }
  });

  it("sets recommendation to null when not provided on choice", () => {
    const input: QuestionInput[] = [
      {
        type: "single-choice",
        id: "q1",
        header: "Q1",
        prompt: "Pick",
        options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ],
      },
    ];
    const result = normalizeQuestions(input);
    if (result[0].type === "single-choice") {
      expect(result[0].recommendation).toBeNull();
    }
  });

  it("preserves recommendation value on choice when provided", () => {
    const input: QuestionInput[] = [
      {
        type: "single-choice",
        id: "q1",
        header: "Q1",
        prompt: "Pick",
        options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ],
        recommendation: "a",
      },
    ];
    const result = normalizeQuestions(input);
    if (result[0].type === "single-choice") {
      expect(result[0].recommendation).toBe("a");
    }
  });

  it("defaults multi-choice recommendation to empty array", () => {
    const input: QuestionInput[] = [
      {
        type: "multi-choice",
        id: "q1",
        header: "Q1",
        prompt: "Pick",
        options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ],
      },
    ];
    const result = normalizeQuestions(input);
    if (result[0].type === "multi-choice") {
      expect(result[0].recommendation).toEqual([]);
    }
  });

  it("normalizes text question with recommendation", () => {
    const input: QuestionInput[] = [
      {
        type: "text",
        id: "notes",
        header: "Notes",
        prompt: "Type something",
        recommendation: "  default  ",
      },
    ];
    const result = normalizeQuestions(input);
    if (result[0].type === "text") {
      expect(result[0].recommendation).toBe("default");
    }
  });

  it("sets text recommendation to null when not provided", () => {
    const input: QuestionInput[] = [
      { type: "text", id: "notes", header: "Notes", prompt: "Type" },
    ];
    const result = normalizeQuestions(input);
    if (result[0].type === "text") {
      expect(result[0].recommendation).toBeNull();
    }
  });

  it("strips undefined descriptions from options", () => {
    const input: QuestionInput[] = [
      {
        type: "single-choice",
        id: "q1",
        header: "Q1",
        prompt: "Pick",
        options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ],
      },
    ];
    const result = normalizeQuestions(input);
    if (result[0].type === "single-choice") {
      expect(result[0].options[0].description).toBeUndefined();
    }
  });
});
