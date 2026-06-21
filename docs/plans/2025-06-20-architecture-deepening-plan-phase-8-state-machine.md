# Phase 8: Extract State Machine from questionnaire-ui

> Part of [architecture-deepening-design.md](../specs/2025-06-20-architecture-deepening-design.md)
>
> **Depends on:** Phases 1-3 must be complete before starting this phase.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the 404-line `questionnaire-ui.ts` monolithic closure into three testable pure modules (state, input, render) plus a thin adapter, enabling comprehensive unit testing of the entire TUI interaction model.

**Architecture:** State machine pattern with immutable reducer. Input handler maps raw key data to actions. Render assembler composes existing render modules using state. The remaining adapter is ~40-50 lines of pi-tui wiring.

**Tech Stack:** TypeScript 6, pi-tui (Key, matchesKey, Editor), Vitest 4, Biome 2.5

**Spec:** `docs/specs/2025-06-20-architecture-deepening-design.md` — Phase 4

**Verification command:** `pnpm check` (runs biome lint + typecheck + vitest)

---

## File Structure

```
src/tui/
  state.ts              # NEW — QuestionnaireState, Action, initState, reduce, helpers
  input.ts              # NEW — mapInput: key data → InputResult
  render.ts             # NEW — renderQuestionnaire: state → string[]
  questionnaire-ui.ts   # REWRITE — thin adapter (~40-50 lines)
  theme.ts              # EXISTING (from Phase 1)
  render-tabs.ts        # EXISTING — unchanged
  render-question.ts    # EXISTING — unchanged
  render-review.ts      # EXISTING — unchanged
  helpers.ts            # EXISTING — unchanged
  index.ts              # EXISTING — unchanged (re-exports runQuestionnaireUI)
tests/tui/
  state.test.ts         # NEW
  input.test.ts         # NEW
  render.test.ts        # NEW (assembler tests, not individual renderer tests)
```

---

### Task 12: Write state.ts — types, initState, helpers

**Files:**

- Create: `src/tui/state.ts`

- [ ] **Step 1: Write `src/tui/state.ts` with types, initState, and helper functions (no reduce yet)**

```ts
import type {
  NormalizedAnswer,
  NormalizedQuestion,
  SelectedOption,
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
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/tui/state.ts
git commit -m "feat: add state types, initState, and helper functions"
```

---

### Task 13: Write state.test.ts for initState and helpers

**Files:**

- Create: `tests/tui/state.test.ts`

- [ ] **Step 1: Write `tests/tui/state.test.ts` — initState and helper tests**

