import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Editor, type EditorTheme } from "@earendil-works/pi-tui";
import type { NormalizedQuestion, QuestionnaireResult } from "../core/types.ts";
import { initState, reduce, buildResult } from "./state.ts";
import { interpret } from "./input.ts";
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
      const effects = interpret(data, {
        state,
        questions,
        notesEditorText: notesEditor.getText(),
      });

      for (const effect of effects) {
        switch (effect.type) {
          case "dispatch":
            state = reduce(state, effect.action, questions);
            break;
          case "finalize":
            done(buildResult(state, questions, effect.cancelled));
            return;
          case "forward-to-editor":
            editor.handleInput(data);
            break;
          case "forward-to-notes-editor":
            notesEditor.handleInput(data);
            break;
          case "set-editor-text":
            editor.setText(effect.text);
            break;
          case "set-notes-editor-text":
            notesEditor.setText(effect.text);
            break;
        }
      }

      if (effects.length > 0) {
        tui.requestRender();
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
