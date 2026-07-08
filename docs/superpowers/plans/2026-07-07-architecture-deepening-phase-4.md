# Phase 4: Merge render-question Into One Function

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse `renderSingleChoiceQuestion` and `renderMultiChoiceQuestion` into one `renderQuestion` with a narrower interface.

**Architecture:** One function, one input object. `question.multiSelect` drives branching internally. The caller (`render.ts`) stops branching and assembling different argument lists.

**Tech Stack:** TypeScript 6, Vitest, Biome

**Note:** This phase works whether or not Phase 3 (cursor consolidation) has landed. If Phase 3 landed, the internals already iterate `RowSlot[]`. If not, the function uses inline index arithmetic — just in one place.

---

### Task 1: Write the new renderQuestion function and update tests

**Files:**
- Modify: `src/tui/render-question.ts`
- Modify: `tests/tui/render-question.test.ts`

- [ ] **Step 1: Update tests to use the new interface**

Replace the entire content of `tests/tui/render-question.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import type { NormalizedQuestion } from "../../src/core/types.ts";
import { renderQuestion } from "../../src/tui/render-question.ts";
import { noopTheme } from "../helpers/theme.ts";

function input(
  question: NormalizedQuestion,
  overrides: Partial<{
    cursor: number;
    selectedValue: string | null;
    customText: string | null;
    checked: Set<string>;
    inputMode: "navigate" | "typing" | "notes";
    editorLines: string[];
  }> = {},
) {
  return {
    question,
    cursor: 0,
    selectedValue: null,
    customText: null,
    checked: new Set<string>(),
    inputMode: "navigate" as const,
    editorLines: [] as string[],
    ...overrides,
  };
}

describe("renderQuestion — single-select", () => {
  const question: NormalizedQuestion = {
    multiSelect: false,
    id: "scope",
    header: "Scope",
    prompt: "What scope?",
    options: [
      { value: "small", label: "Small" },
      { value: "large", label: "Large", description: "Very large" },
    ],
    recommendation: "small",
    allowOther: false,
    allowChat: false,
  };

  it("renders prompt and all options", () => {
    const lines = renderQuestion(input(question), noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("What scope?");
    expect(text).toContain("1. Small");
    expect(text).toContain("2. Large");
  });

  it("shows cursor indicator on focused option", () => {
    const lines = renderQuestion(input(question), noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("\u25B8 ");
  });

  it("shows recommendation suffix", () => {
    const lines = renderQuestion(input(question), noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("[recommended]");
  });

  it("shows option description", () => {
    const lines = renderQuestion(
      input(question, { cursor: 1 }),
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain("Very large");
  });

  it("shows bullet on selected option when cursor is elsewhere", () => {
    const lines = renderQuestion(
      input(question, { cursor: 1, selectedValue: "small" }),
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain("\u2022 1. Small");
    expect(text).toContain("\u25B8 2. Large");
  });

  it("shows cursor on selected option when cursor is on it", () => {
    const lines = renderQuestion(
      input(question, { cursor: 0, selectedValue: "small" }),
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain("\u25B8 1. Small");
  });

  it("renders 'Type something.' sentinel when allowOther is true", () => {
    const q = { ...question, allowOther: true };
    const lines = renderQuestion(input(q), noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("3. Type something.");
  });

  it("does not render sentinel when allowOther is false", () => {
    const lines = renderQuestion(input(question), noopTheme, 80);
    const text = lines.join("\n");
    expect(text).not.toContain("Type something.");
  });

  it("renders custom text when set", () => {
    const q = { ...question, allowOther: true };
    const lines = renderQuestion(
      input(q, { customText: "My custom answer" }),
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain('"My custom answer"');
  });

  it("renders editor content in typing mode", () => {
    const q = { ...question, allowOther: true };
    const lines = renderQuestion(
      input(q, {
        cursor: q.options.length,
        inputMode: "typing",
        editorLines: ["hello"],
      }),
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain("hello");
  });

  it("renders multi-line editor lines separately (not joined)", () => {
    const q = { ...question, allowOther: true };
    const editorLines = ["---border---", "typed text", "---border---"];
    const lines = renderQuestion(
      input(q, {
        cursor: q.options.length,
        inputMode: "typing",
        editorLines,
      }),
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain("---border---\n");
    expect(text).toContain("typed text\n");
    expect(text).not.toContain("---border---typed text");
  });
});

describe("renderQuestion — multi-select", () => {
  const question: NormalizedQuestion = {
    multiSelect: true,
    id: "features",
    header: "Features",
    prompt: "Which features?",
    options: [
      { value: "auth", label: "Auth" },
      { value: "log", label: "Logging" },
    ],
    recommendation: "auth",
    allowOther: false,
    allowChat: false,
  };

  it("renders checkboxes with bullet for checked items", () => {
    const lines = renderQuestion(
      input(question, { checked: new Set(["auth"]) }),
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain("[\u2022] 1. Auth");
    expect(text).toContain("[ ] 2. Logging");
  });

  it("shows recommendation suffix on recommended options", () => {
    const lines = renderQuestion(input(question), noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("[recommended]");
  });

  it("renders '[ ] Chat about this' when allowChat is true", () => {
    const q = { ...question, allowChat: true };
    const lines = renderQuestion(input(q), noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("[ ] Chat about this");
  });

  it("does not render 'Chat about this' when allowChat is false", () => {
    const lines = renderQuestion(input(question), noopTheme, 80);
    const text = lines.join("\n");
    expect(text).not.toContain("Chat about this");
  });

  it("always renders '\u2500\u2500\u2500 Next' sentinel", () => {
    const lines = renderQuestion(input(question), noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("\u2500\u2500\u2500 Next");
  });
});

describe("renderQuestion — chat sentinel", () => {
  const baseQuestion: NormalizedQuestion = {
    multiSelect: false,
    id: "scope",
    header: "Scope",
    prompt: "What scope?",
    options: [
      { value: "small", label: "Small" },
      { value: "large", label: "Large" },
    ],
    recommendation: null,
    allowOther: false,
    allowChat: false,
  };

  it("renders 'N. Chat about this' when allowChat is true", () => {
    const q = { ...baseQuestion, allowChat: true };
    const lines = renderQuestion(input(q), noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("3. Chat about this");
  });

  it("does NOT render 'Chat about this' when allowChat is false", () => {
    const lines = renderQuestion(input(baseQuestion), noopTheme, 80);
    const text = lines.join("\n");
    expect(text).not.toContain("Chat about this");
  });

  it("chat index is after 'Type something.' when allowOther is true", () => {
    const q = { ...baseQuestion, allowOther: true, allowChat: true };
    const lines = renderQuestion(input(q), noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("3. Type something.");
    expect(text).toContain("4. Chat about this");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run tests/tui/render-question.test.ts
```

