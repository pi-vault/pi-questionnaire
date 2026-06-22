import type { NormalizedQuestion, QuestionSelection } from "../core/types.ts";
import { formatAnswerForRender } from "../core/format.ts";
import { pushWrapped, pushWrappedWithPrefix } from "./helpers.ts";
import type { RenderTheme } from "./theme.ts";

export function renderReviewScreen(
  questions: NormalizedQuestion[],
  answers: Map<string, QuestionSelection>,
  notes: Map<string, string>,
  cursor: number,
  theme: RenderTheme,
  width: number,
): string[] {
  const lines: string[] = [];

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
    const noteSuffix = notes.has(q.id) ? " [n]" : "";
    const value = selection
      ? formatAnswerForRender(q, selection) + noteSuffix
      : "(unanswered)";
    const valueColor = selection ? "text" : "muted";

    pushWrappedWithPrefix(
      lines,
      prefix,
      `${marker} ${theme.fg("accent", `${q.header}:`)} ${theme.fg(valueColor, value)}`,
      width,
    );
  }

  return lines;
}
