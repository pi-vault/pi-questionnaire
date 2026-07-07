# Phase 4: Exports and Remaining Tests

> **Status: COMPLETED** — All work was done atomically in Phase 1 (commit `caa4a03`).

**Goal:** Clean up barrel exports (remove deleted type names) and update remaining test fixtures that still reference the old `type` discriminator.

**Architecture:** Mechanical fixture replacement in test files plus export cleanup in `src/core/index.ts`.

**Tech Stack:** TypeScript, Vitest

---

## Outcome

All Phase 4 targets were completed as part of the Phase 1 atomic commit:

| File | Status | Notes |
|---|---|---|
| `src/core/index.ts` | Done | Exports only `NormalizedQuestion` (plus `NormalizedOption`), no old union type exports |
| `src/index.ts` | Done | Tool description updated to "single-select or multi-select" |
| `tests/core/format.test.ts` | Done | 12 tests, flat `NormalizedQuestion` fixtures |
| `tests/tui/render.test.ts` | Done | 7 tests, flat fixtures |
| `tests/tui/render-tabs.test.ts` | Done | 4 tests, flat fixtures |
| `tests/tui/render-review.test.ts` | Done | 2 tests, flat fixtures |
| `tests/index.test.ts` | Done | 2 tests, no `type` references |

### Minor difference from original plan

The barrel file (`src/core/index.ts`) also exports `NormalizedOption`, which the plan omitted. This export is correct — `NormalizedOption` is a distinct interface from `QuestionOption` (it has `value: string` required, not optional) and is used by consumers that need the post-normalization option type.
