import type { QuestionInput, QuestionOption } from "./schema.ts";
import type {
  NormalizedMultiChoiceQuestion,
  NormalizedQuestion,
  NormalizedSingleChoiceQuestion,
} from "./types.ts";

function normalizeOptions(options: QuestionOption[]): QuestionOption[] {
  return options.map((opt) => ({
    value: opt.value.trim(),
    label: opt.label.trim(),
    description: opt.description?.trim() || undefined,
  }));
}

function normalizeSingleChoice(
  q: QuestionInput & { type: "single-choice" },
): NormalizedSingleChoiceQuestion {
  return {
    type: "single-choice",
    id: q.id.trim(),
    header: q.header.trim(),
    prompt: q.prompt.trim(),
    options: normalizeOptions(q.options),
    recommendation: q.recommendation?.trim() ?? null,
  };
}

function normalizeMultiChoice(
  q: QuestionInput & { type: "multi-choice" },
): NormalizedMultiChoiceQuestion {
  return {
    type: "multi-choice",
    id: q.id.trim(),
    header: q.header.trim(),
    prompt: q.prompt.trim(),
    options: normalizeOptions(q.options),
    recommendation: q.recommendation?.map((r) => r.trim()) ?? [],
  };
}

export function normalizeQuestions(
  questions: QuestionInput[],
): NormalizedQuestion[] {
  return questions.map((q) => {
    if (q.type === "single-choice") return normalizeSingleChoice(q);
    return normalizeMultiChoice(q);
  });
}
