// Phase 8.1 G3a (D-08, D-09, D-10): `accord audit` reports what a machine can see about a repository's conventions. It reads files only, spends no model call,
// and exits 0 whenever it ran, whatever it found: it is a report, and no gate runs it (D-10, D-12).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { auditLines, CONVENTIONS_THIN, conventionLines } from '@accord-dev/accord-core';
import type { AuditFact, AuditGap } from '@accord-dev/accord-core';
import type { CommandContext } from '../run.js';

const CONVENTIONS = 'accord/product/conventions.md';

/** The conventions fact and gap: an absent file and a file with no convention line are the same gap (CONTEXT Ruling "What empty means"). */
function conventionsReport(root: string, facts: AuditFact[], gaps: AuditGap[]): void {
  const path = join(root, 'accord', 'product', 'conventions.md');
  if (!existsSync(path)) {
    facts.push({ name: 'conventions', value: 'no file' });
    gaps.push({ id: 'conventions-empty', text: CONVENTIONS + ' does not exist', fix: '/accord-audit drafts conventions from the code, and you accept the lines you want' });
    return;
  }
  const n = conventionLines(readFileSync(path, 'utf8')).length;
  facts.push({ name: 'conventions', value: `${n} convention ${n === 1 ? 'line' : 'lines'}` });
  if (n === 0) gaps.push({ id: 'conventions-empty', text: CONVENTIONS + ' has no convention line', fix: '/accord-audit drafts conventions from the code, and you accept the lines you want' });
  else if (n < CONVENTIONS_THIN) gaps.push({ id: 'conventions-thin', text: `${CONVENTIONS} has ${n} convention ${n === 1 ? 'line' : 'lines'}, fewer than ${CONVENTIONS_THIN}`, fix: '/accord-audit drafts more from the code, and you accept the lines you want' });
}

export function audit(ctx: CommandContext): number {
  const facts: AuditFact[] = [];
  const gaps: AuditGap[] = [];
  conventionsReport(ctx.root, facts, gaps);
  ctx.stdout.write(auditLines(facts, gaps));
  return 0;
}
