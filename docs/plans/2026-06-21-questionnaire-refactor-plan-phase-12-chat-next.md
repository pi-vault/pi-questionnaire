# Phase 12: "Chat About This" + "Next" Sentinels — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `allowChat` field to both question types, the "Chat about this" sentinel to both, and the "Next" row to multi-choice.

**Spec:** `docs/specs/2026-06-21-questionnaire-refactor-design.md`

**Master plan:** `docs/plans/2026-06-21-questionnaire-refactor-plan.md`

**Prerequisite:** Phase 11 complete ("Type something." sentinel working).

**Verification:** After completing all tasks, run `pnpm check` (lint + typecheck + tests). All must pass before committing.

---

Add `allowChat` field to both question types, the "Chat about this" sentinel to both, and the "Next" row to multi-choice.

### Task 12.1: Add `allowChat` to Schema, Types, Normalization

**Files:**

- Modify: `src/core/schema.ts`
- Modify: `src/core/types.ts`
- Modify: `src/core/normalize.ts`
- Test: `tests/core/normalize.test.ts`

- [ ] **Step 1: Add `allowChat` to both question schemas**

In `src/core/schema.ts`, add to both `SingleChoiceQuestionSchema` and `MultiChoiceQuestionSchema`:

```ts
allowChat: Type.Optional(
  Type.Boolean({
    description:
      'Append a "Chat about this" option to signal the agent for discussion (default: true)',
  }),
),
```

- [ ] **Step 2: Add `allowChat` to normalized types**

In `src/core/types.ts`:

```ts
export interface NormalizedSingleChoiceQuestion {
  type: "single-choice";
  id: string;
  header: string;
  prompt: string;
  options: QuestionOption[];
  recommendation: string | null;
  allowOther: boolean;
  allowChat: boolean;
}

export interface NormalizedMultiChoiceQuestion {
  type: "multi-choice";
  id: string;
  header: string;
  prompt: string;
  options: QuestionOption[];
  recommendation: string[];
  allowChat: boolean;
}
```

- [ ] **Step 3: Update normalization**

In `normalizeSingleChoice`, add: `allowChat: q.allowChat !== false,`

In `normalizeMultiChoice`, add: `allowChat: q.allowChat !== false,`

- [ ] **Step 4: Update normalize tests and run**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/core/normalize.test.ts`
Expected: PASS

### Task 12.2: Update State Helpers for Chat and Next

**Files:**

- Modify: `src/tui/state.ts`
- Test: `tests/tui/state.test.ts`

- [ ] **Step 1: Update `CursorTarget` type, `visibleRowCount`, and `cursorTarget`**

Add `chat` and `next` variants to the `CursorTarget` type:

```ts
export type CursorTarget =
  | { kind: "option"; index: number }
  | { kind: "other" }
  | { kind: "chat" }
  | { kind: "next" };
```

Then update both functions:

```ts
export function visibleRowCount(question: NormalizedQuestion): number {
  if (question.type === "single-choice") {
    return (
      question.options.length +
      (question.allowOther ? 1 : 0) +
      (question.allowChat ? 1 : 0)
    );
  }
  // multi-choice: options + chat? + Next
  return question.options.length + (question.allowChat ? 1 : 0) + 1;
}

