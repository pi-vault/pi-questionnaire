import type { NormalizedQuestion } from "../core/types.ts";
import type { RenderTheme } from "./theme.ts";
import {
  type QuestionnaireState,
  answeredIds,
  currentQuestion,
  getSelectedValue,
} from "./state.ts";
import { renderTabBar } from "./render-tabs.ts";
import {
  renderSingleChoiceQuestion,
  renderMultiChoiceQuestion,
} from "./render-question.ts";
import { renderReviewScreen } from "./render-review.ts";
import { pushWrapped } from "./helpers.ts";

export function renderQuestionnaire(
  state: QuestionnaireState,
  questions: NormalizedQuestion[],
  editorLines: string[],
  theme: RenderTheme,
  width: number,
): string[] {
  const lines: string[] = [];
  const renderWidth = Math.max(1, width);
  const reviewTabIndex = questions.length;
  const q = currentQuestion(state, questions);

  lines.push(theme.fg("accent", "\u2500".repeat(renderWidth)));

  // Tab bar
  lines.push(
    ...renderTabBar(
      questions,
      state.activeTab,
      answeredIds(state),
      theme,
      renderWidth,
    ),
  );

  // Content
  if (state.activeTab === reviewTabIndex) {
    lines.push(
      ...renderReviewScreen(
        questions,
        state.answers,
        state.reviewCursor,
        theme,
        renderWidth,
      ),
    );
  } else if (q) {
    switch (q.type) {
      case "single-choice":
        lines.push(
          ...renderSingleChoiceQuestion(
            q,
            state.optionCursor,
            getSelectedValue(state, q.id),
            state.customText.get(q.id) ?? null,
            state.inputMode,
            editorLines,
            theme,
            renderWidth,
          ),
        );
        break;
      case "multi-choice": {
        const checked = state.multiChecked.get(q.id) ?? new Set();
        lines.push(
          ...renderMultiChoiceQuestion(
            q,
            state.optionCursor,
            checked,
            theme,
            renderWidth,
          ),
        );
        break;
      }
    }
  }

  // Hint bar
  lines.push("");
  let hint: string;
  if (state.inputMode === "typing") {
    hint = "Enter submit | Esc cancel | Up/Down exit";
  } else if (state.activeTab === reviewTabIndex) {
    hint =
      "Left/Right tabs | Up/Down move | Space jump | Enter submit | Esc cancel";
  } else if (q?.type === "multi-choice") {
    hint = "Left/Right tabs | Up/Down move | Space toggle | Enter next | Esc cancel";
  } else {
    hint = "Left/Right tabs | Up/Down move | Space/Enter select | Esc cancel";
  }
  pushWrapped(lines, theme.fg("dim", hint), renderWidth);

  lines.push(theme.fg("accent", "\u2500".repeat(renderWidth)));

  return lines;
}
