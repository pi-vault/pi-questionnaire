import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import { describe, expect, it, vi } from "vitest";
import type { NormalizedQuestion, QuestionnaireResult } from "../../src/core/types.ts";
import { runQuestionnaireUI } from "../../src/tui/questionnaire-ui.ts";

const single: NormalizedQuestion = {
  multiSelect: false,
  id: "scope",
  header: "Scope",
  prompt: "Pick scope",
  options: [
    { value: "small", label: "Small" },
    { value: "large", label: "Large" },
  ],
  recommendation: null,
  allowOther: false,
  allowChat: false,
};

const singleWithOther: NormalizedQuestion = { ...single, allowOther: true };
const singleWithChat: NormalizedQuestion = { ...single, allowChat: true };
const multi: NormalizedQuestion = {
  ...single,
  id: "features",
  header: "Features",
  multiSelect: true,
};

function driveCustom(questions: NormalizedQuestion[]) {
  let component: Component;
  let resolve!: (result: QuestionnaireResult) => void;
  const result = new Promise<QuestionnaireResult>((done) => {
    resolve = done;
  });
  const done = vi.fn((value: QuestionnaireResult) => resolve(value));
  const tui = { requestRender: vi.fn() };
  const theme = {
    fg: (_color: string, text: string) => text,
    bg: (_color: string, text: string) => text,
    bold: (text: string) => text,
  };
  const ctx = {
    ui: {
      custom: (factory: unknown) => {
        component = (
          factory as (
            tui: object,
            theme: object,
            keybindings: object,
            done: (value: QuestionnaireResult) => void,
          ) => Component
        )(tui, theme, {}, done);
        return result;
      },
    },
  } as Pick<ExtensionContext, "ui">;

  return {
    component: () => component,
    done,
    requestRender: tui.requestRender,
    result: runQuestionnaireUI(ctx, questions),
  };
}

function input(harness: ReturnType<typeof driveCustom>, data: string) {
  harness.component().handleInput?.(data);
}

describe("runQuestionnaireUI", () => {
  it("resolves a one-question option response on Enter", async () => {
    const harness = driveCustom([single]);

    input(harness, "\r");

    await expect(harness.result).resolves.toMatchObject({
      cancelled: false,
      responses: [{ questionId: "scope", selection: { kind: "option", value: "small" } }],
    });

    input(harness, "\r");
    input(harness, "\x1b");
    input(harness, "ignored");

    expect(harness.done).toHaveBeenCalledTimes(1);
    expect(harness.requestRender).not.toHaveBeenCalled();
  });

  it("resolves a one-question chat response on Enter", async () => {
    const harness = driveCustom([singleWithChat]);

    input(harness, "\x1b[B");
    input(harness, "\x1b[B");
    input(harness, "\r");

    await expect(harness.result).resolves.toMatchObject({
      cancelled: false,
      responses: [{ questionId: "scope", selection: { kind: "chat" } }],
    });
  });

  it("resolves a one-question custom response on Enter", async () => {
    const harness = driveCustom([singleWithOther]);

    input(harness, "\x1b[B");
    input(harness, "\x1b[B");
    input(harness, "\r");
    for (const character of "Custom") input(harness, character);
    input(harness, "\r");

    await expect(harness.result).resolves.toMatchObject({
      cancelled: false,
      responses: [{ questionId: "scope", selection: { kind: "custom", value: "Custom" } }],
    });
  });

  it("does not resolve whitespace-only custom input", async () => {
    const harness = driveCustom([singleWithOther]);

    input(harness, "\x1b[B");
    input(harness, "\x1b[B");
    input(harness, "\r");
    input(harness, " ");
    input(harness, "\r");

    expect(harness.done).not.toHaveBeenCalled();
    input(harness, "\x1b");
    await expect(harness.result).resolves.toMatchObject({ cancelled: true });
  });

  it("waits for Next before resolving a one-question multi-select response", async () => {
    const harness = driveCustom([multi]);

    input(harness, " ");
    expect(harness.done).not.toHaveBeenCalled();
    input(harness, "\x1b[B");
    input(harness, "\x1b[B");
    input(harness, "\r");

    await expect(harness.result).resolves.toMatchObject({
      cancelled: false,
      responses: [{ questionId: "features", selection: { kind: "options" } }],
    });
  });

  it("does not resolve after answering the first of two questions", async () => {
    const harness = driveCustom([single, multi]);

    input(harness, "\r");

    expect(harness.done).not.toHaveBeenCalled();
    input(harness, "\x1b");
    await expect(harness.result).resolves.toMatchObject({ cancelled: true });
  });

  it("keeps Review submission for two questions", async () => {
    const harness = driveCustom([single, multi]);

    input(harness, "\r");
    input(harness, " ");
    input(harness, "\x1b[B");
    input(harness, "\x1b[B");
    input(harness, "\r");

    expect(harness.done).not.toHaveBeenCalled();
    input(harness, "\r");
    await expect(harness.result).resolves.toMatchObject({
      cancelled: false,
      responses: [
        { questionId: "scope", selection: { kind: "option", value: "small" } },
        { questionId: "features", selection: { kind: "options" } },
      ],
    });
    expect(harness.done).toHaveBeenCalledTimes(1);
  });
});
