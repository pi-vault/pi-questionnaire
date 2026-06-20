# Phase 2: TUI Layer (interactive rendering)

> Part of [questionnaire-plan.md](./2025-06-20-questionnaire-plan.md)
>
> **Depends on:** Phase 1 (Core Layer) must be complete before starting this phase.

This phase builds the TUI components. After this phase the full questionnaire UI works end-to-end.

**Verification command:** `pnpm check` (runs biome lint + typecheck + vitest)

---

## Task 7: TUI helpers

**Files:**

- Create: `src/tui/helpers.ts`

- [ ] **Step 1: Write `src/tui/helpers.ts`**

```ts
import {
  truncateToWidth,
  visibleWidth,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";

export function pushWrapped(
  lines: string[],
  text: string,
  width: number,
): void {
  for (const line of wrapTextWithAnsi(text, Math.max(1, width))) {
    lines.push(truncateToWidth(line, width));
  }
}

export function pushWrappedWithPrefix(
  lines: string[],
  prefix: string,
  text: string,
  width: number,
): void {
  const prefixWidth = visibleWidth(prefix);
  const contentWidth = Math.max(1, width - prefixWidth);
  const wrapped = wrapTextWithAnsi(text, contentWidth);
  const continuation = " ".repeat(prefixWidth);

  for (let i = 0; i < wrapped.length; i++) {
    const p = i === 0 ? prefix : continuation;
    lines.push(truncateToWidth(`${p}${wrapped[i]}`, width));
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/tui/helpers.ts
git commit -m "feat: add shared TUI line-wrapping helpers"
```

---

## Task 8: Tab bar rendering

**Files:**

- Create: `src/tui/render-tabs.ts`
- Create: `tests/tui/render-tabs.test.ts`

- [ ] **Step 1: Write the test file `tests/tui/render-tabs.test.ts`**

These tests verify the tab bar logic without depending on pi-tui theme colors. We create a stub theme that passes text through unchanged.

```ts
import { describe, expect, it } from "vitest";
import type { NormalizedQuestion } from "../../src/core/types.ts";
import { renderTabBar } from "../../src/tui/render-tabs.ts";

const noopTheme = {
  fg: (_color: string, text: string) => text,
  bg: (_color: string, text: string) => `[${text}]`,
  bold: (text: string) => text,
};

const questions: NormalizedQuestion[] = [
  {
    type: "single-choice",
    id: "scope",
    header: "Scope",
    prompt: "Pick",
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
    recommendation: null,
  },
  {
    type: "text",
    id: "notes",
    header: "Notes",
    prompt: "Type",
    recommendation: null,
  },
];

describe("renderTabBar", () => {
  it("renders tab labels with answered/unanswered markers", () => {
    const answeredIds = new Set<string>();
    const lines = renderTabBar(questions, 0, answeredIds, noopTheme, 80);
    const joined = lines.join("");
    expect(joined).toContain("Scope");
    expect(joined).toContain("Notes");
    expect(joined).toContain("Review");
  });

  it("marks answered questions with filled marker", () => {
    const answeredIds = new Set(["scope"]);
    const lines = renderTabBar(questions, 0, answeredIds, noopTheme, 80);
    const joined = lines.join("");
    // Filled marker for answered
    expect(joined).toContain("\u25A0 Scope");
    // Empty marker for unanswered
    expect(joined).toContain("\u25A1 Notes");
  });

  it("highlights active tab with bg wrapper", () => {
    const answeredIds = new Set<string>();
    const lines = renderTabBar(questions, 0, answeredIds, noopTheme, 80);
    const joined = lines.join("");
    // Active tab (index 0 = Scope) gets bg wrap: [text]
    expect(joined).toContain("[ \u25A1 Scope ]");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/tui/render-tabs.test.ts`
Expected: FAIL

- [ ] **Step 3: Write `src/tui/render-tabs.ts`**

