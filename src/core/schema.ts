import { Type } from "typebox";
import type { Static } from "typebox";

// Constraint constants — single source of truth
export const MIN_QUESTIONS = 1;
export const MAX_QUESTIONS = 10;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 12;

export const QuestionOptionSchema = Type.Object({
  label: Type.String({ description: "User-facing label for this option" }),
  value: Type.Optional(
    Type.String({
      description:
        "Stable value returned when this option is selected (defaults to label)",
    }),
  ),
  description: Type.Optional(
    Type.String({ description: "Optional helper text shown below the label" }),
  ),
});

export const QuestionSchema = Type.Object({
  id: Type.String({ description: "Unique question identifier" }),
  header: Type.String({
    description: "Short label shown in tabs and summaries",
  }),
  prompt: Type.String({ description: "Full question text shown to the user" }),
  options: Type.Array(QuestionOptionSchema, {
    minItems: MIN_OPTIONS,
    maxItems: MAX_OPTIONS,
    description: `Available options (${MIN_OPTIONS}-${MAX_OPTIONS})`,
  }),
  multiSelect: Type.Optional(
    Type.Boolean({
      description: "Allow multiple selections (default: false)",
    }),
  ),
  recommendation: Type.Optional(
    Type.String({ description: "Value of the recommended option" }),
  ),
  allowOther: Type.Optional(
    Type.Boolean({
      description:
        'Append a "Type something." option for custom text input (default: true)',
    }),
  ),
  allowChat: Type.Optional(
    Type.Boolean({
      description:
        'Append a "Chat about this" option to signal the agent for discussion (default: true)',
    }),
  ),
});

export const QuestionnaireParamsSchema = Type.Object({
  questions: Type.Array(QuestionSchema, {
    minItems: MIN_QUESTIONS,
    maxItems: MAX_QUESTIONS,
    description: `${MIN_QUESTIONS}-${MAX_QUESTIONS} questions to ask the user`,
  }),
});

// Static type aliases — derived from schemas
export type QuestionOption = Static<typeof QuestionOptionSchema>;
export type QuestionInput = Static<typeof QuestionSchema>;
