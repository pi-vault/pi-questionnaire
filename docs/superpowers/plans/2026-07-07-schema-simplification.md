# Schema Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate `Type.Union` from the questionnaire schema so models with weak guided decoding (MiniMax-M3) can produce valid tool arguments.

**Architecture:** Merge `SingleChoiceQuestionSchema` and `MultiChoiceQuestionSchema` into a single flat `QuestionSchema` with a `multiSelect: boolean` field. Make option `value` optional (defaults to `label`). Remove all `type: "single-choice" | "multi-choice"` discriminators from internal types, replacing them with `multiSelect: boolean`. Four atomic phases, each producing a passing test suite.

**Tech Stack:** TypeScript, TypeBox schemas, Vitest

**Spec:** `docs/superpowers/specs/2026-07-07-schema-simplification-design.md`

---

## File Map

| File                                | Phase | Action                                                         |
| ----------------------------------- | ----- | -------------------------------------------------------------- |
| `src/core/schema.ts`                | 1     | Rewrite: merge two schemas into one, make `value` optional     |
| `src/core/types.ts`                 | 1     | Rewrite: merge two interfaces into one                         |
| `tests/core/schema.test.ts`         | 1     | No changes needed (tests constants only)                       |
| `src/core/normalize.ts`             | 2     | Rewrite: single normalization path, default `value` to `label` |
| `src/core/validate.ts`              | 2     | Rewrite: remove type-discriminator branching                   |
| `src/core/process.ts`               | 2     | No changes (only calls validate + normalize)                   |
| `tests/core/normalize.test.ts`      | 2     | Rewrite fixtures, add `value` default test                     |
| `tests/core/validate.test.ts`       | 2     | Rewrite fixtures                                               |
| `tests/core/process.test.ts`        | 2     | Rewrite fixtures                                               |
| `src/tui/state.ts`                  | 3     | Replace `type` checks with `multiSelect`                       |
| `src/tui/input.ts`                  | 3     | Replace `type` check with `multiSelect`                        |
| `src/tui/render.ts`                 | 3     | Replace `switch (q.type)` with `if (q.multiSelect)`            |
| `src/tui/render-question.ts`        | 3     | Change param types to `NormalizedQuestion`                     |
| `tests/tui/state.test.ts`           | 3     | Rewrite fixtures                                               |
| `tests/tui/input.test.ts`           | 3     | Rewrite fixtures                                               |
| `tests/tui/render-question.test.ts` | 3     | Rewrite fixtures                                               |
| `src/core/index.ts`                 | 4     | Remove deleted type exports                                    |
| `src/index.ts`                      | 4     | No changes needed                                              |
| `tests/tui/render.test.ts`          | 4     | Rewrite fixtures                                               |
| `tests/tui/render-tabs.test.ts`     | 4     | Rewrite fixtures (if they reference `type`)                    |
| `tests/tui/render-review.test.ts`   | 4     | Rewrite fixtures (if they reference `type`)                    |
| `tests/index.test.ts`               | 4     | Rewrite fixtures (if they reference `type`)                    |

---

## Phase 1: Schema and Types

Atomic unit: rewrite the schema and type definitions. After this phase, the project will NOT compile (downstream files still reference old types). Tests for schema constants still pass.

See: `docs/superpowers/plans/2026-07-07-schema-simplification-phase-1.md`

## Phase 2: Normalize, Validate, Process (core logic)

Atomic unit: update all core logic files and their tests. After this phase, core tests pass. TUI files still reference old types (won't compile).

See: `docs/superpowers/plans/2026-07-07-schema-simplification-phase-2.md`

## Phase 3: TUI Logic (state, input, render)

Atomic unit: update all TUI logic and rendering files and their tests. After this phase, the full project compiles and all tests pass.

See: `docs/superpowers/plans/2026-07-07-schema-simplification-phase-3.md`

## Phase 4: Exports and Remaining Tests

Atomic unit: clean up barrel exports and update any remaining test fixtures. After this phase, `pnpm check` passes clean.

See: `docs/superpowers/plans/2026-07-07-schema-simplification-phase-4.md`
