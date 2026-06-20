# Phase 4: Verification

> Part of [questionnaire-plan.md](./2025-06-20-questionnaire-plan.md)
>
> **Depends on:** Phases 1-3 must be complete before starting this phase.

Final verification and cleanup. After this phase the extension is release-ready.

**Verification command:** `pnpm check` (runs biome lint + typecheck + vitest)

---

## Task 14: Full verification and cleanup

- [ ] **Step 1: Run full check**

Run: `pnpm check`
Expected: PASS (biome lint + typecheck + all tests)

- [ ] **Step 2: Delete the placeholder test that was in `tests/index.test.ts` before (already replaced in Task 13)**

Already done.

- [ ] **Step 3: Run `pnpm pack:dry-run` to verify the package structure**

Run: `pnpm pack:dry-run`
Expected: Lists files under `src/` including the new `core/` and `tui/` directories

- [ ] **Step 4: Review git log**

Run: `git log --oneline -15`
Verify the commit history is clean and each commit is atomic.

- [ ] **Step 5: Final commit (if any formatting changes from biome)**

If biome made auto-format changes:
```bash
git add -A
git commit -m "style: apply biome formatting"
```
