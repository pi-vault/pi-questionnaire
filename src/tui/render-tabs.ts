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
