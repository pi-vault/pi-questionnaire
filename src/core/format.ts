import type {
  NormalizedAnswer,
  NormalizedQuestion,
  QuestionnaireResult,
} from "./types.ts";

function optionIndex(question: NormalizedQuestion, value: string): number {
  if (question.type === "text") return -1;
  return question.options.findIndex((o) => o.value === value) + 1;
}

export function formatModelLine(
  question: NormalizedQuestion,
  answer: NormalizedAnswer,
): string {
  switch (answer.type) {
    case "single-choice": {
      const idx = optionIndex(question, answer.value);
      return `${question.header}: user selected: ${idx}. ${answer.label}`;
    }
    case "multi-choice": {
      const parts = answer.selected.map((s) => {
        const idx = optionIndex(question, s.value);
        return `${idx}. ${s.label}`;
      });
      return `${question.header}: user selected: ${parts.join(", ")}`;
    }
    case "text": {
      if (!answer.value) {
        return `${question.header}: (empty response)`;
      }
      return `${question.header}: user wrote: "${answer.value}"`;
    }
  }
}

export function formatContentSummary(result: QuestionnaireResult): string {
  if (result.cancelled) {
    return "User cancelled the questionnaire";
  }
  return result.answers
    .map((answer) => {
      const question = result.questions.find((q) => q.id === answer.questionId);
      if (!question) return `${answer.questionId}: (unknown question)`;
      return formatModelLine(question, answer);
    })
    .join("\n");
}

export function formatAnswerForRender(
  question: NormalizedQuestion,
  answer: NormalizedAnswer,
): string {
  switch (answer.type) {
    case "single-choice": {
      const idx = optionIndex(question, answer.value);
      return `${idx}. ${answer.label}`;
    }
    case "multi-choice": {
      return answer.selected
        .map((s) => {
          const idx = optionIndex(question, s.value);
          return `${idx}. ${s.label}`;
        })
        .join(", ");
    }
    case "text": {
      return `(wrote) ${answer.value}`;
    }
  }
}
