import { Key, matchesKey } from "@earendil-works/pi-tui";
import type { NormalizedQuestion } from "../core/types.ts";
import {
  type Action,
  type QuestionnaireState,
  allAnswered,
  currentQuestion,
  cursorTarget,
} from "./state.ts";

export interface InputContext {
  state: QuestionnaireState;
  questions: NormalizedQuestion[];
  notesEditorText: string;
}

export type Effect =
  | { type: "dispatch"; action: Action }
  | { type: "finalize"; cancelled: boolean }
  | { type: "forward-to-editor" }
  | { type: "forward-to-notes-editor" }
  | { type: "set-editor-text"; text: string }
  | { type: "set-notes-editor-text"; text: string };

function dispatch(a: Action): Effect {
  return { type: "dispatch", action: a };
}

export function interpret(data: string, ctx: InputContext): Effect[] {
  const { state, questions } = ctx;
  const reviewTabIndex = questions.length;
  const totalTabs = questions.length + 1;
  const q = currentQuestion(state, questions);

  // Typing mode
  if (state.inputMode === "typing") {
    if (matchesKey(data, Key.escape) || matchesKey(data, Key.up) || matchesKey(data, Key.down)) {
      return [dispatch({ type: "cancelTyping" }), { type: "set-editor-text", text: "" }];
    }
    return [{ type: "forward-to-editor" }];
  }

  // Notes mode — Up/Down save-and-exit (previously in questionnaire-ui.ts)
  if (state.inputMode === "notes" && state.editingQuestionId) {
    if (matchesKey(data, Key.escape)) {
      return [dispatch({ type: "cancelNotes" }), { type: "set-notes-editor-text", text: "" }];
    }
    if (matchesKey(data, Key.up) || matchesKey(data, Key.down)) {
      return [
        dispatch({
          type: "submitNotes",
          questionId: state.editingQuestionId,
          value: ctx.notesEditorText.trim(),
        }),
        dispatch({
          type: "moveCursor",
          direction: matchesKey(data, Key.up) ? "up" : "down",
        }),
        { type: "set-notes-editor-text", text: "" },
      ];
    }
    return [{ type: "forward-to-notes-editor" }];
  }

  // Global Esc
  if (matchesKey(data, Key.escape)) {
    return [{ type: "finalize", cancelled: true }];
  }

  // Tab — open notes editor
  if (matchesKey(data, Key.tab)) {
    if (q) {
      return [
        dispatch({ type: "enterNotes", questionId: q.id }),
        { type: "set-notes-editor-text", text: state.notes.get(q.id) ?? "" },
      ];
    }
    return [];
  }

  // Left/Right navigate tabs
  if (matchesKey(data, Key.right)) {
    return [dispatch({ type: "switchTab", tab: (state.activeTab + 1) % totalTabs })];
  }
  if (matchesKey(data, Key.left)) {
    return [dispatch({ type: "switchTab", tab: (state.activeTab - 1 + totalTabs) % totalTabs })];
  }

  // Review tab
  if (state.activeTab === reviewTabIndex) {
    if (matchesKey(data, Key.up)) {
      return [dispatch({ type: "moveCursor", direction: "up" })];
    }
    if (matchesKey(data, Key.down)) {
      return [dispatch({ type: "moveCursor", direction: "down" })];
    }
    if (matchesKey(data, Key.enter) && allAnswered(state, questions)) {
      return [{ type: "finalize", cancelled: false }];
    }
    if (matchesKey(data, Key.space) || matchesKey(data, Key.enter)) {
      if (state.reviewCursor < questions.length) {
        return [dispatch({ type: "switchTab", tab: state.reviewCursor })];
      }
    }
    return [];
  }

  if (!q) return [];

  // Single-select
  if (!q.multiSelect) {
    if (matchesKey(data, Key.up)) {
      return [dispatch({ type: "moveCursor", direction: "up" })];
    }
    if (matchesKey(data, Key.down)) {
      return [dispatch({ type: "moveCursor", direction: "down" })];
    }
    if (matchesKey(data, Key.enter) || matchesKey(data, Key.space)) {
      const target = cursorTarget(q, state.optionCursor);
      if (target.kind === "option") {
        const opt = q.options[target.index];
        return [dispatch({
          type: "selectOption",
          questionId: q.id,
          value: opt.value,
          label: opt.label,
        })];
      }
      if (target.kind === "other") {
        return [
          dispatch({ type: "enterTyping", questionId: q.id }),
          { type: "set-editor-text", text: state.customText.get(q.id) ?? "" },
        ];
      }
      if (target.kind === "chat") {
        return [dispatch({ type: "selectChat", questionId: q.id })];
      }
    }
    return [];
  }

  // Multi-choice
  if (matchesKey(data, Key.up)) {
    return [dispatch({ type: "moveCursor", direction: "up" })];
  }
  if (matchesKey(data, Key.down)) {
    return [dispatch({ type: "moveCursor", direction: "down" })];
  }
  if (matchesKey(data, Key.space) || matchesKey(data, Key.enter)) {
    const target = cursorTarget(q, state.optionCursor);
    if (target.kind === "option") {
      const opt = q.options[target.index];
      return [dispatch({
        type: "toggleCheckbox",
        questionId: q.id,
        value: opt.value,
      })];
    }
    if (target.kind === "chat") {
      return [dispatch({ type: "selectChat", questionId: q.id })];
    }
    if (target.kind === "next") {
      return [dispatch({ type: "confirmMulti", questionId: q.id })];
    }
  }

  return [];
}
