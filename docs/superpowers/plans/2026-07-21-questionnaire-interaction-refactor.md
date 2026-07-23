# Questionnaire Interaction Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a one-question questionnaire submit its answer immediately, enter custom text as soon as `Type something.` receives focus, and publish its interactive wait status to other Pi extensions.

**Architecture:** Preserve the existing pure interpreter → reducer → UI adapter flow. The reducer owns row topology, wrapped question-row navigation, selections, and notes; the interpreter derives editor effects from the row that receives focus; the UI adapter is the sole completion boundary. `src/index.ts` publishes a producer-owned `pi-vault:questionnaire:status` lifecycle around the actual interactive wait and registers the UI tool as sequential.

**Tech Stack:** TypeScript, Vitest, Biome, `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`.

---

## Behaviour contract

- A single-question questionnaire has no tab bar and no Review screen. Selecting a single-select option, submitting non-empty custom text, choosing chat, or confirming a multi-select response resolves it immediately.
- A one-question multi-select still requires its `Next` row, so toggling a checkbox alone does not resolve the UI.
- `Tab` opens notes even before an answer exists. A saved note is included once that question is answered.
- Question rows wrap: Up from the first row selects the last row; Down from the last row selects the first. Review rows remain clamped.
- Moving onto `Type something.` immediately opens the existing multiline `Editor`, preloaded with the saved custom answer. Moving away discards unsaved editor text. Escape from custom input cancels the questionnaire.
- `allowOther` works for multi-select questions too. Their row order is options → Type something. (when allowed) → chat (when allowed) → Next. A custom answer clears checked options; toggling an option or confirming `Next` replaces the custom answer and clears its cached text. Explicit `Next` with no checks commits `selected: []`, rendered as `(no input)`.
- A valid TUI questionnaire emits `pi-vault:questionnaire:status` with `{ active: true, label: "Waiting for questionnaire response" }` immediately before `runQuestionnaireUI`, then `{ active: false }` from `finally`. Validation and non-TUI early returns emit neither event; the tool is registered with `executionMode: "sequential"`.

## File map

- `src/tui/state.ts` — row layout, wrapping movement, answer transitions, and notes state.
- `src/tui/input.ts` — maps input to state/editor/finalize effects.
- `src/tui/questionnaire-ui.ts` — reduces actions, runs editors, and resolves `ui.custom` exactly once.
- `src/tui/render.ts` — hides single-question tab/review chrome and reports accurate key hints.
- `src/events.ts` — typed public questionnaire-status event contract.
- `src/index.ts` — sequential tool registration and interactive-wait lifecycle.
- `tests/tui/state.test.ts`, `tests/tui/input.test.ts`, `tests/tui/render.test.ts` — pure regressions.
- `tests/tui/questionnaire-ui.test.ts` — adapter completion tests using the existing Pi TUI mocks/patterns; create it if absent.
- `tests/index.test.ts` — tool-level status lifecycle tests using a deferred UI promise.
- `package.json`, `README.md`, `CHANGELOG.md` — public package and behavior description.

## Phase 1 — Notes before an answer

This is independently usable: users can record context before deciding, and the result retains it after they answer.

### Task 1: Remove the answer gate from notes

**Files:**

- Modify: `src/tui/input.ts`
- Modify: `tests/tui/input.test.ts`

- [ ] **Step 1: Replace the existing `Tab on unanswered question returns empty effects` regression with this parameterized positive case.**

```ts
it.each([0, 1])(
  "Tab opens notes for unanswered question tab %i",
  (activeTab) => {
    const question = questions[activeTab]!;
    expect(interpret("\t", ctx(questions, { activeTab }))).toEqual([
      {
        type: "dispatch",
        action: { type: "enterNotes", questionId: question.id },
      },
      { type: "set-notes-editor-text", text: "" },
    ]);
  },
);
```

- [ ] **Step 2: Run the focused test and confirm both cases fail.**

```bash
pnpm exec vitest run tests/tui/input.test.ts
```

