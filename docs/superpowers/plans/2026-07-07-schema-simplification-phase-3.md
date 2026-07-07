# Phase 3: TUI Logic (state, input, render)

> **Status: COMPLETED** — All work was done atomically in Phase 1 (commit `caa4a03`).

**Goal:** Replace all `question.type === "single-choice" | "multi-choice"` checks in TUI files with `question.multiSelect`, update render function signatures and test fixtures.

**Architecture:** Mechanical replacement — every `q.type === "single-choice"` becomes `!q.multiSelect`, every `q.type === "multi-choice"` becomes `q.multiSelect`. Render functions change param types from `NormalizedSingleChoiceQuestion` / `NormalizedMultiChoiceQuestion` to `NormalizedQuestion`.

**Tech Stack:** TypeScript, Vitest

---

## Outcome

All Phase 3 targets were completed as part of the Phase 1 atomic commit:

| File | Status | Notes |
|---|---|---|
| `src/tui/state.ts` | Done | `!question.multiSelect` / `q.multiSelect` checks, `recommendation` as `string \| null` |
| `src/tui/input.ts` | Done | `!q.multiSelect` check |
| `src/tui/render.ts` | Done | `if (q.multiSelect)` dispatch, `q?.multiSelect` hint bar check |
| `src/tui/render-question.ts` | Done | `NormalizedQuestion` param type, `=== opt.value` recommendation check |
| `tests/tui/state.test.ts` | Done | 66 tests, flat `NormalizedQuestion` fixtures |
| `tests/tui/input.test.ts` | Done | 38 tests, flat fixtures |
| `tests/tui/render-question.test.ts` | Done | 19 tests, flat fixtures |
