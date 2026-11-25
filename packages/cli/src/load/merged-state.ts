// Phase 15 D-17, D-21, D-29: what git says about a ticket's code being merged, for the dashboard's one picture of the repository. Everything here is read from git and never written:
// no file, no ref, no record is touched. A git failure always reads as "not merged" (unknown is never merged), so a ticket is never hidden from the group it belongs to by a failed call.
// A leaf module (no import of load/fs.ts), so the loader and `accord worktree` both import it.
import { execFileSync } from 'node:child_process';
import { progressOf } from '@accord-dev/accord-core';
import type { RepoSnapshot } from '@accord-dev/accord-core';

/** The five records of a ticket, as repository paths: its file, then its plan, ledger, review and verification. */
export const recordPaths = (id: string): string[] => [
  'accord/tickets/' + id + '.md',
  ...['plan', 'ledger', 'review', 'verification'].map((n) => 'accord/tickets/' + id + '/' + n + '.md'),
];

const git = (root: string, args: string[]): string => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });

/** The most changed paths `blobsOnRef` looks up, one `git log` each. */
const BLOB_PATHS_MAX = 200;

/**
 * ST-LN-96 t1-ac-5, D-04: is every file the branch `tip` wrote, since it left `ref`, a blob that the history of `ref` already holds at that path?
 * A squash or rebase merge writes the same blobs under other commits, so a branch whose files main then edited again has this proof and no
 * ancestry. True only when the branch's own changes are plain additions and modifications of regular files (a deletion, a rename, a type or
 * mode change, a link or a submodule gives false), there are at most BLOB_PATHS_MAX of them, and every blob is found by `--find-object`; a miss
 * or a git failure gives false, so the branch is kept.
 * Phase 15 D-21: moved here from `accord worktree`, behaviour unchanged, so the loader and the clean command read the one definition.
 */
