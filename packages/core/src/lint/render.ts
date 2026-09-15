// D-60 text rendering, colour-free: `file:line: level rule reason` per finding, then `N errors, M warnings`.
// The parameter is anything carrying findings, so a GateResult renders with no adapter and the counts
// stay derived rather than duplicated into the JSON contract Phase 5 publishes (D-87).
import type { Finding } from '../model/finding.js';

export function renderText(result: { findings: Finding[] }): string {
  const lines = result.findings.map(
    (f) => `${f.file}${f.line === undefined ? '' : ':' + f.line}: ${f.level} ${f.rule} ${f.reason}`,
  );
  const errors = result.findings.filter((f) => f.level === 'error').length;
  // The plural is literal (`1 errors`) so the summary line has one shape for every parser (owner decision, 2026-09-14).
  return [...lines, `${errors} errors, ${result.findings.length - errors} warnings`].join('\n') + '\n';
}
