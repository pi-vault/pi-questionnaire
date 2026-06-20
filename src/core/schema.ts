import { Type } from "typebox";

const QuestionOptionSchema = Type.Object({
  value: Type.String({
    description: "Stable value returned when this option is selected",
  }),
  label: Type.String({ description: "User-facing label for this option" }),
  description: Type.Optional(
    Type.String({ description: "Optional helper text shown below the label" }),
  ),
});

const SingleChoiceQuestionSchema = Type.Object({
  type: Type.Literal("single-choice"),
  id: Type.String({ description: "Unique question identifier" }),
  header: Type.String({
    description: "Short label shown in tabs and summaries",
  }),
  prompt: Type.String({ description: "Full question text shown to the user" }),
  options: Type.Array(QuestionOptionSchema, {
    minItems: 2,
    maxItems: 12,
    description: "Available options (2-12)",
  }),
  recommendation: Type.Optional(
    Type.String({ description: "Value of the recommended option" }),
  ),
});

const MultiChoiceQuestionSchema = Type.Object({
  type: Type.Literal("multi-choice"),
  id: Type.String({ description: "Unique question identifier" }),
  header: Type.String({
    description: "Short label shown in tabs and summaries",
  }),
  prompt: Type.String({ description: "Full question text shown to the user" }),
  options: Type.Array(QuestionOptionSchema, {
    minItems: 2,
    maxItems: 12,
    description: "Available options (2-12)",
  }),
  recommendation: Type.Optional(
    Type.Array(Type.String(), { description: "Values of recommended options" }),
  ),
});

const TextQuestionSchema = Type.Object({
  type: Type.Literal("text"),
  id: Type.String({ description: "Unique question identifier" }),
  header: Type.String({
    description: "Short label shown in tabs and summaries",
  }),
  prompt: Type.String({ description: "Full question text shown to the user" }),
  recommendation: Type.Optional(
    Type.String({ description: "Prefilled editor value" }),
  ),
});

const QuestionSchema = Type.Union([
  SingleChoiceQuestionSchema,
  MultiChoiceQuestionSchema,
  TextQuestionSchema,
]);

export const QuestionnaireParamsSchema = Type.Object({
  questions: Type.Array(QuestionSchema, {
    minItems: 1,
    maxItems: 10,
    description: "1-10 questions to ask the user",
  }),
});