```ts
import type { NormalizedQuestion } from "../core/types.ts";

interface TabBarTheme {
  fg: (color: string, text: string) => string;
  bg: (color: string, text: string) => string;
  bold: (text: string) => string;
}

export function renderTabBar(
  questions: NormalizedQuestion[],
  activeTab: number,
  answeredIds: Set<string>,
  theme: TabBarTheme,
  _width: number,
): string[] {
  const reviewTabIndex = questions.length;
  const allAnswered = questions.every((q) => answeredIds.has(q.id));

  const tabs: string[] = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const answered = answeredIds.has(q.id);
    const marker = answered ? "\u25A0" : "\u25A1";
    const text = ` ${marker} ${q.header} `;
    if (i === activeTab) {
      tabs.push(theme.bg("selectedBg", theme.fg("text", text)));
    } else {
      tabs.push(theme.fg(answered ? "success" : "muted", text));
    }
  }

  const reviewMarker = allAnswered ? "\u2713" : "\u25A1";
  const reviewText = ` ${reviewMarker} Review `;
  if (activeTab === reviewTabIndex) {
    tabs.push(theme.bg("selectedBg", theme.fg("text", reviewText)));
  } else {
    tabs.push(theme.fg(allAnswered ? "success" : "muted", reviewText));
  }

  return [tabs.join(" "), ""];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/tui/render-tabs.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tui/render-tabs.ts tests/tui/render-tabs.test.ts
git commit -m "feat: add tab bar rendering"
```

---

## Task 9: Question rendering

**Files:**

- Create: `src/tui/render-question.ts`
- Create: `tests/tui/render-question.test.ts`

- [ ] **Step 1: Write the test file `tests/tui/render-question.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type {
  NormalizedSingleChoiceQuestion,
  NormalizedMultiChoiceQuestion,
  NormalizedTextQuestion,
} from "../../src/core/types.ts";
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

describe("renderSingleChoiceQuestion", () => {
  const question: NormalizedSingleChoiceQuestion = {
    type: "single-choice",
    id: "scope",
    header: "Scope",
    prompt: "What scope?",
    options: [
      { value: "small", label: "Small" },
      { value: "large", label: "Large", description: "Very large" },
    ],
    recommendation: "small",
  };

  it("renders prompt and all options", () => {
    const lines = renderSingleChoiceQuestion(
      question,
      0,
      null,
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain("What scope?");
    expect(text).toContain("1. Small");
    expect(text).toContain("2. Large");
  });

  it("shows cursor indicator on focused option", () => {
    const lines = renderSingleChoiceQuestion(
      question,
      0,
      null,
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain("\u25B8 ");
  });

  it("shows recommendation suffix", () => {
    const lines = renderSingleChoiceQuestion(
      question,
      0,
      null,
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain("[recommended]");
  });

  it("shows option description", () => {
    const lines = renderSingleChoiceQuestion(
      question,
      1,
      null,
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain("Very large");
  });

  it("shows bullet on selected option when cursor is elsewhere", () => {
    const lines = renderSingleChoiceQuestion(
      question,
      1,
      "small",
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    // Selected option (index 0 = Small) gets bullet marker
    expect(text).toContain("\u2022 1. Small");
    // Cursor option (index 1 = Large) gets cursor marker
    expect(text).toContain("\u25B8 2. Large");
  });

  it("shows cursor on selected option when cursor is on it", () => {
    const lines = renderSingleChoiceQuestion(
      question,
      0,
      "small",
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    // Cursor takes priority over bullet
    expect(text).toContain("\u25B8 1. Small");
  });
});

describe("renderMultiChoiceQuestion", () => {
  const question: NormalizedMultiChoiceQuestion = {
    type: "multi-choice",
    id: "features",
    header: "Features",
    prompt: "Which features?",
    options: [
      { value: "auth", label: "Auth" },
      { value: "log", label: "Logging" },
    ],
    recommendation: ["auth"],
  };

  it("renders checkboxes with bullet for checked items", () => {
    const checked = new Set(["auth"]);
    const lines = renderMultiChoiceQuestion(
      question,
      0,
      checked,
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain("[\u2022] 1. Auth");
    expect(text).toContain("[ ] 2. Logging");
  });

  it("shows recommendation suffix on recommended options", () => {
    const checked = new Set<string>();
    const lines = renderMultiChoiceQuestion(
      question,
      0,
      checked,
      noopTheme,
      80,
    );
    const text = lines.join("\n");
    expect(text).toContain("[recommended]");
  });
});

describe("renderTextQuestion", () => {
  const question: NormalizedTextQuestion = {
    type: "text",
    id: "notes",
    header: "Notes",
    prompt: "Any notes?",
    recommendation: null,
  };

  it("renders prompt", () => {
    const lines = renderTextQuestion(question, [], noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("Any notes?");
  });

  it("includes editor lines", () => {
    const editorLines = ["| some text |"];
    const lines = renderTextQuestion(question, editorLines, noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("| some text |");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/tui/render-question.test.ts`
