import { Key, matchesKey } from "@earendil-works/pi-tui";
import type { NormalizedQuestion } from "../core/types.ts";
import {
  type Action,
  type QuestionnaireState,
  allAnswered,
  currentQuestion,
} from "./state.ts";

export type InputResult =
  | { type: "action"; action: Action }
  | { type: "finalize"; cancelled: boolean }
  | { type: "none" };

function action(a: Action): InputResult {
  return { type: "action", action: a };
}

export function mapInput(
  data: string,
  state: QuestionnaireState,
  questions: NormalizedQuestion[],
): InputResult {
  const reviewTabIndex = questions.length;
  const totalTabs = questions.length + 1;
  const q = currentQuestion(state, questions);

  // Global Esc
  if (matchesKey(data, Key.escape)) {
    return { type: "finalize", cancelled: true };
  }

  // Left/Right navigate tabs
  if (matchesKey(data, Key.right)) {
    return action({
      type: "switchTab",
      tab: (state.activeTab + 1) % totalTabs,
    });
  }
  if (matchesKey(data, Key.left)) {
    return action({
      type: "switchTab",
      tab: (state.activeTab - 1 + totalTabs) % totalTabs,
    });
  }

  // Review tab
  if (state.activeTab === reviewTabIndex) {
    if (matchesKey(data, Key.up)) {
      return action({ type: "moveCursor", direction: "up" });
    }
    if (matchesKey(data, Key.down)) {
      return action({ type: "moveCursor", direction: "down" });
    }
    if (matchesKey(data, Key.enter) && allAnswered(state, questions)) {
      return { type: "finalize", cancelled: false };
    }
    if (matchesKey(data, Key.space) || matchesKey(data, Key.enter)) {
      if (state.reviewCursor < questions.length) {
        return action({ type: "switchTab", tab: state.reviewCursor });
      }
    }
    return { type: "none" };
  }

  if (!q) return { type: "none" };

  // Single-choice
  if (q.type === "single-choice") {
    if (matchesKey(data, Key.up)) {
      return action({ type: "moveCursor", direction: "up" });
    }
    if (matchesKey(data, Key.down)) {
      return action({ type: "moveCursor", direction: "down" });
    }
    if (matchesKey(data, Key.enter) || matchesKey(data, Key.space)) {
      const opt = q.options[state.optionCursor];
      return action({
        type: "selectOption",
        questionId: q.id,
        value: opt.value,
        label: opt.label,
      });
    }
    return { type: "none" };
  }

  // Multi-choice
  if (matchesKey(data, Key.up)) {
    return action({ type: "moveCursor", direction: "up" });
  }
  if (matchesKey(data, Key.down)) {
    return action({ type: "moveCursor", direction: "down" });
  }
  if (matchesKey(data, Key.space)) {
    const opt = q.options[state.optionCursor];
    return action({
      type: "toggleCheckbox",
      questionId: q.id,
      value: opt.value,
    });
  }
  if (matchesKey(data, Key.enter)) {
    return { type: "none" }; // confirm (no-op, answer already synced)
  }

  return { type: "none" };
}
