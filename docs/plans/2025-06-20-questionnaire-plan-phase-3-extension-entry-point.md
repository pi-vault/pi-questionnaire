# Phase 3: Extension Entry Point

> Part of [questionnaire-plan.md](./2025-06-20-questionnaire-plan.md)
>
> **Depends on:** Phase 1 (Core Layer) and Phase 2 (TUI Layer) must be complete before starting this phase.

This phase wires core + TUI into the tool registration. After this phase the extension is fully functional.

**Verification command:** `pnpm check` (runs biome lint + typecheck + vitest)

---

## Task 13: Extension entry point

**Files:**

- Modify: `src/index.ts`
- Modify: `tests/index.test.ts`

- [ ] **Step 1: Update `tests/index.test.ts`**

Replace the existing test with one that verifies the extension registers a tool:

```ts
import { describe, expect, it, vi } from "vitest";
import createExtension from "../src/index.ts";

describe("questionnaire extension", () => {
  it("exports a function", () => {
    expect(typeof createExtension).toBe("function");
  });

  it("registers a tool named 'questionnaire'", () => {
    const registerTool = vi.fn();
    const pi = { registerTool } as any;
    createExtension(pi);
    expect(registerTool).toHaveBeenCalledTimes(1);
    expect(registerTool.mock.calls[0][0].name).toBe("questionnaire");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/index.test.ts`
Expected: FAIL (registerTool not called because `src/index.ts` is still a stub)

- [ ] **Step 3: Write the full `src/index.ts`**

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import {
  QuestionnaireParamsSchema,
  validateQuestions,
  normalizeQuestions,
  formatContentSummary,
  formatAnswerForRender,
} from "./core/index.ts";
import type { QuestionInput, QuestionnaireResult } from "./core/index.ts";
import { runQuestionnaireUI } from "./tui/index.ts";

function errorResult(error: string): {
  content: { type: "text"; text: string }[];
  details: QuestionnaireResult;
  isError: true;
} {
  return {
    content: [{ type: "text", text: `Error: ${error}` }],
    details: { questions: [], answers: [], cancelled: true, error },
    isError: true,
  };
}

export default function createExtension(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "questionnaire",
    label: "Questionnaire",
    description:
      "Ask the user 1-10 structured questions. Supports single-choice, multi-choice, and free-text questions. Use for clarifying requirements, getting preferences, or confirming decisions.",
    promptSnippet:
      "Use this tool to collect structured user decisions before proceeding with implementation or planning.",
    promptGuidelines: [
      "Batch related clarification questions into one questionnaire call.",
      "Prefer this tool over guessing when requirements or preferences are unclear.",
      "Use choice/multi-choice when options are enumerable; use text for open-ended input.",
      "Place the recommended option's value in the recommendation field instead of modifying the label.",
      "Keep questions to 1-5 per call unless a decision genuinely requires more context.",
    ],
    parameters: QuestionnaireParamsSchema,

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const validation = validateQuestions(params.questions);
      if (!validation.valid) {
        return errorResult(validation.error);
      }

      const normalized = normalizeQuestions(params.questions);

      if (ctx.mode !== "tui") {
        return errorResult("Questionnaire requires interactive mode.");
      }

      const result = await runQuestionnaireUI(ctx, normalized);

      return {
        content: [{ type: "text", text: formatContentSummary(result) }],
        details: result,
      };
    },

    renderCall(args, theme, _context) {
      const qs = (args.questions as QuestionInput[]) || [];
      const count = qs.length;
      const labels = qs.map((q) => q.header || q.id).join(", ");
      let text = theme.fg("toolTitle", theme.bold("questionnaire "));
      text += theme.fg("muted", `${count} question${count !== 1 ? "s" : ""}`);
      if (labels) {
        text += theme.fg("dim", ` (${labels})`);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme, _context) {
      const details = result.details as QuestionnaireResult | undefined;
      if (!details) {
        const first = result.content[0];
        return new Text(first?.type === "text" ? first.text : "", 0, 0);
      }

      if (details.error) {
        return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
      }

      if (details.cancelled) {
        return new Text(theme.fg("warning", "Cancelled"), 0, 0);
      }

      const lines = details.answers.map((a) => {
        const q = details.questions.find((q) => q.id === a.questionId);
        if (!q) return `${theme.fg("success", "\u2713 ")}${a.questionId}`;
        const display = formatAnswerForRender(q, a);
        return `${theme.fg("success", "\u2713 ")}${theme.fg("accent", q.header + ":")} ${display}`;
      });

      return new Text(lines.join("\n"), 0, 0);
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/index.test.ts`
Expected: PASS

- [ ] **Step 5: Run full verification**

Run: `pnpm check`
Expected: PASS (lint + typecheck + all tests)

- [ ] **Step 6: Commit**

```bash
git add src/index.ts tests/index.test.ts
git commit -m "feat: wire questionnaire tool registration with core + TUI"
```
