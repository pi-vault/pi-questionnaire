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
