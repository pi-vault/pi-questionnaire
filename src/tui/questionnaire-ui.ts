import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Editor, type EditorTheme, Key, matchesKey } from "@earendil-works/pi-tui";
import type { NormalizedQuestion, QuestionnaireResult } from "../core/types.ts";
import { initState, reduce, buildResult } from "./state.ts";
import { mapInput } from "./input.ts";
import { renderQuestionnaire } from "./render.ts";

export async function runQuestionnaireUI(
  ctx: Pick<ExtensionContext, "ui">,
  questions: NormalizedQuestion[],
): Promise<QuestionnaireResult> {
  return ctx.ui.custom<QuestionnaireResult>((tui, theme, _kb, done) => {
    let state = initState(questions);

    const editorTheme: EditorTheme = {
      borderColor: (s) => theme.fg("accent", s),
      selectList: {
        selectedPrefix: (t) => theme.fg("accent", t),
        selectedText: (t) => theme.fg("accent", t),
        description: (t) => theme.fg("muted", t),
        scrollInfo: (t) => theme.fg("dim", t),
        noMatch: (t) => theme.fg("warning", t),
      },
    };
    const editor = new Editor(tui, editorTheme);
    const notesEditor = new Editor(tui, editorTheme);

    editor.onSubmit = (value) => {
      if (state.inputMode === "typing" && state.editingQuestionId) {
        state = reduce(
          state,
          {
            type: "submitTyping",
            questionId: state.editingQuestionId,
            value: value.trim(),
          },
          questions,
        );
        editor.setText("");
        tui.requestRender();
      }
    };

    notesEditor.onSubmit = (value) => {
      if (state.inputMode === "notes" && state.editingQuestionId) {
        state = reduce(
          state,
          {
            type: "submitNotes",
            questionId: state.editingQuestionId,
            value: value.trim(),
          },
          questions,
        );
        notesEditor.setText("");
        tui.requestRender();
      }
    };

    function handleInput(data: string) {
      // Notes mode: intercept Up/Down to save-and-exit before mapInput
      // (mapInput is pure and cannot access the editor buffer)
      if (state.inputMode === "notes" && state.editingQuestionId) {
        if (matchesKey(data, Key.up) || matchesKey(data, Key.down)) {
          const notesValue = notesEditor.getText();
          state = reduce(
            state,
            {
              type: "submitNotes",
              questionId: state.editingQuestionId,
              value: notesValue.trim(),
            },
            questions,
          );
          state = reduce(
            state,
            {
              type: "moveCursor",
              direction: matchesKey(data, Key.up) ? "up" : "down",
            },
            questions,
          );
          notesEditor.setText("");
          tui.requestRender();
          return;
        }
      }

      const result = mapInput(data, state, questions);
      switch (result.type) {
        case "action":
          state = reduce(state, result.action, questions);
          // Load existing custom text into editor when entering typing mode
          if (state.inputMode === "typing" && state.editingQuestionId) {
            editor.setText(
              state.customText.get(state.editingQuestionId) ?? "",
            );
          }
          // Load existing note into notes editor when entering notes mode
          if (state.inputMode === "notes" && state.editingQuestionId) {
            notesEditor.setText(
              state.notes.get(state.editingQuestionId) ?? "",
            );
          }
          tui.requestRender();
          break;
        case "finalize":
          done(buildResult(state, questions, result.cancelled));
          break;
        case "forward-to-editor":
          editor.handleInput(data);
          tui.requestRender();
          break;
        case "forward-to-notes-editor":
          notesEditor.handleInput(data);
          tui.requestRender();
          break;
        case "none":
          break;
      }
    }

    function render(width: number): string[] {
      const editorLines =
        state.inputMode === "typing"
          ? editor.render(Math.max(1, width - 4))
          : [];
      const notesEditorLines =
        state.inputMode === "notes"
          ? notesEditor.render(Math.max(1, width - 4))
          : [];
      return renderQuestionnaire(
        state,
        questions,
        editorLines,
        notesEditorLines,
        theme,
        width,
      );
    }

    return {
      render,
      invalidate: () => {},
      handleInput,
    };
  });
}
