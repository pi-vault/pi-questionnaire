import type {
  NormalizedQuestion,
  QuestionResponse,
  QuestionSelection,
  QuestionnaireResult,
} from "./types.ts";

function optionIndex(question: NormalizedQuestion, value: string): number {
  return question.options.findIndex((o) => o.value === value) + 1;
}

export function formatModelLine(
  question: NormalizedQuestion,
  response: QuestionResponse,
): string {
  const sel = response.selection;
  switch (sel.kind) {
    case "option": {
      const idx = optionIndex(question, sel.value);
      return `${question.header}: user selected: ${idx}. ${sel.label}`;
    }
    case "options": {
      const parts = sel.selected.map((s) => {
        const idx = optionIndex(question, s.value);
        return `${idx}. ${s.label}`;
      });
      return `${question.header}: user selected: ${parts.join(", ")}`;
    }
    case "custom":
      return `${question.header}: user wrote: "${sel.value}"`;
    case "chat":
      return `${question.header}: user wants to discuss this question`;
  }
}

export function formatNoteLine(
  question: NormalizedQuestion,
  response: QuestionResponse,
): string | null {
  if (!response.notes) return null;
  return `${question.header} note: "${response.notes}"`;
}

export function formatContentSummary(result: QuestionnaireResult): string {
  if (result.cancelled) {
    return "User cancelled the questionnaire";
  }
  const lines: string[] = [];
  for (const response of result.responses) {
    const question = result.questions.find((q) => q.id === response.questionId);
    if (!question) {
      lines.push(`${response.questionId}: (unknown question)`);
      continue;
    }
    lines.push(formatModelLine(question, response));
    const note = formatNoteLine(question, response);
    if (note) lines.push(note);
  }
  return lines.join("\n");
}

export function formatAnswerForRender(
  question: NormalizedQuestion,
  selection: QuestionSelection,
): string {
  switch (selection.kind) {
    case "option": {
      const idx = optionIndex(question, selection.value);
      return `${idx}. ${selection.label}`;
    }
    case "options":
      return selection.selected
        .map((s) => {
          const idx = optionIndex(question, s.value);
          return `${idx}. ${s.label}`;
        })
        .join(", ");
    case "custom":
      return `(wrote) "${selection.value}"`;
    case "chat":
      return "chat";
  }
}