Expected: both parameterized cases fail because `interpret` currently checks `state.answers.has(q.id)`.

- [ ] **Step 3: Change the Tab guard in `src/tui/input.ts` from `if (q && state.answers.has(q.id))` to `if (q)`.** Keep the existing `enterNotes` and preload effects unchanged. Do not change `state.ts`, `buildResult`, rendering, public types, or the Tab shortcut: typing and notes modes run before this branch, and Review has no current question.

- [ ] **Step 4: Re-run the focused test, then the complete project check.**

```bash
pnpm exec vitest run tests/tui/input.test.ts
pnpm check
```

Expected: both commands pass; existing answered-note preload and Review no-op regressions remain green.

- [ ] **Step 5: Commit the independent phase.**

```bash
git add src/tui/input.ts tests/tui/input.test.ts
git commit -m "feat(tui): allow notes before answering"
```

## Phase 2 — Questionnaire status event

This is independently usable: any Pi extension can observe a typed questionnaire wait lifecycle without the package naming a specific consumer.

### Task 2: Publish and emit questionnaire status

**Files:**

- Create: `src/events.ts`
- Modify: `src/index.ts`
- Modify: `tests/index.test.ts`
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Build the deferred UI fixture and failing lifecycle regressions.** Capture the registered tool and `events.emit`; make `ui.custom` return a deferred promise instead of constructing the real TUI. Assert `executionMode: "sequential"`, active status before `ui.custom`, inactive status after cancelled resolution and rejection, and no emissions for invalid or non-TUI calls.

```ts
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setupExtension() {
  const registerTool = vi.fn();
  const emit = vi.fn();
  createExtension({ registerTool, events: { emit } } as any);
  return { tool: registerTool.mock.calls[0]![0], emit };
}
```

- [ ] **Step 2: Run the index test and confirm it fails.**

```bash
pnpm exec vitest run tests/index.test.ts
```

Expected: FAIL because no execution mode or status emissions are registered.

- [ ] **Step 3: Add the importable contract and package export.**

```ts
// src/events.ts
export const QUESTIONNAIRE_STATUS_EVENT =
  "pi-vault:questionnaire:status" as const;

export type QuestionnaireStatusEventPayload =
  | { active: true; label: string }
  | { active: false };
```

```json
"exports": {
  ".": "./src/index.ts",
  "./events": "./src/events.ts"
}
```

- [ ] **Step 4: Add the sequential lifecycle.** Import `QUESTIONNAIRE_STATUS_EVENT`, set `executionMode: "sequential"`, and keep all early returns outside this block:

```ts
pi.events.emit(QUESTIONNAIRE_STATUS_EVENT, {
  active: true,
  label: "Waiting for questionnaire response",
});
try {
  const uiResult = await runQuestionnaireUI(ctx, questions);
  return {
    content: [{ type: "text", text: formatContentSummary(uiResult) }],
    details: uiResult,
  };
} finally {
  pi.events.emit(QUESTIONNAIRE_STATUS_EVENT, { active: false });
}
```

Do not add a `try`/`catch` around `emit`: Pi's event bus isolates listener errors.

- [ ] **Step 5: Document and verify the public contract.** Add a README integration example importing `QUESTIONNAIRE_STATUS_EVENT` and `QuestionnaireStatusEventPayload` from `@pi-vault/pi-questionnaire/events`. Then run:

```bash
pnpm exec vitest run tests/index.test.ts
pnpm check
pnpm run pack:dry-run
```

Expected: all commands pass and the archive includes `src/events.ts`.

- [ ] **Step 6: Commit the independent phase.**

```bash
git add package.json src/events.ts src/index.ts tests/index.test.ts README.md
git commit -m "feat: publish questionnaire wait status"
```

## Phase 3 — Single-question fast path

This is independently usable: a one-question prompt completes as soon as the user commits a valid answer, without tabs or a Review detour. The detailed, executable plan is [phase 3: single-question fast path](2026-07-21-questionnaire-interaction-refactor-phase-3-single-question.md) and supersedes the legacy task breakdown below.