```ts
import { describe, expect, it } from "vitest";
import type { NormalizedQuestion } from "../../src/core/types.ts";
import {
  initState,
  allAnswered,
  answeredIds,
  currentQuestion,
  advanceToNextTab,
  getSelectedValue,
  buildResult,
} from "../../src/tui/state.ts";

const questions: NormalizedQuestion[] = [
  {
    type: "single-choice",
    id: "scope",
    header: "Scope",
    prompt: "Pick scope",
    options: [
      { value: "small", label: "Small" },
      { value: "large", label: "Large" },
    ],
    recommendation: "small",
  },
  {
    type: "multi-choice",
    id: "features",
    header: "Features",
    prompt: "Pick features",
    options: [
      { value: "auth", label: "Auth" },
      { value: "log", label: "Logging" },
    ],
    recommendation: ["auth"],
  },
  {
    type: "text",
    id: "notes",
    header: "Notes",
    prompt: "Any notes?",
    recommendation: "prefilled",
  },
];

describe("initState", () => {
  it("starts on tab 0 with cursors at 0", () => {
    const state = initState(questions);
    expect(state.activeTab).toBe(0);
    expect(state.optionCursor).toBe(0);
    expect(state.reviewCursor).toBe(0);
  });

  it("starts with no answers", () => {
    const state = initState(questions);
    expect(state.answers.size).toBe(0);
  });

  it("pre-populates multiChecked from recommendations", () => {
    const state = initState(questions);
    const checked = state.multiChecked.get("features");
    expect(checked).toBeDefined();
    expect(checked?.has("auth")).toBe(true);
    expect(checked?.has("log")).toBe(false);
  });

  it("pre-populates textValues from recommendations", () => {
    const state = initState(questions);
    expect(state.textValues.get("notes")).toBe("prefilled");
  });

  it("does not pre-populate textValues when no recommendation", () => {
    const noRecQuestions: NormalizedQuestion[] = [
      {
        type: "text",
        id: "notes",
        header: "Notes",
        prompt: "Any notes?",
        recommendation: null,
      },
    ];
    const state = initState(noRecQuestions);
    expect(state.textValues.has("notes")).toBe(false);
  });
});

describe("allAnswered", () => {
  it("returns false when no answers", () => {
    const state = initState(questions);
    expect(allAnswered(state, questions)).toBe(false);
  });

  it("returns true when all questions have answers", () => {
    const state = initState(questions);
    state.answers.set("scope", {
      type: "single-choice",
      questionId: "scope",
      value: "small",
      label: "Small",
    });
    state.answers.set("features", {
      type: "multi-choice",
      questionId: "features",
      selected: [{ value: "auth", label: "Auth" }],
    });
    state.answers.set("notes", {
      type: "text",
      questionId: "notes",
      value: "ok",
    });
    expect(allAnswered(state, questions)).toBe(true);
  });
});

describe("answeredIds", () => {
  it("returns empty set when no answers", () => {
    const state = initState(questions);
    expect(answeredIds(state).size).toBe(0);
  });

  it("returns ids of answered questions", () => {
    const state = initState(questions);
    state.answers.set("scope", {
      type: "single-choice",
      questionId: "scope",
      value: "small",
      label: "Small",
    });
    const ids = answeredIds(state);
    expect(ids.has("scope")).toBe(true);
    expect(ids.size).toBe(1);
  });
});

describe("currentQuestion", () => {
  it("returns question at activeTab", () => {
    const state = initState(questions);
    expect(currentQuestion(state, questions)?.id).toBe("scope");
  });

  it("returns undefined when on review tab", () => {
    const state = { ...initState(questions), activeTab: questions.length };
    expect(currentQuestion(state, questions)).toBeUndefined();
  });
});

describe("advanceToNextTab", () => {
  it("advances to next unanswered question", () => {
    const state = initState(questions);
    state.answers.set("scope", {
      type: "single-choice",
      questionId: "scope",
      value: "small",
      label: "Small",
    });
    const next = advanceToNextTab(state, questions);
    expect(next).toBe(1); // features
  });

  it("goes to review when all answered", () => {
    const state = initState(questions);
    state.answers.set("scope", {
      type: "single-choice",
      questionId: "scope",
      value: "small",
      label: "Small",
    });
    state.answers.set("features", {
      type: "multi-choice",
      questionId: "features",
      selected: [{ value: "auth", label: "Auth" }],
    });
    state.answers.set("notes", {
      type: "text",
      questionId: "notes",
      value: "ok",
    });
    const next = advanceToNextTab(state, questions);
    expect(next).toBe(questions.length); // review tab
  });
});

describe("getSelectedValue", () => {
  it("returns null when no answer", () => {
    const state = initState(questions);
    expect(getSelectedValue(state, "scope")).toBeNull();
  });

  it("returns selected value for single-choice answer", () => {
    const state = initState(questions);
    state.answers.set("scope", {
      type: "single-choice",
      questionId: "scope",
      value: "small",
      label: "Small",
    });
    expect(getSelectedValue(state, "scope")).toBe("small");
  });
});

describe("buildResult", () => {
  it("builds result with answers in question order", () => {
    const state = initState(questions);
    state.answers.set("notes", {
      type: "text",
      questionId: "notes",
      value: "ok",
    });
    state.answers.set("scope", {
      type: "single-choice",
      questionId: "scope",
      value: "small",
      label: "Small",
    });
    const result = buildResult(state, questions, false);
    expect(result.cancelled).toBe(false);
    expect(result.answers).toHaveLength(2);
    expect(result.answers[0].questionId).toBe("scope"); // question order
    expect(result.answers[1].questionId).toBe("notes");
  });

  it("builds cancelled result", () => {
    const state = initState(questions);
    const result = buildResult(state, questions, true);
    expect(result.cancelled).toBe(true);
    expect(result.answers).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm test -- tests/tui/state.test.ts`
