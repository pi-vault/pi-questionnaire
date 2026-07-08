import type { NormalizedQuestion } from "../core/types.ts";
import type { RenderTheme } from "./render-question.ts";
import {
  type QuestionnaireState,
  answeredIds,
  currentQuestion,
  getSelectedValue,
} from "./state.ts";
import { renderTabBar } from "./render-tabs.ts";
import { renderQuestion } from "./render-question.ts";
import { renderReviewScreen } from "./render-review.ts";
import { pushWrapped } from "./helpers.ts";

export function renderQuestionnaire(
  state: QuestionnaireState,
  questions: NormalizedQuestion[],
  editorLines: string[],
  notesEditorLines: string[],
  theme: RenderTheme,
  width: number,
): string[] {
  const lines: string[] = [];
  const renderWidth = Math.max(1, width);
  const reviewTabIndex = questions.length;
  const q = currentQuestion(state, questions);

  lines.push(theme.fg("accent", "\u2500".repeat(renderWidth)));

  // Tab bar
  const notedIds = new Set(state.notes.keys());
  lines.push(
    ...renderTabBar(
      questions,
      state.activeTab,
      answeredIds(state),
      notedIds,
      theme,
    ),
  );

  // Content
  if (state.activeTab === reviewTabIndex) {
    lines.push(
      ...renderReviewScreen(
        questions,
        state.answers,
        state.notes,
        state.reviewCursor,
        theme,
        renderWidth,
      ),
    );
  } else if (q) {
    lines.push(
      ...renderQuestion(
        {
          question: q,
          cursor: state.optionCursor,
          selectedValue: getSelectedValue(state, q.id),
          customText: state.customText.get(q.id) ?? null,
          checked: state.multiChecked.get(q.id) ?? new Set(),
          inputMode: state.inputMode,
          editorLines,
        },
        theme,
        renderWidth,
      ),
    );
  }

  // Notes editor (when in notes mode)
  if (state.inputMode === "notes") {
    lines.push("");
    pushWrapped(lines, theme.fg("muted", "Note for this question:"), renderWidth);
    for (const line of notesEditorLines) {
      lines.push(` ${line}`);
    }
  }

  // Hint bar
  lines.push("");
  let hint: string;
  if (state.inputMode === "typing") {
    hint = "Enter submit | Esc cancel | Up/Down exit";
  } else if (state.inputMode === "notes") {
    hint = "Enter save | Esc discard";
  } else if (state.activeTab === reviewTabIndex) {
    hint = "Left/Right tabs | Up/Down select | Enter submit | Esc cancel";
  } else if (q?.multiSelect) {
    hint =
      "Left/Right tabs | Up/Down select | Space toggle | Tab notes | Esc cancel";
  } else {
    hint =
      "Left/Right tabs | Up/Down select | Enter confirm | Tab notes | Esc cancel";
  }
  pushWrapped(lines, theme.fg("dim", hint), renderWidth);

  lines.push(theme.fg("accent", "\u2500".repeat(renderWidth)));

  return lines;
}
