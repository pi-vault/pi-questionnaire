import { describe, expect, it } from "vitest";
import type {
  ExtensionAPI,
  ExtensionContext,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import createExtension from "../src/index.ts";
import {
  QUESTIONNAIRE_STATUS_EVENT,
  type QuestionnaireStatusEventPayload,
} from "../src/events.ts";

const _payloadTypeAllowsOtherLabels: QuestionnaireStatusEventPayload = {
  active: true,
  label: "A different waiting label",
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function registerTool() {
  let tool: ToolDefinition | undefined;
  const emitted: Array<{
    eventName: string;
    payload: QuestionnaireStatusEventPayload;
  }> = [];

  const pi = {
    events: {
      emit(eventName: string, payload: QuestionnaireStatusEventPayload) {
        emitted.push({ eventName, payload });
      },
    },
    registerTool(definition: ToolDefinition) {
      tool = definition;
    },
  } as Pick<ExtensionAPI, "events" | "registerTool"> as ExtensionAPI;

  createExtension(pi);

  if (!tool) {
    throw new Error("questionnaire tool was not registered");
  }

  return { tool, emitted };
}

function createContext(
  mode: ExtensionContext["mode"],
  custom: (...args: unknown[]) => Promise<unknown>,
): ExtensionContext {
  return {
    mode,
    hasUI: true,
    cwd: process.cwd(),
    ui: {
      custom: custom as unknown as ExtensionContext["ui"]["custom"],
    },
  } as unknown as ExtensionContext;
}

describe("questionnaire extension", () => {
  it("registers the questionnaire tool with sequential execution", () => {
    const { tool } = registerTool();
    expect(tool.name).toBe("questionnaire");
    expect(tool.executionMode).toBe("sequential");
  });

  it("emits active before opening the TUI and inactive after cancellation", async () => {
    const { tool, emitted } = registerTool();
    const deferred = createDeferred<{
      questions: [];
      responses: [];
      cancelled: true;
    }>();
    let customStarted = false;

    const executePromise = tool.execute(
      "tool-call",
      {
        questions: [
          {
            id: "scope",
            header: "Scope",
            prompt: "Which scope should we ship first?",
            options: [{ label: "Small" }, { label: "Large" }],
          },
        ],
      },
      undefined,
      undefined,
      {
        ...createContext("tui", async () => {
          customStarted = true;
          return deferred.promise;
        }),
      },
    );

    expect(customStarted).toBe(true);
    expect(emitted).toEqual([
      {
        eventName: QUESTIONNAIRE_STATUS_EVENT,
        payload: {
          active: true,
          label: "Waiting for questionnaire response",
        },
      },
    ]);

    deferred.resolve({
      questions: [],
      responses: [],
      cancelled: true,
    });

    const result = await executePromise;

    expect(result.details).toMatchObject({ cancelled: true });
    expect(emitted).toEqual([
      {
        eventName: QUESTIONNAIRE_STATUS_EVENT,
        payload: {
          active: true,
          label: "Waiting for questionnaire response",
        },
      },
      {
        eventName: QUESTIONNAIRE_STATUS_EVENT,
        payload: { active: false },
      },
    ]);
  });

  it("emits inactive when the TUI rejects", async () => {
    const { tool, emitted } = registerTool();
    const deferred = createDeferred<never>();

    const executePromise = tool.execute(
      "tool-call",
      {
        questions: [
          {
            id: "scope",
            header: "Scope",
            prompt: "Which scope should we ship first?",
            options: [{ label: "Small" }, { label: "Large" }],
          },
        ],
      },
      undefined,
      undefined,
      {
        ...createContext("tui", async () => deferred.promise),
      },
    );

    deferred.reject(new Error("ui failed"));

    await expect(executePromise).rejects.toThrow("ui failed");
    expect(emitted).toEqual([
      {
        eventName: QUESTIONNAIRE_STATUS_EVENT,
        payload: {
          active: true,
          label: "Waiting for questionnaire response",
        },
      },
      {
        eventName: QUESTIONNAIRE_STATUS_EVENT,
        payload: { active: false },
      },
    ]);
  });

  it("does not emit status events for invalid input", async () => {
    const { tool, emitted } = registerTool();

    const result = await tool.execute(
      "tool-call",
      {
        questions: [
          {
            id: "scope",
            header: "Scope",
            prompt: "Which scope should we ship first?",
            options: [{ label: "Only option" }],
          },
        ],
      },
      undefined,
      undefined,
      createContext("tui", async () => {
        throw new Error("custom() should not run for invalid input");
      }),
    );

    expect(result).toMatchObject({ isError: true });
    expect(emitted).toEqual([]);
  });

  it("does not emit status events outside TUI mode", async () => {
    const { tool, emitted } = registerTool();

    const result = await tool.execute(
      "tool-call",
      {
        questions: [
          {
            id: "scope",
            header: "Scope",
            prompt: "Which scope should we ship first?",
            options: [{ label: "Small" }, { label: "Large" }],
          },
        ],
      },
      undefined,
      undefined,
      {
        ...createContext("print", async () => {
          throw new Error("custom() should not run outside TUI mode");
        }),
        hasUI: false,
      },
    );

    expect(result).toMatchObject({ isError: true });
    expect(emitted).toEqual([]);
  });
});