Expected: FAIL

- [ ] **Step 3: Write `src/tui/render-question.ts`**

```ts
import type {
  NormalizedSingleChoiceQuestion,
  NormalizedMultiChoiceQuestion,
  NormalizedTextQuestion,
} from "../core/types.ts";
import { pushWrapped, pushWrappedWithPrefix } from "./helpers.ts";

interface QuestionTheme {
  fg: (color: string, text: string) => string;
  bg: (color: string, text: string) => string;
  bold: (text: string) => string;
}

export function renderSingleChoiceQuestion(
  question: NormalizedSingleChoiceQuestion,
  cursor: number,
  selectedValue: string | null,
  theme: QuestionTheme,
  width: number,
): string[] {
  const lines: string[] = [];

  pushWrapped(lines, theme.fg("text", question.prompt), width);
  lines.push("");

  for (let i = 0; i < question.options.length; i++) {
    const opt = question.options[i];
    const isCursor = i === cursor;
    const isSelected = selectedValue === opt.value;
    const recSuffix =
      question.recommendation === opt.value ? " [recommended]" : "";
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

  return lines;
}

export function renderMultiChoiceQuestion(
  question: NormalizedMultiChoiceQuestion,
  cursor: number,
  checked: Set<string>,
  theme: QuestionTheme,
  width: number,
): string[] {
  const lines: string[] = [];

  pushWrapped(lines, theme.fg("text", question.prompt), width);
  lines.push("");

  for (let i = 0; i < question.options.length; i++) {
    const opt = question.options[i];
    const isCursor = i === cursor;
    const isChecked = checked.has(opt.value);
    const prefix = isCursor ? theme.fg("accent", "\u25B8 ") : "  ";
    const marker = isChecked ? "[\u2022]" : "[ ]";
    const recSuffix = question.recommendation.includes(opt.value)
      ? " [recommended]"
      : "";
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
  }

  return lines;
}

export function renderTextQuestion(
  question: NormalizedTextQuestion,
  editorLines: string[],
  theme: QuestionTheme,
  width: number,
): string[] {
  const lines: string[] = [];

  pushWrapped(lines, theme.fg("text", question.prompt), width);
  lines.push("");

  for (const line of editorLines) {
    lines.push(` ${line}`);
  }

  lines.push("");
  pushWrapped(
    lines,
    theme.fg("dim", "Enter submit | Tab/Shift+Tab navigate tabs"),
    width,
  );

  return lines;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/tui/render-question.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tui/render-question.ts tests/tui/render-question.test.ts
git commit -m "feat: add question rendering for single-choice, multi-choice, and text"
```

---

## Task 10: Review screen rendering

**Files:**

- Create: `src/tui/render-review.ts`
- Create: `tests/tui/render-review.test.ts`

