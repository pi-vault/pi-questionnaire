# Phase 13: Per-Question Notes via Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-question notes accessible via Tab key: `notes` state, `enterNotes`/`submitNotes`/`cancelNotes` actions, notes editor in the UI adapter, `[n]` indicator in tab bar and review screen, and updated hint bars per the spec.

**Spec:** `docs/specs/2026-06-21-questionnaire-refactor-design.md` (sections 2–4)

**Prerequisite:** Phase 12 complete (all sentinels working). Verified: `pnpm check` passes (166 tests).

**Verification:** After each task, run the relevant test file. After completing all tasks, run `pnpm check` (lint + typecheck + tests). All must pass before the final commit.

---

## File Map

| File | Responsibility | Tasks |
|---|---|---|
| `src/tui/state.ts` | Notes state, actions, reducer, `hasSelection`, `buildResult` | 1 |
| `tests/tui/state.test.ts` | State unit tests | 1 |
| `src/tui/input.ts` | Notes mode key routing, Tab key handler | 2 |
| `tests/tui/input.test.ts` | Input mapping unit tests | 2 |
| `src/tui/render-tabs.ts` | `[n]` marker on tabs with notes | 3 |
| `tests/tui/render-tabs.test.ts` | Tab bar rendering tests | 3 |
| `src/tui/render-review.ts` | `[n]` marker on review rows with notes | 3 |
| `tests/tui/render-review.test.ts` | Review screen rendering tests | 3 |
| `src/tui/render.ts` | Notes editor display, updated hint bars | 3 |
| `tests/tui/render.test.ts` | Full questionnaire rendering tests | 3 |
| `src/tui/questionnaire-ui.ts` | Second Editor instance, Up/Down intercept, forwarding | 4 |

---

### Task 1: Add Notes State, Actions, and Reducer

**Files:**

- Modify: `src/tui/state.ts`
- Test: `tests/tui/state.test.ts`

- [ ] **Step 1: Write failing tests for `hasSelection`, notes actions, and `buildResult` with notes**

Append these tests to the end of `tests/tui/state.test.ts`:

```ts
describe("hasSelection", () => {
  it("returns false when question has no answer", () => {
    const state = initState(questions);
    expect(hasSelection(state, "scope")).toBe(false);
  });

  it("returns true when question has an answer", () => {
    const state = initState(questions);
    state.answers.set("scope", { kind: "option", value: "small", label: "Small" });
    expect(hasSelection(state, "scope")).toBe(true);
  });
});

describe("notes actions", () => {
  it("enterNotes sets inputMode to notes and editingQuestionId", () => {
    const state = initState(questions);
    const next = reduce(
      state,
      { type: "enterNotes", questionId: "scope" },
      questions,
    );
    expect(next.inputMode).toBe("notes");
    expect(next.editingQuestionId).toBe("scope");
  });

  it("submitNotes stores trimmed note and returns to navigate", () => {
    const state = initState(questions);
    state.inputMode = "notes";
    state.editingQuestionId = "scope";
    const next = reduce(
      state,
      { type: "submitNotes", questionId: "scope", value: "  my note  " },
      questions,
    );
    expect(next.notes.get("scope")).toBe("my note");
    expect(next.inputMode).toBe("navigate");
    expect(next.editingQuestionId).toBeNull();
  });

  it("submitNotes with empty string deletes existing note", () => {
    const state = initState(questions);
    state.notes.set("scope", "old note");
    state.inputMode = "notes";
    state.editingQuestionId = "scope";
    const next = reduce(
      state,
      { type: "submitNotes", questionId: "scope", value: "   " },
      questions,
    );
    expect(next.notes.has("scope")).toBe(false);
    expect(next.inputMode).toBe("navigate");
  });

  it("cancelNotes returns to navigate without modifying notes", () => {
    const state = initState(questions);
    state.notes.set("scope", "existing note");
    state.inputMode = "notes";
    state.editingQuestionId = "scope";
    const next = reduce(state, { type: "cancelNotes" }, questions);
    expect(next.inputMode).toBe("navigate");
    expect(next.editingQuestionId).toBeNull();
    expect(next.notes.get("scope")).toBe("existing note");
  });

  it("switchTab resets inputMode when in notes mode", () => {
    const state = initState(questions);
    state.inputMode = "notes";
    state.editingQuestionId = "scope";
    const next = reduce(state, { type: "switchTab", tab: 1 }, questions);
    expect(next.inputMode).toBe("navigate");
    expect(next.editingQuestionId).toBeNull();
  });
});

describe("buildResult with notes", () => {
  it("includes notes in response when present", () => {
    const state = initState(questions);
    state.answers.set("scope", { kind: "option", value: "small", label: "Small" });
    state.notes.set("scope", "important note");
    const result = buildResult(state, questions, false);
    expect(result.responses[0].notes).toBe("important note");
  });

  it("omits notes field when question has no note", () => {
    const state = initState(questions);
    state.answers.set("scope", { kind: "option", value: "small", label: "Small" });
    const result = buildResult(state, questions, false);
    expect(result.responses[0].notes).toBeUndefined();
  });
});
```

