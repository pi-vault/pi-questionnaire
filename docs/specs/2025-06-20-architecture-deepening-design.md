# Architecture Deepening Design

## Goal

Refactor pi-questionnaire's internal architecture to improve testability, reduce duplication, and align the codebase with its stated "Pure-Function Core + Thin UI" design. Four changes, delivered in four atomic phases ordered from simplest to most complex. Each phase leaves the project in a passing, releasable state.

## Constraints

- Pre-release (v0.1.0): public API may break freely.
- Immutable reducer pattern for state machine (Phase 4).
- Named type aliases preserved for readability when deriving types from TypeBox (Phase 2).
- Verification: `pnpm check` (biome lint + typecheck + vitest) must pass after each phase.

---

## Phase 5: Consolidate theme interfaces

**Problem:** `TabBarTheme`, `QuestionTheme`, and `ReviewTheme` are structurally identical interfaces defined privately in three render modules and reduplicated as `noopTheme` in three test files.

**Changes:**

| Action | File                                | Detail                                                                                                                                             |
| ------ | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create | `src/tui/theme.ts`                  | Export `RenderTheme` interface: `fg(color: string, text: string): string`, `bg(color: string, text: string): string`, `bold(text: string): string` |
| Edit   | `src/tui/render-tabs.ts`            | Delete `TabBarTheme`, import `RenderTheme`                                                                                                         |
| Edit   | `src/tui/render-question.ts`        | Delete `QuestionTheme`, import `RenderTheme`                                                                                                       |
| Edit   | `src/tui/render-review.ts`          | Delete `ReviewTheme`, import `RenderTheme`                                                                                                         |
| Create | `tests/helpers/theme.ts`            | Export `noopTheme: RenderTheme` (identity functions)                                                                                               |
| Edit   | `tests/tui/render-tabs.test.ts`     | Import `noopTheme` from helpers, delete inline definition                                                                                          |
| Edit   | `tests/tui/render-question.test.ts` | Import `noopTheme` from helpers, delete inline definition                                                                                          |
| Edit   | `tests/tui/render-review.test.ts`   | Import `noopTheme` from helpers, delete inline definition                                                                                          |

**No new tests.** Existing tests verify behavior is preserved.

---

## Phase 6: Derive TypeScript types from TypeBox schema

**Problem:** Input question shapes are defined twice — as TypeScript interfaces in `types.ts` and as TypeBox schemas in `schema.ts`. Constraints (2-12 options, 1-10 questions) appear in three places: schema.ts, validate.ts, and the spec.

**Changes:**

| Action | File                   | Detail                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------ | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Edit   | `src/core/schema.ts`   | Export constraint constants: `MIN_QUESTIONS = 1`, `MAX_QUESTIONS = 10`, `MIN_OPTIONS = 2`, `MAX_OPTIONS = 12`. Use them in schema definitions. Export internal schemas (`QuestionOptionSchema`, etc.) for `Static` derivation. Add named type aliases: `export type QuestionOption = Static<typeof QuestionOptionSchema>`, `export type SingleChoiceQuestionInput = Static<typeof SingleChoiceQuestionSchema>`, etc. |
| Edit   | `src/core/types.ts`    | Remove input-side interfaces: `QuestionOption`, `SingleChoiceQuestionInput`, `MultiChoiceQuestionInput`, `TextQuestionInput`, `QuestionInput`. Keep normalized types, answer types, `QuestionnaireResult`.                                                                                                                                                                                                           |
| Edit   | `src/core/validate.ts` | Import `MIN_QUESTIONS`, `MAX_QUESTIONS`, `MIN_OPTIONS`, `MAX_OPTIONS` from schema.ts. Replace magic numbers.                                                                                                                                                                                                                                                                                                         |
| Edit   | `src/core/index.ts`    | Re-export input types from `schema.ts` instead of `types.ts`.                                                                                                                                                                                                                                                                                                                                                        |

**No new tests.** Structurally identical types — existing tests pass unchanged.

**Verification note:** Confirm `Static<typeof SingleChoiceQuestionSchema>` produces `recommendation?: string` (optional), matching the current interface. TypeBox's `Type.Optional()` produces `T | undefined` in Static output, which is compatible with the `?:` syntax.

---

## Phase 7: Fuse validate + normalize into `processQuestions`

**Problem:** `validate.ts` and `normalize.ts` share an implicit ordering contract enforced only by the caller. Validation trims strings to check emptiness, then normalization trims them again. Neither module is self-sufficient.

**Changes:**