Expected: PASS (all tests green)

- [ ] **Step 3: Commit**

```bash
git add tests/tui/state.test.ts
git commit -m "test: add state initState and helper tests"
```

---

### Task 14: Add reduce function to state.ts with tests

**Files:**

- Edit: `src/tui/state.ts`
- Edit: `tests/tui/state.test.ts`

- [ ] **Step 1: Add `reduce` function to `src/tui/state.ts`**

Add this function after the helper functions:

```ts
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
```

- [ ] **Step 2: Add reduce tests to `tests/tui/state.test.ts`**

Append to the test file:

```ts
import { reduce } from "../../src/tui/state.ts";

describe("reduce", () => {
  it("switchTab changes active tab and resets cursors", () => {
    const state = { ...initState(questions), optionCursor: 2, reviewCursor: 1 };
    const next = reduce(state, { type: "switchTab", tab: 1 }, questions);
    expect(next.activeTab).toBe(1);
    expect(next.optionCursor).toBe(0);
    expect(next.reviewCursor).toBe(0);
  });

  it("switchTab does not mutate original state", () => {
    const state = initState(questions);
    const next = reduce(state, { type: "switchTab", tab: 1 }, questions);
    expect(state.activeTab).toBe(0);
    expect(next.activeTab).toBe(1);
  });

  it("moveCursor up decrements optionCursor", () => {
    const state = { ...initState(questions), optionCursor: 1 };
    const next = reduce(
      state,
      { type: "moveCursor", direction: "up" },
      questions,
    );
    expect(next.optionCursor).toBe(0);
  });

  it("moveCursor down increments optionCursor", () => {
    const state = initState(questions);
    const next = reduce(
      state,
      { type: "moveCursor", direction: "down" },
      questions,
    );
    expect(next.optionCursor).toBe(1);
  });

  it("moveCursor clamps at bounds", () => {
    const state = initState(questions);
    const next = reduce(
      state,
      { type: "moveCursor", direction: "up" },
      questions,
    );
    expect(next.optionCursor).toBe(0);
  });

  it("moveCursor on review tab moves reviewCursor", () => {
    const state = { ...initState(questions), activeTab: questions.length };
    const next = reduce(
      state,
      { type: "moveCursor", direction: "down" },
      questions,
    );
    expect(next.reviewCursor).toBe(1);
  });

  it("selectOption records answer and advances", () => {
    const state = initState(questions);
    const next = reduce(
      state,
      {
        type: "selectOption",
        questionId: "scope",
        value: "small",
        label: "Small",
      },
      questions,
    );
    const answer = next.answers.get("scope");
    expect(answer?.type).toBe("single-choice");
    expect(next.activeTab).toBe(1); // advanced to next unanswered
  });

  it("toggleCheckbox adds value and syncs answer", () => {
    const state = initState(questions);
    const next = reduce(
      state,
      { type: "toggleCheckbox", questionId: "features", value: "log" },
      questions,
    );
    expect(next.multiChecked.get("features")?.has("log")).toBe(true);
    expect(next.multiChecked.get("features")?.has("auth")).toBe(true); // from recommendation
    const answer = next.answers.get("features");
    expect(answer?.type).toBe("multi-choice");
    if (answer?.type === "multi-choice") {
      expect(answer.selected).toHaveLength(2);
    }
  });

  it("toggleCheckbox removes value when already checked", () => {
    const state = initState(questions);
    const next = reduce(
      state,
      { type: "toggleCheckbox", questionId: "features", value: "auth" },
      questions,
    );
    expect(next.multiChecked.get("features")?.has("auth")).toBe(false);
    // No selections left — answer should be removed
    expect(next.answers.has("features")).toBe(false);
  });

  it("submitText records text answer", () => {
    const state = initState(questions);
    const next = reduce(
      state,
      { type: "submitText", questionId: "notes", value: "my notes" },
      questions,
    );
    expect(next.textValues.get("notes")).toBe("my notes");
    const answer = next.answers.get("notes");
    expect(answer?.type).toBe("text");
    if (answer?.type === "text") {
      expect(answer.value).toBe("my notes");
    }
  });

  it("resetCursors zeros both cursors", () => {
    const state = {
      ...initState(questions),
      optionCursor: 3,
      reviewCursor: 2,
    };
    const next = reduce(state, { type: "resetCursors" }, questions);
    expect(next.optionCursor).toBe(0);
    expect(next.reviewCursor).toBe(0);
  });

  it("moveCursor down clamps at last option", () => {
    const state = { ...initState(questions), optionCursor: 1 };
    // scope has 2 options, so max index is 1
    const next = reduce(
      state,
      { type: "moveCursor", direction: "down" },
      questions,
    );
    expect(next.optionCursor).toBe(1);
  });

  it("moveCursor on review tab clamps reviewCursor at 0", () => {
    const state = { ...initState(questions), activeTab: questions.length };
    const next = reduce(
      state,
      { type: "moveCursor", direction: "up" },
      questions,
    );
    expect(next.reviewCursor).toBe(0);
  });

  it("moveCursor on review tab clamps at last question", () => {
    const state = {
      ...initState(questions),
      activeTab: questions.length,
      reviewCursor: questions.length - 1,
    };
    const next = reduce(
      state,
      { type: "moveCursor", direction: "down" },
      questions,
    );
    expect(next.reviewCursor).toBe(questions.length - 1);
  });

  it("selectOption advances to review when all answered", () => {
    const state = initState(questions);
    state.answers.set("features", {
      type: "multi-choice",
      questionId: "features",
      selected: [{ value: "auth", label: "Auth" }],
    });
    state.answers.set("notes", {
      type: "text",
      questionId: "notes",
      value: "ok",
    });
    const next = reduce(
      state,
      {
        type: "selectOption",
        questionId: "scope",
        value: "small",
        label: "Small",
      },
      questions,
    );
    expect(next.activeTab).toBe(questions.length); // review tab
  });

  it("selectOption resets cursors after advancing", () => {
    const state = { ...initState(questions), optionCursor: 1 };
    const next = reduce(
      state,
      {
        type: "selectOption",
        questionId: "scope",
        value: "small",
        label: "Small",
      },
      questions,
    );
    expect(next.optionCursor).toBe(0);
    expect(next.reviewCursor).toBe(0);
  });

  it("toggleCheckbox with multiple selections preserves question order", () => {
    const state = initState(questions);
    let next = reduce(
      state,
      { type: "toggleCheckbox", questionId: "features", value: "log" },
      questions,
    );
    const answer = next.answers.get("features");
    if (answer?.type === "multi-choice") {
      // auth (from recommendation) comes before log in options array
      expect(answer.selected[0].value).toBe("auth");
      expect(answer.selected[1].value).toBe("log");
    }
  });

  it("submitText overwrites previous text value", () => {
    const state = initState(questions);
    let next = reduce(
      state,
      { type: "submitText", questionId: "notes", value: "first" },
      questions,
    );
    next = reduce(
      next,
      { type: "submitText", questionId: "notes", value: "second" },
      questions,
    );
    expect(next.textValues.get("notes")).toBe("second");
  });

  it("moveCursor ignores text questions", () => {
    const state = { ...initState(questions), activeTab: 2 }; // text tab
    const next = reduce(
      state,
      { type: "moveCursor", direction: "down" },
      questions,
    );
    expect(next.optionCursor).toBe(0); // unchanged
  });
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm test -- tests/tui/state.test.ts`
Expected: PASS (all tests green)