export function blobsOnRef(root: string, tip: string, ref: string): boolean {
  try {
    const base = git(root, ['merge-base', ref, tip]).trim();
    if (base === '') return false;
    const fields = git(root, ['diff', '--raw', '-z', '--no-renames', '--no-abbrev', base, tip, '--']).split('\0');
    if (fields.pop() !== '') return false;
    // each change is a header (":<old mode> <new mode> <old sha> <new sha> <status>") then its path
    if (fields.length % 2 !== 0 || fields.length / 2 > BLOB_PATHS_MAX) return false;
    for (let i = 0; i < fields.length; i += 2) {
      const h = /^:(\d{6}) (\d{6}) [0-9a-f]+ ([0-9a-f]+) ([AM])$/.exec(fields[i]);
      if (h === null || (h[4] === 'A' ? h[2] !== '100644' : h[1] !== h[2] || (h[2] !== '100644' && h[2] !== '100755'))) return false;
      const file = fields[i + 1];
      if (file === '' || git(root, ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '-1', '--format=%H', '--find-object=' + h[3], ref, '--', ':(literal)' + file]).trim() === '') return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** The object name of each `<rev>:<path>` of `specs` in one `git cat-file --batch-check`, in order; undefined for a spec that names no blob. Any git failure gives undefined for every spec. */
function blobNames(root: string, specs: readonly string[]): (string | undefined)[] {
  if (specs.length === 0) return [];
  try {
    const out = execFileSync('git', ['cat-file', '--batch-check'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
      input: specs.map((s) => s + '\n').join(''),
    }).split('\n');
    return specs.map((_, i) => /^([0-9a-f]+) blob \d+$/.exec(out[i] ?? '')?.[1]);
  } catch {
    return specs.map(() => undefined);
  }
}

/**
 * D-29, D-21: the ids of the claims whose branch tip is merged into `ref`, the default ref. `claimRefs` maps a ticket id to its claim ref (`refs/heads/t/ID`).
 * Merged means one of: the tip is an ancestor of `ref` (one `git for-each-ref --merged`); or, for a squash or rebase merge that leaves the branch with other commits, the tip holds a
 * ledger.md and every one of the ticket's records the tip holds is the very blob `ref` holds at that path (one `git cat-file --batch-check` for all the claims). A tip with no ledger.md is
 * a claim that has built nothing, which equal records would otherwise make look merged. A failed git call gives an empty set for the ancestry and an unmatched claim for the blobs.
 * `blobsOnRef` (the clean command's proof, which reads the whole branch) is not used here: it costs several git processes per claim, and the dashboard reads every claim.
 */
export function mergedClaims(root: string, claimRefs: Readonly<Record<string, string>>, ref: string): Set<string> {
  const ids = Object.keys(claimRefs);
  const merged = new Set<string>();
  if (ids.length === 0) return merged;
  let ancestors: Set<string>;
  try {
    const out = execFileSync('git', ['for-each-ref', '--merged', ref, '--format=%(refname)', ...ids.map((id) => claimRefs[id])], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
    });
    ancestors = new Set(out.split('\n').filter((l) => l !== ''));
  } catch {
    return merged; // an unborn ref or a git failure: nothing is merged
  }
  const rest = ids.filter((id) => !ancestors.has(claimRefs[id]));
  for (const id of ids) if (ancestors.has(claimRefs[id])) merged.add(id);
  const specs = rest.flatMap((id) => recordPaths(id).flatMap((p) => [claimRefs[id] + ':' + p, ref + ':' + p]));
  const names = blobNames(root, specs);
  const per = recordPaths('x').length * 2;
  rest.forEach((id, k) => {
    let held = 0;
    let equal = true;
    let ledger = false;
    for (let j = 0; j < per; j += 2) {
      const tip = names[k * per + j];
      if (tip === undefined) continue;
      held++;
      if (j === 4) ledger = true; // the third record is the ledger
      if (tip !== names[k * per + j + 1]) equal = false;
    }
    if (held > 0 && ledger && equal) merged.add(id);
  });
  return merged;
}

/** One path the default ref has that HEAD does not hold as the default ref does: `A` added there, `M` changed there, `D` only HEAD has it. */
export interface RefChange {
  status: 'A' | 'M' | 'D';
  path: string;
  id: string;
}

/**
 * D-17: the ticket record paths under accord/tickets/ on which HEAD and `ref` differ, from one `git diff --name-status` between the two trees (no blob is read). The loader takes the
 * `A` and `M` paths from `ref` for every ticket but the checkout's own, so a worktree cut before a merge reads the same records as the main checkout; a `D` path is one only HEAD holds
 * (an unpublished local record, Ruling R3) and stays as the checkout has it. A git failure (an unborn HEAD) gives none.
 */
export function changedOnRef(root: string, ref: string): RefChange[] {
  let out: string;
  try {
    out = execFileSync('git', ['diff', '--name-status', '-z', '--no-renames', 'HEAD', ref, '--', 'accord/tickets'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
    });
  } catch {
    return [];
  }
  const fields = out.split('\0');
  const changes: RefChange[] = [];
  for (let i = 0; i + 1 < fields.length; i += 2) {
    const status = fields[i];
    const path = fields[i + 1];
    const id = /^accord\/tickets\/([^/]+)(?:\.md|\/(?:plan|ledger|review|verification)\.md)$/.exec(path)?.[1];
    if (id === undefined || (status !== 'A' && status !== 'M' && status !== 'D')) continue;
    changes.push({ status, path, id });
  }
  return changes;
}

/**
 * D-29, the gone-branch case: `snapshot` with `mergedClaims` extended by every open lane M, L or P ticket that has no claim ref left (its branch was deleted after the merge) and whose
 * default-ref records show it at review or verify, which is where a ticket stands after its code merged and before it is verified. Read from the default ref snapshot the load already made:
 * no git process. A snapshot with no default ref is returned as it is.
 */
export function withMergedClaims(snapshot: RepoSnapshot): RepoSnapshot {
  const def = snapshot.defaultRef?.snapshot;
  if (def === undefined) return snapshot;
  const claims = snapshot.claims ?? {};
  const gone: string[] = [];
  for (const [id, ticket] of Object.entries(def.tickets)) {
    const fm = ticket.frontmatter;
    if (fm?.status !== 'open' || fm.type === 'epic' || (fm.lane !== 'M' && fm.lane !== 'L' && fm.lane !== 'P')) continue;
    if (Object.hasOwn(claims, id)) continue;
    const stage = progressOf(def, ticket)?.stage;
    if (stage === 'review' || stage === 'verify') gone.push(id);
  }
  const merged = [...new Set([...(snapshot.mergedClaims ?? []), ...gone])];
  return merged.length === 0 ? snapshot : { ...snapshot, mergedClaims: merged };
}
