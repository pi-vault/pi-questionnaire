import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import {
  QuestionnaireParamsSchema,
  processQuestions,
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
    details: { questions: [], responses: [], cancelled: true, error },
    isError: true,
  };
}

export default function createExtension(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "questionnaire",
    label: "Questionnaire",
    description:
      "Ask the user 1-10 structured questions. Supports single-select and multi-select questions. Use for clarifying requirements, getting preferences, or confirming decisions.",
    promptSnippet:
      "Use this tool to collect structured user decisions before proceeding with implementation or planning.",
    promptGuidelines: [
      "Batch related clarification questions into one questionnaire call.",
      "Prefer this tool over guessing when requirements or preferences are unclear.",
      "Place the recommended option's value in the recommendation field instead of modifying the label.",
      "Keep questions to 1-5 per call unless a decision genuinely requires more context.",
    ],
    parameters: QuestionnaireParamsSchema,

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = processQuestions(params.questions);
      if (!result.ok) {
        return errorResult(result.error);
      }

      if (ctx.mode !== "tui") {
        return errorResult("Questionnaire requires interactive mode.");
      }

      const uiResult = await runQuestionnaireUI(ctx, result.questions);

      return {
        content: [{ type: "text", text: formatContentSummary(uiResult) }],
        details: uiResult,
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

      const lines = details.responses.map((r) => {
        const q = details.questions.find((q) => q.id === r.questionId);
        if (!q) return `${theme.fg("success", "\u2713 ")}${r.questionId}`;
        const display = formatAnswerForRender(q, r.selection);
        return `${theme.fg("success", "\u2713 ")}${theme.fg("accent", `${q.header}:`)} ${display}`;
      });

      return new Text(lines.join("\n"), 0, 0);
    },
  });
}
