// Phase 8.2 group 3 (D-01..D-08): the facts and gaps about the work in a repository: claimed tickets that went quiet and drafts nobody touched, each naming the person. It reads git and files,
// writes nothing, fetches nothing and calls no model: the claim branches it judges are the ones already in this clone (local and origin-tracking), so the report is only as fresh as the last fetch.
// Group 3 loads the claims view itself, as `accord dashboard` does, inside a guard: `accord audit` keeps its checkout preflight, so a claim-view failure never stops the pin report or groups 1, 2 and 6.
import { isOpenWork, loadSnapshot, statusRows, ticketIdleGaps } from '@accord-dev/accord-core';
import type { AuditFact, AuditGap } from '@accord-dev/accord-core';
import type { CommandContext } from '../run.js';
import { NOT_CHECKED } from './audit-health.js';
import { loadClaimView, withDefaultRef, withQueued } from './fs.js';
import { whoFor } from './who.js';

/** The fact that names the display mode: `email`, `initials`, or the unset-value form that says what git holds (Ruling "who setting"). */
function whoFact(mode: string, value: string | undefined): string {
  if (value === undefined || value === '' || value === 'email' || value === 'initials') return mode;
  return `${mode} (git config accord.who is "${value}", which is neither email nor initials)`;
}

/** The first non-empty line of an error, for a `not checked` fact. */
function firstLine(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  return text.split(/\r?\n/).map((l) => l.trim()).find((l) => l !== '') ?? 'unknown error';
}

/** The group 3 facts and gaps (Rulings "group 3 facts, G1", "gap wording"). Every string goes through audit.ts's `fact()` and `gap()` closures, which make it printable. */
export async function auditHygiene(ctx: CommandContext): Promise<{ facts: AuditFact[]; gaps: AuditGap[] }> {
  const facts: AuditFact[] = [];
  const gaps: AuditGap[] = [];
  const config = ctx.snapshot.config;
  const who = whoFor(ctx.root, config);
  facts.push({ name: 'who', value: whoFact(who.mode, who.value) });
  // never a clean result for a check that did not run
  if (config === undefined) {
    facts.push({ name: 'work-ages', value: `not checked (${NOT_CHECKED})` });
    return { facts, gaps };
  }
  const staleDays = config.stale_days ?? '14';
  try {
    const parts = loadClaimView(ctx.root);
    const loaded = loadSnapshot(parts.view);
    const plain = parts.checkout === parts.view ? loaded : loadSnapshot(parts.checkout);
    const view = withQueued(ctx.root, withDefaultRef(ctx.root, loaded, parts.refs));
    const open = statusRows(view, Math.floor(Date.now() / 1000), plain).filter(isOpenWork(view));
    facts.push({ name: 'work-ages', value: `claimed tickets idle over ${staleDays} days (stale_days), from the branches already in this clone` });
    gaps.push(...ticketIdleGaps(open, staleDays, who.show));
  } catch (err) {
    facts.push({ name: 'work-ages', value: `not checked (the claim branches could not be read: ${firstLine(err)})` });
  }
  return { facts, gaps };
}
