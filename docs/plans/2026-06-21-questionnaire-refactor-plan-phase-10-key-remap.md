# Phase 10: Key Remapping — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remap tab-navigation from Tab/Shift+Tab to Left/Right. Tab becomes unbound (reserved for Phase 13 notes).

**Spec:** `docs/specs/2026-06-21-questionnaire-refactor-design.md`

**Master plan:** `docs/plans/2026-06-21-questionnaire-refactor-plan.md`

**Prerequisite:** Phase 9 complete (text question type removed).

**Verification:** After completing all tasks, run `pnpm check` (lint + typecheck + tests). All must pass before committing.

---

Remap tab-navigation from Tab/Shift+Tab to Left/Right. Tab becomes unbound (reserved for Phase 13 notes). Left/Right now works on all question types.

### Task 10.1: Update Input Mapping

**Files:**

- Modify: `src/tui/input.ts`
- Test: `tests/tui/input.test.ts`

- [ ] **Step 1: Rewrite key routing in `mapInput`**

Replace Tab/Shift+Tab tab-navigation with Left/Right. Remove the Tab/Shift+Tab bindings. Left/Right now always does tab navigation (they were previously guarded by `q?.type !== "text"` which is gone).

Updated `mapInput`:

```ts
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

  // Tab navigation via Left/Right
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
  if (q.type === "multi-choice") {
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
      return { type: "none" };
    }
    return { type: "none" };
  }

  return { type: "none" };
}
```

- [ ] **Step 2: Update tests**

In `tests/tui/input.test.ts`:

- Replace all Tab key tests with Left/Right key tests for tab navigation
- Remove Shift+Tab tests, replace with Left key tests
- Remove any `q?.type !== "text"` conditional test logic
- Verify Left/Right switches tabs on both single-choice and multi-choice

- [ ] **Step 3: Run tests**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/tui/input.test.ts`
Expected: PASS

### Task 10.2: Update Hint Bar

**Files:**

- Modify: `src/tui/render.ts`
- Test: `tests/tui/render.test.ts`

- [ ] **Step 1: Update hint text in `render.ts`**

Change the hint strings to reflect new key mapping:

```ts
const hint =
  state.activeTab === reviewTabIndex
    ? "Left/Right tabs | Enter submit | Space edit | Esc cancel"
    : q?.type === "multi-choice"
      ? "Left/Right tabs | Up/Down move | Space toggle | Esc cancel"
      : "Left/Right tabs | Up/Down move | Space/Enter select | Esc cancel";
```

- [ ] **Step 2: Update render tests**

Update any hint-bar assertions to match new key labels.

- [ ] **Step 3: Run full check**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && pnpm check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/ tests/
git commit -m "refactor: remap tab navigation from Tab/Shift+Tab to Left/Right"
```

---
