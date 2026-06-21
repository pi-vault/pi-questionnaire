import type {
  NormalizedAnswer,
  NormalizedQuestion,
  QuestionnaireResult,
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

function cloneState(state: QuestionnaireState): QuestionnaireState {
  return {
    activeTab: state.activeTab,
    optionCursor: state.optionCursor,
    reviewCursor: state.reviewCursor,
    answers: new Map(state.answers),
    multiChecked: new Map(
      [...state.multiChecked].map(([k, v]) => [k, new Set(v)]),
    ),
    textValues: new Map(state.textValues),
  };
}

export function reduce(
  state: QuestionnaireState,
  action: Action,
  questions: NormalizedQuestion[],
): QuestionnaireState {
  const next = cloneState(state);

  switch (action.type) {
    case "switchTab": {
      next.activeTab = action.tab;
      next.optionCursor = 0;
      next.reviewCursor = 0;
      return next;
    }
    case "moveCursor": {
      const q = currentQuestion(next, questions);
      if (!q) {
        // Review tab
        if (action.direction === "up") {
          next.reviewCursor = Math.max(0, next.reviewCursor - 1);
        } else {
          next.reviewCursor = Math.min(
            questions.length - 1,
            next.reviewCursor + 1,
          );
        }
        return next;
      }
      if (q.type === "single-choice" || q.type === "multi-choice") {
        const optCount = q.options.length;
        if (action.direction === "up") {
          next.optionCursor = Math.max(0, next.optionCursor - 1);
        } else {
          next.optionCursor = Math.min(optCount - 1, next.optionCursor + 1);
        }
      }
      return next;
    }
    case "selectOption": {
      next.answers.set(action.questionId, {
        type: "single-choice",
        questionId: action.questionId,
        value: action.value,
        label: action.label,
      });
      const nextTab = advanceToNextTab(next, questions);
      next.activeTab = nextTab;
      next.optionCursor = 0;
      next.reviewCursor = 0;
      return next;
    }
    case "toggleCheckbox": {
      const checked = next.multiChecked.get(action.questionId) ?? new Set();
      if (checked.has(action.value)) {
        checked.delete(action.value);
      } else {
        checked.add(action.value);
      }
      next.multiChecked.set(action.questionId, checked);
      // Sync answer
      const q = questions.find((q) => q.id === action.questionId);
      if (q?.type === "multi-choice") {
        const selected = q.options
          .filter((o) => checked.has(o.value))
          .map((o) => ({ value: o.value, label: o.label }));
        if (selected.length > 0) {
          next.answers.set(action.questionId, {
            type: "multi-choice",
            questionId: action.questionId,
            selected,
          });
        } else {
          next.answers.delete(action.questionId);
        }
      }
      return next;
    }
    case "submitText": {
      next.textValues.set(action.questionId, action.value);
      next.answers.set(action.questionId, {
        type: "text",
        questionId: action.questionId,
        value: action.value,
      });
      return next;
    }
    case "resetCursors": {
      next.optionCursor = 0;
      next.reviewCursor = 0;
      return next;
    }
  }
}

export function buildResult(
  state: QuestionnaireState,
  questions: NormalizedQuestion[],
  cancelled: boolean,
): QuestionnaireResult {
  return {
    questions,
    answers: questions
      .map((q) => state.answers.get(q.id))
      .filter((a): a is NormalizedAnswer => a !== undefined),
    cancelled,
  };
}
