import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Editor, type EditorTheme } from "@earendil-works/pi-tui";
import type { NormalizedQuestion, QuestionnaireResult } from "../core/types.ts";
import { initState, reduce, buildResult, currentQuestion } from "./state.ts";
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

    editor.onSubmit = (value) => {
      const q = currentQuestion(state, questions);
      if (q?.type !== "text") return;
      state = reduce(
        state,
        { type: "submitText", questionId: q.id, value: value.trim() },
        questions,
      );
      tui.requestRender();
    };

    function handleInput(data: string) {
      const result = mapInput(data, state, questions);
      switch (result.type) {
        case "action":
          state = reduce(state, result.action, questions);
          // Sync editor text when switching to a text tab
          {
            const q = currentQuestion(state, questions);
            if (q?.type === "text") {
              editor.setText(state.textValues.get(q.id) ?? "");
            }
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
        case "none":
          break;
      }
    }

    function render(width: number): string[] {
      const q = currentQuestion(state, questions);
      const editorLines =
        q?.type === "text" ? editor.render(Math.max(1, width - 2)) : [];
      return renderQuestionnaire(state, questions, editorLines, theme, width);
    }

    return {
      render,
      invalidate: () => {},
      handleInput,
    };
  });
}
