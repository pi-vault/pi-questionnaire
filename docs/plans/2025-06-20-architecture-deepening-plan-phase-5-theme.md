# Phase 5: Consolidate Theme Interfaces

> Part of [architecture-deepening-design.md](../specs/2025-06-20-architecture-deepening-design.md)
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace three identical private theme interfaces and three duplicated `noopTheme` test objects with one shared `RenderTheme` type and one shared test helper.

**Architecture:** Create `src/tui/theme.ts` for the shared interface and `tests/helpers/theme.ts` for the test helper. Update all consumers to import from these shared locations.

**Tech Stack:** TypeScript 6, Vitest 4, Biome 2.5

**Spec:** `docs/specs/2025-06-20-architecture-deepening-design.md` — Phase 1

**Verification command:** `pnpm check` (runs biome lint + typecheck + vitest)

---

## File Structure

```
src/tui/
  theme.ts                     # NEW — shared RenderTheme interface
  render-tabs.ts               # EDIT — delete TabBarTheme, import RenderTheme
  render-question.ts           # EDIT — delete QuestionTheme, import RenderTheme
  render-review.ts             # EDIT — delete ReviewTheme, import RenderTheme
tests/helpers/
  theme.ts                     # NEW — shared noopTheme
tests/tui/
  render-tabs.test.ts          # EDIT — import noopTheme from helpers
  render-question.test.ts      # EDIT — import noopTheme from helpers
  render-review.test.ts        # EDIT — import noopTheme from helpers
```

---

### Task 1: Create shared RenderTheme interface

**Files:**

- Create: `src/tui/theme.ts`

- [ ] **Step 1: Write `src/tui/theme.ts`**

```ts
export interface RenderTheme {
  fg(color: string, text: string): string;
  bg(color: string, text: string): string;
  bold(text: string): string;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/tui/theme.ts
git commit -m "feat: add shared RenderTheme interface"
```

---

### Task 2: Create shared test helper

**Files:**

- Create: `tests/helpers/theme.ts`

- [ ] **Step 1: Write `tests/helpers/theme.ts`**

```ts
import type { RenderTheme } from "../../src/tui/theme.ts";

export const noopTheme: RenderTheme = {
  fg: (_color: string, text: string) => text,
  bg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/helpers/theme.ts
git commit -m "test: add shared noopTheme helper"
```

---

### Task 3: Update render-tabs.ts to use RenderTheme

**Files:**

- Edit: `src/tui/render-tabs.ts`
- Edit: `tests/tui/render-tabs.test.ts`

- [ ] **Step 1: Replace TabBarTheme with RenderTheme import in `src/tui/render-tabs.ts`**

Delete lines 3-7 (the `TabBarTheme` interface) and add the import:

Replace:

```ts
import type { NormalizedQuestion } from "../core/types.ts";

interface TabBarTheme {
  fg(color: string, text: string): string;
  bg(color: string, text: string): string;
  bold(text: string): string;
}

export function renderTabBar(
  questions: NormalizedQuestion[],
  activeTab: number,
  answeredIds: Set<string>,
  theme: TabBarTheme,
```

With:

```ts
import type { NormalizedQuestion } from "../core/types.ts";
import type { RenderTheme } from "./theme.ts";

export function renderTabBar(
  questions: NormalizedQuestion[],
  activeTab: number,
  answeredIds: Set<string>,
  theme: RenderTheme,
```

- [ ] **Step 2: Replace noopTheme in `tests/tui/render-tabs.test.ts`**

Replace:

```ts
import { describe, expect, it } from "vitest";
import type { NormalizedQuestion } from "../../src/core/types.ts";
import { renderTabBar } from "../../src/tui/render-tabs.ts";

const noopTheme = {
  fg: (_color: string, text: string) => text,
  bg: (_color: string, text: string) => `[${text}]`,
  bold: (text: string) => text,
};
```

With:

```ts
import { describe, expect, it } from "vitest";
import type { NormalizedQuestion } from "../../src/core/types.ts";
import { renderTabBar } from "../../src/tui/render-tabs.ts";
import { noopTheme } from "../helpers/theme.ts";
```

**Important:** The tabs test uses `bg: (_color, text) => \`[${text}]\``while the shared helper uses`bg: (\_color, text) => text`. The test for "highlights active tab with bg wrapper" checks for `[ □ Scope ]`which depends on`bg`wrapping with brackets. Override`bg` locally in that specific test:

Replace:

```ts
  it("highlights active tab with bg wrapper", () => {
    const answeredIds = new Set<string>();
    const lines = renderTabBar(questions, 0, answeredIds, noopTheme, 80);
```

