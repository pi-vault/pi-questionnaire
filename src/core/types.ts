import type { QuestionOption } from "./schema.ts";

export interface NormalizedSingleChoiceQuestion {
  type: "single-choice";
  id: string;
  header: string;
  prompt: string;
  options: QuestionOption[];
  recommendation: string | null;
}

export interface NormalizedMultiChoiceQuestion {
  type: "multi-choice";
  id: string;
  header: string;
  prompt: string;
  options: QuestionOption[];
  recommendation: string[];
}

export interface NormalizedTextQuestion {
  type: "text";
  id: string;
  header: string;
  prompt: string;
  recommendation: string | null;
}

export type NormalizedQuestion =
  | NormalizedSingleChoiceQuestion
  | NormalizedMultiChoiceQuestion
  | NormalizedTextQuestion;

export interface SelectedOption {
  value: string;
  label: string;
}

export interface SingleChoiceAnswer {
  type: "single-choice";
  questionId: string;
  value: string;
  label: string;
}

export interface MultiChoiceAnswer {
  type: "multi-choice";
  questionId: string;
  selected: SelectedOption[];
}

export interface TextAnswer {
  type: "text";
  questionId: string;
  value: string;
}

export type NormalizedAnswer =
  | SingleChoiceAnswer
  | MultiChoiceAnswer
  | TextAnswer;

export interface QuestionnaireResult {
  questions: NormalizedQuestion[];
  answers: NormalizedAnswer[];
  cancelled: boolean;
  error?: string;
}
