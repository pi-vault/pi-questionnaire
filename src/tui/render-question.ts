import type {
  NormalizedSingleChoiceQuestion,
  NormalizedMultiChoiceQuestion,
  NormalizedTextQuestion,
} from "../core/types.ts";
import { pushWrapped, pushWrappedWithPrefix } from "./helpers.ts";

interface QuestionTheme {
  fg: (color: string, text: string) => string;
  bg: (color: string, text: string) => string;
  bold: (text: string) => string;
}

export function renderSingleChoiceQuestion(
  question: NormalizedSingleChoiceQuestion,
  cursor: number,
  selectedValue: string | null,
  theme: QuestionTheme,
  width: number,
): string[] {
  const lines: string[] = [];

  pushWrapped(lines, theme.fg("text", question.prompt), width);
  lines.push("");

  for (let i = 0; i < question.options.length; i++) {
    const opt = question.options[i];
    const isCursor = i === cursor;
    const isSelected = selectedValue === opt.value;
    const recSuffix =
      question.recommendation === opt.value ? " [recommended]" : "";
    const label = `${i + 1}. ${opt.label}${recSuffix}`;

    let prefix: string;
    let color: string;
    if (isCursor) {
      prefix = theme.fg("accent", "\u25B8 ");
      color = "accent";
    } else if (isSelected) {
      prefix = theme.fg("success", "\u2022 ");
      color = "success";
    } else {
      prefix = "  ";
      color = "text";
    }

    pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
    if (opt.description) {
      pushWrappedWithPrefix(
        lines,
        "     ",
        theme.fg("muted", opt.description),
        width,
      );
    }
  }

  return lines;
}

export function renderMultiChoiceQuestion(
  question: NormalizedMultiChoiceQuestion,
  cursor: number,
  checked: Set<string>,
  theme: QuestionTheme,
  width: number,
): string[] {
  const lines: string[] = [];

  pushWrapped(lines, theme.fg("text", question.prompt), width);
  lines.push("");

  for (let i = 0; i < question.options.length; i++) {
    const opt = question.options[i];
    const isCursor = i === cursor;
    const isChecked = checked.has(opt.value);
    const prefix = isCursor ? theme.fg("accent", "\u25B8 ") : "  ";
    const marker = isChecked ? "[\u2022]" : "[ ]";
    const recSuffix = question.recommendation.includes(opt.value)
      ? " [recommended]"
      : "";
    const label = `${marker} ${i + 1}. ${opt.label}${recSuffix}`;
    const color = isCursor ? "accent" : isChecked ? "success" : "text";

    pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
    if (opt.description) {
      pushWrappedWithPrefix(
        lines,
        "       ",
        theme.fg("muted", opt.description),
        width,
      );
    }
  }

  return lines;
}

export function renderTextQuestion(
  question: NormalizedTextQuestion,
  editorLines: string[],
  theme: QuestionTheme,
  width: number,
): string[] {
  const lines: string[] = [];

  pushWrapped(lines, theme.fg("text", question.prompt), width);
  lines.push("");

  for (const line of editorLines) {
    lines.push(` ${line}`);
  }

  lines.push("");
  pushWrapped(
    lines,
    theme.fg("dim", "Enter submit | Tab/Shift+Tab navigate tabs"),
    width,
  );

  return lines;
}