With:

```ts
  it("highlights active tab with bg wrapper", () => {
    const answeredIds = new Set<string>();
    const bgTheme = { ...noopTheme, bg: (_c: string, t: string) => `[${t}]` };
    const lines = renderTabBar(questions, 0, answeredIds, bgTheme, 80);
```

- [ ] **Step 3: Run tests**

Run: `pnpm check`
Expected: PASS (all 52 tests green)

- [ ] **Step 4: Commit**

```bash
git add src/tui/render-tabs.ts tests/tui/render-tabs.test.ts
git commit -m "refactor: use shared RenderTheme in render-tabs"
```

---

### Task 4: Update render-question.ts to use RenderTheme

**Files:**

- Edit: `src/tui/render-question.ts`
- Edit: `tests/tui/render-question.test.ts`

- [ ] **Step 1: Replace QuestionTheme with RenderTheme import in `src/tui/render-question.ts`**

Replace:

```ts
import { pushWrapped, pushWrappedWithPrefix } from "./helpers.ts";

interface QuestionTheme {
  fg(color: string, text: string): string;
  bg(color: string, text: string): string;
  bold(text: string): string;
}

export function renderSingleChoiceQuestion(
  question: NormalizedSingleChoiceQuestion,
  cursor: number,
  selectedValue: string | null,
  theme: QuestionTheme,
```

With:

```ts
import { pushWrapped, pushWrappedWithPrefix } from "./helpers.ts";
import type { RenderTheme } from "./theme.ts";

export function renderSingleChoiceQuestion(
  question: NormalizedSingleChoiceQuestion,
  cursor: number,
  selectedValue: string | null,
  theme: RenderTheme,
```

Also update the other two function signatures in the same file:

Replace `theme: QuestionTheme` with `theme: RenderTheme` in `renderMultiChoiceQuestion` (line 65) and `renderTextQuestion` (line 103).

- [ ] **Step 2: Replace noopTheme in `tests/tui/render-question.test.ts`**

Replace:

```ts
import {
  renderSingleChoiceQuestion,
  renderMultiChoiceQuestion,
  renderTextQuestion,
} from "../../src/tui/render-question.ts";

const noopTheme = {
  fg: (_color: string, text: string) => text,
  bg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};
```

With:

```ts
import {
  renderSingleChoiceQuestion,
  renderMultiChoiceQuestion,
  renderTextQuestion,
} from "../../src/tui/render-question.ts";
import { noopTheme } from "../helpers/theme.ts";
```

- [ ] **Step 3: Run tests**

Run: `pnpm check`
Expected: PASS (all 52 tests green)

- [ ] **Step 4: Commit**

```bash
git add src/tui/render-question.ts tests/tui/render-question.test.ts
git commit -m "refactor: use shared RenderTheme in render-question"
```

---

### Task 5: Update render-review.ts to use RenderTheme

**Files:**

- Edit: `src/tui/render-review.ts`
- Edit: `tests/tui/render-review.test.ts`

- [ ] **Step 1: Replace ReviewTheme with RenderTheme import in `src/tui/render-review.ts`**

Replace:

```ts
import { pushWrapped, pushWrappedWithPrefix } from "./helpers.ts";

interface ReviewTheme {
  fg(color: string, text: string): string;
  bg(color: string, text: string): string;
  bold(text: string): string;
}

export function renderReviewScreen(
  questions: NormalizedQuestion[],
  answers: Map<string, NormalizedAnswer>,
  cursor: number,
  theme: ReviewTheme,
```

With:

```ts
import { pushWrapped, pushWrappedWithPrefix } from "./helpers.ts";
import type { RenderTheme } from "./theme.ts";

export function renderReviewScreen(
  questions: NormalizedQuestion[],
  answers: Map<string, NormalizedAnswer>,
  cursor: number,
  theme: RenderTheme,
```

- [ ] **Step 2: Replace noopTheme in `tests/tui/render-review.test.ts`**

Replace:

```ts
import { renderReviewScreen } from "../../src/tui/render-review.ts";

const noopTheme = {
  fg: (_color: string, text: string) => text,
  bg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};
```

With:

```ts
import { renderReviewScreen } from "../../src/tui/render-review.ts";
import { noopTheme } from "../helpers/theme.ts";
```

- [ ] **Step 3: Run tests**

Run: `pnpm check`
Expected: PASS (all 52 tests green)

- [ ] **Step 4: Commit**

```bash
git add src/tui/render-review.ts tests/tui/render-review.test.ts
git commit -m "refactor: use shared RenderTheme in render-review"
```
