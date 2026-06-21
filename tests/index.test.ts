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
