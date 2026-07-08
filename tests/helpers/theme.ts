import type { RenderTheme } from "../../src/tui/render-question.ts";

export const noopTheme: RenderTheme = {
  fg: (_color: string, text: string) => text,
  bg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};
