import { describe, expect, it } from "vitest";
import type {
  NormalizedSingleChoiceQuestion,
  NormalizedMultiChoiceQuestion,
} from "../../src/core/types.ts";
import {
  renderSingleChoiceQuestion,
  renderMultiChoiceQuestion,
} from "../../src/tui/render-question.ts";
import { noopTheme } from "../helpers/theme.ts";

describe("renderSingleChoiceQuestion", () => {
  const question: NormalizedSingleChoiceQuestion = {
    type: "single-choice",
    id: "scope",
    header: "Scope",
    prompt: "What scope?",
    options: [
      { value: "small", label: "Small" },
      { value: "large", label: "Large", description: "Very large" },
    ],
    recommendation: "small",
    allowOther: false,
  };

  it("renders prompt and all options", () => {
    const lines = renderSingleChoiceQuestion(
      question,
      0,
      null,
      null,
      "navigate",
      [],
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain("What scope?");
    expect(text).toContain("1. Small");
    expect(text).toContain("2. Large");
  });

  it("shows cursor indicator on focused option", () => {
    const lines = renderSingleChoiceQuestion(
      question,
      0,
      null,
      null,
      "navigate",
      [],
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain("\u25B8 ");
  });

  it("shows recommendation suffix", () => {
    const lines = renderSingleChoiceQuestion(
      question,
      0,
      null,
      null,
      "navigate",
      [],
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain("[recommended]");
  });

  it("shows option description", () => {
    const lines = renderSingleChoiceQuestion(
      question,
      1,
      null,
      null,
      "navigate",
      [],
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain("Very large");
  });

  it("shows bullet on selected option when cursor is elsewhere", () => {
    const lines = renderSingleChoiceQuestion(
      question,
      1,
      "small",
      null,
      "navigate",
      [],
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    // Selected option (index 0 = Small) gets bullet marker
    expect(text).toContain("\u2022 1. Small");
    // Cursor option (index 1 = Large) gets cursor marker
    expect(text).toContain("\u25B8 2. Large");
  });

  it("shows cursor on selected option when cursor is on it", () => {
    const lines = renderSingleChoiceQuestion(
      question,
      0,
      "small",
      null,
      "navigate",
      [],
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    // Cursor takes priority over bullet
    expect(text).toContain("\u25B8 1. Small");
  });

  it("renders 'Type something.' sentinel when allowOther is true", () => {
    const q = { ...question, allowOther: true };
    const lines = renderSingleChoiceQuestion(
      q,
      0,
      null,
      null,
      "navigate",
      [],
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain("3. Type something.");
  });

  it("does not render sentinel when allowOther is false", () => {
    const lines = renderSingleChoiceQuestion(
      question,
      0,
      null,
      null,
      "navigate",
      [],
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).not.toContain("Type something.");
  });

  it("renders custom text when set", () => {
    const q = { ...question, allowOther: true };
    const lines = renderSingleChoiceQuestion(
      q,
      0,
      null,
      "My custom answer",
      "navigate",
      [],
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain('"My custom answer"');
  });

  it("renders editor content in typing mode", () => {
    const q = { ...question, allowOther: true };
    const lines = renderSingleChoiceQuestion(
      q,
      q.options.length,
      null,
      null,
      "typing",
      ["hello"],
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain("hello");
  });
});

describe("renderMultiChoiceQuestion", () => {
  const question: NormalizedMultiChoiceQuestion = {
    type: "multi-choice",
    id: "features",
    header: "Features",
    prompt: "Which features?",
    options: [
      { value: "auth", label: "Auth" },
      { value: "log", label: "Logging" },
    ],
    recommendation: ["auth"],
  };

  it("renders checkboxes with bullet for checked items", () => {
    const checked = new Set(["auth"]);
    const lines = renderMultiChoiceQuestion(
      question,
      0,
      checked,
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain("[\u2022] 1. Auth");
    expect(text).toContain("[ ] 2. Logging");
  });

  it("shows recommendation suffix on recommended options", () => {
    const checked = new Set<string>();
    const lines = renderMultiChoiceQuestion(
      question,
      0,
      checked,
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain("[recommended]");
  });
});
