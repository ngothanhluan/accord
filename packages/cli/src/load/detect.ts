// ST-LN-50 D-11 (TEAM-02): what `accord init` can tell about a repository's conventions from the repository itself.
// Host loader, read-only, bounded, never writes: it returns proposals, and a proposal is only text. The one place
// a value reaches `accord/config.yml` is `accord config set`, which the onboarding skill runs after asking
// the user, so nothing detected here is ever trusted as a value.
//
// Bounded (T-03.1-45): at most 200 commits are read, in one git process with a 64 MiB buffer, and every git call
// passes `-c log.showSignature=false --no-show-signature` so its output never depends on the user's git config
// (conventions.md). A git failure of any kind gives no proposal for that key, never a throw: init must still
// finish its own work on a repository whose history cannot be read.
//
// Evidence floor (Ruling, plan 03.1-33): a value is proposed only when at least `MIN_COMMITS` commits were read
// and one shape holds at least `MIN_SHARE_PERCENT` percent of them. A weak guess is a question the user would
// answer for nothing; the key stays unproposed and the team sets it later through `accord config`.
import { execFileSync } from 'node:child_process';
import { defaultRefOf } from './fs.js';

/** One detected value: a dotted config key, its JSON value, and the evidence for it in numbers. */
export interface Proposal {
  key: string;
  value: unknown;
  evidence: string;
}

const MAX_COMMITS = 200;
const MIN_COMMITS = 10;
const MIN_SHARE_PERCENT = 60;

const GIT = {
  encoding: 'utf8' as const,
  stdio: ['ignore', 'pipe', 'pipe'] as ['ignore', 'pipe', 'pipe'],
  maxBuffer: 64 * 1024 * 1024,
};

/** Every proposal this repository supports, in the order the output contract lists the keys (git.merge first). */
export function detectProposals(root: string): Proposal[] {
  const found = mergeStyle(root, defaultRefOf(root) ?? 'HEAD');
  return found === undefined ? [] : [found];
}

/** `refs/heads/main` and `refs/remotes/origin/main` both read as `main` in the evidence. */
const shortName = (ref: string): string => ref.replace(/^refs\/(?:heads|remotes\/origin)\//, '');

/**
 * `git.merge` from the first-parent history of `ref`, newest 200 commits: a history where most commits are merge
 * commits proposes `merge`, and one where most single-parent commits end in ` (#<n>)` (what a squash merge on a
 * host leaves) proposes `squash`. `rebase` is never proposed: a rebased pull request leaves single-parent commits
 * with no mark, which a team that pushes to main directly leaves too, so no count could tell the two apart.
 */
function mergeStyle(root: string, ref: string): Proposal | undefined {
  let raw: string;
  try {
    raw = execFileSync(
      'git',
      ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '-z', '--first-parent', '-n', String(MAX_COMMITS), '--format=%P%x00%s', ref],
      { cwd: root, ...GIT },
    );
  } catch {
    return undefined;
  }
  const tokens = raw.split('\0');
  let total = 0;
  let merges = 0;
  let suffixed = 0;
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    total += 1;
    if (tokens[i].split(' ').filter((p) => p !== '').length > 1) merges += 1;
    else if (/ \(#[0-9]+\)$/.test(tokens[i + 1])) suffixed += 1;
  }
  if (total < MIN_COMMITS) return undefined;
  const holds = (n: number): boolean => n * 100 >= total * MIN_SHARE_PERCENT;
  const on = shortName(ref);
  if (holds(suffixed)) return { key: 'git.merge', value: 'squash', evidence: `${suffixed} of ${total} recent commits on ${on} end in (#n)` };
  if (holds(merges)) return { key: 'git.merge', value: 'merge', evidence: `${merges} of ${total} recent commits on ${on} are merge commits` };
  return undefined;
}