| Action | File                         | Detail                                                                                                                                                                                                                                  |
| ------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create | `src/core/process.ts`        | Export `ProcessResult = { ok: true; questions: NormalizedQuestion[] } \| { ok: false; error: string }`. Export `processQuestions(raw: QuestionInput[]): ProcessResult`. Internally calls `validateQuestions` then `normalizeQuestions`. |
| Edit   | `src/core/validate.ts`       | No change to implementation. Remove from barrel export (becomes internal).                                                                                                                                                              |
| Edit   | `src/core/normalize.ts`      | No change to implementation. Remove from barrel export (becomes internal).                                                                                                                                                              |
| Edit   | `src/core/index.ts`          | Remove `validateQuestions`, `normalizeQuestions` exports. Add `processQuestions`, `ProcessResult` exports.                                                                                                                              |
| Edit   | `src/index.ts`               | Replace validate-then-normalize two-step with single `processQuestions()` call.                                                                                                                                                         |
| Create | `tests/core/process.test.ts` | Integration tests: valid input returns `{ ok: true, questions }` with normalized data; invalid input returns `{ ok: false, error }`; result questions are trimmed. 3-5 test cases.                                                      |

**Existing test files unchanged:** `validate.test.ts` and `normalize.test.ts` import directly from source files, not from the barrel.

---

## Phase 8: Extract state machine from questionnaire-ui monolith

**Problem:** `questionnaire-ui.ts` is a 404-line closure with 7 mutable state variables, 5 input handlers, rendering assembly, and cache management. It is untestable through its interface. The spec lists `questionnaire-ui.test.ts` but the file does not exist because the module cannot be unit-tested.

**Changes:**

### New: `src/tui/state.ts` (~80-100 lines)

```ts
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

export function initState(questions: NormalizedQuestion[]): QuestionnaireState;
export function reduce(
  state: QuestionnaireState,
  action: Action,
  questions: NormalizedQuestion[],
): QuestionnaireState;

// Pure helpers derived from state
export function allAnswered(
  state: QuestionnaireState,
  questions: NormalizedQuestion[],
): boolean;
export function answeredIds(state: QuestionnaireState): Set<string>;
export function advanceToNextTab(
  state: QuestionnaireState,
  questions: NormalizedQuestion[],
): number;
```

The reducer returns a new state object on every transition (immutable pattern). `toggleCheckbox` atomically updates both `multiChecked` and `answers` (if selection becomes empty, the answer is removed). `initState` populates `multiChecked` from multi-choice recommendations and `textValues` from text recommendations.

### New: `src/tui/input.ts` (~60-80 lines)

```ts
export type InputResult =
  | { type: "action"; action: Action }
  | { type: "finalize"; cancelled: boolean }
  | { type: "forward-to-editor" }
  | { type: "none" };

export function mapInput(
  data: string,
  state: QuestionnaireState,
  questions: NormalizedQuestion[],
): InputResult;
```

Pure function. Encodes the precedence rules: global Esc (non-text) → tab navigation → question-specific. Returns what should happen without performing it.

### New: `src/tui/render.ts` (~50-60 lines)

```ts
export function renderQuestionnaire(
  state: QuestionnaireState,
  questions: NormalizedQuestion[],
  editorLines: string[],
  theme: RenderTheme,
  width: number,
): string[];
```

Pure function. Composes `renderTabBar`, `renderSingleChoiceQuestion`, `renderMultiChoiceQuestion`, `renderTextQuestion`, `renderReviewScreen` using state values. Includes hint bar logic. No caching.

### Rewritten: `src/tui/questionnaire-ui.ts` (~40-50 lines)

Shrinks to a thin adapter. The adapter holds one `let state` variable — this is the sole mutable reference, reassigned on each reduce cycle (the state objects themselves are immutable):

1. Calls `let state = initState(questions)`.
2. Creates the `Editor` instance.
3. Wires `handleInput`: calls `mapInput()`, dispatches result (action → `state = reduce(state, action, questions)` + `tui.requestRender()`; finalize → `done()`; forward-to-editor → `editor.handleInput(data)` + requestRender).
4. Wires `render`: calls `renderQuestionnaire(state, questions, editor.render(...), theme, width)`.
5. Wires `editor.onSubmit`: dispatches `submitText` action → reduce → requestRender.

No business logic. No state decisions. Pure wiring.

### Tests

| File                       | Coverage                                   | Cases  |
| -------------------------- | ------------------------------------------ | ------ |
| `tests/tui/state.test.ts`  | `initState`, `reduce`, helper functions    | ~30-40 |
| `tests/tui/input.test.ts`  | `mapInput` with various key + state combos | ~20-30 |
| `tests/tui/render.test.ts` | `renderQuestionnaire` output verification  | ~10-15 |

Existing `render-tabs.test.ts`, `render-question.test.ts`, `render-review.test.ts` remain unchanged.

---

## Phase Dependencies

```
Phase 5 (theme)
    └─ Phase 6 (schema types)
         └─ Phase 7 (processQuestions)
              └─ Phase 8 (state machine)
```

Each phase is independently mergeable. Phase 4 uses `RenderTheme` from Phase 1 in its new `render.ts`. Phase 4 uses `processQuestions` from Phase 3 indirectly (via the entry point). No phase depends on a later phase.

## Success Criteria

- `pnpm check` passes after each phase.
- After Phase 8: `questionnaire-ui.ts` is under 50 lines.
- After Phase 8: state machine has 60+ test cases covering transitions, input mapping, and render output.
- Zero type assertions (`as any`, `as SomeType`) introduced by the refactor.
- No behavior change — the extension works identically from the user's perspective.