The revised plan retains the single-question header after removing the tab bar, uses the real Pi Editor/ui.custom harness from the reference package, centralizes completion after reducer transitions, and leaves recommendation synchronization to phase 5.

### Legacy Task 3 (superseded; do not execute)

**Files:**

- Modify: `src/tui/input.ts`
- Modify: `src/tui/render.ts`
- Modify: `tests/tui/input.test.ts`
- Modify: `tests/tui/render.test.ts`

- [ ] **Step 1: Add interpreter regressions for a one-question fixture.**

```ts
it("does not create tab-navigation effects for one question", () => {
  const one = [questions[0]!];
  expect(interpret("\x1b[C", ctx(one))).toEqual([]);
  expect(interpret("\x1b[D", ctx(one))).toEqual([]);
});

it("finalizes a one-question single-select confirmation", () => {
  const one = [questions[0]!];
  expect(interpret("\r", ctx(one))).toEqual([
    {
      type: "dispatch",
      action: {
        type: "selectOption",
        questionId: "scope",
        value: "small",
        label: "Small",
      },
    },
  ]);
});
```

- [ ] **Step 2: Add rendering regressions.**

```ts
it("hides tabs and review chrome for one question", () => {
  const one = [questions[0]!];
  const text = renderQuestionnaire(
    initState(one),
    one,
    [],
    [],
    noopTheme,
    80,
  ).join("\n");
  expect(text).not.toContain("Review");
  expect(text).not.toContain("Left/Right tabs");
});
```

- [ ] **Step 3: Run the focused tests and confirm the no-tab/render expectations fail.**

```bash
pnpm exec vitest run tests/tui/input.test.ts tests/tui/render.test.ts
```

- [ ] **Step 4: In `input.ts`, derive `const isMultiQuestion = questions.length > 1`.** Use it to set `totalTabs` to `questions.length + 1` only for multi-question sessions. Return `[]` for Left/Right when false; preserve current tab/review handling otherwise.

- [ ] **Step 5: In `render.ts`, conditionally call `renderTabBar` only when `questions.length > 1`.** In every non-editor hint, omit `Left/Right tabs` when false. Do not render a Review screen in a single-question session because the reducer will never move `activeTab` there.

- [ ] **Step 6: Add a UI-adapter completion harness test.** Mock `Editor` with `onSubmit`, `setText`, `getText`, `handleInput`, and `render`, capture the component and `done` callback passed to `ui.custom`, then test these real inputs:

```ts
it("resolves one single-select answer immediately", async () => {
  const ui = createHarness([singleQuestion]);
  ui.component.handleInput("\r");
  expect(ui.done).toHaveBeenCalledWith(
    expect.objectContaining({
      cancelled: false,
      responses: [
        {
          questionId: "scope",
          selection: { kind: "option", value: "small", label: "Small" },
        },
      ],
    }),
  );
});

it("does not resolve an empty custom submission or reuse an old custom answer", () => {
  const ui = createHarness([{ ...singleQuestion, allowOther: true }]);
  ui.component.handleInput("\x1b[B");
  ui.editor.onSubmit("previous");
  ui.component.handleInput("\x1b[A");
  ui.component.handleInput("\x1b[B");
  ui.editor.onSubmit("   ");
  expect(ui.done).toHaveBeenCalledTimes(1);
});
```

The second test must assert after the first successful `previous` submission only if the harness reopens the same one-question UI; alternatively, split it into two harnesses and assert that whitespace yields zero calls. Do not assert that a promise remains unsettled.

- [ ] **Step 7: Add `applyAction` in `src/tui/questionnaire-ui.ts` and use it for every dispatch and editor submission.** It must reduce first, then finalize only when the session has one question and the action commits a valid answer:

```ts
function applyAction(action: Action): boolean {
  state = reduce(state, action, questions);
  const commits =
    action.type === "selectOption" ||
    action.type === "selectChat" ||
    action.type === "confirmMulti" ||
    (action.type === "submitTyping" && action.value.trim().length > 0);

  if (
    questions.length === 1 &&
    commits &&
    state.answers.has(questions[0]!.id)
  ) {
    done(buildResult(state, questions, false));
    return true;
  }
  return false;
}
```

Use `applyAction` from both editor `onSubmit` callbacks and the `dispatch` effect branch. If it returns true, return from `handleInput` before clearing/rendering. This explicit trimmed-value predicate prevents whitespace from re-submitting a previously stored custom response.

- [ ] **Step 8: Add a one-question multi-select test that requires `Next`.** Toggle an option and assert no `done` call; navigate to the `next` row, press Enter, and assert one options response. Implement no special case in the reducer: `confirmMulti` is the commit action.

- [ ] **Step 9: Run the focused suite and commit.**

```bash
pnpm exec vitest run tests/tui/input.test.ts tests/tui/render.test.ts tests/tui/questionnaire-ui.test.ts
git add src/tui/input.ts src/tui/render.ts src/tui/questionnaire-ui.ts tests/tui/input.test.ts tests/tui/render.test.ts tests/tui/questionnaire-ui.test.ts
git commit -m "feat(tui): submit single-question responses immediately"
```

Expected: Vitest passes before committing.

## Phase 4 — Focus-driven custom text and wrapping navigation

This is independently usable: custom input behaves like a focused row rather than a separate step, while normal question navigation becomes cyclic.

> **Phase 4 authority:** Follow `docs/superpowers/plans/2026-07-21-questionnaire-interaction-refactor-phase-4-focus-custom-input.md` for the implementation. It supersedes the older aggregate steps below and explicitly replaces contradictory state, input, render, and adapter regressions.

### Task 4: Put row topology and wrapping in the reducer (superseded)

Do not execute the historical checkbox steps in this aggregate section. The dedicated Phase 4 plan above is the decision-complete replacement and includes the required adapter regressions and verification.

**Files:**

- Modify: `src/tui/state.ts`
- Modify: `src/tui/input.ts`
- Modify: `src/tui/render.ts`
- Modify: `tests/tui/state.test.ts`
- Modify: `tests/tui/input.test.ts`
- Modify: `tests/tui/render.test.ts`
- Modify: `tests/tui/questionnaire-ui.test.ts`

- [ ] **Step 1: Add state tests for wrapping question rows and clamped review rows.**

```ts
it("wraps question rows", () => {
  const q = { ...questionsWithOther[0]!, allowOther: true };
  expect(
    reduce(
      { ...initState([q]), optionCursor: 0 },
      { type: "moveCursor", direction: "up" },
      [q],
    ).optionCursor,
  ).toBe(visibleRowCount(q) - 1);
  expect(
    reduce(
      { ...initState([q]), optionCursor: visibleRowCount(q) - 1 },
      { type: "moveCursor", direction: "down" },
      [q],
    ).optionCursor,
  ).toBe(0);
});

it("keeps review navigation clamped", () => {
  const state = {
    ...initState(questions),
    activeTab: questions.length,
    reviewCursor: 0,
  };
  expect(
    reduce(state, { type: "moveCursor", direction: "up" }, questions)
      .reviewCursor,
  ).toBe(0);
});
```

- [ ] **Step 2: Add input tests for focus transitions and Escape.**