Also add `hasSelection` to the import at the top of the test file:

```ts
import {
  advanceToNextTab,
  allAnswered,
  answeredIds,
  buildResult,
  currentQuestion,
  cursorTarget,
  getSelectedValue,
  hasSelection,
  initState,
  reduce,
  visibleRowCount,
} from "../../src/tui/state.ts";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/tui/state.test.ts`
Expected: FAIL — `hasSelection` is not exported, `enterNotes`/`submitNotes`/`cancelNotes` are not in the Action type, `notes` field doesn't exist on state.

- [ ] **Step 3: Add `notes` field to state, `hasSelection` helper, and notes actions**

In `src/tui/state.ts`:

Add `notes` field to `QuestionnaireState` (after `customText`):

```ts
export interface QuestionnaireState {
  activeTab: number;
  optionCursor: number;
  reviewCursor: number;
  answers: Map<string, QuestionSelection>;
  multiChecked: Map<string, Set<string>>;
  inputMode: "navigate" | "typing" | "notes";
  editingQuestionId: string | null;
  customText: Map<string, string>;
  notes: Map<string, string>;
}
```

Add `notes: new Map()` to `initState` return value (after `customText: new Map()`):

```ts
  return {
    activeTab: 0,
    optionCursor: 0,
    reviewCursor: 0,
    answers: new Map(),
    multiChecked,
    inputMode: "navigate",
    editingQuestionId: null,
    customText: new Map(),
    notes: new Map(),
  };
```

Add `notes: new Map(state.notes)` to `cloneState` (after `customText`):

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
    inputMode: state.inputMode,
    editingQuestionId: state.editingQuestionId,
    customText: new Map(state.customText),
    notes: new Map(state.notes),
  };
}
```

Add `hasSelection` helper (after `getSelectedValue`):

```ts
export function hasSelection(
  state: QuestionnaireState,
  questionId: string,
): boolean {
  return state.answers.has(questionId);
}
```

Add notes actions to the `Action` type (after the `confirmMulti` variant):

```ts
export type Action =
  | { type: "switchTab"; tab: number }
  | { type: "moveCursor"; direction: "up" | "down" }
  | { type: "selectOption"; questionId: string; value: string; label: string }
  | { type: "toggleCheckbox"; questionId: string; value: string }
  | { type: "resetCursors" }
  | { type: "enterTyping"; questionId: string }
  | { type: "submitTyping"; questionId: string; value: string }
  | { type: "cancelTyping" }
  | { type: "selectChat"; questionId: string }
  | { type: "confirmMulti"; questionId: string }
  | { type: "enterNotes"; questionId: string }
  | { type: "submitNotes"; questionId: string; value: string }
  | { type: "cancelNotes" };
```

Add reducer cases inside the `switch` in `reduce`, before the closing `}` of the switch:

```ts
    case "enterNotes": {
      next.inputMode = "notes";
      next.editingQuestionId = action.questionId;
      return next;
    }
    case "submitNotes": {
      const trimmed = action.value.trim();
      if (trimmed) {
        next.notes.set(action.questionId, trimmed);
      } else {
        next.notes.delete(action.questionId);
      }
      next.inputMode = "navigate";
      next.editingQuestionId = null;
      return next;
    }
    case "cancelNotes": {
      next.inputMode = "navigate";
      next.editingQuestionId = null;
      return next;
    }
