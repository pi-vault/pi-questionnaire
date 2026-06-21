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