```ts
it("enters typing when navigation reaches other and preloads saved text", () => {
  const state = { ...initState(questionsWithOther), optionCursor: 1 };
  state.customText.set("scope", "existing text");
  expect(
    interpret("\x1b[B", {
      state,
      questions: questionsWithOther,
      notesEditorText: "",
    }),
  ).toEqual([
    { type: "dispatch", action: { type: "moveCursor", direction: "down" } },
    { type: "dispatch", action: { type: "enterTyping", questionId: "scope" } },
    { type: "set-editor-text", text: "existing text" },
  ]);
});

it("leaves typing, moves to the wrapped row, and clears the draft", () => {
  const state = {
    ...initState(questionsWithOther),
    optionCursor: 2,
    inputMode: "typing" as const,
    editingQuestionId: "scope",
  };
  expect(
    interpret("\x1b[B", {
      state,
      questions: questionsWithOther,
      notesEditorText: "",
    }),
  ).toEqual([
    { type: "dispatch", action: { type: "cancelTyping" } },
    { type: "dispatch", action: { type: "moveCursor", direction: "down" } },
    { type: "set-editor-text", text: "" },
  ]);
});

it("cancels the questionnaire from custom input", () => {
  const state = {
    ...initState(questionsWithOther),
    inputMode: "typing" as const,
    editingQuestionId: "scope",
  };
  expect(
    interpret("\x1b", {
      state,
      questions: questionsWithOther,
      notesEditorText: "",
    }),
  ).toEqual([{ type: "finalize", cancelled: true }]);
});
```

- [ ] **Step 3: Run the focused tests and confirm they fail.**

```bash
pnpm exec vitest run tests/tui/state.test.ts tests/tui/input.test.ts
```

- [ ] **Step 4: Add one exported wrapped-index helper in `state.ts`.**

```ts
export function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}
```

Use it in the question branch of `moveCursor` as `next.optionCursor = wrapIndex(next.optionCursor + delta, visibleRowCount(q))`. Keep the review branch's existing `Math.max`/`Math.min` behavior.

- [ ] **Step 5: Add a `moveEffects` helper in `input.ts` that calculates the destination with `wrapIndex`.** It must dispatch `moveCursor`, then append `enterTyping` and `set-editor-text` only when `cursorTarget(question, destination).kind === "other"`.

```ts
function moveEffects(
  direction: "up" | "down",
  question: NormalizedQuestion,
  state: QuestionnaireState,
): Effect[] {
  const delta = direction === "up" ? -1 : 1;
  const cursor = wrapIndex(
    state.optionCursor + delta,
    visibleRowCount(question),
  );
  const effects: Effect[] = [dispatch({ type: "moveCursor", direction })];
  if (cursorTarget(question, cursor).kind === "other") {
    effects.push(dispatch({ type: "enterTyping", questionId: question.id }), {
      type: "set-editor-text",
      text: state.customText.get(question.id) ?? "",
    });
  }
  return effects;
}
```

Use it for navigate-mode Up/Down in both single- and multi-select branches. In typing mode, Escape returns only `{ type: "finalize", cancelled: true }`; Up/Down return `cancelTyping`, the matching `moveEffects`, and one empty editor effect. Do not call `moveEffects` in review or notes mode.

- [ ] **Step 6: Change the typing hint in `render.ts` to `Enter submit | Esc cancel | Up/Down move`.** The text must match the new Escape behavior.

- [ ] **Step 7: Run focused tests, then commit.**

```bash
pnpm exec vitest run tests/tui/state.test.ts tests/tui/input.test.ts tests/tui/render.test.ts
git add src/tui/state.ts src/tui/input.ts src/tui/render.ts tests/tui/state.test.ts tests/tui/input.test.ts tests/tui/render.test.ts
git commit -m "feat(tui): enter custom text when its row is focused"
```

## Phase 5 — Multi-select custom answers

The executable plan for this phase lives in [the Phase 5 multi-select custom plan](2026-07-21-questionnaire-interaction-refactor-phase-5-multi-custom.md). It supersedes the former inline task breakdown.

The phase keeps the existing TUI architecture and adds the following contract: multi-select rows use options → optional custom → optional chat → Next; custom and option answers are mutually exclusive; recommendations are materialized on `Next`; explicit empty `Next` commits `selected: []`; and empty selections render as `(no input)`.

Run the detailed plan's focused tests after each task, then the full `pnpm exec vitest run`, `pnpm check`, `pnpm pack:dry-run`, and `git diff --check` validation before integration.
