import type { NormalizedQuestion } from "../core/types.ts";
import { pushWrapped, pushWrappedWithPrefix } from "./helpers.ts";
import { rowLayout } from "./state.ts";

export interface RenderTheme {
  fg(color: string, text: string): string;
  bg(color: string, text: string): string;
  bold(text: string): string;
}

export function renderSingleChoiceQuestion(
  question: NormalizedQuestion,
  cursor: number,
  selectedValue: string | null,
  customText: string | null,
  inputMode: "navigate" | "typing" | "notes",
  editorLines: string[],
  theme: RenderTheme,
  width: number,
): string[] {
  const lines: string[] = [];
  const slots = rowLayout(question);

  pushWrapped(lines, theme.fg("text", question.prompt), width);
  lines.push("");

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const isCursor = i === cursor;

    switch (slot.kind) {
      case "option": {
        const opt = slot.option;
        const isSelected = selectedValue === opt.value;
        const recSuffix =
          question.recommendation === opt.value ? " [recommended]" : "";
        const label = `${slot.index + 1}. ${opt.label}${recSuffix}`;

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
        break;
      }
      case "other": {
        const prefix = isCursor ? theme.fg("accent", "\u25B8 ") : "  ";
        const displayNumber = i + 1;

        if (inputMode === "typing") {
          const label = `${displayNumber}.`;
          pushWrappedWithPrefix(
            lines,
            prefix,
            theme.fg("accent", label),
            width,
          );
          for (const line of editorLines) {
            lines.push(`    ${line}`);
          }
        } else if (customText) {
          const label = `${displayNumber}. "${customText}"`;
          const color = isCursor ? "accent" : "text";
          pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
        } else {
          const label = `${displayNumber}. Type something.`;
          const color = isCursor ? "accent" : "muted";
          pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
        }
        break;
      }
      case "chat": {
        const prefix = isCursor ? theme.fg("accent", "\u25B8 ") : "  ";
        const displayNumber = i + 1;
        const label = `${displayNumber}. Chat about this`;
        const color = isCursor ? "accent" : "muted";
        pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
        break;
      }
      case "next":
        break;
    }
  }

  return lines;
}

export function renderMultiChoiceQuestion(
  question: NormalizedQuestion,
  cursor: number,
  checked: Set<string>,
  theme: RenderTheme,
  width: number,
): string[] {
  const lines: string[] = [];
  const slots = rowLayout(question);

  pushWrapped(lines, theme.fg("text", question.prompt), width);
  lines.push("");

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const isCursor = i === cursor;
    const prefix = isCursor ? theme.fg("accent", "\u25B8 ") : "  ";

    switch (slot.kind) {
      case "option": {
        const opt = slot.option;
        const isChecked = checked.has(opt.value);
        const marker = isChecked ? "[\u2022]" : "[ ]";
        const recSuffix =
          question.recommendation === opt.value ? " [recommended]" : "";
        const label = `${marker} ${slot.index + 1}. ${opt.label}${recSuffix}`;
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
        break;
      }
      case "chat": {
        const label = "[ ] Chat about this";
        const color = isCursor ? "accent" : "muted";
        pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
        break;
      }
      case "next": {
        const label = "\u2500\u2500\u2500 Next";
        const color = isCursor ? "accent" : "dim";
        pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
        break;
      }
      case "other":
        break;
    }
  }

  return lines;
}
