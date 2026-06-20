export interface QuestionOption {
  value: string;
  label: string;
  description?: string;
}

export interface SingleChoiceQuestionInput {
  type: "single-choice";
  id: string;
  header: string;
  prompt: string;
  options: QuestionOption[];
  recommendation?: string;
}

export interface MultiChoiceQuestionInput {
  type: "multi-choice";
  id: string;
  header: string;
  prompt: string;
  options: QuestionOption[];
  recommendation?: string[];
}

export interface TextQuestionInput {
  type: "text";
  id: string;
  header: string;
  prompt: string;
  recommendation?: string;
}

export type QuestionInput =
  | SingleChoiceQuestionInput
  | MultiChoiceQuestionInput
  | TextQuestionInput;

export interface NormalizedChoiceQuestion {
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
  | NormalizedChoiceQuestion
  | NormalizedMultiChoiceQuestion
  | NormalizedTextQuestion;

export interface SelectedOption {
  value: string;
  label: string;
}

export interface ChoiceAnswer {
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

export type NormalizedAnswer = ChoiceAnswer | MultiChoiceAnswer | TextAnswer;

export interface QuestionnaireResult {
  questions: NormalizedQuestion[];
  answers: NormalizedAnswer[];
  cancelled: boolean;
  error?: string;
}
