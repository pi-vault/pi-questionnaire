import { describe, expect, it } from "vitest";
import type {
  NormalizedAnswer,
  NormalizedQuestion,
} from "../../src/core/types.ts";
import { renderReviewScreen } from "../../src/tui/render-review.ts";

const noopTheme = {
  fg: (_color: string, text: string) => text,
  bg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};

const questions: NormalizedQuestion[] = [
  {
    type: "single-choice",
    id: "scope",
    header: "Scope",
    prompt: "Pick",
    options: [
      { value: "small", label: "Small" },
      { value: "large", label: "Large" },
    ],
    recommendation: null,
  },
  {
    type: "text",
    id: "notes",
    header: "Notes",
    prompt: "Type",
    recommendation: null,
  },
];

describe("renderReviewScreen", () => {
  it("shows answered and unanswered rows", () => {
    const answers = new Map<string, NormalizedAnswer>([
      [
        "scope",
        {
          type: "single-choice",
          questionId: "scope",
          value: "small",
          label: "Small",
        },
      ],
    ]);
    const lines = renderReviewScreen(questions, answers, 0, noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("Scope");
    expect(text).toContain("Small");
    expect(text).toContain("(unanswered)");
  });

  it("shows submit prompt when all answered", () => {
    const answers = new Map<string, NormalizedAnswer>([
      [
        "scope",
        {
          type: "single-choice",
          questionId: "scope",
          value: "small",
          label: "Small",
        },
      ],
      ["notes", { type: "text", questionId: "notes", value: "ok" }],
    ]);
    const lines = renderReviewScreen(questions, answers, 0, noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("Enter submit");
  });

  it("shows warning when not all answered", () => {
    const answers = new Map<string, NormalizedAnswer>();
    const lines = renderReviewScreen(questions, answers, 0, noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("Answer all questions");
  });
});
