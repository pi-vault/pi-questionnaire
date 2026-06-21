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
  renderTextQuestion,
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
  } else {
    const q = currentQuestion(state, questions);
    if (q) {
      switch (q.type) {
        case "single-choice":
          lines.push(
            ...renderSingleChoiceQuestion(
              q,
              state.optionCursor,
              getSelectedValue(state, q.id),
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
        case "text":
          lines.push(...renderTextQuestion(q, editorLines, theme, renderWidth));
          break;
      }
    }
  }

  // Hint bar (non-text questions only)
  const q = currentQuestion(state, questions);
  if (q?.type !== "text") {
    lines.push("");
    const hint =
      state.activeTab === reviewTabIndex
        ? "Tab navigate | Enter submit | Space edit | Esc cancel"
        : q?.type === "multi-choice"
          ? "Tab navigate | Up/Down move | Space toggle | Esc cancel"
          : "Tab navigate | Up/Down move | Space/Enter select | Esc cancel";
    pushWrapped(lines, theme.fg("dim", hint), renderWidth);
  }

  lines.push(theme.fg("accent", "\u2500".repeat(renderWidth)));

  return lines;
}
