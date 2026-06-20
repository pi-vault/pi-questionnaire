import type { QuestionInput } from "./types.ts";

type ValidationResult = { valid: true } | { valid: false; error: string };

export function validateQuestions(
  questions: QuestionInput[],
): ValidationResult {
  if (questions.length === 0) {
    return {
      valid: false,
      error: "Questionnaire must include at least 1 question.",
    };
  }
  if (questions.length > 10) {
    return {
      valid: false,
      error: "Questionnaire supports at most 10 questions.",
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
      if (q.options.length < 2 || q.options.length > 12) {
        return {
          valid: false,
          error: `Question "${trimmedId}" must have 2-12 options.`,
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
