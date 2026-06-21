import type { QuestionInput } from "./schema.ts";
import {
  MIN_QUESTIONS,
  MAX_QUESTIONS,
  MIN_OPTIONS,
  MAX_OPTIONS,
} from "./schema.ts";

type ValidationResult = { valid: true } | { valid: false; error: string };

export function validateQuestions(
  questions: QuestionInput[],
): ValidationResult {
  if (questions.length === 0) {
    return {
      valid: false,
      error: `Questionnaire must include at least ${MIN_QUESTIONS} question.`,
    };
  }
  if (questions.length > MAX_QUESTIONS) {
    return {
      valid: false,
      error: `Questionnaire supports at most ${MAX_QUESTIONS} questions.`,
    };
  }

  const idSet = new Set<string>();

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const trimmedId = q.id.trim();
    const questionNumber = i + 1;

    if (!trimmedId) {
      return {
        valid: false,
        error: `Question ${questionNumber} has an empty id.`,
      };
    }
    if (idSet.has(trimmedId)) {
      return { valid: false, error: `Duplicate question id: "${trimmedId}".` };
    }
    idSet.add(trimmedId);

    if (!q.header.trim()) {
      return {
        valid: false,
        error: `Question "${trimmedId}" has an empty header.`,
      };
    }
    if (!q.prompt.trim()) {
      return {
        valid: false,
        error: `Question "${trimmedId}" has an empty prompt.`,
      };
    }

    if (q.type === "single-choice" || q.type === "multi-choice") {
      if (q.options.length < MIN_OPTIONS || q.options.length > MAX_OPTIONS) {
        return {
          valid: false,
          error: `Question "${trimmedId}" must have ${MIN_OPTIONS}-${MAX_OPTIONS} options.`,
        };
      }

      const valueSet = new Set<string>();
      for (const opt of q.options) {
        const trimmedValue = opt.value.trim();
        if (!trimmedValue) {
          return {
            valid: false,
            error: `Question "${trimmedId}" has an option with an empty value.`,
          };
        }
        if (!opt.label.trim()) {
          return {
            valid: false,
            error: `Question "${trimmedId}" has an option with an empty label.`,
          };
        }
        if (valueSet.has(trimmedValue)) {
          return {
            valid: false,
            error: `Question "${trimmedId}" has duplicate option value "${trimmedValue}".`,
          };
        }
        valueSet.add(trimmedValue);
      }

      const optionValues = new Set(q.options.map((o) => o.value.trim()));

      if (q.type === "single-choice" && q.recommendation !== undefined) {
        if (!optionValues.has(q.recommendation.trim())) {
          return {
            valid: false,
            error: `Question "${trimmedId}" recommendation "${q.recommendation.trim()}" does not match any option value.`,
          };
        }
      }

      if (q.type === "multi-choice" && q.recommendation !== undefined) {
        for (const rec of q.recommendation) {
          if (!optionValues.has(rec.trim())) {
            return {
              valid: false,
              error: `Question "${trimmedId}" recommendation "${rec.trim()}" does not match any option value.`,
            };
          }
        }
      }
    }
  }

  return { valid: true };
}