Expected: FAIL — `renderQuestion` is not exported from `render-question.ts` (only `renderSingleChoiceQuestion` and `renderMultiChoiceQuestion` exist).

- [ ] **Step 3: Rewrite render-question.ts with the unified function**

Replace the entire content of `src/tui/render-question.ts` with:

```ts
import type { NormalizedQuestion } from "../core/types.ts";
import { pushWrapped, pushWrappedWithPrefix } from "./helpers.ts";
import type { RenderTheme } from "./theme.ts";

export interface RenderQuestionInput {
  question: NormalizedQuestion;
  cursor: number;
  selectedValue: string | null;
  customText: string | null;
  checked: Set<string>;
  inputMode: "navigate" | "typing" | "notes";
  editorLines: string[];
}

export function renderQuestion(
  input: RenderQuestionInput,
  theme: RenderTheme,
  width: number,
): string[] {
  const { question, cursor, inputMode, editorLines } = input;
  const lines: string[] = [];

  pushWrapped(lines, theme.fg("text", question.prompt), width);
  lines.push("");

  for (let i = 0; i < question.options.length; i++) {
    const opt = question.options[i];
    const isCursor = i === cursor;
    const recSuffix =
      question.recommendation === opt.value ? " [recommended]" : "";

    if (question.multiSelect) {
      const isChecked = input.checked.has(opt.value);
      const prefix = isCursor ? theme.fg("accent", "\u25B8 ") : "  ";
      const marker = isChecked ? "[\u2022]" : "[ ]";
      const label = `${marker} ${i + 1}. ${opt.label}${recSuffix}`;
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
    } else {
      const isSelected = input.selectedValue === opt.value;
      const label = `${i + 1}. ${opt.label}${recSuffix}`;

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
    }
  }

  // Sentinels — only for single-select
  if (!question.multiSelect) {
    if (question.allowOther) {
      const sentinelIndex = question.options.length;
      const isCursor = sentinelIndex === cursor;
      const prefix = isCursor ? theme.fg("accent", "\u25B8 ") : "  ";

      if (inputMode === "typing") {
        const label = `${sentinelIndex + 1}.`;
        pushWrappedWithPrefix(
          lines,
          prefix,
          theme.fg("accent", label),
          width,
        );
        for (const line of editorLines) {
          lines.push(`    ${line}`);
        }
      } else if (input.customText) {
        const label = `${sentinelIndex + 1}. "${input.customText}"`;
        const color = isCursor ? "accent" : "text";
        pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
      } else {
        const label = `${sentinelIndex + 1}. Type something.`;
        const color = isCursor ? "accent" : "muted";
        pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
      }
    }

    if (question.allowChat) {
      const chatIndex =
        question.options.length + (question.allowOther ? 1 : 0);
      const isCursor = chatIndex === cursor;
      const prefix = isCursor ? theme.fg("accent", "\u25B8 ") : "  ";
      const label = `${chatIndex + 1}. Chat about this`;
      const color = isCursor ? "accent" : "muted";
      pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
    }
  }

  // Sentinels — only for multi-select
  if (question.multiSelect) {
    if (question.allowChat) {
      const chatIndex = question.options.length;
      const isCursor = chatIndex === cursor;
      const prefix = isCursor ? theme.fg("accent", "\u25B8 ") : "  ";
      const label = "[ ] Chat about this";
      const color = isCursor ? "accent" : "muted";
      pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
    }

    {
      const nextIndex =
        question.options.length + (question.allowChat ? 1 : 0);
      const isCursor = nextIndex === cursor;
      const prefix = isCursor ? theme.fg("accent", "\u25B8 ") : "  ";
      const label = "\u2500\u2500\u2500 Next";
      const color = isCursor ? "accent" : "dim";
      pushWrappedWithPrefix(lines, prefix, theme.fg(color, label), width);
    }
  }

  return lines;
}
```

