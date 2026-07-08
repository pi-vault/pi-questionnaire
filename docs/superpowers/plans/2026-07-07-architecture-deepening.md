# Architecture Deepening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Five independent refactors that improve locality, leverage, and testability — ordered simplest to most complex.

**Architecture:** Each phase is an atomic PR. No phase depends on another having landed. Each phase plan is a self-contained document that can be executed independently.

**Tech Stack:** TypeScript 6, TypeBox, Vitest, Biome (lint/format)

**Spec:** `docs/superpowers/specs/2026-07-07-architecture-deepening-design.md`

---

## Phases

Each phase has its own plan file with full step-by-step instructions. Execute phases in order (simplest first) or pick any phase independently.

| Phase | Plan file | Summary |
|-------|-----------|---------|
| 1 | `2026-07-07-architecture-deepening-phase-1.md` | Dissolve `theme.ts` — move `RenderTheme` type to `render-question.ts`, delete file |
| 2 | `2026-07-07-architecture-deepening-phase-2.md` | Inline `process.ts` — export validate/normalize directly, inline composition |
| 3 | `2026-07-07-architecture-deepening-phase-3.md` | Consolidate cursor arithmetic — add `rowLayout()` to `state.ts`, rewrite render-question to iterate slots |
| 4 | `2026-07-07-architecture-deepening-phase-4.md` | Merge render-question — two functions become one with an input object |
| 5 | `2026-07-07-architecture-deepening-phase-5.md` | Deepen input interpreter — `mapInput` becomes `interpret`, returns `Effect[]`, owns all key logic |

## Verification

After each phase, run the full check suite:

```bash
pnpm check
```

This runs `biome lint . && tsc --noEmit && vitest run` — linting, typechecking, and all tests.
