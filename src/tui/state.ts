import type {
  NormalizedAnswer,
  NormalizedQuestion,
} from "../core/types.ts";

export interface QuestionnaireState {
  activeTab: number;
  optionCursor: number;
  reviewCursor: number;
  answers: Map<string, NormalizedAnswer>;
  multiChecked: Map<string, Set<string>>;
  textValues: Map<string, string>;
}

export type Action =
  | { type: "switchTab"; tab: number }
  | { type: "moveCursor"; direction: "up" | "down" }
  | { type: "selectOption"; questionId: string; value: string; label: string }
  | { type: "toggleCheckbox"; questionId: string; value: string }
  | { type: "submitText"; questionId: string; value: string }
  | { type: "resetCursors" };

export function initState(questions: NormalizedQuestion[]): QuestionnaireState {
  const multiChecked = new Map<string, Set<string>>();
  const textValues = new Map<string, string>();

  for (const q of questions) {
    if (q.type === "multi-choice") {
      multiChecked.set(q.id, new Set(q.recommendation));
    }
    if (q.type === "text" && q.recommendation) {
      textValues.set(q.id, q.recommendation);
    }
  }

  return {
    activeTab: 0,
    optionCursor: 0,
    reviewCursor: 0,
    answers: new Map(),
    multiChecked,
    textValues,
  };
}

export function allAnswered(
  state: QuestionnaireState,
  questions: NormalizedQuestion[],
): boolean {
  return questions.every((q) => state.answers.has(q.id));
}

export function answeredIds(state: QuestionnaireState): Set<string> {
  return new Set(state.answers.keys());
}

export function currentQuestion(
  state: QuestionnaireState,
  questions: NormalizedQuestion[],
): NormalizedQuestion | undefined {
  if (state.activeTab >= questions.length) return undefined;
  return questions[state.activeTab];
}

export function advanceToNextTab(
  state: QuestionnaireState,
  questions: NormalizedQuestion[],
): number {
  const reviewTabIndex = questions.length;
  for (let offset = 1; offset <= questions.length; offset++) {
    const idx = (state.activeTab + offset) % questions.length;
    if (!state.answers.has(questions[idx].id)) {
      return idx;
    }
  }
  return reviewTabIndex;
}

export function getSelectedValue(
  state: QuestionnaireState,
  questionId: string,
): string | null {
  const answer = state.answers.get(questionId);
  if (answer?.type === "single-choice") return answer.value;
  return null;
}

export function buildResult(
  state: QuestionnaireState,
  questions: NormalizedQuestion[],
  cancelled: boolean,
) {
  return {
    questions,
    answers: questions
      .map((q) => state.answers.get(q.id))
      .filter((a): a is NormalizedAnswer => a !== undefined),
    cancelled,
  };
}
