import type {
  NormalizedSingleChoiceQuestion,
  NormalizedMultiChoiceQuestion,
} from "../core/types.ts";
import { pushWrapped, pushWrappedWithPrefix } from "./helpers.ts";
import type { RenderTheme } from "./theme.ts";

export function renderSingleChoiceQuestion(
  question: NormalizedSingleChoiceQuestion,
  cursor: number,
  selectedValue: string | null,
  customText: string | null,
  inputMode: "navigate" | "typing" | "notes",
  editorLines: string[],
  theme: RenderTheme,
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

  // "Type something." sentinel
  if (question.allowOther) {
    const sentinelIndex = question.options.length;
    const isCursor = sentinelIndex === cursor;
    const prefix = isCursor ? theme.fg("accent", "\u25B8 ") : "  ";

    if (inputMode === "typing") {
      const editorContent = editorLines.join("") || "";
      const label = `${sentinelIndex + 1}. ${editorContent}`;
      pushWrappedWithPrefix(lines, prefix, theme.fg("accent", label), width);
    } else if (customText) {
      const label = `${sentinelIndex + 1}. "${customText}"`;
      const color = isCursor ? "accent" : "text";
      pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
    } else {
      const label = `${sentinelIndex + 1}. Type something.`;
      const color = isCursor ? "accent" : "muted";
      pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
    }
  }

  // "Chat about this" sentinel
  if (question.allowChat) {
    const chatIndex = question.options.length + (question.allowOther ? 1 : 0);
    const isCursor = chatIndex === cursor;
    const prefix = isCursor ? theme.fg("accent", "\u25B8 ") : "  ";
    const label = `${chatIndex + 1}. Chat about this`;
    const color = isCursor ? "accent" : "muted";
    pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
  }

  return lines;
}

export function renderMultiChoiceQuestion(
  question: NormalizedMultiChoiceQuestion,
  cursor: number,
  checked: Set<string>,
  theme: RenderTheme,
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

  // "Chat about this" sentinel
  if (question.allowChat) {
    const chatIndex = question.options.length;
    const isCursor = chatIndex === cursor;
    const prefix = isCursor ? theme.fg("accent", "\u25B8 ") : "  ";
    const label = `[ ] Chat about this`;
    const color = isCursor ? "accent" : "muted";
    pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
  }

  // "Next" sentinel
  {
    const nextIndex = question.options.length + (question.allowChat ? 1 : 0);
    const isCursor = nextIndex === cursor;
    const prefix = isCursor ? theme.fg("accent", "\u25B8 ") : "  ";
    const label = "\u2500\u2500\u2500 Next";
    const color = isCursor ? "accent" : "dim";
    pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
  }

  return lines;
}


