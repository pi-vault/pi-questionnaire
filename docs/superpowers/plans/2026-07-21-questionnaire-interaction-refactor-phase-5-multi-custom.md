# Multi-Select Custom Answers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the existing `Type something.` custom-answer flow to multi-select questions while keeping custom, option, chat, and empty-confirmation states unambiguous.

**Architecture:** Keep the existing pure interpreter → reducer → UI adapter flow. `rowLayout` remains the sole row-topology source; a small state helper derives ordered checked options, while the reducer owns answer replacement and cached-editor cleanup. The reference package informs behavior only; its row-intent metadata architecture is out of scope.

**Tech Stack:** TypeScript, Vitest, Biome, `@earendil-works/pi-tui`.

---

## Behavior contract

- Multi-select rows are options → `Type something.` when `allowOther` is true → chat when `allowChat` is true → `Next`.
- Moving onto `Type something.` uses the existing focus-driven multiline editor. Enter or Space while the row is focused also opens it for empty-submit recovery.
- Non-empty custom submission clears checked options and stores `{ kind: "custom", value }`.
- Selecting a checkbox or confirming `Next` clears cached custom text and replaces a custom answer with `{ kind: "options", selected }`.
- `Next` materializes the prechecked recommendation into the answer. Explicit `Next` with no checked options commits `{ kind: "options", selected: [] }`.
- Empty multi-select selections render as `(no input)` in Review and in the model-facing summary.
- No public schema, type, dependency, or result-shape changes are required.

## File map

- `src/tui/state.ts` — row topology, checked-option derivation, and mutually exclusive answer transitions.
- `src/tui/input.ts` — multi-select custom-row activation while focused.
- `src/core/format.ts` — stable `(no input)` rendering for empty committed selections.
- `tests/tui/state.test.ts`, `tests/tui/input.test.ts`, `tests/tui/render-question.test.ts` — pure regressions using existing fixtures.
- `tests/tui/questionnaire-ui.test.ts` — real `driveCustom` end-to-end completion flows.
- `tests/core/format.test.ts` — empty-selection formatting regressions.
- `README.md`, `CHANGELOG.md` — public behavior documentation.

`src/tui/render-question.ts` is not a production change: it already walks `rowLayout` and renders the `other` slot.

### Task 1: Add the multi-select custom row and input route

**Files:**

- Modify: `src/tui/state.ts`
- Modify: `src/tui/input.ts`
- Test: `tests/tui/state.test.ts`, `tests/tui/input.test.ts`, `tests/tui/render-question.test.ts`

- [ ] **Step 1: Add the failing topology regression.**

In `tests/tui/state.test.ts`, add one fixture beside the existing question fixtures:

```ts
const multiWithOther: NormalizedQuestion = {
  multiSelect: true,
  id: "features-other",
  header: "Features",
  prompt: "Pick features",
  options: [
    { value: "auth", label: "Auth" },
    { value: "log", label: "Logging" },
  ],
  recommendation: "auth",
  allowOther: true,
  allowChat: true,
};
```

Add:

```ts
it("orders other before chat and Next for multi-select", () => {
  expect(rowLayout(multiWithOther)).toEqual([
    { kind: "option", index: 0 },
    { kind: "option", index: 1 },
    { kind: "other" },
    { kind: "chat" },
    { kind: "next" },
  ]);
});
```

- [ ] **Step 2: Add pure input and render regressions.**

In `tests/tui/input.test.ts`, derive `multiWithOther` from the existing `questions[1]` fixture and assert direct activation while the cursor is already on the custom row:

```ts
it("opens custom input from a focused multi-select other row", () => {
  const q = { ...questions[1], allowOther: true };
  const state = { ...initState([q]), optionCursor: q.options.length };
  expect(interpret("\r", { state, questions: [q], notesEditorText: "" })).toEqual([
    { type: "dispatch", action: { type: "enterTyping", questionId: q.id } },
    { type: "set-editor-text", text: "" },
  ]);
});
```

In `tests/tui/render-question.test.ts`, extend the existing multi-select fixture:

```ts
it("renders the multi-select custom row before Next", () => {
  const q = { ...question, allowOther: true };
  const text = renderQuestion(input(q, { cursor: q.options.length }), noopTheme, 80).join("\n");
  expect(text).toContain("3. Type something.");
  expect(text.indexOf("Type something.")).toBeLessThan(text.indexOf("Next"));
});
```

- [ ] **Step 3: Run the focused tests and confirm the new topology/input assertions fail.**

```bash
pnpm exec vitest run tests/tui/state.test.ts tests/tui/input.test.ts tests/tui/render-question.test.ts
```

Expected: the multi `rowLayout` omits `other`, so the cursor target is `next` and the direct input assertion fails.

- [ ] **Step 4: Make `rowLayout` append sentinels in one order.**

Replace the split single/multi tail in `src/tui/state.ts` with:

```ts
if (question.allowOther) slots.push({ kind: "other" });
if (question.allowChat) slots.push({ kind: "chat" });
if (question.multiSelect) slots.push({ kind: "next" });
```

