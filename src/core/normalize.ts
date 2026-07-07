import type { QuestionInput } from "./schema.ts";
import type { NormalizedOption, NormalizedQuestion } from "./types.ts";

export function normalizeQuestions(
  questions: QuestionInput[],
): NormalizedQuestion[] {
  return questions.map((q) => ({
    id: q.id.trim(),
    header: q.header.trim(),
    prompt: q.prompt.trim(),
    options: q.options.map((opt) => {
      const normalized: NormalizedOption = {
        label: opt.label.trim(),
        value: (opt.value ?? opt.label).trim(),
      };
      const desc = opt.description?.trim();
      if (desc) normalized.description = desc;
      return normalized;
    }),
    multiSelect: q.multiSelect === true,
    recommendation: q.recommendation?.trim() ?? null,
    allowOther: q.allowOther !== false,
    allowChat: q.allowChat !== false,
  }));
}