```

Update `buildResult` to include notes in responses:

```ts
export function buildResult(
  state: QuestionnaireState,
  questions: NormalizedQuestion[],
  cancelled: boolean,
): QuestionnaireResult {
  const responses: QuestionResponse[] = questions
    .map((q) => {
      const selection = state.answers.get(q.id);
      if (!selection) return undefined;
      const notes = state.notes.get(q.id);
      const response: QuestionResponse = { questionId: q.id, selection };
      if (notes) response.notes = notes;
      return response;
    })
    .filter((r): r is QuestionResponse => r !== undefined);
  return { questions, responses, cancelled };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/tui/state.test.ts`
Expected: PASS (all 67+ tests)

- [ ] **Step 5: Commit**

```bash
git add src/tui/state.ts tests/tui/state.test.ts
git commit -m "feat: add notes state, hasSelection, actions, and reducer cases"
```

---

### Task 2: Update Input Mapping for Notes Mode and Tab Key

**Files:**

- Modify: `src/tui/input.ts`
- Test: `tests/tui/input.test.ts`

- [ ] **Step 1: Write failing tests for notes mode routing and Tab key**

Append these tests to the end of the `describe("mapInput", ...)` block in `tests/tui/input.test.ts`:

```ts
  it("Esc in notes mode returns cancelNotes", () => {
    const state = {
      ...initState(questions),
      inputMode: "notes" as const,
      editingQuestionId: "scope",
    };
    const result = mapInput("\x1b", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action).toEqual({ type: "cancelNotes" });
    }
  });

  it("Enter in notes mode returns forward-to-notes-editor", () => {
    const state = {
      ...initState(questions),
      inputMode: "notes" as const,
      editingQuestionId: "scope",
    };
    const result = mapInput("\r", state, questions);
    expect(result).toEqual({ type: "forward-to-notes-editor" });
  });

  it("character keys in notes mode return forward-to-notes-editor", () => {
    const state = {
      ...initState(questions),
      inputMode: "notes" as const,
      editingQuestionId: "scope",
    };
    const result = mapInput("a", state, questions);
    expect(result).toEqual({ type: "forward-to-notes-editor" });
  });

  it("Up in notes mode returns forward-to-notes-editor", () => {
    const state = {
      ...initState(questions),
      inputMode: "notes" as const,
      editingQuestionId: "scope",
    };
    const result = mapInput("\x1b[A", state, questions);
    expect(result).toEqual({ type: "forward-to-notes-editor" });
  });

  it("Tab on answered question returns enterNotes", () => {
    const state = initState(questions);
    state.answers.set("scope", {
      kind: "option",
      value: "small",
      label: "Small",
    });
    const result = mapInput("\t", state, questions);
    expect(result.type).toBe("action");
    if (result.type === "action") {
      expect(result.action).toEqual({
        type: "enterNotes",
        questionId: "scope",
      });
    }
  });

  it("Tab on unanswered question returns none", () => {
    const state = initState(questions);
    const result = mapInput("\t", state, questions);
    expect(result).toEqual({ type: "none" });
  });

  it("Tab on review tab returns none", () => {
    const state = {
      ...initState(questions),
      activeTab: questions.length,
    };
    const result = mapInput("\t", state, questions);
    expect(result).toEqual({ type: "none" });
  });
```

No import changes needed in the test file — it only imports `initState` from state, and the tests exercise `hasSelection` indirectly via `mapInput`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/tui/input.test.ts`
Expected: FAIL — `forward-to-notes-editor` is not in the `InputResult` type, notes mode handling doesn't exist, Tab key is unhandled.

- [ ] **Step 3: Add notes mode routing and Tab key handling**

In `src/tui/input.ts`:

Add `hasSelection` to the import from state:

```ts
import {
  type Action,
  type QuestionnaireState,
  allAnswered,
  currentQuestion,
  cursorTarget,
  hasSelection,
} from "./state.ts";
```

Add `forward-to-notes-editor` variant to `InputResult`:

