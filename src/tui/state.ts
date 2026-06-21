import type {
  NormalizedQuestion,
  QuestionResponse,
  QuestionSelection,
  QuestionnaireResult,
} from "../core/types.ts";

export type CursorTarget =
  | { kind: "option"; index: number }
  | { kind: "other" };

export function visibleRowCount(question: NormalizedQuestion): number {
  if (question.type === "single-choice") {
    return question.options.length + (question.allowOther ? 1 : 0);
  }
  return question.options.length;
}

export function cursorTarget(
  question: NormalizedQuestion,
  cursor: number,
): CursorTarget {
  if (cursor < question.options.length) {
    return { kind: "option", index: cursor };
  }
  if (
    question.type === "single-choice" &&
    question.allowOther &&
    cursor === question.options.length
  ) {
    return { kind: "other" };
  }
  return {
    kind: "option",
    index: Math.min(cursor, question.options.length - 1),
  };
}

export interface QuestionnaireState {
  activeTab: number;
  optionCursor: number;
  reviewCursor: number;
  answers: Map<string, QuestionSelection>;
  multiChecked: Map<string, Set<string>>;
  inputMode: "navigate" | "typing" | "notes";
  editingQuestionId: string | null;
  customText: Map<string, string>;
}

export type Action =
  | { type: "switchTab"; tab: number }
  | { type: "moveCursor"; direction: "up" | "down" }
  | { type: "selectOption"; questionId: string; value: string; label: string }
  | { type: "toggleCheckbox"; questionId: string; value: string }
  | { type: "resetCursors" }
  | { type: "enterTyping"; questionId: string }
  | { type: "submitTyping"; questionId: string; value: string }
  | { type: "cancelTyping" };

export function initState(questions: NormalizedQuestion[]): QuestionnaireState {
  const multiChecked = new Map<string, Set<string>>();

  for (const q of questions) {
    if (q.type === "multi-choice") {
      multiChecked.set(q.id, new Set(q.recommendation));
    }
  }

  return {
    activeTab: 0,
    optionCursor: 0,
    reviewCursor: 0,
    answers: new Map(),
    multiChecked,
    inputMode: "navigate",
    editingQuestionId: null,
    customText: new Map(),
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
  const sel = state.answers.get(questionId);
  if (sel?.kind === "option") return sel.value;
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
    inputMode: state.inputMode,
    editingQuestionId: state.editingQuestionId,
    customText: new Map(state.customText),
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
      next.inputMode = "navigate";
      next.editingQuestionId = null;
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
      const rowCount = visibleRowCount(q);
      if (action.direction === "up") {
        next.optionCursor = Math.max(0, next.optionCursor - 1);
      } else {
        next.optionCursor = Math.min(rowCount - 1, next.optionCursor + 1);
      }
      return next;
    }
    case "selectOption": {
      next.answers.set(action.questionId, {
        kind: "option",
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
          next.answers.set(action.questionId, { kind: "options", selected });
        } else {
          next.answers.delete(action.questionId);
        }
      }
      return next;
    }
    case "resetCursors": {
      next.optionCursor = 0;
      next.reviewCursor = 0;
      return next;
    }
    case "enterTyping": {
      next.inputMode = "typing";
      next.editingQuestionId = action.questionId;
      return next;
    }
    case "submitTyping": {
      const trimmed = action.value.trim();
      if (trimmed) {
        next.customText.set(action.questionId, trimmed);
        next.answers.set(action.questionId, {
          kind: "custom",
          value: trimmed,
        });
        const nextTab = advanceToNextTab(next, questions);
        next.activeTab = nextTab;
        next.optionCursor = 0;
        next.reviewCursor = 0;
      }
      next.inputMode = "navigate";
      next.editingQuestionId = null;
      return next;
    }
    case "cancelTyping": {
      next.inputMode = "navigate";
      next.editingQuestionId = null;
      return next;
    }
  }
}

export function buildResult(
  state: QuestionnaireState,
  questions: NormalizedQuestion[],
  cancelled: boolean,
): QuestionnaireResult {
  const responses: QuestionResponse[] = questions
    .map((q) => {
      const selection = state.answers.get(q.id);
      if (!selection) return undefined;
      return { questionId: q.id, selection };
    })
    .filter((r): r is QuestionResponse => r !== undefined);
  return { questions, responses, cancelled };
}
