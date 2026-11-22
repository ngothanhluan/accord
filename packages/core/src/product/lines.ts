// Phase 8.5 D-01 skeleton for the red commit: the names exist so the tests compile and fail on their assertions; the next commit replaces this file.
export const CONVENTIONS_FILE = 'accord/product/conventions.md';
export type LineProblemKind = 'length' | 'bidi' | 'tag' | 'hidden' | 'reserved' | 'unclosed-comment';
export interface LineVerdict { kind: LineProblemKind; reason: string; fix: string }
export interface LineProblem extends LineVerdict { line: number }
export function lineProblem(_line: string): LineVerdict | undefined {
  return undefined;
}
export function checkProductText(text: string): { lines: { line: number; text: string; withheld: boolean }[]; problems: LineProblem[] } {
  return { lines: text.split('\n').map((t, i) => ({ line: i + 1, text: t, withheld: false })), problems: [] };
}
export function withheldLine(file: string, n: number): string {
  return `(accord withheld line ${n} of ${file}: it breaks a delivery rule; run accord lint)`;
}
