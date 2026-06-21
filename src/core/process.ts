import type { QuestionInput } from "./schema.ts";
import type { NormalizedQuestion } from "./types.ts";
import { validateQuestions } from "./validate.ts";
import { normalizeQuestions } from "./normalize.ts";

export type ProcessResult =
  | { ok: true; questions: NormalizedQuestion[] }
  | { ok: false; error: string };

export function processQuestions(raw: QuestionInput[]): ProcessResult {
  const validation = validateQuestions(raw);
  if (!validation.valid) {
    return { ok: false, error: validation.error };
  }
  return { ok: true, questions: normalizeQuestions(raw) };
}
