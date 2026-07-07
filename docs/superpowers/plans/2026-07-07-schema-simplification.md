# Schema Simplification Implementation Plan

> **Status: COMPLETED** — All four phases were implemented atomically in a single commit during Phase 1 (`caa4a03`). 192 tests pass, `tsc --noEmit` is clean.

**Goal:** Eliminate `Type.Union` from the questionnaire schema so models with weak guided decoding (MiniMax-M3) can produce valid tool arguments.

**Architecture:** Merge `SingleChoiceQuestionSchema` and `MultiChoiceQuestionSchema` into a single flat `QuestionSchema` with a `multiSelect: boolean` field. Make option `value` optional (defaults to `label`). Remove all `type: "single-choice" | "multi-choice"` discriminators from internal types, replacing them with `multiSelect: boolean`.

**Tech Stack:** TypeScript, TypeBox schemas, Vitest

**Spec:** `docs/superpowers/specs/2026-07-07-schema-simplification-design.md`

---

## Execution Summary

The plan originally called for four incremental phases, each leaving the codebase in a progressively more complete state. In practice, all changes were applied atomically in a single Phase 1 commit, producing a fully passing test suite immediately.

## Phase 1: Schema and Types — COMPLETED

See: `docs/superpowers/plans/2026-07-07-schema-simplification-phase-1.md`

## Phase 2: Normalize, Validate, Process — COMPLETED (done in Phase 1)

See: `docs/superpowers/plans/2026-07-07-schema-simplification-phase-2.md`

## Phase 3: TUI Logic (state, input, render) — COMPLETED (done in Phase 1)

See: `docs/superpowers/plans/2026-07-07-schema-simplification-phase-3.md`

## Phase 4: Exports and Remaining Tests — COMPLETED (done in Phase 1)

See: `docs/superpowers/plans/2026-07-07-schema-simplification-phase-4.md`
