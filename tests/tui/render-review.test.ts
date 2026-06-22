import { describe, expect, it } from "vitest";
import type {
  NormalizedQuestion,
  QuestionSelection,
} from "../../src/core/types.ts";
import { renderReviewScreen } from "../../src/tui/render-review.ts";
import { noopTheme } from "../helpers/theme.ts";

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
    allowOther: false,
    allowChat: false,
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
    recommendation: [],
    allowChat: false,
  },
];

describe("renderReviewScreen", () => {
  it("shows answered and unanswered rows", () => {
    const answers = new Map<string, QuestionSelection>([
      ["scope", { kind: "option", value: "small", label: "Small" }],
    ]);
    const lines = renderReviewScreen(questions, answers, new Map(), 0, noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("Scope");
    expect(text).toContain("Small");
    expect(text).toContain("(unanswered)");
  });

  it("shows submit prompt when all answered", () => {
    const answers = new Map<string, QuestionSelection>([
      ["scope", { kind: "option", value: "small", label: "Small" }],
      [
        "features",
        {
          kind: "options",
          selected: [{ value: "auth", label: "Auth" }],
        },
      ],
    ]);
    const lines = renderReviewScreen(questions, answers, new Map(), 0, noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("Enter submit");
  });

  it("shows warning when not all answered", () => {
    const answers = new Map<string, QuestionSelection>();
    const lines = renderReviewScreen(questions, answers, new Map(), 0, noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("Answer all questions");
  });

  it("shows [n] marker for questions with notes", () => {
    const answers = new Map<string, QuestionSelection>([
      ["scope", { kind: "option", value: "small", label: "Small" }],
    ]);
    const notes = new Map([["scope", "my note"]]);
    const lines = renderReviewScreen(questions, answers, notes, 0, noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("[n]");
    // Only the answered-with-note question gets [n]
    expect(text).toContain("Small [n]");
  });
});
