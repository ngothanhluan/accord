// D-60 text rendering, colour-free: `file:line: level rule reason` per finding, then `N errors, M warnings`.
import type { LintResult } from './index.js';

export function renderText(result: LintResult): string {
  const lines = result.findings.map(
    (f) => `${f.file}${f.line === undefined ? '' : ':' + f.line}: ${f.level} ${f.rule} ${f.reason}`,
  );
  // The plural is literal (`1 errors`) so the summary line has one shape for every parser (owner decision, 2026-09-14).
  return [...lines, `${result.errors} errors, ${result.warnings} warnings`].join('\n') + '\n';
}