- [ ] **Step 5: Route the multi `other` target through the existing editor effect.**

In the multi-select Enter/Space branch of `src/tui/input.ts`, add this branch between the option and chat branches:

```ts
if (target.kind === "other") {
  return [
    dispatch({ type: "enterTyping", questionId: q.id }),
    { type: "set-editor-text", text: state.customText.get(q.id) ?? "" },
  ];
}
```

Leave `moveEffects` unchanged; Phase 4 already activates typing when navigation lands on `other`.

- [ ] **Step 6: Verify Task 1 and commit.**

```bash
pnpm exec vitest run tests/tui/state.test.ts tests/tui/input.test.ts tests/tui/render-question.test.ts
git diff --check
git add src/tui/state.ts src/tui/input.ts tests/tui/state.test.ts tests/tui/input.test.ts tests/tui/render-question.test.ts
git commit -m "feat(tui): expose custom row for multi-select"
```

Expected: focused topology, input, and render tests pass.

### Task 2: Make custom, checked, recommended, and empty answers explicit

**Files:**

- Modify: `src/tui/state.ts`
- Test: `tests/tui/state.test.ts`

- [ ] **Step 1: Add reducer regressions before implementation.**

Add these tests using the existing `questions` fixture and the new `multiWithOther` fixture:

```ts
it("replaces checked options with a custom answer", () => {
  const state = initState([multiWithOther]);
  state.multiChecked.set(multiWithOther.id, new Set(["auth"]));
  const next = reduce(
    state,
    { type: "submitTyping", questionId: multiWithOther.id, value: "Custom" },
    [multiWithOther],
  );
  expect(next.multiChecked.get(multiWithOther.id)).toEqual(new Set());
  expect(next.answers.get(multiWithOther.id)).toEqual({ kind: "custom", value: "Custom" });
});

it("replaces a custom answer with an option and clears cached text", () => {
  const state = initState([multiWithOther]);
  state.answers.set(multiWithOther.id, { kind: "custom", value: "Custom" });
  state.customText.set(multiWithOther.id, "Custom");
  const next = reduce(
    state,
    { type: "toggleCheckbox", questionId: multiWithOther.id, value: "auth" },
    [multiWithOther],
  );
  expect(next.customText.has(multiWithOther.id)).toBe(false);
  expect(next.answers.get(multiWithOther.id)).toEqual({
    kind: "options",
    selected: [{ value: "auth", label: "Auth" }],
  });
});

it("materializes a recommendation when Next confirms multi-select", () => {
  const next = reduce(
    initState([multiWithOther]),
    { type: "confirmMulti", questionId: multiWithOther.id },
    [multiWithOther],
  );
  expect(next.answers.get(multiWithOther.id)).toEqual({
    kind: "options",
    selected: [{ value: "auth", label: "Auth" }],
  });
});

it("commits an explicit empty multi-select confirmation", () => {
  const q = { ...multiWithOther, recommendation: null };
  const next = reduce(initState([q]), { type: "confirmMulti", questionId: q.id }, [q]);
  expect(next.answers.get(q.id)).toEqual({ kind: "options", selected: [] });
  expect(next.activeTab).toBe(1);
});
```

- [ ] **Step 2: Run the reducer tests and confirm the new assertions fail.**

```bash
pnpm exec vitest run tests/tui/state.test.ts
```

Expected: custom submission retains checks, option toggling retains cached text, recommendation confirmation does not persist an answer, and empty confirmation has no answer.

- [ ] **Step 3: Add one pure selected-option helper.**

Place this above `reduce` in `src/tui/state.ts`:

```ts
function selectedMultiOptions(
  state: QuestionnaireState,
  questionId: string,
  questions: NormalizedQuestion[],
) {
  const question = questions.find((candidate) => candidate.id === questionId);
  if (!question?.multiSelect) return undefined;
  const checked = state.multiChecked.get(questionId) ?? new Set<string>();
  return question.options
    .filter((option) => checked.has(option.value))
    .map((option) => ({ value: option.value, label: option.label }));
}
```

- [ ] **Step 4: Apply the helper at each reducer boundary.**

In `toggleCheckbox`, delete cached custom text, derive selected options, and set or delete the answer:

```ts
next.customText.delete(action.questionId);
const selected = selectedMultiOptions(next, action.questionId, questions);
if (selected === undefined) return next;
if (selected.length === 0) next.answers.delete(action.questionId);
else next.answers.set(action.questionId, { kind: "options", selected });
return next;
```

In the non-empty branch of `submitTyping`, clear the checked set before storing the custom answer:

```ts
next.multiChecked.get(action.questionId)?.clear();
next.customText.set(action.questionId, trimmed);
next.answers.set(action.questionId, { kind: "custom", value: trimmed });
```

In `confirmMulti`, derive the options, clear cached custom text, persist the answer even when `selected.length === 0`, then call the existing `advanceToNextTab` cursor reset:

```ts
const selected = selectedMultiOptions(next, action.questionId, questions);
if (selected !== undefined) {
  next.customText.delete(action.questionId);
  next.answers.set(action.questionId, { kind: "options", selected });
}
const nextTab = advanceToNextTab(next, questions);
next.activeTab = nextTab;
next.optionCursor = 0;
next.reviewCursor = 0;
return next;
```