- [ ] **Step 4: Commit**

```bash
git add src/tui/state.ts tests/tui/state.test.ts
git commit -m "feat: add reduce function with full test coverage"
```

---

### Task 15: Write input.ts and input.test.ts

**Files:**

- Create: `src/tui/input.ts`
- Create: `tests/tui/input.test.ts`

- [ ] **Step 1: Write `src/tui/input.ts`**

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

  // Global Esc (non-text questions)
  if (q?.type !== "text" && matchesKey(data, Key.escape)) {
    return { type: "finalize", cancelled: true };
  }

  // Tab navigation (always intercepted)
  if (matchesKey(data, Key.tab)) {
    return action({
      type: "switchTab",
      tab: (state.activeTab + 1) % totalTabs,
    });
  }
  if (matchesKey(data, Key.shift("tab"))) {
    return action({
      type: "switchTab",
      tab: (state.activeTab - 1 + totalTabs) % totalTabs,
    });
  }

  // Left/Right navigate tabs (non-text questions only)
  if (q?.type !== "text") {
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
      return { type: "none" }; // confirm (no-op, answer already synced)
    }
    return { type: "none" };
  }

  // Text
  if (q.type === "text") {
    if (matchesKey(data, Key.escape)) {
      return { type: "finalize", cancelled: true };
    }
    return { type: "forward-to-editor" };
  }

  return { type: "none" };
}
```

- [ ] **Step 2: Write `tests/tui/input.test.ts`**

This file tests `mapInput` using pi-tui's actual `Key` constants. Since `matchesKey` compares raw terminal data against key identifiers, we use `Key` values as mock data — the implementation detail of how pi-tui encodes keys. For reliable tests, import and use `Key` to build expected actions.

```ts
import { describe, expect, it, vi } from "vitest";
import { Key } from "@earendil-works/pi-tui";
import type { NormalizedQuestion } from "../../src/core/types.ts";
import { initState } from "../../src/tui/state.ts";
import { mapInput } from "../../src/tui/input.ts";

