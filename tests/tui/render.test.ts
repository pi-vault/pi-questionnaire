import { describe, expect, it } from "vitest";
import type { NormalizedQuestion } from "../../src/core/types.ts";
import { initState } from "../../src/tui/state.ts";
import { renderQuestionnaire } from "../../src/tui/render.ts";
import { noopTheme } from "../helpers/theme.ts";

const questions: NormalizedQuestion[] = [
  {
    multiSelect: false,
    id: "scope",
    header: "Scope",
    prompt: "Pick scope",
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

describe("renderQuestionnaire", () => {
  it("renders tab bar and question content for single-choice", () => {
    const state = initState(questions);
    const lines = renderQuestionnaire(state, questions, [], [], noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("Scope");
    expect(text).toContain("Pick scope");
    expect(text).toContain("Small");
    expect(text).toContain("Review");
  });

  it("renders review screen when on review tab", () => {
    const state = { ...initState(questions), activeTab: questions.length };
    const lines = renderQuestionnaire(state, questions, [], [], noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("Review answers");
    expect(text).toContain("(unanswered)");
  });

  it("includes hint bar for choice questions", () => {
    const state = initState(questions);
    const lines = renderQuestionnaire(state, questions, [], [], noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("Left/Right tabs");
    expect(text).toContain("Enter confirm");
    expect(text).toContain("Tab notes");
  });

  it("shows typing mode hint bar when inputMode is typing", () => {
    const state = {
      ...initState(questions),
      inputMode: "typing" as const,
      editingQuestionId: "scope",
    };
    const lines = renderQuestionnaire(state, questions, [], [], noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("Enter submit");
    expect(text).toContain("Esc cancel");
    expect(text).toContain("Up/Down exit");
  });

  it("shows separator lines at top and bottom", () => {
    const state = initState(questions);
    const lines = renderQuestionnaire(state, questions, [], [], noopTheme, 80);
    expect(lines[0]).toContain("\u2500");
    expect(lines[lines.length - 1]).toContain("\u2500");
  });

  it("shows notes mode hint bar when inputMode is notes", () => {
    const state = {
      ...initState(questions),
      inputMode: "notes" as const,
      editingQuestionId: "scope",
    };
    const lines = renderQuestionnaire(state, questions, [], [], noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("Enter save");
    expect(text).toContain("Esc discard");
  });

  it("renders notes editor below question content in notes mode", () => {
    const state = {
      ...initState(questions),
      inputMode: "notes" as const,
      editingQuestionId: "scope",
    };
    const notesEditorLines = ["my note text"];
    const lines = renderQuestionnaire(
      state,
      questions,
      [],
      notesEditorLines,
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain("Note for this question:");
    expect(text).toContain("my note text");
  });
});
