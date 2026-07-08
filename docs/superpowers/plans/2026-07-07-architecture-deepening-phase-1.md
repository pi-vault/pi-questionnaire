# Phase 1: Dissolve theme.ts

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the phantom `theme.ts` seam — move the `RenderTheme` type into `render-question.ts` and delete the standalone file.

**Architecture:** `RenderTheme` is a 3-method interface with one adapter (the pi-tui theme). Move the type to its primary consumer, update all import paths.

**Tech Stack:** TypeScript 6, Vitest, Biome

---

### Task 1: Move RenderTheme type to render-question.ts

**Files:**
- Modify: `src/tui/render-question.ts:1-3`
- Delete: `src/tui/theme.ts`

- [ ] **Step 1: Add the RenderTheme type to render-question.ts**

Add the type definition at the top of `src/tui/render-question.ts`, before the existing imports, and export it:

```ts
export interface RenderTheme {
  fg(color: string, text: string): string;
  bg(color: string, text: string): string;
  bold(text: string): string;
}
```

Remove the import of `RenderTheme` from `./theme.ts` in the same file. The current line 3:

```ts
import type { RenderTheme } from "./theme.ts";
```

Delete this line.

- [ ] **Step 2: Delete src/tui/theme.ts**

```bash
rm src/tui/theme.ts
```

- [ ] **Step 3: Run typecheck to see what breaks**

```bash
pnpm typecheck
```

Expected: errors in `render-tabs.ts`, `render-review.ts`, `render.ts`, and `tests/helpers/theme.ts` — all importing from the deleted `./theme.ts`.

### Task 2: Update import paths

**Files:**
- Modify: `src/tui/render-tabs.ts:2`
- Modify: `src/tui/render-review.ts:4`
- Modify: `src/tui/render.ts:2`
- Modify: `tests/helpers/theme.ts:1`

- [ ] **Step 1: Update render-tabs.ts**

In `src/tui/render-tabs.ts`, change:

```ts
import type { RenderTheme } from "./theme.ts";
```

to:

```ts
import type { RenderTheme } from "./render-question.ts";
```

- [ ] **Step 2: Update render-review.ts**

In `src/tui/render-review.ts`, change:

```ts
import type { RenderTheme } from "./theme.ts";
```

to:

```ts
import type { RenderTheme } from "./render-question.ts";
```

- [ ] **Step 3: Update render.ts**

In `src/tui/render.ts`, change:

```ts
import type { RenderTheme } from "./theme.ts";
```

to:

```ts
import type { RenderTheme } from "./render-question.ts";
```

- [ ] **Step 4: Update tests/helpers/theme.ts**

In `tests/helpers/theme.ts`, change:

```ts
import type { RenderTheme } from "../../src/tui/theme.ts";
```

to:

```ts
import type { RenderTheme } from "../../src/tui/render-question.ts";
```

- [ ] **Step 5: Run the full check suite**

```bash
pnpm check
```

Expected: all lint, typecheck, and tests pass. Zero behavioral changes.

### Task 3: Commit

- [ ] **Step 1: Commit the change**

```bash
git add -A
git commit -m "refactor(tui): dissolve theme.ts phantom seam

Move RenderTheme type to render-question.ts (primary consumer).
One adapter = hypothetical seam; don't maintain a file for it.

Generated with [Devin](https://devin.ai)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>"
```
