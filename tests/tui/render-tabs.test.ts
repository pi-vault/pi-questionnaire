import { describe, expect, it } from "vitest";
import type { NormalizedQuestion } from "../../src/core/types.ts";
import { renderTabBar } from "../../src/tui/render-tabs.ts";
import { noopTheme } from "../helpers/theme.ts";

const questions: NormalizedQuestion[] = [
  {
    type: "single-choice",
    id: "scope",
    header: "Scope",
    prompt: "Pick",
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
    recommendation: null,
    allowOther: false,
    allowChat: false,
  },
  {
    type: "multi-choice",
    id: "notes",
    header: "Notes",
    prompt: "Pick some",
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
    recommendation: [],
    allowChat: false,
  },
];

describe("renderTabBar", () => {
  it("renders tab labels with answered/unanswered markers", () => {
    const answeredIds = new Set<string>();
    const lines = renderTabBar(questions, 0, answeredIds, noopTheme, 80);
    const joined = lines.join("");
    expect(joined).toContain("Scope");
    expect(joined).toContain("Notes");
    expect(joined).toContain("Review");
  });

  it("marks answered questions with filled marker", () => {
    const answeredIds = new Set(["scope"]);
    const lines = renderTabBar(questions, 0, answeredIds, noopTheme, 80);
    const joined = lines.join("");
    // Filled marker for answered
    expect(joined).toContain("\u25A0 Scope");
    // Empty marker for unanswered
    expect(joined).toContain("\u25A1 Notes");
  });

  it("highlights active tab with bg wrapper", () => {
    const answeredIds = new Set<string>();
    const bgTheme = { ...noopTheme, bg: (_c: string, t: string) => `[${t}]` };
    const lines = renderTabBar(questions, 0, answeredIds, bgTheme, 80);
    const joined = lines.join("");
    // Active tab (index 0 = Scope) gets bg wrap: [text]
    expect(joined).toContain("[ \u25A1 Scope ]");
  });
});