```ts
export type InputResult =
  | { type: "action"; action: Action }
  | { type: "finalize"; cancelled: boolean }
  | { type: "forward-to-editor" }
  | { type: "forward-to-notes-editor" }
  | { type: "none" };
```

In `mapInput`, add notes mode handling after the typing mode block and before the `// Global Esc` comment. Insert this block between the closing `}` of the typing mode block and the `// Global Esc` line:

```ts
  // Notes mode — forward most keys to the notes editor
  // Up/Down save-and-exit is handled by the UI adapter (needs editor buffer access)
  if (state.inputMode === "notes") {
    if (matchesKey(data, Key.escape)) {
      return action({ type: "cancelNotes" });
    }
    return { type: "forward-to-notes-editor" };
  }
```

Add Tab key handling in navigate mode. Insert after the `// Global Esc` block (after the `return { type: "finalize", cancelled: true };` line) and before the `// Left/Right navigate tabs` comment:

```ts
  // Tab — open notes editor (only if question has a selection)
  if (matchesKey(data, Key.tab)) {
    if (q && hasSelection(state, q.id)) {
      return action({ type: "enterNotes", questionId: q.id });
    }
    return { type: "none" };
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/tui/input.test.ts`
Expected: PASS (all 37+ tests)

- [ ] **Step 5: Commit**

```bash
git add src/tui/input.ts tests/tui/input.test.ts
git commit -m "feat: add notes mode input routing and Tab key handler"
```

---

### Task 3: Update Rendering for Notes

**Files:**

- Modify: `src/tui/render-tabs.ts`
- Modify: `src/tui/render-review.ts`
- Modify: `src/tui/render.ts`
- Test: `tests/tui/render-tabs.test.ts`
- Test: `tests/tui/render-review.test.ts`
- Test: `tests/tui/render.test.ts`

- [ ] **Step 1: Write failing tests for `[n]` marker in tab bar**

In `tests/tui/render-tabs.test.ts`, update the three existing test calls to pass the new `notedIds` parameter. Each call to `renderTabBar` currently takes 5 arguments — add `new Set<string>()` as the 4th argument (after `answeredIds`, before `noopTheme`):

```ts
// In "renders tab labels with answered/unanswered markers":
const lines = renderTabBar(questions, 0, answeredIds, new Set(), noopTheme, 80);

// In "marks answered questions with filled marker":
const lines = renderTabBar(questions, 0, answeredIds, new Set(), noopTheme, 80);

// In "highlights active tab with bg wrapper":
const lines = renderTabBar(questions, 0, answeredIds, new Set(), bgTheme, 80);
```

Then append a new test to the `describe("renderTabBar", ...)` block:

```ts
  it("shows [n] marker for questions with notes", () => {
    const answeredIds = new Set(["scope"]);
    const notedIds = new Set(["scope"]);
    const lines = renderTabBar(questions, 0, answeredIds, notedIds, noopTheme, 80);
    const joined = lines.join("");
    expect(joined).toContain("Scope [n]");
    // Question without note should not have [n]
    expect(joined).not.toContain("Notes [n]");
  });
```

- [ ] **Step 2: Write failing tests for `[n]` marker in review screen**

In `tests/tui/render-review.test.ts`, update the three existing test calls to pass the new `notes` parameter. Each call to `renderReviewScreen` currently takes 5 arguments — add `new Map<string, string>()` as the 3rd argument (after `answers`, before `cursor`):

```ts
// In "shows answered and unanswered rows":
const lines = renderReviewScreen(questions, answers, new Map(), 0, noopTheme, 80);

// In "shows submit prompt when all answered":
const lines = renderReviewScreen(questions, answers, new Map(), 0, noopTheme, 80);

// In "shows warning when not all answered":
const lines = renderReviewScreen(questions, answers, new Map(), 0, noopTheme, 80);
```

Then append a new test to the `describe("renderReviewScreen", ...)` block:

```ts
  it("shows [n] marker for questions with notes", () => {
    const answers = new Map<string, QuestionSelection>([
      ["scope", { kind: "option", value: "small", label: "Small" }],
    ]);
    const notes = new Map([["scope", "my note"]]);
    const lines = renderReviewScreen(questions, answers, notes, 0, noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("[n]");
    // Only the answered-with-note question gets [n]
    expect(text).toContain("Small [n]");
  });
```

