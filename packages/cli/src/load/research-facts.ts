// ST-LN-94 CR-01, CR-02: the research fact of a lane R ticket, read from git: its claim commit's time, and which listed records the branch added
// or changed after that commit, each with the time of its last change. Every git failure is `{ error }`, which core reads as no record of the
// ticket's own (fail closed). This module imports nothing from fs.ts, so fs.ts and claim-facts.ts may both use it.
import { execFileSync } from 'node:child_process';
import { isResearchRecord } from '@accord-dev/accord-core';
import type { ResearchFact, Ticket } from '@accord-dev/accord-core';

const GIT = {
  encoding: 'utf8' as const,
  stdio: ['ignore', 'pipe', 'pipe'] as ['ignore', 'pipe', 'pipe'],
  maxBuffer: 64 * 1024 * 1024,
  env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
};

/** One `claim: <id>` commit: its sha and its committer time in seconds since the epoch (ST-LN-94 D-11: the research clock starts there). */
export interface Claim {
  sha: string;
  time: number;
}

/** The commits reachable from `rev` (and not from the `notIn` refs) whose subject is exactly `claim: <id>`, oldest first (topological: a claim is never listed before its ancestor, whatever the commit dates). */
export function claimsOf(root: string, id: string, notIn: string[], rev = 'HEAD'): Claim[] {
  const claim = 'claim: ' + id;
  // `--grep` only narrows the log (it also matches `claim: <id>0` and a body line), so the subject is compared exactly.
  const log = execFileSync(
    'git',
    ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '--fixed-strings', '--grep=' + claim, '--topo-order', '--reverse', '--format=%H %ct %s', rev, ...notIn],
    { cwd: root, ...GIT },
  );
  const hits: Claim[] = [];
  for (const line of log.split('\n')) {
    const space = line.indexOf(' ');
    const second = space > 0 ? line.indexOf(' ', space + 1) : -1;
    if (second > 0 && line.slice(second + 1) === claim) {
      hits.push({ sha: line.slice(0, space).toLowerCase(), time: Number(line.slice(space + 1, second)) });
    }
  }
  return hits;
}

/**
 * The commit a ticket's claim is read at (ST-LN-91 D-15): the newest `claim: <id>` commit reachable from HEAD and not from the default ref `ref`,
 * else the newest one overall. `offDefault` says which: the first is a claim on the working branch, whose own commits are those not on `ref`.
 */
export function claimCommitOf(root: string, id: string, ref: string | undefined): { claim: Claim; offDefault: boolean } | undefined {
  const off = claimsOf(root, id, ref === undefined ? [] : ['--not', ref]);
  if (off.length > 0) return { claim: off[off.length - 1], offDefault: ref !== undefined };
  const any = ref === undefined ? [] : claimsOf(root, id, []);
  return any.length > 0 ? { claim: any[any.length - 1], offDefault: false } : undefined;
}

const why = (e: unknown): string => {
  const err = e as { stderr?: string | Buffer; message?: string };
  const text = (typeof err.stderr === 'string' ? err.stderr : err.stderr?.toString('utf8')) ?? '';
  return (text.trim() || err.message || String(e)).split('\n')[0];
};

/**
 * CR-01, CR-02: the research fact of lane R ticket `t` at `rev`.
 * - At HEAD (`rev` undefined): the claim is the one accord budget clocks from (claimCommitOf). A claim on the working branch counts only the commits
 *   after it that the default ref does not hold, so a record another ticket merged into the default branch is not this ticket's. A listed record
 *   with a change not yet committed (staged, unstaged or untracked) counts as changed at `now` (seconds).
 * - At the default ref `rev`: the newest claim that ref holds, and every commit after it there (the ticket's branch merged).
 * The time of a record's change is the committer time of the newest such commit that touches it. Pathspecs are literal.
 */
export function gitResearchFact(root: string, t: Ticket, o: { ref: string | undefined; rev?: string; now: number }): ResearchFact {
  try {
    const records = [...new Set((t.frontmatter?.research ?? []).filter(isResearchRecord))];
    const found =
      o.rev === undefined
        ? claimCommitOf(root, t.id, o.ref)
        : (() => {
            const all = claimsOf(root, t.id, [], o.rev);
            return all.length > 0 ? { claim: all[all.length - 1], offDefault: false } : undefined;
          })();
    if (found === undefined) return { error: `${t.id} has no claim: ${t.id} commit to count its research from` };
    const { claim, offDefault } = found;
    const changed: Record<string, number> = Object.create(null);
    if (records.length === 0) return { claimTime: claim.time, changed: { ...changed } };
    const rev = o.rev ?? 'HEAD';
    const log = execFileSync(
      'git',
      ['--literal-pathspecs', '-c', 'log.showSignature=false', 'log', '--no-show-signature', '--no-renames', '--format=%x01%ct', '--name-only',
        `${claim.sha}..${rev}`, ...(offDefault && o.ref !== undefined ? ['--not', o.ref] : []), '--', ...records],
      { cwd: root, ...GIT },
    );
    let time: number | undefined;
    for (const line of log.split('\n')) {
      if (line.startsWith('\u0001')) time = Number(line.slice(1));
      else if (line !== '' && time !== undefined && records.includes(line) && !Object.hasOwn(changed, line)) changed[line] = time;
    }
    if (o.rev === undefined) {
      const status = execFileSync('git', ['--literal-pathspecs', 'status', '--porcelain=v1', '-z', '--untracked-files=all', '--', ...records], { cwd: root, ...GIT });
      const entries = status.split('\0');
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        if (e.length < 4) continue;
        const path = e.slice(3);
        if (records.includes(path)) changed[path] = Math.max(changed[path] ?? 0, o.now);
        if (e[0] === 'R' || e[0] === 'C') i++; // the next field is the source path
      }
    }
    return { claimTime: claim.time, changed: { ...changed } };
  } catch (e) {
    return { error: `git failed reading the research of ${t.id}: ${why(e)}` };
  }
}

/** CR-01: the research facts of every lane R ticket of `tickets` that lists a research path, read at HEAD (`rev` undefined) or at `rev`. */
export function researchFactsFor(
  root: string,
  tickets: Record<string, Ticket>,
  o: { ref: string | undefined; rev?: string; now?: number },
): Record<string, ResearchFact> | undefined {
  const now = o.now ?? Math.floor(Date.now() / 1000);
  const out: Record<string, ResearchFact> = {};
  for (const t of Object.values(tickets)) {
    if (t.frontmatter?.lane !== 'R' || (t.frontmatter.research ?? []).length === 0) continue;
    out[t.id] = gitResearchFact(root, t, { ref: o.ref, ...(o.rev === undefined ? {} : { rev: o.rev }), now });
  }
  return Object.keys(out).length === 0 ? undefined : out;
}
