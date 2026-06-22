import { Key, matchesKey } from "@earendil-works/pi-tui";
import type { NormalizedQuestion } from "../core/types.ts";
import {
  type Action,
  type QuestionnaireState,
  allAnswered,
  currentQuestion,
  cursorTarget,
} from "./state.ts";

export type InputResult =
  | { type: "action"; action: Action }
  | { type: "finalize"; cancelled: boolean }
  | { type: "forward-to-editor" }
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

  // Typing mode — forward most keys to the inline editor
  if (state.inputMode === "typing") {
    if (matchesKey(data, Key.escape)) {
      return action({ type: "cancelTyping" });
    }
    if (matchesKey(data, Key.up)) {
      return action({ type: "cancelTyping" });
    }
    if (matchesKey(data, Key.down)) {
      return action({ type: "cancelTyping" });
    }
    // Enter, Left, Right, and all other keys → forward to editor
    return { type: "forward-to-editor" };
  }

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
      const target = cursorTarget(q, state.optionCursor);
      if (target.kind === "option") {
        const opt = q.options[target.index];
        return action({
          type: "selectOption",
          questionId: q.id,
          value: opt.value,
          label: opt.label,
        });
      }
      if (target.kind === "other") {
        return action({ type: "enterTyping", questionId: q.id });
      }
      if (target.kind === "chat") {
        return action({ type: "selectChat", questionId: q.id });
      }
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
  if (matchesKey(data, Key.space) || matchesKey(data, Key.enter)) {
    const target = cursorTarget(q, state.optionCursor);
    if (target.kind === "option") {
      const opt = q.options[target.index];
      return action({
        type: "toggleCheckbox",
        questionId: q.id,
        value: opt.value,
      });
    }
    if (target.kind === "chat") {
      return action({ type: "selectChat", questionId: q.id });
    }
    if (target.kind === "next") {
      return action({ type: "confirmMulti", questionId: q.id });
    }
  }

  return { type: "none" };
}
