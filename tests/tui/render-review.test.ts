import { describe, expect, it } from "vitest";
import type {
  NormalizedQuestion,
  QuestionSelection,
} from "../../src/core/types.ts";
import { renderReviewScreen } from "../../src/tui/render-review.ts";
import { noopTheme } from "../helpers/theme.ts";

const questions: NormalizedQuestion[] = [
  {
    multiSelect: false,
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
    multiSelect: true,
    id: "features",
    header: "Features",
    prompt: "Pick features",
    options: [
      { value: "auth", label: "Auth" },
      { value: "log", label: "Logging" },
    ],
    recommendation: null,
    allowOther: false,
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
