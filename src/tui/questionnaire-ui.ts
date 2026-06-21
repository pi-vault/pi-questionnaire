import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
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

    function handleInput(data: string) {
      const result = mapInput(data, state, questions);
      switch (result.type) {
        case "action":
          state = reduce(state, result.action, questions);
          tui.requestRender();
          break;
        case "finalize":
          done(buildResult(state, questions, result.cancelled));
          break;
        case "none":
          break;
      }
    }

    function render(width: number): string[] {
      return renderQuestionnaire(state, questions, theme, width);
    }

    return {
      render,
      invalidate: () => {},
      handleInput,
    };
  });
}
