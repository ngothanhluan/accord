// ST-LN-91 D-14: the planner's fix of plan.md as `accord round --plan` reads it from git: the last commit that changed
// plan-review.md (plan.md there is the plan as the round critiqued it), the `git diff -U0` hunks from it to the working tree, and
// both texts. The hunks are git's own; no diff algorithm lives in core. Every git error fails closed as `{ error }`.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { groundsV2 } from '@accord-dev/accord-core';
import type { PlanFix, PlanHunk, RepoSnapshot } from '@accord-dev/accord-core';
import { catBatch } from './fs.js';
import { whyGit } from './round-facts.js';

const GIT = {
  encoding: 'utf8' as const,
  stdio: ['pipe', 'pipe', 'pipe'] as ['pipe', 'pipe', 'pipe'],
  maxBuffer: 64 * 1024 * 1024,
  env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
};

// `@@ -a[,b] +c[,d] @@`: a missing count is 1. Anchored, no nested quantifier.
const HEADER = /^@@ -([0-9]+)(?:,([0-9]+))? \+([0-9]+)(?:,([0-9]+))? @@/gm;

/** The hunks of a `git diff -U0` output, in file order. */
export function hunksOf(diff: string): PlanHunk[] {
  return [...diff.matchAll(HEADER)].map((m) => ({
    oldStart: Number(m[1]),
    oldCount: m[2] === undefined ? 1 : Number(m[2]),
    newStart: Number(m[3]),
    newCount: m[4] === undefined ? 1 : Number(m[4]),
  }));
}

/** The working-tree file; undefined when it does not exist. */
function workingText(root: string, path: string): string | undefined {
  try {
    return readFileSync(join(root, path), 'utf8');
  } catch (e) {
    if ((e as { code?: string }).code === 'ENOENT') return undefined;
    throw e;
  }
}

/**
 * `snapshot` with planFix[id] set; `snapshot` itself when the check cannot apply: the plan record has no pin fact or a pin below the
 * cut-off (the check waits for the same round-1 pin as the grounds rule), or no commit has changed plan-review.md yet.
 */
export function withPlanFix(root: string, snapshot: RepoSnapshot, id: string): RepoSnapshot {
  if (!groundsV2(snapshot, id, 'plan')) return snapshot;
  const dir = `accord/tickets/${id}`;
  const set = (fix: PlanFix): RepoSnapshot => ({ ...snapshot, planFix: { ...snapshot.planFix, [id]: fix } });
  try {
    const base = execFileSync(
      'git',
      ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '-1', '--format=%H', 'HEAD', '--', `:(literal)${dir}/plan-review.md`],
      { cwd: root, ...GIT },
    ).trim().toLowerCase();
    if (base === '') return snapshot;
    const diff = execFileSync(
      'git',
      ['diff', '--no-color', '--no-ext-diff', '-U0', base, '--', `:(literal)${dir}/plan.md`],
      { cwd: root, ...GIT },
    );
    const old = catBatch(root, [`${base}:${dir}/plan.md`], 'plan.md at the last plan-review.md commit')[0];
    const now = workingText(root, `${dir}/plan.md`);
    return set({ base, hunks: hunksOf(diff), ...(old === undefined ? {} : { old }), ...(now === undefined ? {} : { new: now }) });
  } catch (e) {
    return set({ error: 'git failed reading the plan fix: ' + whyGit(e) });
  }
}