export function cursorTarget(
  question: NormalizedQuestion,
  cursor: number,
): CursorTarget {
  if (cursor < question.options.length) {
    return { kind: "option", index: cursor };
  }

  let sentinel = question.options.length;

  if (question.type === "single-choice") {
    if (question.allowOther && cursor === sentinel) return { kind: "other" };
    if (question.allowOther) sentinel++;
    if (question.allowChat && cursor === sentinel) return { kind: "chat" };
    return { kind: "option", index: question.options.length - 1 };
  }

  // multi-choice
  if (question.allowChat && cursor === sentinel) return { kind: "chat" };
  if (question.allowChat) sentinel++;
  if (cursor === sentinel) return { kind: "next" };
  return { kind: "option", index: question.options.length - 1 };
}
```

- [ ] **Step 2: Add `selectChat` action to reducer**

Add to `Action` type:

```ts
| { type: "selectChat"; questionId: string }
```

Add reducer case:

```ts
case "selectChat": {
  // Chat replaces any existing selection; for multi-choice, clear checked
  next.answers.set(action.questionId, { kind: "chat" });
  const checked = next.multiChecked.get(action.questionId);
  if (checked) checked.clear();
  // Chat counts as answered — advance to next unanswered tab
  const nextTab = advanceToNextTab(next, questions);
  next.activeTab = nextTab;
  next.optionCursor = 0;
  next.reviewCursor = 0;
  return next;
}
```

- [ ] **Step 3: Add multi-choice confirm action**

For the "Next" row, we reuse the existing answer sync behavior. When the user presses Enter/Space on "Next", the multi-choice answer (from toggled checkboxes) is already synced. We just need to advance:

Add to `Action` type:

```ts
| { type: "confirmMulti"; questionId: string }
```

Add reducer case:

```ts
case "confirmMulti": {
  // Answer already synced via toggleCheckbox. Just advance.
  const nextTab = advanceToNextTab(next, questions);
  next.activeTab = nextTab;
  next.optionCursor = 0;
  next.reviewCursor = 0;
  return next;
}
```

- [ ] **Step 4: Write tests for new helpers and actions**

Add tests for `visibleRowCount` with `allowChat`, `cursorTarget` with `chat` and `next` kinds, `selectChat` action, `confirmMulti` action.

- [ ] **Step 5: Run tests**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/tui/state.test.ts`
Expected: PASS

### Task 12.3: Update Input Mapping for Chat and Next

**Files:**

- Modify: `src/tui/input.ts`
- Test: `tests/tui/input.test.ts`

- [ ] **Step 1: Update single-choice Enter/Space handler**

```ts
if (q.type === "single-choice") {
  // ... Up/Down unchanged ...
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
```

- [ ] **Step 2: Update multi-choice handler**

```ts
if (q.type === "multi-choice") {
  // ... Up/Down unchanged ...
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
```

- [ ] **Step 3: Write tests and run**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/tui/input.test.ts`
Expected: PASS

### Task 12.4: Update Rendering for Chat and Next

**Files:**

- Modify: `src/tui/render-question.ts`
- Modify: `src/tui/render.ts` (hint bar)
- Test: `tests/tui/render-question.test.ts`

- [ ] **Step 1: Add chat sentinel rendering to `renderSingleChoiceQuestion`**

After the "Type something." sentinel block, add:

```ts
// "Chat about this" sentinel
if (question.allowChat) {
  const chatIndex = question.options.length + (question.allowOther ? 1 : 0);
  const isCursor = chatIndex === cursor;
  const prefix = isCursor ? theme.fg("accent", "\u25B8 ") : "  ";
  const label = `${chatIndex + 1}. Chat about this`;
  const color = isCursor ? "accent" : "muted";
  pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
}
```

- [ ] **Step 2: Add chat and Next sentinel rendering to `renderMultiChoiceQuestion`**

The function signature stays the same — `allowChat` is already on `NormalizedMultiChoiceQuestion` after Task 12.1.

After the options loop, add:

```ts
// "Chat about this" sentinel
if (question.allowChat) {
  const chatIndex = question.options.length;
  const isCursor = chatIndex === cursor;
  const prefix = isCursor ? theme.fg("accent", "\u25B8 ") : "  ";
  const isChecked = false; // chat is never "checked"
  const marker = "[ ]";
  const label = `${marker} Chat about this`;
  const color = isCursor ? "accent" : "muted";
  pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
}

// "Next" sentinel
{
  const nextIndex = question.options.length + (question.allowChat ? 1 : 0);
  const isCursor = nextIndex === cursor;
  const prefix = isCursor ? theme.fg("accent", "\u25B8 ") : "  ";
  const label = "\u2500\u2500 Next";
  const color = isCursor ? "accent" : "dim";
  pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
}
```

- [ ] **Step 3: Update multi-choice hint bar in `src/tui/render.ts`**

The multi-choice hint should mention Enter for confirming "Next":

```ts
} else if (q?.type === "multi-choice") {
  hint = "Left/Right tabs | Up/Down move | Space toggle | Enter next | Esc cancel";
}
```

- [ ] **Step 4: Write tests and run full check**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && pnpm check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ tests/
git commit -m "feat: add 'Chat about this' and 'Next' sentinels"
```

---
