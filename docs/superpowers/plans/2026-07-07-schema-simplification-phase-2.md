# Phase 2: Normalize, Validate, Process

> **Status: COMPLETED** — All work was done atomically in Phase 1 (commit `caa4a03`).

**Goal:** Update core logic (normalize, validate, process) and their tests to use the flat `QuestionSchema` from Phase 1.

**Architecture:** Single normalization path (no branching on `type`), default `value` to `label`, simplify validation to use `multiSelect` instead of `type` discriminator.

**Tech Stack:** TypeScript, TypeBox, Vitest

---

## Outcome

All Phase 2 targets were completed as part of the Phase 1 atomic commit:

| File | Status | Notes |
|---|---|---|
| `src/core/normalize.ts` | Done | Single path, `opt.value ?? opt.label`, `multiSelect === true` |
| `src/core/validate.ts` | Done | No type-discriminator branching, optional-value handling |
| `src/core/process.ts` | No changes needed | Only calls validate + normalize |
| `tests/core/normalize.test.ts` | Done | 12 tests, flat `QuestionInput` fixtures |
| `tests/core/validate.test.ts` | Done | 19 tests, includes value-defaulting edge cases |
| `tests/core/process.test.ts` | Done | 6 tests, includes multiSelect coverage |

### Design divergence from original plan

The plan proposed forcing `allowOther: false` during normalization for multi-select questions (`allowOther: q.multiSelect ? false : q.allowOther !== false`). The implementation instead defaults `allowOther` to `true` for all questions (`q.allowOther !== false`) and enforces the multi-select restriction at the TUI rendering layer — `visibleRowCount` and `cursorTarget` in `state.ts` branch on `!question.multiSelect` before checking `allowOther`, so multi-select questions never render the "Other" row. This is equivalent behavior with the guard at the right layer.
