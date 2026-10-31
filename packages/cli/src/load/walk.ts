// ST-LN-57: one walk of the ticket branch (HEAD less the default ref) with each commit's parents and paths.
// A merge's paths are those its remerge diff shows, so a merge counts for its own conflict resolutions only.
import { execFileSync } from 'node:child_process';
import { ownRecordsOnly } from '@accord-dev/accord-core';
import { gitIsShallow, parseAfterLog } from './fs.js';

export interface Walk {
  commits: Map<string, { parents: string[]; files: string[] }>; // lower-case shas
  order: string[]; // newest first, as git printed them
}

const NO_DEFAULT = 'no default branch: none of origin/HEAD, origin/main, origin/master, main or master resolves';

/** git's first non-blank stderr line without "fatal: ". */
function whyGit(e: unknown): string {
  const line = ((e as { stderr?: string }).stderr ?? '').split('\n').find((l) => l.trim() !== '');
  return line === undefined ? 'git failed' : line.replace(/^fatal: /, '').trim();
}

export function readWalk(root: string, o: { laneS: boolean; def: string | undefined; baseline: string | undefined }): Walk | { error: string } {
  if (gitIsShallow(root)) return { error: "this clone is shallow, so the ticket branch's history is cut; run git fetch --unshallow" };
  let negative: string;
  let firstParent = false;
  if (o.def !== undefined) negative = o.def;
  else if (o.laneS) return { error: NO_DEFAULT };
  else if (o.baseline !== undefined) {
    negative = o.baseline;
    firstParent = true;
  } else return { error: 'no default branch and plan.md records no baseline:' };
  const opts = {
    cwd: root,
    encoding: 'utf8' as const,
    stdio: ['ignore', 'pipe', 'pipe'] as ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
  };
  const args = (remerge: boolean) => [
    '-c', 'core.quotePath=false', '-c', 'log.showSignature=false', 'log', '--no-show-signature', '-z',
    '--format=%x01%H%x00%P', '--name-only', '--no-renames', ...(remerge ? ['--remerge-diff'] : []),
    ...(firstParent ? ['--first-parent'] : []), 'HEAD', '^' + negative, '--',
  ];
  let commits;
  try {
    commits = parseAfterLog(execFileSync('git', args(true), opts), true);
  } catch {
    try {
      commits = parseAfterLog(execFileSync('git', args(false), opts), false);
    } catch (e) {
      return { error: 'git failed reading the ticket branch: ' + whyGit(e) };
    }
    if (commits.some((c) => c.parents.length > 1)) {
      return { error: "git cannot show a merge's own changes (git log --remerge-diff needs git 2.36 or newer)" };
    }
  }
  const walk: Walk = { commits: new Map(), order: [] };
  for (const c of commits) {
    const sha = c.sha.toLowerCase();
    walk.commits.set(sha, { parents: c.parents.map((p) => p.toLowerCase()), files: c.files ?? [] });
    walk.order.push(sha);
  }
  return walk;
}

/** The walk commits reachable from `from`, itself included when it is in the walk. */
export function reach(walk: Walk, from: string): Set<string> {
  const seen = new Set<string>();
  const stack = [from.toLowerCase()];
  for (let sha = stack.pop(); sha !== undefined; sha = stack.pop()) {
    const c = walk.commits.get(sha);
    if (c === undefined || seen.has(sha)) continue;
    seen.add(sha);
    stack.push(...c.parents);
  }
  return seen;
}

/** Following first parents from `from`, `from` included, the first walk commit that is not records-only; the first commit reached outside the walk when there is none. */
export function nearestCode(walk: Walk, from: string, id: string): string {
  let sha = from.toLowerCase();
  for (;;) {
    const c = walk.commits.get(sha);
    if (c === undefined || !ownRecordsOnly(id, c.files) || c.parents.length === 0) return sha;
    sha = c.parents[0];
  }
}
