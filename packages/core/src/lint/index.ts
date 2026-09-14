// D-58 one list: loader findings stamped error, plus every table rule for the profile, sorted (A8).
import type { Finding } from '../model/finding.js';
import type { RepoSnapshot } from '../model/snapshot.js';
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

/** Pure: reads the snapshot only, never mutates it, and returns the same result on every call. */
export function lintSnapshot(snapshot: RepoSnapshot): LintResult {
  const profile = snapshot.config?.profile ?? 'build';
  // Pitfall 4: ajv echoes a schema.required at the same pointer as schema.if; the required finding is the actionable one.
  const loaded = snapshot.errors.filter((f) => f.rule !== 'schema.if').map((f) => ({ ...f, level: 'error' as const }));
  const linted = RULES.filter((r) => r.profiles.includes(profile)).flatMap((r) =>
    r.check(snapshot).map((d) => ({ ...d, rule: r.id, level: r.level })),
  );
  const findings = [...loaded, ...linted].sort(byFileLineRule);
  const errors = findings.filter((f) => f.level === 'error').length;
  return { findings, errors, warnings: findings.length - errors };
}