- [ ] **Step 3: Write failing tests for notes rendering and hints in `renderQuestionnaire`**

In `tests/tui/render.test.ts`, update the existing test calls to pass the new `notesEditorLines` parameter. Each call to `renderQuestionnaire` currently takes 5 arguments — add `[]` as the 4th argument (after `editorLines []`, before `noopTheme`):

```ts
// In "renders tab bar and question content for single-choice":
const lines = renderQuestionnaire(state, questions, [], [], noopTheme, 80);

// In "renders review screen when on review tab":
const lines = renderQuestionnaire(state, questions, [], [], noopTheme, 80);

// In "shows separator lines at top and bottom":
const lines = renderQuestionnaire(state, questions, [], [], noopTheme, 80);
```

Update the "includes hint bar for choice questions" test to match the spec's new hint text:

```ts
  it("includes hint bar for choice questions", () => {
    const state = initState(questions);
    const lines = renderQuestionnaire(state, questions, [], [], noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("Left/Right tabs");
    expect(text).toContain("Enter confirm");
    expect(text).toContain("Tab notes");
  });
```

Update the "shows typing mode hint bar when inputMode is typing" test to pass the new parameter:

```ts
  it("shows typing mode hint bar when inputMode is typing", () => {
    const state = {
      ...initState(questions),
      inputMode: "typing" as const,
      editingQuestionId: "scope",
    };
    const lines = renderQuestionnaire(state, questions, [], [], noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("Enter submit");
    expect(text).toContain("Esc cancel");
    expect(text).toContain("Up/Down exit");
  });
```

Then append new tests:

```ts
  it("shows notes mode hint bar when inputMode is notes", () => {
    const state = {
      ...initState(questions),
      inputMode: "notes" as const,
      editingQuestionId: "scope",
    };
    const lines = renderQuestionnaire(state, questions, [], [], noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("Enter save");
    expect(text).toContain("Esc discard");
  });

  it("renders notes editor below question content in notes mode", () => {
    const state = {
      ...initState(questions),
      inputMode: "notes" as const,
      editingQuestionId: "scope",
    };
    const notesEditorLines = ["my note text"];
    const lines = renderQuestionnaire(
      state,
      questions,
      [],
      notesEditorLines,
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain("Note for this question:");
    expect(text).toContain("my note text");
  });
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/tui/render-tabs.test.ts tests/tui/render-review.test.ts tests/tui/render.test.ts`
Expected: FAIL — function signatures don't match, `[n]` rendering missing, hint text changed.

- [ ] **Step 5: Update `renderTabBar` to accept `notedIds` and show `[n]`**

In `src/tui/render-tabs.ts`, add `notedIds` parameter and `[n]` suffix:

```ts
export function renderTabBar(
  questions: NormalizedQuestion[],
  activeTab: number,
  answeredIds: Set<string>,
  notedIds: Set<string>,
  theme: RenderTheme,
  _width: number,
): string[] {
  const reviewTabIndex = questions.length;
  const allAnswered = questions.every((q) => answeredIds.has(q.id));

  const tabs: string[] = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const answered = answeredIds.has(q.id);
    const marker = answered ? "\u25A0" : "\u25A1";
    const noteSuffix = notedIds.has(q.id) ? " [n]" : "";
    const text = ` ${marker} ${q.header}${noteSuffix} `;
    if (i === activeTab) {
      tabs.push(theme.bg("selectedBg", theme.fg("text", text)));
    } else {
      tabs.push(theme.fg(answered ? "success" : "muted", text));
    }
  }

  const reviewMarker = allAnswered ? "\u2713" : "\u25A1";
  const reviewText = ` ${reviewMarker} Review `;
  if (activeTab === reviewTabIndex) {
    tabs.push(theme.bg("selectedBg", theme.fg("text", reviewText)));
  } else {
    tabs.push(theme.fg(allAnswered ? "success" : "muted", reviewText));
  }

  return [tabs.join(" "), ""];
}
```