- [ ] **Step 1: Write the test file `tests/tui/render-review.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type {
  NormalizedAnswer,
  NormalizedQuestion,
} from "../../src/core/types.ts";
import { renderReviewScreen } from "../../src/tui/render-review.ts";

const noopTheme = {
  fg: (_color: string, text: string) => text,
  bg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};

const questions: NormalizedQuestion[] = [
  {
    type: "single-choice",
    id: "scope",
    header: "Scope",
    prompt: "Pick",
    options: [
      { value: "small", label: "Small" },
      { value: "large", label: "Large" },
    ],
    recommendation: null,
  },
  {
    type: "text",
    id: "notes",
    header: "Notes",
    prompt: "Type",
    recommendation: null,
  },
];

describe("renderReviewScreen", () => {
  it("shows answered and unanswered rows", () => {
    const answers = new Map<string, NormalizedAnswer>([
      [
        "scope",
        {
          type: "single-choice",
          questionId: "scope",
          value: "small",
          label: "Small",
        },
      ],
    ]);
    const lines = renderReviewScreen(questions, answers, 0, noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("Scope");
    expect(text).toContain("Small");
    expect(text).toContain("(unanswered)");
  });

  it("shows submit prompt when all answered", () => {
    const answers = new Map<string, NormalizedAnswer>([
      [
        "scope",
        {
          type: "single-choice",
          questionId: "scope",
          value: "small",
          label: "Small",
        },
      ],
      ["notes", { type: "text", questionId: "notes", value: "ok" }],
    ]);
    const lines = renderReviewScreen(questions, answers, 0, noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("Enter submit");
  });

  it("shows warning when not all answered", () => {
    const answers = new Map<string, NormalizedAnswer>();
    const lines = renderReviewScreen(questions, answers, 0, noopTheme, 80);
    const text = lines.join("\n");
    expect(text).toContain("Answer all questions");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/tui/render-review.test.ts`
Expected: FAIL

- [ ] **Step 3: Write `src/tui/render-review.ts`**

```ts
import type { NormalizedAnswer, NormalizedQuestion } from "../core/types.ts";
import { formatAnswerForRender } from "../core/format.ts";
import { pushWrapped, pushWrappedWithPrefix } from "./helpers.ts";

interface ReviewTheme {
  fg: (color: string, text: string) => string;
  bg: (color: string, text: string) => string;
  bold: (text: string) => string;
}

export function renderReviewScreen(
  questions: NormalizedQuestion[],
  answers: Map<string, NormalizedAnswer>,
  cursor: number,
  theme: ReviewTheme,
  width: number,
): string[] {
  const lines: string[] = [];
  const allAnswered = questions.every((q) => answers.has(q.id));

  pushWrapped(lines, theme.fg("accent", theme.bold("Review answers")), width);
  lines.push("");

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const answer = answers.get(q.id);
    const isCursor = i === cursor;
    const prefix = isCursor ? theme.fg("accent", "\u25B8 ") : "  ";
    const marker = answer
      ? theme.fg("success", "\u25A0")
      : theme.fg("warning", "\u25A1");
    const value = answer ? formatAnswerForRender(q, answer) : "(unanswered)";
    const valueColor = answer ? "text" : "muted";

    pushWrappedWithPrefix(
      lines,
      prefix,
      `${marker} ${theme.fg("accent", `${q.header}:`)} ${theme.fg(valueColor, value)}`,
      width,
    );
  }

  lines.push("");
  if (allAnswered) {
    pushWrapped(
      lines,
      theme.fg("success", "Enter submit | Space edit | Esc cancel"),
      width,
    );
  } else {
    pushWrapped(
      lines,
      theme.fg("warning", "Answer all questions before submitting."),
      width,
    );
    pushWrapped(lines, theme.fg("dim", "Space edit | Esc cancel"), width);
  }

  return lines;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/tui/render-review.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tui/render-review.ts tests/tui/render-review.test.ts
git commit -m "feat: add review screen rendering"
```

---

## Task 11: Questionnaire UI orchestrator

**Files:**