const questions: NormalizedQuestion[] = [
  {
    type: "single-choice",
    id: "scope",
    header: "Scope",
    prompt: "Pick scope",
    options: [
      { value: "small", label: "Small" },
      { value: "large", label: "Large" },
    ],
    recommendation: null,
  },
  {
    type: "multi-choice",
    id: "features",
    header: "Features",
    prompt: "Pick features",
    options: [
      { value: "auth", label: "Auth" },
      { value: "log", label: "Logging" },
    ],
    recommendation: [],
  },
  {
    type: "text",
    id: "notes",
    header: "Notes",
    prompt: "Any notes?",
    recommendation: null,
  },
];

describe("mapInput", () => {
  it("Esc on non-text question returns finalize cancelled", () => {
    const state = initState(questions);
    const result = mapInput("\x1b", state, questions);
    expect(result).toEqual({ type: "finalize", cancelled: true });
  });

  it("Tab returns switchTab to next", () => {
    const state = initState(questions);
    const result = mapInput("\t", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action.type).toBe("switchTab");
      if (result.action.type === "switchTab") {
        expect(result.action.tab).toBe(1);
      }
    }
  });

  it("Up on single-choice returns moveCursor up", () => {
    const state = { ...initState(questions), optionCursor: 1 };
    const result = mapInput("\x1b[A", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action).toEqual({ type: "moveCursor", direction: "up" });
    }
  });

  it("Space on single-choice returns selectOption", () => {
    const state = initState(questions);
    const result = mapInput(" ", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action.type).toBe("selectOption");
    }
  });

  it("Space on multi-choice returns toggleCheckbox", () => {
    const state = { ...initState(questions), activeTab: 1 };
    const result = mapInput(" ", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action.type).toBe("toggleCheckbox");
    }
  });

  it("text question forwards non-nav keys to editor", () => {
    const state = { ...initState(questions), activeTab: 2 };
    const result = mapInput("a", state, questions);
    expect(result).toEqual({ type: "forward-to-editor" });
  });

  it("Esc on text question returns finalize cancelled", () => {
    const state = { ...initState(questions), activeTab: 2 };
    const result = mapInput("\x1b", state, questions);
    expect(result).toEqual({ type: "finalize", cancelled: true });
  });

  it("Enter on review with all answered returns finalize submitted", () => {
    const state = { ...initState(questions), activeTab: questions.length };
    state.answers.set("scope", {
      type: "single-choice",
      questionId: "scope",
      value: "small",
      label: "Small",
    });
    state.answers.set("features", {
      type: "multi-choice",
      questionId: "features",
      selected: [{ value: "auth", label: "Auth" }],
    });
    state.answers.set("notes", {
      type: "text",
      questionId: "notes",
      value: "ok",
    });
    const result = mapInput("\r", state, questions);
    expect(result).toEqual({ type: "finalize", cancelled: false });
  });

  it("Space on review navigates to question tab", () => {
    const state = {
      ...initState(questions),
      activeTab: questions.length,
      reviewCursor: 1,
    };
    const result = mapInput(" ", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action).toEqual({ type: "switchTab", tab: 1 });
    }
  });

  it("Down on single-choice returns moveCursor down", () => {
    const state = initState(questions);
    const result = mapInput("\x1b[B", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action).toEqual({ type: "moveCursor", direction: "down" });
    }
  });

  it("Enter on single-choice returns selectOption", () => {
    const state = initState(questions);
    const result = mapInput("\r", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action.type).toBe("selectOption");
      if (result.action.type === "selectOption") {
        expect(result.action.questionId).toBe("scope");
        expect(result.action.value).toBe("small");
      }
    }
  });

  it("Up on review returns moveCursor up", () => {
    const state = {
      ...initState(questions),
      activeTab: questions.length,
      reviewCursor: 1,
    };
    const result = mapInput("\x1b[A", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action).toEqual({ type: "moveCursor", direction: "up" });
    }
  });

  it("Down on review returns moveCursor down", () => {
    const state = { ...initState(questions), activeTab: questions.length };
    const result = mapInput("\x1b[B", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action).toEqual({ type: "moveCursor", direction: "down" });
    }
  });

  it("Enter on review without all answered returns none", () => {
    const state = { ...initState(questions), activeTab: questions.length };
    const result = mapInput("\r", state, questions);
    // Not all answered, so Enter navigates to question at cursor
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action.type).toBe("switchTab");
    }
  });

  it("Up on multi-choice returns moveCursor up", () => {
    const state = { ...initState(questions), activeTab: 1, optionCursor: 1 };
    const result = mapInput("\x1b[A", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action).toEqual({ type: "moveCursor", direction: "up" });
    }
  });

  it("Enter on multi-choice returns none", () => {
    const state = { ...initState(questions), activeTab: 1 };
    const result = mapInput("\r", state, questions);
    expect(result).toEqual({ type: "none" });
  });

  it("Tab on text question still switches tabs", () => {
    const state = { ...initState(questions), activeTab: 2 };
    const result = mapInput("\t", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action.type).toBe("switchTab");
    }
  });

  it("unrecognized key on single-choice returns none", () => {
    const state = initState(questions);
    const result = mapInput("x", state, questions);
    expect(result).toEqual({ type: "none" });
  });
});
```

**Note:** The raw key codes used above (`\x1b`, `\t`, `\x1b[A`, `\x1b[B`, `\r`, `" "`) are standard ANSI terminal sequences. If pi-tui uses a different encoding (e.g., Kitty protocol), run the tests and adjust the raw strings to match what `matchesKey` expects.

- [ ] **Step 3: Run tests**

Run: `pnpm test -- tests/tui/input.test.ts`
Expected: PASS (if raw key codes match pi-tui's expectations). If any tests fail due to key encoding mismatches, adjust the raw strings to match what `matchesKey` expects.

- [ ] **Step 4: Commit**

```bash
git add src/tui/input.ts tests/tui/input.test.ts
git commit -m "feat: add mapInput with tests"
```

---

### Task 16: Write render.ts (assembler) and render.test.ts

**Files:**

- Create: `src/tui/render.ts`
- Create: `tests/tui/render.test.ts`

- [ ] **Step 1: Write `src/tui/render.ts`**

```ts
import type { NormalizedQuestion } from "../core/types.ts";
import type { RenderTheme } from "./theme.ts";
import {
  type QuestionnaireState,
  answeredIds,
  currentQuestion,
  getSelectedValue,
  allAnswered,
} from "./state.ts";
import { renderTabBar } from "./render-tabs.ts";
import {
  renderSingleChoiceQuestion,
  renderMultiChoiceQuestion,
  renderTextQuestion,
} from "./render-question.ts";
import { renderReviewScreen } from "./render-review.ts";
import { pushWrapped } from "./helpers.ts";

export function renderQuestionnaire(
  state: QuestionnaireState,
  questions: NormalizedQuestion[],
  editorLines: string[],
  theme: RenderTheme,
  width: number,
): string[] {
  const lines: string[] = [];
  const renderWidth = Math.max(1, width);
  const reviewTabIndex = questions.length;

  lines.push(theme.fg("accent", "\u2500".repeat(renderWidth)));

  // Tab bar
  lines.push(
    ...renderTabBar(
      questions,
      state.activeTab,
      answeredIds(state),
      theme,
      renderWidth,
    ),
  );

  // Content
  if (state.activeTab === reviewTabIndex) {
    lines.push(
      ...renderReviewScreen(
        questions,
        state.answers,
        state.reviewCursor,
        theme,
        renderWidth,
      ),
    );
  } else {
    const q = currentQuestion(state, questions);
    if (q) {
      switch (q.type) {
        case "single-choice":
          lines.push(
            ...renderSingleChoiceQuestion(
              q,
              state.optionCursor,
              getSelectedValue(state, q.id),
              theme,
              renderWidth,
            ),
          );
          break;
        case "multi-choice": {
          const checked = state.multiChecked.get(q.id) ?? new Set();
          lines.push(
            ...renderMultiChoiceQuestion(
              q,
              state.optionCursor,
              checked,
              theme,
              renderWidth,
            ),
          );
          break;
        }
        case "text":
          lines.push(...renderTextQuestion(q, editorLines, theme, renderWidth));
          break;
      }
    }
  }

  // Hint bar (non-text questions only)
  const q = currentQuestion(state, questions);
  if (q?.type !== "text") {
    lines.push("");
    const hint =
      state.activeTab === reviewTabIndex
        ? "Tab navigate | Enter submit | Space edit | Esc cancel"
        : q?.type === "multi-choice"
          ? "Tab navigate | Up/Down move | Space toggle | Esc cancel"
          : "Tab navigate | Up/Down move | Space/Enter select | Esc cancel";
    pushWrapped(lines, theme.fg("dim", hint), renderWidth);
  }

  lines.push(theme.fg("accent", "\u2500".repeat(renderWidth)));

  return lines;
}
```

- [ ] **Step 2: Write `tests/tui/render.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type { NormalizedQuestion } from "../../src/core/types.ts";
import { initState } from "../../src/tui/state.ts";
import { renderQuestionnaire } from "../../src/tui/render.ts";
import { noopTheme } from "../helpers/theme.ts";

const questions: NormalizedQuestion[] = [
  {
    type: "single-choice",
    id: "scope",
    header: "Scope",
    prompt: "Pick scope",
    options: [
      { value: "small", label: "Small" },
      { value: "large", label: "Large" },
    ],
    recommendation: null,
  },
  {
    type: "text",
    id: "notes",
    header: "Notes",
    prompt: "Any notes?",
    recommendation: null,
  },
];

describe("renderQuestionnaire", () => {
  it("renders tab bar and question content for single-choice", () => {
    const state = initState(questions);
    const lines = renderQuestionnaire(state, questions, [], noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("Scope");
    expect(text).toContain("Pick scope");
    expect(text).toContain("Small");
    expect(text).toContain("Review");
  });

  it("renders text question with editor lines", () => {
    const state = { ...initState(questions), activeTab: 1 };
    const editorLines = ["| my text |"];
    const lines = renderQuestionnaire(
      state,
      questions,
      editorLines,
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain("Any notes?");
    expect(text).toContain("| my text |");
  });

  it("renders review screen when on review tab", () => {
    const state = { ...initState(questions), activeTab: questions.length };
    const lines = renderQuestionnaire(state, questions, [], noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("Review answers");
    expect(text).toContain("(unanswered)");
  });

  it("includes hint bar for non-text questions", () => {
    const state = initState(questions);
    const lines = renderQuestionnaire(state, questions, [], noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("Space/Enter select");
  });

  it("does not include choice hint bar for text questions", () => {
    const state = { ...initState(questions), activeTab: 1 };
    const lines = renderQuestionnaire(state, questions, [], noopTheme, 80);
    const text = lines.join("\n");
    expect(text).not.toContain("Space/Enter select");
  });

  it("shows separator lines at top and bottom", () => {
    const state = initState(questions);
    const lines = renderQuestionnaire(state, questions, [], noopTheme, 80);
    expect(lines[0]).toContain("\u2500");
    expect(lines[lines.length - 1]).toContain("\u2500");
  });
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm test -- tests/tui/render.test.ts`
Expected: PASS (all tests green)

- [ ] **Step 4: Commit**

```bash
git add src/tui/render.ts tests/tui/render.test.ts
git commit -m "feat: add renderQuestionnaire assembler with tests"
```

---

### Task 17: Rewrite questionnaire-ui.ts as thin adapter

**Files:**

- Rewrite: `src/tui/questionnaire-ui.ts`

- [ ] **Step 1: Rewrite `src/tui/questionnaire-ui.ts`**

```ts
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Editor, type EditorTheme } from "@earendil-works/pi-tui";
import type { NormalizedQuestion, QuestionnaireResult } from "../core/types.ts";
import { initState, reduce, buildResult, currentQuestion } from "./state.ts";
import { mapInput } from "./input.ts";
import { renderQuestionnaire } from "./render.ts";

export async function runQuestionnaireUI(
  ctx: Pick<ExtensionContext, "ui">,
  questions: NormalizedQuestion[],
): Promise<QuestionnaireResult> {
  return ctx.ui.custom<QuestionnaireResult>((tui, theme, _kb, done) => {
    let state = initState(questions);

    const editorTheme: EditorTheme = {
      borderColor: (s) => theme.fg("accent", s),
      selectList: {
        selectedPrefix: (t) => theme.fg("accent", t),
        selectedText: (t) => theme.fg("accent", t),
        description: (t) => theme.fg("muted", t),
        scrollInfo: (t) => theme.fg("dim", t),
        noMatch: (t) => theme.fg("warning", t),
      },
    };
    const editor = new Editor(tui, editorTheme);

    editor.onSubmit = (value) => {
      const q = currentQuestion(state, questions);
      if (q?.type !== "text") return;
      state = reduce(
        state,
        { type: "submitText", questionId: q.id, value: value.trim() },
        questions,
      );
      tui.requestRender();
    };

    function handleInput(data: string) {
      const result = mapInput(data, state, questions);
      switch (result.type) {
        case "action":
          state = reduce(state, result.action, questions);
          // Sync editor text when switching to a text tab
          {
            const q = currentQuestion(state, questions);
            if (q?.type === "text") {
              editor.setText(state.textValues.get(q.id) ?? "");
            }
          }
          tui.requestRender();
          break;
        case "finalize":
          done(buildResult(state, questions, result.cancelled));
          break;
        case "forward-to-editor":
          editor.handleInput(data);
          tui.requestRender();
          break;
        case "none":
          break;
      }
    }

    function render(width: number): string[] {
      const q = currentQuestion(state, questions);
      const editorLines =
        q?.type === "text" ? editor.render(Math.max(1, width - 2)) : [];
      return renderQuestionnaire(state, questions, editorLines, theme, width);
    }

    return {
      render,
      invalidate: () => {},
      handleInput,
    };
  });
}
```

- [ ] **Step 2: Run full check**

Run: `pnpm check`
Expected: PASS (all tests green)

- [ ] **Step 3: Verify line count**

Run: `wc -l src/tui/questionnaire-ui.ts`
Expected: Under 70 lines (the adapter plus imports and formatting)

- [ ] **Step 4: Commit**

```bash
git add src/tui/questionnaire-ui.ts
git commit -m "refactor: rewrite questionnaire-ui as thin adapter over state machine"
```

---

### Task 18: Final verification

- [ ] **Step 1: Run full check**

Run: `pnpm check`
Expected: PASS (biome lint + typecheck + all tests)

- [ ] **Step 2: Verify test count meets spec requirement (60+ state machine tests)**

Run: `pnpm test`
Expected: 52 original + 4 process + ~43 state + ~18 input + ~6 render = ~123 total tests. State machine tests alone (state + input + render) should be 60+.

- [ ] **Step 3: Verify no type assertions introduced**

Run: `grep -rn "as any\|as [A-Z]" src/tui/state.ts src/tui/input.ts src/tui/render.ts src/tui/questionnaire-ui.ts`
Expected: No output (zero type assertions)

- [ ] **Step 4: Verify questionnaire-ui.ts line count**

Run: `wc -l src/tui/questionnaire-ui.ts`
Expected: Under 70 lines

- [ ] **Step 5: Run pack dry-run**

Run: `pnpm pack --dry-run`
Expected: Lists all source files including new `state.ts`, `input.ts`, `render.ts`, `theme.ts`

- [ ] **Step 6: Review git log**

Run: `git log --oneline -20`
Verify clean atomic commits for each task.
