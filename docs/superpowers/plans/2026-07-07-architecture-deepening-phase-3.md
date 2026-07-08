# Phase 3: Consolidate Cursor-Position Arithmetic

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `state.ts` the single source of truth for question row layout. Eliminate duplicated sentinel-index arithmetic from `render-question.ts`.

**Architecture:** Add `RowSlot` type and `rowLayout()` function to `state.ts`. Simplify `cursorTarget` and `visibleRowCount` to delegate. Rewrite `render-question.ts` to iterate slots instead of computing positions.

**Tech Stack:** TypeScript 6, Vitest, Biome

---

### Task 1: Add RowSlot type and rowLayout function

**Files:**

- Modify: `src/tui/state.ts:1-6` (add NormalizedOption import)
- Modify: `src/tui/state.ts:8-48` (add RowSlot, rowLayout; rewrite cursorTarget, visibleRowCount)
- Test: `tests/tui/state.test.ts`

- [ ] **Step 1: Write failing tests for rowLayout**

Add the following at the top of `tests/tui/state.test.ts`, adding `rowLayout` to the import from `../../src/tui/state.ts`:

```ts
import {
  advanceToNextTab,
  allAnswered,
  answeredIds,
  buildResult,
  currentQuestion,
  cursorTarget,
  getSelectedValue,
  initState,
  reduce,
  rowLayout,
  visibleRowCount,
} from "../../src/tui/state.ts";
```

Then add this describe block after the existing fixture definitions (after line 129), before the `describe("initState", ...)` block:

```ts
describe("rowLayout", () => {
  it("returns option slots for plain single-select (no sentinels)", () => {
    const slots = rowLayout(questions[0]); // allowOther: false, allowChat: false
    expect(slots).toEqual([
      { kind: "option", index: 0, option: { value: "small", label: "Small" } },
      { kind: "option", index: 1, option: { value: "large", label: "Large" } },
    ]);
  });

  it("includes other slot for single-select with allowOther", () => {
    const slots = rowLayout(singleWithOther);
    expect(slots).toEqual([
      { kind: "option", index: 0, option: { value: "small", label: "Small" } },
      { kind: "option", index: 1, option: { value: "large", label: "Large" } },
      { kind: "other" },
    ]);
  });

  it("includes chat slot for single-select with allowChat", () => {
    const slots = rowLayout(singleWithChat);
    expect(slots).toEqual([
      { kind: "option", index: 0, option: { value: "small", label: "Small" } },
      { kind: "option", index: 1, option: { value: "large", label: "Large" } },
      { kind: "chat" },
    ]);
  });

  it("includes other then chat for single-select with both", () => {
    const slots = rowLayout(singleWithOtherAndChat);
    expect(slots).toEqual([
      { kind: "option", index: 0, option: { value: "small", label: "Small" } },
      { kind: "option", index: 1, option: { value: "large", label: "Large" } },
      { kind: "other" },
      { kind: "chat" },
    ]);
  });

  it("includes next slot for multi-select (no chat)", () => {
    const slots = rowLayout(questions[1]); // allowChat: false
    expect(slots).toEqual([
      { kind: "option", index: 0, option: { value: "auth", label: "Auth" } },
      { kind: "option", index: 1, option: { value: "log", label: "Logging" } },
      { kind: "next" },
    ]);
  });

  it("includes chat then next for multi-select with allowChat", () => {
    const slots = rowLayout(multiWithChat);
    expect(slots).toEqual([
      { kind: "option", index: 0, option: { value: "auth", label: "Auth" } },
      { kind: "option", index: 1, option: { value: "log", label: "Logging" } },
      { kind: "chat" },
      { kind: "next" },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run tests/tui/state.test.ts
```

Expected: FAIL — `rowLayout` is not exported from `state.ts`.

- [ ] **Step 3: Add the NormalizedOption import to state.ts**

In `src/tui/state.ts`, change line 1-6 from:

```ts
import type {
  NormalizedQuestion,
  QuestionResponse,
  QuestionSelection,
  QuestionnaireResult,
} from "../core/types.ts";
```

to:

```ts
import type {
  NormalizedOption,
  NormalizedQuestion,
  QuestionResponse,
  QuestionSelection,
  QuestionnaireResult,
} from "../core/types.ts";
```

- [ ] **Step 4: Add the RowSlot type and rowLayout function**

In `src/tui/state.ts`, replace the block from `export type CursorTarget` through the end of the `cursorTarget` function (lines 8-48) with:

```ts
export type CursorTarget =
  | { kind: "option"; index: number }
  | { kind: "other" }
  | { kind: "chat" }
  | { kind: "next" };

export type RowSlot =
  | { kind: "option"; index: number; option: NormalizedOption }
  | { kind: "other" }
  | { kind: "chat" }
  | { kind: "next" };

export function rowLayout(question: NormalizedQuestion): RowSlot[] {
  const slots: RowSlot[] = question.options.map((option, index) => ({
    kind: "option",
    index,
    option,
  }));

  if (!question.multiSelect) {
    if (question.allowOther) slots.push({ kind: "other" });
    if (question.allowChat) slots.push({ kind: "chat" });
  } else {
    if (question.allowChat) slots.push({ kind: "chat" });
    slots.push({ kind: "next" });
  }

  return slots;
}

export function visibleRowCount(question: NormalizedQuestion): number {
  return rowLayout(question).length;
}

export function cursorTarget(
  question: NormalizedQuestion,
  cursor: number,
): CursorTarget {
  const slots = rowLayout(question);
  const slot = slots[Math.min(cursor, slots.length - 1)];
  if (slot.kind === "option") return { kind: "option", index: slot.index };
  return { kind: slot.kind };
}
```

