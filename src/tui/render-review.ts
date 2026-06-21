import type { NormalizedQuestion, QuestionSelection } from "../core/types.ts";
import { formatAnswerForRender } from "../core/format.ts";
import { pushWrapped, pushWrappedWithPrefix } from "./helpers.ts";
import type { RenderTheme } from "./theme.ts";

export function renderReviewScreen(
  questions: NormalizedQuestion[],
  answers: Map<string, QuestionSelection>,
  cursor: number,
  theme: RenderTheme,
  width: number,
): string[] {
  const lines: string[] = [];
  const allAnswered = questions.every((q) => answers.has(q.id));

  pushWrapped(lines, theme.fg("accent", theme.bold("Review answers")), width);
  lines.push("");

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const selection = answers.get(q.id);
    const isCursor = i === cursor;
    const prefix = isCursor ? theme.fg("accent", "\u25B8 ") : "  ";
    const marker = selection
      ? theme.fg("success", "\u25A0")
      : theme.fg("warning", "\u25A1");
    const value = selection
      ? formatAnswerForRender(q, selection)
      : "(unanswered)";
    const valueColor = selection ? "text" : "muted";

    pushWrappedWithPrefix(
      lines,
      prefix,
      `${marker} ${theme.fg("accent", `${q.header}:`)} ${theme.fg(valueColor, value)}`,
      width,
    );
  }

  lines.push("");
  if (allAnswered) {
    pushWrapped(
      lines,
      theme.fg("success", "Enter submit | Space edit | Esc cancel"),
      width,
    );
  } else {
    pushWrapped(
      lines,
      theme.fg("warning", "Answer all questions before submitting."),
      width,
    );
    pushWrapped(lines, theme.fg("dim", "Space edit | Esc cancel"), width);
  }

  return lines;
}
