// GATE-01/GATE-06 Ready and GATE-02/GATE-03/GATE-11 Done (D-87, D-89): the ticket-scoped lint findings
// plus the gate table for the gate being run, merged into one sorted list. The verdict is read off that
// list and from nothing else — there is no flag, option, or config key that can produce a `pass` while
// an error finding exists.
import type { Finding } from '../model/finding.js';
import type { RepoSnapshot } from '../model/snapshot.js';
import { lintSnapshot } from '../lint/index.js';
import { acHash } from './hash.js';
import { downgradeMaintain, DONE_RULES, READY_PROMOTE, READY_RULES } from './rules.js';
import type { GateRule } from './rules.js';

export interface GateResult {
  gate: 'ready' | 'done';
  ticket: string;
  verdict: 'pass' | 'fail';
  findings: Finding[]; // sorted by file, then line (line-less first), then rule, reason, pointer
  acHash?: string; // absent only when the ticket is unknown or carries no `@ac-n` scenario (D-86)
}

// Code-point order, never a locale-aware compare, so the goldens are identical on every host.
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function byFileLineRule(a: Finding, b: Finding): number {
  return (
    cmp(a.file, b.file) ||
    (a.line ?? 0) - (b.line ?? 0) ||
    cmp(a.rule, b.rule) ||
    cmp(a.reason, b.reason) ||
    cmp(a.pointer ?? '', b.pointer ?? '')
  );
}

/**
 * D-89 ticket scope: the ticket file, its folder, and its assets folder. String comparison only — an id
 * may contain `.`, `-`, and `_`, so a regular expression built from it would widen the scope and pull a
 * neighbouring ticket's findings into this result (T-04-01).
 */
export function scoped(findings: Finding[], id: string): Finding[] {
  const file = 'accord/tickets/' + id + '.md';
  const folder = 'accord/tickets/' + id + '/';
  const assets = 'accord/assets/' + id + '/';
  return findings.filter((f) => f.file === file || f.file.startsWith(folder) || f.file.startsWith(assets));
}

/**
 * The shared gate body. One function, so `downgradeMaintain` keeps exactly one call site and every gate
 * inherits the GATE-07 matrix: a second copy is how one gate silently falls out of that matrix the
 * moment GATE-12 flips a level (D-88). `promote` is the D-89 hygiene promotion, which is Ready's alone.
 * Pure: reads the snapshot only, never mutates it, and returns the same result on every call.
 */
function run(
  gate: GateResult['gate'],
  rules: readonly GateRule[],
  promote: readonly string[],
  snapshot: RepoSnapshot,
  id: string,
): GateResult {
  const profile = snapshot.config?.profile ?? 'build';
  const gated = rules
    .filter((r) => r.profiles.includes(profile))
    .flatMap((r) => r.check(snapshot, id).map((d) => ({ ...d, rule: r.id, level: r.level })));
  // An unknown id short-circuits: gate.ticket-unknown is already in `gated` on BOTH tables, every
  // other check is silent without a ticket, and there is no scenario to hash. A table missing that row
  // would read its verdict off an empty list and pass a ticket that does not exist.
  const known = Object.hasOwn(snapshot.tickets, id);
  // READY_PROMOTE and MAINTAIN_DOWNGRADE are disjoint, so the order of the two passes cannot matter.
  const lint = known
    ? downgradeMaintain(scoped(lintSnapshot(snapshot).findings, id), profile).map((f) =>
        promote.includes(f.rule) ? { ...f, level: 'error' as const } : f,
      )
    : [];
  const findings = [...lint, ...gated].sort(byFileLineRule);
  const hash = known ? acHash(snapshot.tickets[id].scenarios) : undefined;
  return {
    gate,
    ticket: id,
    verdict: findings.some((f) => f.level === 'error') ? 'fail' : 'pass',
    findings,
    ...(hash === undefined ? {} : { acHash: hash }),
  };
}

/** GATE-01: the Ready table plus the three LINT-06 hygiene rules promoted to blocking (D-89). */
export function gateReady(snapshot: RepoSnapshot, id: string): GateResult {
  return run('ready', READY_RULES, READY_PROMOTE, snapshot, id);
}

/**
 * GATE-02/GATE-03/GATE-11: the Done table plus every ticket-scoped lint finding at the level lint
 * stamped. No hygiene promotion and no design rule — Done does not re-run Ready (D-89 applied to Done).
 */
export function gateDone(snapshot: RepoSnapshot, id: string): GateResult {
  return run('done', DONE_RULES, [], snapshot, id);
}