- [ ] **Step 5: Run the state tests**

```bash
pnpm vitest run tests/tui/state.test.ts
```

Expected: all tests pass — new `rowLayout` tests plus existing `cursorTarget` and `visibleRowCount` tests.

- [ ] **Step 6: Run the full check suite**

```bash
pnpm check
```

Expected: all pass. The render-question code still works — it hasn't been changed yet and doesn't import `rowLayout`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(tui): add rowLayout as single source of truth for cursor positions

RowSlot[] describes the row layout for a question.
cursorTarget and visibleRowCount now delegate to rowLayout.

Generated with [Devin](https://devin.ai)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>"
```

### Task 2: Rewrite render-question.ts to iterate RowSlot[]

**Files:**

- Modify: `src/tui/render-question.ts`
- Test: `tests/tui/render-question.test.ts` (no changes — same behavioral assertions)

- [ ] **Step 1: Rewrite render-question.ts to use rowLayout**

Replace the entire content of `src/tui/render-question.ts` with:

```ts
import type { NormalizedQuestion } from "../core/types.ts";
import { pushWrapped, pushWrappedWithPrefix } from "./helpers.ts";
import { rowLayout } from "./state.ts";

export interface RenderTheme {
  fg(color: string, text: string): string;
  bg(color: string, text: string): string;
  bold(text: string): string;
}

export function renderSingleChoiceQuestion(
  question: NormalizedQuestion,
  cursor: number,
  selectedValue: string | null,
  customText: string | null,
  inputMode: "navigate" | "typing" | "notes",
  editorLines: string[],
  theme: RenderTheme,
  width: number,
): string[] {
  const lines: string[] = [];
  const slots = rowLayout(question);

  pushWrapped(lines, theme.fg("text", question.prompt), width);
  lines.push("");

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const isCursor = i === cursor;

    switch (slot.kind) {
      case "option": {
        const opt = slot.option;
        const isSelected = selectedValue === opt.value;
        const recSuffix =
          question.recommendation === opt.value ? " [recommended]" : "";
        const label = `${slot.index + 1}. ${opt.label}${recSuffix}`;

        let prefix: string;
        let color: string;
        if (isCursor) {
          prefix = theme.fg("accent", "\u25B8 ");
          color = "accent";
        } else if (isSelected) {
          prefix = theme.fg("success", "\u2022 ");
          color = "success";
        } else {
          prefix = "  ";
          color = "text";
        }

        pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
        if (opt.description) {
          pushWrappedWithPrefix(
            lines,
            "     ",
            theme.fg("muted", opt.description),
            width,
          );
        }
        break;
      }
      case "other": {
        const prefix = isCursor ? theme.fg("accent", "\u25B8 ") : "  ";
        const sentinelNumber = i + 1;

        if (inputMode === "typing") {
          const label = `${sentinelNumber}.`;
          pushWrappedWithPrefix(
            lines,
            prefix,
            theme.fg("accent", label),
            width,
          );
          for (const line of editorLines) {
            lines.push(`    ${line}`);
          }
        } else if (customText) {
          const label = `${sentinelNumber}. "${customText}"`;
          const color = isCursor ? "accent" : "text";
          pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
        } else {
          const label = `${sentinelNumber}. Type something.`;
          const color = isCursor ? "accent" : "muted";
          pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
        }
        break;
      }
      case "chat": {
        const prefix = isCursor ? theme.fg("accent", "\u25B8 ") : "  ";
        const chatNumber = i + 1;
        const label = `${chatNumber}. Chat about this`;
        const color = isCursor ? "accent" : "muted";
        pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
        break;
      }
    }
  }

  return lines;
}

export function renderMultiChoiceQuestion(
  question: NormalizedQuestion,
  cursor: number,
  checked: Set<string>,
  theme: RenderTheme,
  width: number,
): string[] {
  const lines: string[] = [];
  const slots = rowLayout(question);

  pushWrapped(lines, theme.fg("text", question.prompt), width);
  lines.push("");

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const isCursor = i === cursor;
    const prefix = isCursor ? theme.fg("accent", "\u25B8 ") : "  ";

    switch (slot.kind) {
      case "option": {
        const opt = slot.option;
        const isChecked = checked.has(opt.value);
        const marker = isChecked ? "[\u2022]" : "[ ]";
        const recSuffix =
          question.recommendation === opt.value ? " [recommended]" : "";
        const label = `${marker} ${slot.index + 1}. ${opt.label}${recSuffix}`;
        const color = isCursor ? "accent" : isChecked ? "success" : "text";

        pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
        if (opt.description) {
          pushWrappedWithPrefix(
            lines,
            "       ",
            theme.fg("muted", opt.description),
            width,
          );
        }
        break;
      }
      case "chat": {
        const label = "[ ] Chat about this";
        const color = isCursor ? "accent" : "muted";
        pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
        break;
      }
      case "next": {
        const label = "\u2500\u2500\u2500 Next";
        const color = isCursor ? "accent" : "dim";
        pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
        break;
      }
    }
  }

  return lines;
}
```

- [ ] **Step 2: Run the render-question tests**

```bash
pnpm vitest run tests/tui/render-question.test.ts
```

Expected: all tests pass. Same visual output, different internal path.

- [ ] **Step 3: Run the full check suite**

```bash
pnpm check
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(tui): rewrite render-question to iterate RowSlot[]

No more duplicated sentinel-index arithmetic. Both render functions
now call rowLayout() and iterate typed slots.

Generated with [Devin](https://devin.ai)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>"
```