- [ ] **Step 5: Verify Task 2 and commit.**

```bash
pnpm exec vitest run tests/tui/state.test.ts
git diff --check
git add src/tui/state.ts tests/tui/state.test.ts
git commit -m "feat(tui): make multi-select answers mutually exclusive"
```

Expected: all reducer tests pass, including recommendation and empty-confirmation cases.

### Task 3: Format empty answers, prove adapter completion, and update public docs

**Files:**

- Modify: `src/core/format.ts`
- Modify: `tests/core/format.test.ts`
- Modify: `tests/tui/questionnaire-ui.test.ts`
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add formatter regressions.**

In `tests/core/format.test.ts`, add:

```ts
it("formats an empty multi-select as no input", () => {
  const response: QuestionResponse = {
    questionId: "features",
    selection: { kind: "options", selected: [] },
  };
  expect(formatModelLine(multiQ, response)).toBe("Features: user selected: (no input)");
  expect(formatAnswerForRender(multiQ, response.selection)).toBe("(no input)");
});
```

- [ ] **Step 2: Implement one formatter placeholder.**

In `src/core/format.ts`, define `const NO_INPUT_PLACEHOLDER = "(no input)"` and use it when the mapped options string is empty:

```ts
case "options": {
  const parts = sel.selected.map((s) => {
    const idx = optionIndex(question, s.value);
    return `${idx}. ${s.label}`;
  });
  return `${question.header}: user selected: ${parts.join(", ") || NO_INPUT_PLACEHOLDER}`;
}
```

Use the same fallback in `formatAnswerForRender` for the `options` branch.

- [ ] **Step 3: Add real adapter regressions using the existing `driveCustom` harness.**

In `tests/tui/questionnaire-ui.test.ts`, use the existing `multi` fixture and add:

```ts
it("resolves a one-question multi custom answer immediately", async () => {
  const q = { ...multi, allowOther: true };
  const harness = driveCustom([q]);
  input(harness, "\x1b[B");
  input(harness, "\x1b[B");
  for (const character of "Custom") input(harness, character);
  input(harness, "\r");
  await expect(harness.result).resolves.toMatchObject({
    cancelled: false,
    responses: [{ questionId: q.id, selection: { kind: "custom", value: "Custom" } }],
  });
});

it("resolves a recommended one-question multi answer after Next", async () => {
  const q = { ...multi, recommendation: "small" };
  const harness = driveCustom([q]);
  input(harness, "\x1b[B");
  input(harness, "\x1b[B");
  input(harness, "\r");
  await expect(harness.result).resolves.toMatchObject({
    cancelled: false,
    responses: [{ questionId: q.id, selection: { kind: "options", selected: [{ value: "small", label: "Small" }] } }],
  });
});

it("resolves an explicit empty one-question multi answer after Next", async () => {
  const harness = driveCustom([multi]);
  input(harness, "\x1b[B");
  input(harness, "\x1b[B");
  input(harness, "\r");
  await expect(harness.result).resolves.toMatchObject({
    cancelled: false,
    responses: [{ questionId: multi.id, selection: { kind: "options", selected: [] } }],
  });
});
```

- [ ] **Step 4: Update the public documentation.**

In `README.md`, change the `allowOther` optional-field bullet to state that it appends `Type something.` on single- and multi-select questions and that a multi-select custom answer replaces checked options.

In `CHANGELOG.md`, change the 0.1.0 custom-answer entry from “single-choice questions” to “single- and multi-select questions.”

- [ ] **Step 5: Run the complete validation suite and commit.**

```bash
pnpm exec vitest run
pnpm check
pnpm pack:dry-run
git diff --check
git add src/core/format.ts tests/core/format.test.ts tests/tui/questionnaire-ui.test.ts README.md CHANGELOG.md
git commit -m "feat(tui): support custom multi-select answers"
```

Expected: all tests pass; `pnpm check` reports only the existing Biome schema-version info and pre-existing non-null-assertion warning; the dry-run package remains valid.

## Manual acceptance

- A multi-select question with `allowOther: true` opens the existing editor on `Type something.`, and its response contains only the custom selection.
- After replacing a multi custom answer with a checkbox, the Review row shows only the option and the old custom text is gone.
- A recommended multi question completes through `Next` with the recommendation in `selected`.
- A multi question with no checks completes through explicit `Next` and formats as `(no input)`.

## Plan self-review

- **Spec coverage:** topology, focus routing, custom/check exclusivity, recommendation synchronization, empty confirmation, formatting, adapter completion, and documentation each have an implementation task.
- **Placeholder scan:** no `TBD`, `TODO`, or undefined helper names remain; all test harness references use the existing `driveCustom` API and `input` helper.
- **Type consistency:** `selectedMultiOptions` returns the existing `{ value, label }[]` shape used by `QuestionSelection`; empty arrays remain valid and are distinguished from `undefined` with an explicit check.
- **Scope:** no new row metadata abstraction, public API, dependency, or production render refactor is included.
