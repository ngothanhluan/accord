// D-58 one list: loader findings stamped error, plus every table rule for the profile, sorted (A8).
import type { Finding } from '../model/finding.js';
import type { RepoSnapshot } from '../model/snapshot.js';
import { resolveStrictness } from '../config/strictness.js';
import { effectiveLevel, STAGE_OF, stageOff } from '../gate/floor.js';
import { RULES } from './rules.js';

export interface LintResult {
  findings: Finding[]; // sorted by file, then line (line-less first), then rule, reason, pointer
  errors: number;
  warnings: number;
}

// Code-point order, never a locale-aware compare, so the goldens are identical on every host.
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const byFileLineRule = (a: Finding, b: Finding): number =>
  cmp(a.file, b.file) ||
  (a.line ?? 0) - (b.line ?? 0) ||
  cmp(a.rule, b.rule) ||
  cmp(a.reason, b.reason) ||
  cmp(a.pointer ?? '', b.pointer ?? '');

/** The ticket id a finding's file belongs to: `accord/tickets/<id>.md` or a file under `accord/tickets/<id>/`; string work only, so an id with `.` or `-` never widens the match. */
function ticketOfFile(file: string): string | undefined {
  const root = 'accord/tickets/';
  if (!file.startsWith(root)) return undefined;
  const rest = file.slice(root.length);
  const slash = rest.indexOf('/');
  if (slash >= 0) return rest.slice(0, slash);
  return rest.endsWith('.md') ? rest.slice(0, -'.md'.length) : undefined;
}

/** Pure: reads the snapshot only, never mutates it, and returns the same result on every call. */
export function lintSnapshot(snapshot: RepoSnapshot): LintResult {
  const profile = snapshot.config?.profile ?? 'build';
  // Pitfall 4: ajv echoes a schema.required at the same pointer as schema.if; the required finding is the actionable one.
  const loaded = snapshot.errors.filter((f) => f.rule !== 'schema.if').map((f) => ({ ...f, level: 'error' as const }));
  const strictness = resolveStrictness(snapshot.config);
  // The same stamp as the gates' (gate/index.ts): the table level, or the team's for an OVERRIDABLE rule; off drops the rule's findings.
  const linted = RULES.filter((r) => r.profiles.includes(profile)).flatMap((r) => {
    const level = effectiveLevel(r.id, r.level, strictness);
    return level === 'off' ? [] : r.check(snapshot).map((d) => ({ ...d, rule: r.id, level }));
  });
  // D-08: a rule of a stage the ticket's lane turned off leaves with the stage (the gates read their lint findings from here, so this is their drop too); a LOCKED rule has no stage.
  const staged = linted.filter((f) => {
    const id = Object.hasOwn(STAGE_OF, f.rule) ? ticketOfFile(f.file) : undefined;
    return id === undefined || !stageOff(snapshot, id, STAGE_OF[f.rule]);
  });
  const findings = [...loaded, ...staged].sort(byFileLineRule);
  const errors = findings.filter((f) => f.level === 'error').length;
  return { findings, errors, warnings: findings.length - errors };
}
