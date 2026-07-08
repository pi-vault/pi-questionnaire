import { describe, expect, it } from "vitest";
import type { NormalizedQuestion } from "../../src/core/types.ts";
import { renderQuestion } from "../../src/tui/render-question.ts";
import { noopTheme } from "../helpers/theme.ts";

function input(
  question: NormalizedQuestion,
  overrides: Partial<{
    cursor: number;
    selectedValue: string | null;
    customText: string | null;
    checked: Set<string>;
    inputMode: "navigate" | "typing" | "notes";
    editorLines: string[];
  }> = {},
) {
  return {
    question,
    cursor: 0,
    selectedValue: null,
    customText: null,
    checked: new Set<string>(),
    inputMode: "navigate" as const,
    editorLines: [] as string[],
    ...overrides,
  };
}

describe("renderQuestion — single-select", () => {
  const question: NormalizedQuestion = {
    multiSelect: false,
    id: "scope",
    header: "Scope",
    prompt: "What scope?",
    options: [
      { value: "small", label: "Small" },
      { value: "large", label: "Large", description: "Very large" },
    ],
    recommendation: "small",
    allowOther: false,
    allowChat: false,
  };

  it("renders prompt and all options", () => {
    const lines = renderQuestion(input(question), noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("What scope?");
    expect(text).toContain("1. Small");
    expect(text).toContain("2. Large");
  });

  it("shows cursor indicator on focused option", () => {
    const lines = renderQuestion(input(question), noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("\u25B8 ");
  });

  it("shows recommendation suffix", () => {
    const lines = renderQuestion(input(question), noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("[recommended]");
  });

  it("shows option description", () => {
    const lines = renderQuestion(
      input(question, { cursor: 1 }),
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain("Very large");
  });

  it("shows bullet on selected option when cursor is elsewhere", () => {
    const lines = renderQuestion(
      input(question, { cursor: 1, selectedValue: "small" }),
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain("\u2022 1. Small");
    expect(text).toContain("\u25B8 2. Large");
  });

  it("shows cursor on selected option when cursor is on it", () => {
    const lines = renderQuestion(
      input(question, { cursor: 0, selectedValue: "small" }),
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain("\u25B8 1. Small");
  });

  it("renders 'Type something.' sentinel when allowOther is true", () => {
    const q = { ...question, allowOther: true };
    const lines = renderQuestion(input(q), noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("3. Type something.");
  });

  it("does not render sentinel when allowOther is false", () => {
    const lines = renderQuestion(input(question), noopTheme, 80);
    const text = lines.join("\n");
    expect(text).not.toContain("Type something.");
  });

  it("renders custom text when set", () => {
    const q = { ...question, allowOther: true };
    const lines = renderQuestion(
      input(q, { customText: "My custom answer" }),
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain('"My custom answer"');
  });

  it("renders editor content in typing mode", () => {
    const q = { ...question, allowOther: true };
    const lines = renderQuestion(
      input(q, {
        cursor: q.options.length,
        inputMode: "typing",
        editorLines: ["hello"],
      }),
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain("hello");
  });

  it("renders multi-line editor lines separately (not joined)", () => {
    const q = { ...question, allowOther: true };
    const editorLines = ["---border---", "typed text", "---border---"];
    const lines = renderQuestion(
      input(q, {
        cursor: q.options.length,
        inputMode: "typing",
        editorLines,
      }),
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain("---border---\n");
    expect(text).toContain("typed text\n");
    expect(text).not.toContain("---border---typed text");
  });
});

describe("renderQuestion — multi-select", () => {
  const question: NormalizedQuestion = {
    multiSelect: true,
    id: "features",
    header: "Features",
    prompt: "Which features?",
    options: [
      { value: "auth", label: "Auth" },
      { value: "log", label: "Logging" },
    ],
    recommendation: "auth",
    allowOther: false,
    allowChat: false,
  };

  it("renders checkboxes with bullet for checked items", () => {
    const lines = renderQuestion(
      input(question, { checked: new Set(["auth"]) }),
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain("[\u2022] 1. Auth");
    expect(text).toContain("[ ] 2. Logging");
  });

  it("shows recommendation suffix on recommended options", () => {
    const lines = renderQuestion(input(question), noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("[recommended]");
  });

  it("renders '[ ] Chat about this' when allowChat is true", () => {
    const q = { ...question, allowChat: true };
    const lines = renderQuestion(input(q), noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("[ ] Chat about this");
  });

  it("does not render 'Chat about this' when allowChat is false", () => {
    const lines = renderQuestion(input(question), noopTheme, 80);
    const text = lines.join("\n");
    expect(text).not.toContain("Chat about this");
  });

  it("always renders '\u2500\u2500\u2500 Next' sentinel", () => {
    const lines = renderQuestion(input(question), noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("\u2500\u2500\u2500 Next");
  });
});

describe("renderQuestion — chat sentinel", () => {
  const baseQuestion: NormalizedQuestion = {
    multiSelect: false,
    id: "scope",
    header: "Scope",
    prompt: "What scope?",
    options: [
      { value: "small", label: "Small" },
      { value: "large", label: "Large" },
    ],
    recommendation: null,
    allowOther: false,
    allowChat: false,
  };

  it("renders 'N. Chat about this' when allowChat is true", () => {
    const q = { ...baseQuestion, allowChat: true };
    const lines = renderQuestion(input(q), noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("3. Chat about this");
  });

  it("does NOT render 'Chat about this' when allowChat is false", () => {
    const lines = renderQuestion(input(baseQuestion), noopTheme, 80);
    const text = lines.join("\n");
    expect(text).not.toContain("Chat about this");
  });

  it("chat index is after 'Type something.' when allowOther is true", () => {
    const q = { ...baseQuestion, allowOther: true, allowChat: true };
    const lines = renderQuestion(input(q), noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("3. Type something.");
    expect(text).toContain("4. Chat about this");
  });
});
