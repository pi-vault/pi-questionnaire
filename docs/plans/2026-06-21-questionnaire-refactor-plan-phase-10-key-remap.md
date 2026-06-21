# Phase 10: Key Remapping — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remap tab-navigation from Tab/Shift+Tab to Left/Right. Tab becomes unbound (reserved for Phase 13 notes).

**Spec:** `docs/specs/2026-06-21-questionnaire-refactor-design.md`

**Master plan:** `docs/plans/2026-06-21-questionnaire-refactor-plan.md`

**Prerequisite:** Phase 9 complete (text question type removed).

**Verification:** After completing all tasks, run `pnpm check` (lint + typecheck + tests). All must pass before committing.

---

Remap tab-navigation from Tab/Shift+Tab to Left/Right. Tab becomes unbound (reserved for Phase 13 notes). Left/Right already exists for tab navigation; this phase removes the redundant Tab/Shift+Tab bindings and updates hint text.

### Task 10.1: Update Input Mapping

**Files:**

- Modify: `src/tui/input.ts`
- Test: `tests/tui/input.test.ts`

- [ ] **Step 1: Remove Tab/Shift+Tab bindings from `mapInput`**

Delete the Tab/Shift+Tab block (the `// Tab navigation (always intercepted)` section, currently lines 33-45). Left/Right tab navigation already exists immediately below and is kept as-is. No other source changes needed — the rest of the function stays the same.

- [ ] **Step 2: Remove Tab/Shift+Tab tests**

In `tests/tui/input.test.ts`, delete these three test cases:

- `"Tab returns switchTab to next"` (lines 38-48)
- `"Shift+Tab returns switchTab to previous"` (lines 169-176)
- `"Shift+Tab wraps from first tab to review"` (lines 178-188)

The existing Left/Right arrow tests (lines 190-218) already cover tab navigation and remain unchanged.

- [ ] **Step 3: Run tests**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && npx vitest run tests/tui/input.test.ts`
Expected: PASS

### Task 10.2: Update Hint Bar

**Files:**

- Modify: `src/tui/render.ts`
- Test: `tests/tui/render.test.ts`

- [ ] **Step 1: Update hint text in `render.ts`**

Replace the current hint block (lines 83-88) with updated key labels. The review hint keeps Up/Down and Space since they still work on that screen:

```ts
const hint =
  state.activeTab === reviewTabIndex
    ? "Left/Right tabs | Up/Down move | Space jump | Enter submit | Esc cancel"
    : q?.type === "multi-choice"
      ? "Left/Right tabs | Up/Down move | Space toggle | Esc cancel"
      : "Left/Right tabs | Up/Down move | Space/Enter select | Esc cancel";
```

- [ ] **Step 2: Update render tests**

In `tests/tui/render.test.ts`, the `"includes hint bar for choice questions"` test asserts `toContain("Space/Enter select")` which still passes with the new text. No test changes needed.

- [ ] **Step 3: Run full check**

Run: `cd /Users/lanh/Developer/pi-vault/pi-questionnaire && pnpm check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/ tests/
git commit -m "refactor: remap tab navigation from Tab/Shift+Tab to Left/Right"
```

---