**Note:** If Phase 1 (dissolve theme.ts) has landed, the `import type { RenderTheme } from "./theme.ts"` line should instead be removed and `RenderTheme` will already be defined in this file. Adjust accordingly based on what's already merged.

- [ ] **Step 4: Run render-question tests**

```bash
pnpm vitest run tests/tui/render-question.test.ts
```

Expected: all pass.

### Task 2: Update render.ts to use the new interface

**Files:**
- Modify: `src/tui/render.ts:9-13,56-81`

- [ ] **Step 1: Update imports in render.ts**

In `src/tui/render.ts`, replace:

```ts
import {
  renderSingleChoiceQuestion,
  renderMultiChoiceQuestion,
} from "./render-question.ts";
```

with:

```ts
import { renderQuestion } from "./render-question.ts";
```

- [ ] **Step 2: Replace the branching content block in render.ts**

In `src/tui/render.ts`, replace the content rendering block (the `} else if (q) {` block, lines 56-82):

```ts
  } else if (q) {
    if (q.multiSelect) {
      const checked = state.multiChecked.get(q.id) ?? new Set();
      lines.push(
        ...renderMultiChoiceQuestion(
          q,
          state.optionCursor,
          checked,
          theme,
          renderWidth,
        ),
      );
    } else {
      lines.push(
        ...renderSingleChoiceQuestion(
          q,
          state.optionCursor,
          getSelectedValue(state, q.id),
          state.customText.get(q.id) ?? null,
          state.inputMode,
          editorLines,
          theme,
          renderWidth,
        ),
      );
    }
  }
```

with:

```ts
  } else if (q) {
    lines.push(
      ...renderQuestion(
        {
          question: q,
          cursor: state.optionCursor,
          selectedValue: getSelectedValue(state, q.id),
          customText: state.customText.get(q.id) ?? null,
          checked: state.multiChecked.get(q.id) ?? new Set(),
          inputMode: state.inputMode,
          editorLines,
        },
        theme,
        renderWidth,
      ),
    );
  }
```

- [ ] **Step 3: Run the full check suite**

```bash
pnpm check
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(tui): merge render-question into one function

Collapse renderSingleChoiceQuestion and renderMultiChoiceQuestion
into renderQuestion with a single RenderQuestionInput object.
Interface narrows from 2 functions x 13 params to 1 function x 3 params.

Generated with [Devin](https://devin.ai)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>"
```