- [ ] **Step 6: Update `renderReviewScreen` to accept `notes` and show `[n]`**

In `src/tui/render-review.ts`, add `notes` parameter and `[n]` suffix:

```ts
export function renderReviewScreen(
  questions: NormalizedQuestion[],
  answers: Map<string, QuestionSelection>,
  notes: Map<string, string>,
  cursor: number,
  theme: RenderTheme,
  width: number,
): string[] {
  const lines: string[] = [];
  const allAnswered = questions.every((q) => answers.has(q.id));

  pushWrapped(lines, theme.fg("accent", theme.bold("Review answers")), width);
  lines.push("");

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const selection = answers.get(q.id);
    const isCursor = i === cursor;
    const prefix = isCursor ? theme.fg("accent", "\u25B8 ") : "  ";
    const marker = selection
      ? theme.fg("success", "\u25A0")
      : theme.fg("warning", "\u25A1");
    const noteSuffix = notes.has(q.id) ? " [n]" : "";
    const value = selection
      ? formatAnswerForRender(q, selection) + noteSuffix
      : "(unanswered)";
    const valueColor = selection ? "text" : "muted";

    pushWrappedWithPrefix(
      lines,
      prefix,
      `${marker} ${theme.fg("accent", `${q.header}:`)} ${theme.fg(valueColor, value)}`,
      width,
    );
  }

  lines.push("");
  if (allAnswered) {
    pushWrapped(
      lines,
      theme.fg("success", "Enter submit | Space edit | Esc cancel"),
      width,
    );
  } else {
    pushWrapped(
      lines,
      theme.fg("warning", "Answer all questions before submitting."),
      width,
    );
    pushWrapped(lines, theme.fg("dim", "Space edit | Esc cancel"), width);
  }

  return lines;
}
```

- [ ] **Step 7: Update `renderQuestionnaire` for notes editor, hint bars, and new params**

In `src/tui/render.ts`, make these changes:

Add `notesEditorLines` parameter to the function signature:

```ts
export function renderQuestionnaire(
  state: QuestionnaireState,
  questions: NormalizedQuestion[],
  editorLines: string[],
  notesEditorLines: string[],
  theme: RenderTheme,
  width: number,
): string[] {
```

Update the `renderTabBar` call to pass `notedIds`:

```ts
  // Tab bar
  const notedIds = new Set(state.notes.keys());
  lines.push(
    ...renderTabBar(
      questions,
      state.activeTab,
      answeredIds(state),
      notedIds,
      theme,
      renderWidth,
    ),
  );
```

Update the `renderReviewScreen` call to pass `state.notes`:

```ts
  // Content
  if (state.activeTab === reviewTabIndex) {
    lines.push(
      ...renderReviewScreen(
        questions,
        state.answers,
        state.notes,
        state.reviewCursor,
        theme,
        renderWidth,
      ),
    );
```

Add notes editor rendering after the content block (after the closing `}` of the `} else if (q) {` block) and before the `// Hint bar` comment:

```ts
  // Notes editor (when in notes mode)
  if (state.inputMode === "notes") {
    lines.push("");
    pushWrapped(lines, theme.fg("muted", "Note for this question:"), renderWidth);
    for (const line of notesEditorLines) {
      lines.push(` ${line}`);
    }
  }

  // Hint bar
```

Update the hint bar section to match the spec:

```ts
  // Hint bar
  lines.push("");
  let hint: string;
  if (state.inputMode === "typing") {
    hint = "Enter submit | Esc cancel | Up/Down exit";
  } else if (state.inputMode === "notes") {
    hint = "Enter save | Esc discard";
  } else if (state.activeTab === reviewTabIndex) {
    hint = "Left/Right tabs | Up/Down select | Enter submit | Esc cancel";
  } else if (q?.type === "multi-choice") {
    hint =
      "Left/Right tabs | Up/Down select | Space toggle | Tab notes | Esc cancel";
  } else {
    hint =
      "Left/Right tabs | Up/Down select | Enter confirm | Tab notes | Esc cancel";
  }
  pushWrapped(lines, theme.fg("dim", hint), renderWidth);
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/tui/render-tabs.test.ts tests/tui/render-review.test.ts tests/tui/render.test.ts`
Expected: PASS (all rendering tests)

