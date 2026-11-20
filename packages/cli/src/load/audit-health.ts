// Phase 8.1 G3b (D-08 group 2, D-18): the facts and gaps about accord's own setup in a repository. It reads, and writes nothing: no config.yml edit, no trust allow, no rendered file.
import type { AuditFact, AuditGap } from '@accord-dev/accord-core';
import pkg from '../../package.json' with { type: 'json' };
import { newer } from '../commands/notice.js';
import type { CommandContext } from '../run.js';

const CONFIG = 'accord/config.yml';
const FIX_MARK = ' - run: ';
export const NOT_CHECKED = "config.yml does not pass this CLI's schema";

/** The gap for a pin message `pinMessage` built: the first part as the text, and as the fix the command it names, or /accord-upgrade when the running CLI is the newer one. */
export function pinGap(message: string, running: string): { text: string; fix: string } {
  const at = message.lastIndexOf(FIX_MARK);
  const text = at < 0 ? message : message.slice(0, at);
  const command = at < 0 ? undefined : message.slice(at + FIX_MARK.length);
  const pinned = /^config\.yml pins accord (\S+), running /.exec(message)?.[1];
  // A stale build (npm run build) is fixed by building; only an older pin is fixed by the upgrade skill.
  if (command === undefined || (command.startsWith('npx') && pinned !== undefined && newer(running, pinned))) return { text, fix: '/accord-upgrade' };
  return { text, fix: command };
}

/** The group 2 facts and gaps (Ruling "group 2 gap ids and fixes"). */
export function auditHealth(ctx: CommandContext): { facts: AuditFact[]; gaps: AuditGap[] } {
  const facts: AuditFact[] = [];
  const gaps: AuditGap[] = [];

  if (ctx.pinMismatch !== undefined) {
    const { text, fix } = pinGap(ctx.pinMismatch, pkg.version);
    gaps.push({ id: 'pin-mismatch', text, fix });
  }

  // A config this CLI cannot validate: say so once; every check that needs a valid config says `not checked` (Ruling "a config this CLI cannot validate").
  const configFindings = ctx.snapshot.errors.filter((e) => e.file === CONFIG && e.rule !== 'load.config-missing');
  if (ctx.snapshot.config === undefined && configFindings.length > 0) {
    const pinned = ctx.pinMismatch === undefined ? undefined : /^config\.yml pins accord (\S+), running /.exec(ctx.pinMismatch)?.[1];
    gaps.push({
      id: 'config-invalid',
      text: `accord/config.yml does not pass this CLI's schema (${configFindings.length} ${configFindings.length === 1 ? 'finding' : 'findings'})`,
      fix: `accord lint names them; when the pin is newer than this CLI, run npx --yes ${pkg.name}@${pinned ?? '<pin>'} audit`,
    });
  }
  return { facts, gaps };
}
