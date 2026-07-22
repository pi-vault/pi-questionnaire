import type {
  ExtensionAPI,
  ExtensionContext,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import { QUESTIONNAIRE_STATUS_EVENT } from "../src/events.ts";
import createExtension from "../src/index.ts";

const validParams = {
  questions: [
    {
      id: "scope",
      header: "Scope",
      prompt: "Which scope?",
      options: [{ label: "Small" }, { label: "Full" }],
    },
  ],
};
const activeStatus = {
  active: true,
  label: "Waiting for questionnaire response",
};
const inactiveStatus = { active: false };
const cancelledResult = {
  questions: [],
  responses: [],
  cancelled: true,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setupExtension() {
  const registerTool = vi.fn<(tool: ToolDefinition) => void>();
  const emit = vi.fn();
  createExtension({ registerTool, events: { emit } } as unknown as ExtensionAPI);
  const tool = registerTool.mock.calls[0]?.[0];
  if (!tool) throw new Error("questionnaire tool was not registered");
  return { tool, emit };
}

function execute(tool: ToolDefinition, params: object, ctx: object) {
  return tool.execute("tool-call", params, undefined, undefined, ctx as ExtensionContext);
}

describe("questionnaire extension", () => {
  it("registers the questionnaire tool with sequential execution", () => {
    const { tool } = setupExtension();
    expect(tool).toMatchObject({ name: "questionnaire", executionMode: "sequential" });
  });

  it("emits active before opening the TUI and inactive after cancellation", async () => {
    const { tool, emit } = setupExtension();
    const pending = deferred<typeof cancelledResult>();
    const custom = vi.fn(() => pending.promise);

    const execution = execute(tool, validParams, { mode: "tui", ui: { custom } });

    expect(custom).toHaveBeenCalledOnce();
    expect(emit.mock.calls).toEqual([[QUESTIONNAIRE_STATUS_EVENT, activeStatus]]);

    pending.resolve(cancelledResult);
    await expect(execution).resolves.toMatchObject({ details: { cancelled: true } });
    expect(emit.mock.calls).toEqual([
      [QUESTIONNAIRE_STATUS_EVENT, activeStatus],
      [QUESTIONNAIRE_STATUS_EVENT, inactiveStatus],
    ]);
  });

  it("emits inactive when the TUI rejects", async () => {
    const { tool, emit } = setupExtension();
    const pending = deferred<never>();
    const execution = execute(tool, validParams, {
      mode: "tui",
      ui: { custom: () => pending.promise },
    });

    pending.reject(new Error("ui failed"));
    await expect(execution).rejects.toThrow("ui failed");
    expect(emit.mock.calls).toEqual([
      [QUESTIONNAIRE_STATUS_EVENT, activeStatus],
      [QUESTIONNAIRE_STATUS_EVENT, inactiveStatus],
    ]);
  });

  it("does not emit status events for invalid input", async () => {
    const { tool, emit } = setupExtension();
    const invalidParams = {
      questions: [
        {
          ...validParams.questions[0],
          options: [{ label: "Only option" }],
        },
      ],
    };

    await expect(execute(tool, invalidParams, { mode: "tui" })).resolves.toMatchObject({
      isError: true,
    });
    expect(emit).not.toHaveBeenCalled();
  });

  it("does not emit status events outside TUI mode", async () => {
    const { tool, emit } = setupExtension();

    await expect(execute(tool, validParams, { mode: "print" })).resolves.toMatchObject({
      isError: true,
    });
    expect(emit).not.toHaveBeenCalled();
  });
});
