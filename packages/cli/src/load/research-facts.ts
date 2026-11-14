// ST-LN-94 CR-01, CR-02: the research fact of a lane R ticket, read from git: its claim commit's time, and which listed records the branch added
// or changed after that commit (with no claim commit, from the commit that added the ticket file on), each with the time of its last change. Every git failure is `{ error }`, which core reads as no record of the
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

/**
 * One `claim: <id>` commit: its sha and its author time in seconds since the epoch (ST-LN-94 D-11: the research clock starts there). REVIEW2
 * WR-03: the author time, which a rebase keeps; a rebase or `git pull --rebase` sets the committer time to now.
 */
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
    ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '--fixed-strings', '--grep=' + claim, '--topo-order', '--reverse', '--format=%H %at %s', rev, ...notIn],
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
 * The commit a ticket's claim is read at (ST-LN-91 D-15): the newest `claim: <id>` commit reachable from `rev` (HEAD by default) and not from
 * the default ref `ref`, else the newest one overall. `offDefault` says which: the first is a claim on a working branch, whose own commits are
 * those not on `ref`. At `ref` itself only the second is asked.
 */
export function claimCommitOf(root: string, id: string, ref: string | undefined, rev = 'HEAD'): { claim: Claim; offDefault: boolean } | undefined {
  const off = ref === rev ? [] : claimsOf(root, id, ref === undefined ? [] : ['--not', ref], rev);
  if (off.length > 0) return { claim: off[off.length - 1], offDefault: ref !== undefined };
  const any = ref === undefined ? [] : claimsOf(root, id, [], rev);
  return any.length > 0 ? { claim: any[any.length - 1], offDefault: false } : undefined;
}

/** REVIEW2 CR-01: the newest commit reachable from `rev` that adds `path` (topological order); undefined when none does. Pathspec literal. */
function addedBy(root: string, rev: string, path: string): string | undefined {
  const log = execFileSync(
    'git',
    ['--literal-pathspecs', '-c', 'log.showSignature=false', 'log', '--no-show-signature', '--no-renames', '--diff-filter=A', '--topo-order', '--format=%H', rev, '--', path],
    { cwd: root, ...GIT },
  );
  const first = log.split('\n')[0].trim();
  return first === '' ? undefined : first;
}

const why = (e: unknown): string => {
  const err = e as { stderr?: string | Buffer; message?: string };
  const text = (typeof err.stderr === 'string' ? err.stderr : err.stderr?.toString('utf8')) ?? '';
  return (text.trim() || err.message || String(e)).split('\n')[0];
};

/**
 * CR-01, CR-02: the research fact of lane R ticket `t` at `rev`: HEAD and its working tree (`rev` undefined), the default ref, or (REVIEW2
 * WR-01) the tip of the claimed branch the main checkout reads the ticket from.
 * - The claim is the one accord budget clocks from (claimCommitOf at `rev`). A claim off the default ref counts only the commits after it that
 *   the default ref does not hold, so a record another ticket merged into the default branch is not this ticket's; a claim the default ref holds
 *   counts every commit after it on `rev` (the ticket's branch merged).
 * - REVIEW2 CR-01: with no claim commit reachable from `rev` (the default branch after a squash merge, or a rebase merge that dropped an empty
 *   claim commit), the commits counted are the one that added the ticket file on `rev` and every later one, and the fact has no `claimTime`, so
 *   the record's Spent line alone judges the timebox. A record last changed before the ticket file was added is still evidence. No such commit
 *   is an error.
 * - At HEAD, a listed record with a change not yet committed (staged, unstaged or untracked) counts as changed at `now` (seconds).
 * The time of a record's change is the author time (REVIEW2 WR-03, kept by a rebase) of the newest such commit that touches it. File names are
 * read NUL-separated and unquoted (REVIEW2 WR-02). Pathspecs are literal.
 */
export function gitResearchFact(root: string, t: Ticket, o: { ref: string | undefined; rev?: string; now: number }): ResearchFact {
  try {
    const records = [...new Set((t.frontmatter?.research ?? []).filter(isResearchRecord))];
    const rev = o.rev ?? 'HEAD';
    const found = claimCommitOf(root, t.id, o.ref, rev);
    let range: string[];
    if (found === undefined) {
      const ticketPath = 'accord/tickets/' + t.id + '.md';
      const added = addedBy(root, rev, ticketPath);
      if (added === undefined) return { error: `${t.id} has no claim: ${t.id} commit, and no commit adds ${ticketPath}, to count its research from` };
      range = [rev, '--not', added + '^@'];
    } else range = [`${found.claim.sha}..${rev}`, ...(found.offDefault && o.ref !== undefined ? ['--not', o.ref] : [])];
    const claimTime = found === undefined ? {} : { claimTime: found.claim.time };
    const changed: Record<string, number> = Object.create(null);
    if (records.length === 0) return { ...claimTime, changed: { ...changed } };
    const log = execFileSync(
      'git',
      ['--literal-pathspecs', '-c', 'log.showSignature=false', 'log', '--no-show-signature', '--no-renames', '-z', '--format=%x01%at', '--name-only',
        ...range, '--', ...records],
      { cwd: root, ...GIT },
    );
    // With -z each commit reads \x01<time>, NUL, then a newline and its paths, each NUL-terminated.
    let time: number | undefined;
    for (const field of log.split('\0')) {
      const item = field.startsWith('\n') ? field.slice(1) : field;
      if (item.startsWith('\u0001')) time = Number(item.slice(1));
      else if (item !== '' && time !== undefined && records.includes(item) && !Object.hasOwn(changed, item)) changed[item] = time;
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
    return { ...claimTime, changed: { ...changed } };
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
