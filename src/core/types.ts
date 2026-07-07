export interface NormalizedOption {
  label: string;
  value: string;
  description?: string;
}

export interface NormalizedQuestion {
  id: string;
  header: string;
  prompt: string;
  options: NormalizedOption[];
  multiSelect: boolean;
  recommendation: string | null;
  allowOther: boolean;
  allowChat: boolean;
}

export interface SelectedOption {
  value: string;
  label: string;
}

export type QuestionSelection =
  | { kind: "option"; value: string; label: string }
  | { kind: "options"; selected: SelectedOption[] }
  | { kind: "custom"; value: string }
  | { kind: "chat" };

export interface QuestionResponse {
  questionId: string;
  selection: QuestionSelection;
  notes?: string;
}

export interface QuestionnaireResult {
  questions: NormalizedQuestion[];
  responses: QuestionResponse[];
  cancelled: boolean;
  error?: string;
}