- Create: `src/tui/questionnaire-ui.ts`

This is the main TUI entry point: it creates the `ctx.ui.custom()` closure, owns all mutable state, routes input, and delegates rendering to the render functions from Tasks 8-10.

The theme object from the `ctx.ui.custom()` callback is the live Pi `Theme` instance, which automatically reflects the user's current theme. It is passed through to all render functions unchanged.

- [ ] **Step 1: Write `src/tui/questionnaire-ui.ts`**

```ts
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  Editor,
  type EditorTheme,
  Key,
  matchesKey,
} from "@earendil-works/pi-tui";
import type {
  NormalizedAnswer,
  NormalizedQuestion,
  QuestionnaireResult,
} from "../core/types.ts";
import { renderTabBar } from "./render-tabs.ts";
import {
  renderSingleChoiceQuestion,
  renderMultiChoiceQuestion,
  renderTextQuestion,
} from "./render-question.ts";
import { renderReviewScreen } from "./render-review.ts";
import { pushWrapped } from "./helpers.ts";

export async function runQuestionnaireUI(
  ctx: Pick<ExtensionContext, "ui">,
  questions: NormalizedQuestion[],
): Promise<QuestionnaireResult> {
  const reviewTabIndex = questions.length;

  return ctx.ui.custom<QuestionnaireResult>((tui, theme, _kb, done) => {
    // State
    let activeTab = 0;
    let optionCursor = 0;
    const answers = new Map<string, NormalizedAnswer>();
    const multiChecked = new Map<string, Set<string>>();
    const textValues = new Map<string, string>();
    let reviewCursor = 0;
    let cachedLines: string[] | undefined;

    // Initialize multi-checked sets and text values from recommendations
    for (const q of questions) {
      if (q.type === "multi-choice") {
        multiChecked.set(q.id, new Set(q.recommendation));
      }
      if (q.type === "text" && q.recommendation) {
        textValues.set(q.id, q.recommendation);
      }
    }

    // Editor for text questions
    const editorTheme: EditorTheme = {
      borderColor: (s) => theme.fg("accent", s),
      selectList: {
        selectedPrefix: (t) => theme.fg("accent", t),
        selectedText: (t) => theme.fg("accent", t),
        description: (t) => theme.fg("muted", t),
        scrollInfo: (t) => theme.fg("dim", t),
        noMatch: (t) => theme.fg("warning", t),
      },
    };
    const editor = new Editor(tui, editorTheme);

    editor.onSubmit = (value) => {
      const q = currentQuestion();
      if (!q || q.type !== "text") return;
      const trimmed = value.trim();
      textValues.set(q.id, trimmed);
      answers.set(q.id, { type: "text", questionId: q.id, value: trimmed });
      invalidate();
    };

    // Helpers
    function invalidate() {
      cachedLines = undefined;
      tui.requestRender();
    }

    function currentQuestion(): NormalizedQuestion | undefined {
      if (activeTab >= questions.length) return undefined;
      return questions[activeTab];
    }

    function answeredIds(): Set<string> {
      return new Set(answers.keys());
    }

    function allAnswered(): boolean {
      return questions.every((q) => answers.has(q.id));
    }

    function getSelectedValue(
      q: NormalizedQuestion & { type: "single-choice" },
    ): string | null {
      const answer = answers.get(q.id);
      if (answer?.type === "single-choice") return answer.value;
      return null;
    }

    function switchTab(nextTab: number) {
      activeTab = nextTab;
      optionCursor = 0;
      reviewCursor = 0;

      // Sync editor with text value for the new tab
      const q = currentQuestion();
      if (q?.type === "text") {
        editor.setText(textValues.get(q.id) ?? "");
      }

      invalidate();
    }

    function advanceToNext() {
      // Find the next unanswered tab (wrapping). Go to Review if all answered.
      for (let offset = 1; offset <= questions.length; offset++) {
        const idx = (activeTab + offset) % questions.length;
        if (!answers.has(questions[idx].id)) {
          switchTab(idx);
          return;
        }
      }
      switchTab(reviewTabIndex);
    }

    function finalize(cancelled: boolean) {
      done({
        questions,
        answers: questions
          .map((q) => answers.get(q.id))
          .filter((a): a is NormalizedAnswer => a !== undefined),
        cancelled,
      });
    }

    // Input handling
    function handleTabNavigation(data: string): boolean {
      const totalTabs = questions.length + 1;
      // Tab/Shift+Tab always navigate tabs
      if (matchesKey(data, Key.tab)) {
        switchTab((activeTab + 1) % totalTabs);
        return true;
      }
      if (matchesKey(data, Key.shift("tab"))) {
        switchTab((activeTab - 1 + totalTabs) % totalTabs);
        return true;
      }
      // Left/Right navigate tabs only on non-text questions
      // (text questions need Left/Right for cursor movement in the editor)
      const q = currentQuestion();
      if (q?.type !== "text") {
        if (matchesKey(data, Key.right)) {
          switchTab((activeTab + 1) % totalTabs);
          return true;
        }
        if (matchesKey(data, Key.left)) {
          switchTab((activeTab - 1 + totalTabs) % totalTabs);
          return true;
        }
      }
      return false;
    }

    function handleSingleChoiceInput(
      data: string,
      q: NormalizedQuestion & { type: "single-choice" },
    ) {
      const optCount = q.options.length;

      if (matchesKey(data, Key.up)) {
        optionCursor = Math.max(0, optionCursor - 1);
        invalidate();
        return;
      }
      if (matchesKey(data, Key.down)) {
        optionCursor = Math.min(optCount - 1, optionCursor + 1);
        invalidate();
        return;
      }
      if (matchesKey(data, Key.enter) || matchesKey(data, Key.space)) {
        const opt = q.options[optionCursor];
        answers.set(q.id, {
          type: "single-choice",
          questionId: q.id,
          value: opt.value,
          label: opt.label,
        });
        advanceToNext();
        return;
      }
    }

    function handleMultiChoiceInput(
      data: string,
      q: NormalizedQuestion & { type: "multi-choice" },
    ) {
      const optCount = q.options.length;
      const checked = multiChecked.get(q.id) ?? new Set();

      if (matchesKey(data, Key.up)) {
        optionCursor = Math.max(0, optionCursor - 1);
        invalidate();
        return;
      }
      if (matchesKey(data, Key.down)) {
        optionCursor = Math.min(optCount - 1, optionCursor + 1);
        invalidate();
        return;
      }
      if (matchesKey(data, Key.space)) {
        const opt = q.options[optionCursor];
        if (checked.has(opt.value)) {
          checked.delete(opt.value);
        } else {
          checked.add(opt.value);
        }
        multiChecked.set(q.id, checked);
        // Sync answer
        const selected = q.options
          .filter((o) => checked.has(o.value))
          .map((o) => ({ value: o.value, label: o.label }));
        if (selected.length > 0) {
          answers.set(q.id, {
            type: "multi-choice",
            questionId: q.id,
            selected,
          });
        } else {
          answers.delete(q.id);
        }
        invalidate();
        return;
      }
      if (matchesKey(data, Key.enter)) {
        // Confirm current selection (no-op if nothing selected, answer already synced)
        invalidate();
        return;
      }
    }

    function handleTextInput(data: string) {
      // Tab/Shift+Tab intercepted above; Left/Right passed through here
      // Esc cancels the questionnaire
      if (matchesKey(data, Key.escape)) {
        finalize(true);
        return;
      }
      // Forward everything else (including Left/Right for cursor) to the editor
      editor.handleInput(data);
      invalidate();
    }

    function handleReviewInput(data: string) {
      if (matchesKey(data, Key.up)) {
        reviewCursor = Math.max(0, reviewCursor - 1);
        invalidate();
        return;
      }
      if (matchesKey(data, Key.down)) {
        reviewCursor = Math.min(questions.length - 1, reviewCursor + 1);
        invalidate();
        return;
      }
      if (matchesKey(data, Key.space) || matchesKey(data, Key.enter)) {
        // If on a question row, jump to that question
        if (reviewCursor < questions.length) {
          // But if all answered and Enter, submit
          if (matchesKey(data, Key.enter) && allAnswered()) {
            finalize(false);
            return;
          }
          switchTab(reviewCursor);
          return;
        }
      }
    }

    function handleInput(data: string) {
      // Global: Esc cancels (except text questions handle their own Esc)
      const q = currentQuestion();
      if (q?.type !== "text" && matchesKey(data, Key.escape)) {
        finalize(true);
        return;
      }

      // Tab navigation (intercepted before everything, including text editor)
      if (handleTabNavigation(data)) return;

      // Question-specific handling
      if (activeTab === reviewTabIndex) {
        handleReviewInput(data);
        return;
      }

      if (!q) return;

      switch (q.type) {
        case "single-choice":
          handleSingleChoiceInput(data, q);
          return;
        case "multi-choice":
          handleMultiChoiceInput(data, q);
          return;
        case "text":
          handleTextInput(data);
          return;
      }
    }

    // Rendering
    function render(width: number): string[] {
      if (cachedLines) return cachedLines;

      const lines: string[] = [];
      const renderWidth = Math.max(1, width);

      lines.push(theme.fg("accent", "\u2500".repeat(renderWidth)));

      // Tab bar
      lines.push(
        ...renderTabBar(
          questions,
          activeTab,
          answeredIds(),
          theme,
          renderWidth,
        ),
      );

      // Content
      if (activeTab === reviewTabIndex) {
        lines.push(
          ...renderReviewScreen(
            questions,
            answers,
            reviewCursor,
            theme,
            renderWidth,
          ),
        );
      } else {
        const q = currentQuestion();
        if (q) {
          switch (q.type) {
            case "single-choice":
              lines.push(
                ...renderSingleChoiceQuestion(
                  q,
                  optionCursor,
                  getSelectedValue(q),
                  theme,
                  renderWidth,
                ),
              );
              break;
            case "multi-choice": {
              const checked = multiChecked.get(q.id) ?? new Set();
              lines.push(
                ...renderMultiChoiceQuestion(
                  q,
                  optionCursor,
                  checked,
                  theme,
                  renderWidth,
                ),
              );
              break;
            }
            case "text": {
              const editorLines = editor.render(Math.max(1, renderWidth - 2));
              lines.push(
                ...renderTextQuestion(q, editorLines, theme, renderWidth),
              );
              break;
            }
          }
        }
      }

      // Hint bar (non-text questions only, text question hint is in renderTextQuestion)
      const q = currentQuestion();
      if (q?.type !== "text") {
        lines.push("");
        const hint =
          activeTab === reviewTabIndex
            ? "Tab navigate | Enter submit | Space edit | Esc cancel"
            : q?.type === "multi-choice"
              ? "Tab navigate | Up/Down move | Space toggle | Esc cancel"
              : "Tab navigate | Up/Down move | Space/Enter select | Esc cancel";
        pushWrapped(lines, theme.fg("dim", hint), renderWidth);
      }

      lines.push(theme.fg("accent", "\u2500".repeat(renderWidth)));

      cachedLines = lines;
      return lines;
    }

    return {
      render,
      invalidate: () => {
        cachedLines = undefined;
      },
      handleInput,
    };
  });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/tui/questionnaire-ui.ts
git commit -m "feat: add questionnaire UI orchestrator with state and input routing"
```

---

## Task 12: TUI barrel export

**Files:**

- Create: `src/tui/index.ts`

- [ ] **Step 1: Write `src/tui/index.ts`**

```ts
export { runQuestionnaireUI } from "./questionnaire-ui.ts";
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/tui/index.ts
git commit -m "feat: add TUI barrel export"
```