- [ ] **Step 9: Commit**

```bash
git add src/tui/render-tabs.ts src/tui/render-review.ts src/tui/render.ts tests/tui/render-tabs.test.ts tests/tui/render-review.test.ts tests/tui/render.test.ts
git commit -m "feat: add [n] notes indicator and notes editor rendering"
```

---

### Task 4: Update UI Adapter for Notes Editor

**Files:**

- Modify: `src/tui/questionnaire-ui.ts`

This file orchestrates the TUI with `Editor` instances. It cannot be unit-tested (depends on the live `pi-tui` runtime), so we verify via typecheck and the full test suite.

- [ ] **Step 1: Add notes editor and update `handleInput` and `render`**

Replace the entire contents of `src/tui/questionnaire-ui.ts` with:

```ts
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Editor, type EditorTheme, Key, matchesKey } from "@earendil-works/pi-tui";
import type { NormalizedQuestion, QuestionnaireResult } from "../core/types.ts";
import { initState, reduce, buildResult } from "./state.ts";
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
    const notesEditor = new Editor(tui, editorTheme);

    editor.onSubmit = (value) => {
      if (state.inputMode === "typing" && state.editingQuestionId) {
        state = reduce(
          state,
          {
            type: "submitTyping",
            questionId: state.editingQuestionId,
            value: value.trim(),
          },
          questions,
        );
        editor.setText("");
        tui.requestRender();
      }
    };

    notesEditor.onSubmit = (value) => {
      if (state.inputMode === "notes" && state.editingQuestionId) {
        state = reduce(
          state,
          {
            type: "submitNotes",
            questionId: state.editingQuestionId,
            value: value.trim(),
          },
          questions,
        );
        notesEditor.setText("");
        tui.requestRender();
      }
    };

    function handleInput(data: string) {
      // Notes mode: intercept Up/Down to save-and-exit before mapInput
      // (mapInput is pure and cannot access the editor buffer)
      if (state.inputMode === "notes" && state.editingQuestionId) {
        if (matchesKey(data, Key.up) || matchesKey(data, Key.down)) {
          const notesValue = notesEditor.getText();
          state = reduce(
            state,
            {
              type: "submitNotes",
              questionId: state.editingQuestionId,
              value: notesValue.trim(),
            },
            questions,
          );
          state = reduce(
            state,
            {
              type: "moveCursor",
              direction: matchesKey(data, Key.up) ? "up" : "down",
            },
            questions,
          );
          notesEditor.setText("");
          tui.requestRender();
          return;
        }
      }

      const result = mapInput(data, state, questions);
      switch (result.type) {
        case "action":
          state = reduce(state, result.action, questions);
          // Load existing custom text into editor when entering typing mode
          if (state.inputMode === "typing" && state.editingQuestionId) {
            editor.setText(
              state.customText.get(state.editingQuestionId) ?? "",
            );
          }
          // Load existing note into notes editor when entering notes mode
          if (state.inputMode === "notes" && state.editingQuestionId) {
            notesEditor.setText(
              state.notes.get(state.editingQuestionId) ?? "",
            );
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
        case "forward-to-notes-editor":
          notesEditor.handleInput(data);
          tui.requestRender();
          break;
        case "none":
          break;
      }
    }

    function render(width: number): string[] {
      const editorLines =
        state.inputMode === "typing"
          ? editor.render(Math.max(1, width - 4))
          : [];
      const notesEditorLines =
        state.inputMode === "notes"
          ? notesEditor.render(Math.max(1, width - 4))
          : [];
      return renderQuestionnaire(
        state,
        questions,
        editorLines,
        notesEditorLines,
        theme,
        width,
      );
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

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && pnpm check`
Expected: PASS — lint clean, typecheck passes, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/tui/questionnaire-ui.ts
git commit -m "feat: add notes editor to UI adapter with save-on-navigate"
```

---

## Final Verification

- [ ] Run `pnpm check` — lint, typecheck, all tests pass
- [ ] Review the full diff (`git diff master...HEAD`) for stale references or dead code
