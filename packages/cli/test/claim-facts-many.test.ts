// Phase 08.9 D-03: the batched claim-fact reader against the per-ticket oracle. gitClaimFactsMany(root, ids, config) must hold, for every id, exactly what gitClaimFacts(root, id, config) returns,
// `{ error }` and undefined included; each fixture below is a real git repository read by both. D-02 is the second case: the claim commits of any number of tickets come from one log.
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { CONFIG, laneTicket, P } from '../../../test/helpers/lane.js';
import { gitClaimFacts, gitClaimFactsMany, onePathCommits, rulesetCommitsMany } from '../src/load/claim-facts.js';
import { countedSync, spawnLog } from './helpers/git-spawns.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, mergeMsg, writeFiles } from './helpers/repo.js';

vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig<typeof import('node:child_process')>()));

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) cleanup(dirs.pop() as string);
  spawnLog.on = false;
  spawnLog.calls = [];
});

/** A moment `n` minutes after a fixed start, so two commits made in one test never share a second. */
const at = (n: number): Date => new Date(Date.UTC(2026, 10, 1, 12, n, 0));

/** A sandbox on `branch` holding the config and a queued ticket file for each of `ids`, in one commit. */
function base(ids: string[], branch = 'main', config = CONFIG): string {
  const repo = makeEmptyRepo();
  dirs.push(repo);
  gitRun(repo, 'symbolic-ref', 'HEAD', `refs/heads/${branch}`);
  gitRun(repo, 'config', 'user.email', 'a@x.io');
  gitRun(repo, 'config', 'user.name', 'a');
  writeFiles(repo, { 'accord/config.yml': config, ...Object.fromEntries(ids.map((id) => [P(id), laneTicket(id)])) });
  commitMsg(repo, 'add tickets', at(0));
  return repo;
}

type Kind = 'none' | 'claim' | 'error';
const kindOf = (fact: ReturnType<typeof gitClaimFacts>): Kind => (fact === undefined ? 'none' : 'error' in fact ? 'error' : 'claim');

/** The map holds exactly the ids asked, each one deep-equal to the per-ticket read, and each one is the kind the fixture is built to give (so a fixture that reads undefined everywhere proves nothing). */
function same(repo: string, kinds: Record<string, Kind>, config?: Parameters<typeof gitClaimFacts>[2], chunk?: number): void {
  const ids = Object.keys(kinds);
  const many = gitClaimFactsMany(repo, ids, config, chunk);
  expect([...many.keys()].sort()).toEqual([...ids].sort());
  for (const id of ids) {
    const want = gitClaimFacts(repo, id, config);
    expect(kindOf(want), `${id} is built to read as ${kinds[id]}: ${JSON.stringify(want)}`).toBe(kinds[id]);
    expect(many.get(id), id).toEqual(want);
  }
}

/** The git verb of one argument list: the first word that is neither a flag nor the value of `-c`. */
function verbOf(argv: string[]): string {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '-c') i++;
    else if (!argv[i].startsWith('-')) return argv[i];
  }
  return '?';
}

// Phase 08.9 D-03: every fixture below is read by the batch and by the per-ticket oracle, and the two must agree.
it('risk:regression gitClaimFactsMany answers every ticket as gitClaimFacts does (D-03)', () => {
  // fixture 1: no claim commit at all
  same(base(['T-1', 'T-2']), { 'T-1': 'none', 'T-2': 'none' });

  // fixture 2: one claim on the default branch beside a ticket that has none
  const onMain = base(['T-1', 'T-2']);
  commitMsg(onMain, 'claim: T-1', at(1), true);
  same(onMain, { 'T-1': 'claim', 'T-2': 'none' });

  // fixture 3: a legacy claim subject named by commits.legacy_subjects.claim, and the current subject beside it
  const legacy = base(['T-1', 'T-2']);
  commitMsg(legacy, 'picked up T-1', at(1), true);
  commitMsg(legacy, 'claim: T-2', at(2), true);
  same(legacy, { 'T-1': 'claim', 'T-2': 'claim' }, { commits: { legacy_subjects: { claim: ['picked up {id}'] } } });

  // fixture 4: T-1 and T-10 both claimed; T-2 is named only in a body line and T-100 only by a longer id; neither is a claim
  const prefixes = base(['T-1', 'T-10', 'T-2', 'T-100']);
  commitMsg(prefixes, 'notes\n\nclaim: T-2 was talked about', at(1), true);
  commitMsg(prefixes, 'claim: T-10', at(2), true);
  commitMsg(prefixes, 'claim: T-100 retried', at(3), true);
  commitMsg(prefixes, 'claim: T-1', at(4), true);
  same(prefixes, { 'T-1': 'claim', 'T-10': 'claim', 'T-2': 'none', 'T-100': 'none' });

  // fixture 5: one id claimed on two branches whose claim commits are not ancestor-related, both merged into main by merge commits
  const twice = base(['T-1', 'T-2']);
  gitRun(twice, 'switch', '-q', '-c', 'branch-a');
  commitMsg(twice, 'claim: T-1', at(1), true);
  gitRun(twice, 'switch', '-q', 'main');
  gitRun(twice, 'switch', '-q', '-c', 'branch-b');
  commitMsg(twice, 'claim: T-1', at(2), true);
  commitMsg(twice, 'claim: T-2', at(3), true);
  gitRun(twice, 'switch', '-q', 'main');
  mergeMsg(twice, 'branch-a', 'merge a');
  mergeMsg(twice, 'branch-b', 'merge b');
  same(twice, { 'T-1': 'claim', 'T-2': 'claim' });
  // the batch must have handed T-1 (two unrelated claims) to claimCommitOf, or the fixture proves nothing about the order rule
  expect(countedSync(() => gitClaimFactsMany(twice, ['T-1'])).argv.some((a) => a.some((x) => x.startsWith('--grep='))), 'T-1 is read by claimCommitOf').toBe(true);

  // fixture 6: no default ref (the only branch is trunk, there is no origin)
  const noDefault = base(['T-1', 'T-2'], 'trunk');
  commitMsg(noDefault, 'claim: T-1', at(1), true);
  same(noDefault, { 'T-1': 'claim', 'T-2': 'none' });

  // fixture 7: HEAD on an unmerged ticket branch whose claim commit is on it, beside a ticket claimed on main (the claim off the default ref takes the merge-base process)
  const onBranch = base(['T-1', 'T-2']);
  commitMsg(onBranch, 'claim: T-1', at(1), true);
  gitRun(onBranch, 'switch', '-q', '-c', 'ticket-2');
  commitMsg(onBranch, 'claim: T-2', at(2), true);
  same(onBranch, { 'T-1': 'claim', 'T-2': 'claim' });

  // fixture 8: accord/config.yml missing at one ticket's claim commit, beside two good ids: that id alone is an error
  const noConfig = base(['T-1', 'T-2', 'T-3']);
  commitMsg(noConfig, 'claim: T-1', at(1), true);
  rmSync(join(noConfig, 'accord', 'config.yml'));
  commitMsg(noConfig, 'claim: T-2', at(2));
  writeFiles(noConfig, { 'accord/config.yml': CONFIG });
  commitMsg(noConfig, 'restore the config', at(3));
  commitMsg(noConfig, 'claim: T-3', at(4), true);
  same(noConfig, { 'T-1': 'claim', 'T-2': 'error', 'T-3': 'claim' });

  // fixture 9: a ruleset: line in the ticket file at its claim commit
  const atClaim = base(['T-1', 'T-2']);
  writeFiles(atClaim, { [P('T-1')]: laneTicket('T-1', { frontmatter: ['ruleset: "0.10.0"'] }) });
  commitMsg(atClaim, 'T-1 under a ruleset', at(1));
  commitMsg(atClaim, 'claim: T-1', at(2), true);
  same(atClaim, { 'T-1': 'claim', 'T-2': 'none' });
  expect(gitClaimFacts(atClaim, 'T-1'), 'the ruleset is read at the claim').toMatchObject({ ruleset: '0.10.0' });

  // fixture 10: no ruleset: line at the claim, one written by a later commit (the backfill)
  const after = base(['T-1', 'T-2']);
  commitMsg(after, 'claim: T-1', at(1), true);
  commitMsg(after, 'claim: T-2', at(2), true);
  writeFiles(after, { [P('T-1')]: laneTicket('T-1', { frontmatter: ['ruleset: "0.10.0"'] }) });
  commitMsg(after, 'sync: ruleset', at(3));
  same(after, { 'T-1': 'claim', 'T-2': 'claim' });
  expect(gitClaimFacts(after, 'T-1'), 'the ruleset is read from the commit that wrote it').toMatchObject({ ruleset: '0.10.0', rulesetCommit: expect.stringMatching(/^[0-9a-f]{40}/) });

  // fixture 11: a merge commit after the claim, the merge bringing in the ticket's ruleset
  const merged = base(['T-1', 'T-2']);
  commitMsg(merged, 'claim: T-1', at(1), true);
  gitRun(merged, 'switch', '-q', '-c', 'side');
  writeFiles(merged, { [P('T-1')]: laneTicket('T-1', { frontmatter: ['ruleset: "0.10.0"'] }) });
  commitMsg(merged, 'side: ruleset', at(2));
  gitRun(merged, 'switch', '-q', 'main');
  commitMsg(merged, 'claim: T-2', at(3), true);
  mergeMsg(merged, 'side', 'merge side');
  same(merged, { 'T-1': 'claim', 'T-2': 'claim' });

  // Phase 08.9 D-03 fixture (l): a merge that keeps the ticket branch's copy of one ticket file while the other side wrote a ruleset: line into it, and a mix of the other (the batched ruleset read must follow one side for T-1 only)
  const l = fixtureL();
  same(l.repo, { 'T-1': 'claim', 'T-2': 'claim' });
  expect(gitClaimFacts(l.repo, 'T-1'), 'the hidden side wrote no ruleset the claim sees').not.toHaveProperty('ruleset');
  expect(gitClaimFacts(l.repo, 'T-2'), 'the mixed file takes main\'s commit as its ruleset').toMatchObject({ ruleset: '0.10.0', rulesetCommit: l.expected[P('T-2')][0] });

  // Phase 08.9 D-03 fixture (m): a side branch adds and removes a ruleset: line before it merges; neither commit is the backfill
  const m = fixtureM();
  same(m.repo, { 'T-1': 'claim' });
  expect(gitClaimFacts(m.repo, 'T-1'), 'no commit the one-path log lists wrote a ruleset').not.toHaveProperty('ruleset');

  // Phase 08.9 D-03 fixture (n): five tickets read with a chunk of 2 (three ruleset logs): each takes its own backfill
  const n = fixtureN();
  same(n.repo, { 'T-1': 'claim', 'T-2': 'claim', 'T-3': 'claim', 'T-4': 'claim', 'T-5': 'claim' }, undefined, 2);
  expect(gitClaimFacts(n.repo, 'T-3'), 'the first commit that wrote a ruleset, not the last').toMatchObject({ ruleset: '0.10.0', rulesetCommit: n.expected[P('T-3')][0] });
});

// Phase 08.9 D-02: the claim commits of any number of tickets come from one log, with no --grep argument and one default-ref lookup.
it('risk:resource gitClaimFactsMany reads the claim commits of any number of tickets with one log (D-02)', () => {
  for (const count of [2, 12]) {
    const ids = Array.from({ length: count }, (_, i) => `T-${i + 1}`);
    const repo = base(ids);
    ids.forEach((id, i) => commitMsg(repo, `claim: ${id}`, at(i + 1), true));
    const { value, argv } = countedSync(() => gitClaimFactsMany(repo, ids));
    expect(value.size).toBe(count);
    expect(argv.filter((a) => a.some((x) => x.startsWith('--grep='))), `${count} tickets: a log still limits by --grep`).toEqual([]);
    expect(argv.filter((a) => verbOf(a) === 'for-each-ref').length, `${count} tickets: for-each-ref runs once`).toBe(1);
    // Phase 08.9 D-02: the merge base comes from the default ref's ancestor set, every ticket's blobs ride one cat-file --batch, and the ruleset backfill is read for every ticket by one log (08.9-05)
    const verbs = argv.map(verbOf);
    expect(verbs.filter((v) => v === 'rev-list').length, `${count} tickets: rev-list runs once`).toBe(1);
    expect(verbs.filter((v) => v === 'merge-base').length, `${count} tickets: no merge-base for a claim on the default branch`).toBe(0);
    expect(argv.filter((a) => verbOf(a) === 'cat-file' && a.includes('--batch')).length, `${count} tickets: one cat-file --batch`).toBe(1);
    expect(argv.filter((a) => a.includes('-G^ruleset:')).length, `${count} tickets: at most one ruleset log`).toBeLessThanOrEqual(1);
  }
});

/** Every commit reachable from HEAD with its parents, oldest first, as the one `git log --topo-order --reverse` of the whole history gives them (the parent graph rulesetCommitsMany reads). */
function graphOf(repo: string): Map<string, string[]> {
  const rows = gitRun(repo, 'log', '--topo-order', '--reverse', '--format=%H %P', 'HEAD').split('\n').filter((l) => l.trim() !== '');
  return new Map(rows.map((l): [string, string[]] => { const [sha, ...parents] = l.trim().split(' '); return [sha, parents]; }));
}

/**
 * Phase 08.9 D-03: the one-path ruleset log of commitsWritingRuleset (claim-facts.ts), argv and parsing byte for byte. It is a copy because that function is not exported and keeps its text
 * (it is the oracle of rulesetCommitsMany; exporting it would change its text).
 */
function oneTicketLog(root: string, claim: string, rel: string): string[] {
  const log = execFileSync(
    'git',
    ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '--no-renames', '--topo-order', '--reverse', '--format=%H', '-G^ruleset:', claim + '..HEAD', '--', ':(literal)' + rel],
    { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, GIT_NO_LAZY_FETCH: '1' } },
  );
  return log.split(/\r?\n/).map((l) => l.trim().toLowerCase()).filter((l) => /^[0-9a-f]{40,64}$/.test(l));
}

/** The batch's list for every ticket equals the one-path log's, element for element and in order; `expected` (rel -> commits) pins what git is built to answer, so a fixture that lists nothing everywhere proves nothing. */
function sameRuleset(repo: string, claims: { rel: string; claim: string }[], expected: Record<string, string[]>, chunk?: number, perTicket = 0): void {
  const graph = graphOf(repo);
  const counted = countedSync(() => rulesetCommitsMany(repo, graph, claims, chunk));
  const many = counted.value;
  // the replay answers without a log of its own: one log for the chunk, plus one per ticket the replay hands back to the one-path log (`perTicket`)
  if (chunk === undefined) expect(counted.argv.filter((a) => a.includes('-G^ruleset:')).length, 'ruleset logs started').toBe(1 + perTicket);
  expect([...many.keys()].sort()).toEqual(claims.map((c) => c.rel).sort());
  for (const c of claims) {
    const want = oneTicketLog(repo, c.claim, c.rel);
    expect(want, `${c.rel} is built to list ${JSON.stringify(expected[c.rel])}`).toEqual(expected[c.rel]);
    expect(many.get(c.rel), c.rel).toEqual(want);
  }
}

const withRuleset = (id: string, value = '0.10.0', ...more: string[]): string => laneTicket(id, { frontmatter: [...more, `ruleset: "${value}"`] });

/** A fixture both oracles read: the repository, the tickets' claims, and the commits the one-path log is built to list for each ticket. */
interface Built {
  repo: string;
  claims: { rel: string; claim: string }[];
  expected: Record<string, string[]>;
}

/**
 * Phase 08.9 D-03 fixture (l): a merge that keeps the ticket branch's copy of T-1 while main's side wrote a ruleset: line into it, and a mix for T-2 (changed on both sides). A one-path walk for T-1 follows only
 * the branch side, so main's commit is hidden; for T-2 the merge is the same as neither parent, both sides are followed and main's commit is listed. A walk over both paths at once would list it for T-1 too.
 */
function fixtureL(): Built {
  const l = base(['T-1', 'T-2']);
  const l1 = commitMsg(l, 'claim: T-1', at(1), true);
  const l2 = commitMsg(l, 'claim: T-2', at(2), true);
  gitRun(l, 'switch', '-q', '-c', 'ticket-branch');
  writeFiles(l, { [P('T-1')]: laneTicket('T-1', { frontmatter: ['note: branch'] }), [P('T-2')]: laneTicket('T-2', { frontmatter: ['note: branch'] }) });
  commitMsg(l, 'the branch edits both tickets', at(3));
  gitRun(l, 'switch', '-q', 'main');
  writeFiles(l, { [P('T-1')]: withRuleset('T-1'), [P('T-2')]: withRuleset('T-2') });
  const lMain = commitMsg(l, 'main writes a ruleset into both', at(4));
  gitRun(l, 'switch', '-q', 'ticket-branch');
  gitRun(l, 'merge', '-q', '--no-ff', '--no-commit', '-s', 'ours', 'main');
  writeFiles(l, { [P('T-2')]: withRuleset('T-2', '0.10.0', 'note: branch') });
  commitMsg(l, 'merge main into the ticket branch', at(5));
  return { repo: l, claims: [{ rel: P('T-1'), claim: l1 }, { rel: P('T-2'), claim: l2 }], expected: { [P('T-1')]: [], [P('T-2')]: [lMain] } };
}

/** Phase 08.9 D-03 fixture (m): a side branch adds and then removes a ruleset: line before it merges; main moved on, so the merge is the same as its first parent for the file and the side branch's two commits are hidden. */
function fixtureM(): Built {
  const m = base(['T-1']);
  const m1 = commitMsg(m, 'claim: T-1', at(1), true);
  gitRun(m, 'switch', '-q', '-c', 'side');
  writeFiles(m, { [P('T-1')]: withRuleset('T-1') });
  commitMsg(m, 'side adds a ruleset', at(2));
  writeFiles(m, { [P('T-1')]: laneTicket('T-1') });
  commitMsg(m, 'side removes it again', at(3));
  gitRun(m, 'switch', '-q', 'main');
  commitMsg(m, 'main moves on', at(4), true);
  mergeMsg(m, 'side', 'merge side');
  return { repo: m, claims: [{ rel: P('T-1'), claim: m1 }], expected: { [P('T-1')]: [] } };
}

/** Phase 08.9 D-03 fixture (n): five tickets, read with a chunk of 2 (T-1 and T-3 written by one commit, T-2 and T-3 by the next, T-4 and T-5 never). */
function fixtureN(): Built {
  const n = base(['T-1', 'T-2', 'T-3', 'T-4', 'T-5']);
  const claims = ['T-1', 'T-2', 'T-3', 'T-4', 'T-5'].map((id, i) => ({ rel: P(id), claim: commitMsg(n, `claim: ${id}`, at(i + 1), true) }));
  writeFiles(n, { [P('T-1')]: withRuleset('T-1'), [P('T-3')]: withRuleset('T-3') });
  const nOne = commitMsg(n, 'sync: rulesets one', at(10));
  writeFiles(n, { [P('T-2')]: withRuleset('T-2'), [P('T-3')]: withRuleset('T-3', '0.11.0') });
  const nTwo = commitMsg(n, 'sync: rulesets two', at(11));
  return { repo: n, claims, expected: { [P('T-1')]: [nOne], [P('T-2')]: [nTwo], [P('T-3')]: [nOne, nTwo], [P('T-4')]: [], [P('T-5')]: [] } };
}

// Phase 08.9 D-03: rulesetCommitsMany lists for every ticket the commits the one-path ruleset log lists, in its order; each fixture below is read by both.
it('risk:regression rulesetCommitsMany lists for every ticket what the one-path ruleset log lists (D-03)', () => {
  const l = fixtureL();
  sameRuleset(l.repo, l.claims, l.expected);
  const m = fixtureM();
  sameRuleset(m.repo, m.claims, m.expected);

  // (o) a ruleset: line written after the claim on a straight history, then its value changed: both commits, oldest first
  const o = base(['T-1', 'T-2']);
  const o1 = commitMsg(o, 'claim: T-1', at(1), true);
  writeFiles(o, { [P('T-1')]: withRuleset('T-1') });
  const oFirst = commitMsg(o, 'sync: ruleset', at(2));
  commitMsg(o, 'an unrelated commit', at(3), true);
  writeFiles(o, { [P('T-1')]: withRuleset('T-1', '0.11.0') });
  const oSecond = commitMsg(o, 'sync: ruleset again', at(4));
  sameRuleset(o, [{ rel: P('T-1'), claim: o1 }], { [P('T-1')]: [oFirst, oSecond] });

  // (p) a merge after the claim that brings a ruleset: line from the branch side: the merge is the same as the branch side, which is followed and listed (the merge itself is never listed)
  const p = base(['T-1', 'T-2']);
  const p1 = commitMsg(p, 'claim: T-1', at(1), true);
  gitRun(p, 'switch', '-q', '-c', 'side');
  writeFiles(p, { [P('T-1')]: withRuleset('T-1') });
  const pSide = commitMsg(p, 'side: ruleset', at(2));
  gitRun(p, 'switch', '-q', 'main');
  writeFiles(p, { [P('T-2')]: laneTicket('T-2', { frontmatter: ['note: main'] }) });
  commitMsg(p, 'main edits the other ticket', at(3));
  mergeMsg(p, 'side', 'merge side');
  sameRuleset(p, [{ rel: P('T-1'), claim: p1 }], { [P('T-1')]: [pSide] });

  // (q) a ticket with no commit after its claim (an empty list), beside one that has one
  const q = base(['T-1', 'T-2']);
  const q1 = commitMsg(q, 'claim: T-1', at(1), true);
  writeFiles(q, { [P('T-1')]: withRuleset('T-1') });
  const qNext = commitMsg(q, 'sync: ruleset', at(2));
  const q2 = commitMsg(q, 'claim: T-2', at(3), true);
  sameRuleset(q, [{ rel: P('T-1'), claim: q1 }, { rel: P('T-2'), claim: q2 }], { [P('T-1')]: [qNext], [P('T-2')]: [] });

  // (r) two sibling branches write a ruleset: line each and the merge resolves to a third version: the merge is the same as neither parent, so both sides are followed and the order is the log's
  const r = base(['T-1']);
  const r1 = commitMsg(r, 'claim: T-1', at(1), true);
  gitRun(r, 'switch', '-q', '-c', 'left');
  writeFiles(r, { [P('T-1')]: withRuleset('T-1', '0.10.0') });
  const rLeft = commitMsg(r, 'left: ruleset', at(2));
  gitRun(r, 'switch', '-q', 'main');
  gitRun(r, 'switch', '-q', '-c', 'right');
  writeFiles(r, { [P('T-1')]: withRuleset('T-1', '0.11.0') });
  const rRight = commitMsg(r, 'right: ruleset', at(3));
  gitRun(r, 'merge', '-q', '--no-ff', '--no-commit', '-s', 'ours', 'left');
  writeFiles(r, { [P('T-1')]: withRuleset('T-1', '0.12.0') });
  commitMsg(r, 'merge left into right', at(4));
  expect(oneTicketLog(r, r1, P('T-1')).sort(), 'both sides are listed').toEqual([rLeft, rRight].sort());
  sameRuleset(r, [{ rel: P('T-1'), claim: r1 }], { [P('T-1')]: oneTicketLog(r, r1, P('T-1')) });

  // (s) the claim commit is the first parent of a merge that is the same as it for the file: git follows the claim (the bottom of the range) alone, so the side branch's ruleset commit stays hidden
  const s = base(['T-1']);
  const s1 = commitMsg(s, 'claim: T-1', at(1), true);
  gitRun(s, 'switch', '-q', '-c', 'side');
  writeFiles(s, { [P('T-1')]: withRuleset('T-1') });
  commitMsg(s, 'side: ruleset', at(2));
  gitRun(s, 'switch', '-q', 'main');
  gitRun(s, 'merge', '-q', '--no-ff', '--no-commit', '-s', 'ours', 'side');
  commitMsg(s, 'merge side, keeping the claim copy', at(3));
  sameRuleset(s, [{ rel: P('T-1'), claim: s1 }], { [P('T-1')]: [] });

  // (t) HEAD is a merge whose first parent is older than the claim and is the same as the merge for the file: whether git follows that parent alone depends on its traversal order, so the batch hands the ticket to the one-path log
  const t = base(['T-1']);
  const tBase = gitRun(t, 'rev-parse', 'HEAD').trim();
  commitMsg(t, 'a commit between', at(1), true);
  const t1 = commitMsg(t, 'claim: T-1', at(2), true);
  gitRun(t, 'switch', '-q', '-c', 'side');
  writeFiles(t, { [P('T-1')]: withRuleset('T-1') });
  commitMsg(t, 'side: ruleset', at(3));
  gitRun(t, 'switch', '-q', '-c', 'older', tBase);
  gitRun(t, 'merge', '-q', '--no-ff', '--no-commit', '-s', 'ours', 'side');
  commitMsg(t, 'merge side into the older branch', at(4));
  sameRuleset(t, [{ rel: P('T-1'), claim: t1 }], { [P('T-1')]: oneTicketLog(t, t1, P('T-1')) }, undefined, 1);
});

// Phase 08.9 D-02 (T-08.9-14): the ruleset commits of any number of tickets come from one log per chunk of ticket paths; five tickets read with a chunk of 2 are read by three logs and equal the per-ticket logs.
it('risk:resource rulesetCommitsMany reads the ruleset commits of any number of tickets with one log per 200 paths (D-02)', () => {
  const ids = Array.from({ length: 12 }, (_, i) => `T-${i + 1}`);
  const repo = base(ids);
  const claims = ids.map((id, i) => ({ rel: P(id), claim: commitMsg(repo, `claim: ${id}`, at(i + 1), true) }));
  const graph = graphOf(repo);
  const all = countedSync(() => rulesetCommitsMany(repo, graph, claims));
  expect(all.value.size).toBe(12);
  expect(all.argv.filter((a) => a.includes('-G^ruleset:')).length, 'twelve tickets: one ruleset log').toBe(1);

  // (n) five tickets, chunk size 2: three logs, and every ticket's list still equals its one-path log
  const n = fixtureN();
  const counted = countedSync(() => rulesetCommitsMany(n.repo, graphOf(n.repo), n.claims, 2));
  expect(counted.argv.filter((a) => a.includes('-G^ruleset:')).length, 'five tickets with chunk size 2: three logs').toBe(3);
  sameRuleset(n.repo, n.claims, n.expected, 2);
});


/**
 * Phase 08.9 D-03: the shapes of a draft's history on the default branch that the creator of a draft depends on, in one repository: ONCE-1 added once; TWICE-1 added with the same content on two branches that are both
 * merged (git's per-file simplification follows the first parent only, so the creator is b1's); READD-1 added, deleted and added again; NONE-1 added only on a branch that is not merged (no adding commit in HEAD's
 * history); DIFF-1 added with different content on two branches and merged by hand to a third content (the merge differs from both parents, so both sides are walked). Each adding commit has its own author.
 */
function creatorRepo(): string {
  const repo = makeEmptyRepo();
  dirs.push(repo);
  gitRun(repo, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  gitRun(repo, 'config', 'user.name', 'a');
  const as = (email: string): void => {
    gitRun(repo, 'config', 'user.email', email);
  };
  const ticket = (id: string, extra = ''): Record<string, string> => ({ [P(id)]: laneTicket(id) + extra });
  as('a@x.io');
  writeFiles(repo, { 'accord/config.yml': CONFIG });
  commitMsg(repo, 'base', at(0));
  as('once@x.io');
  writeFiles(repo, ticket('ONCE-1'));
  commitMsg(repo, 'add ONCE-1', at(1));
  gitRun(repo, 'switch', '-q', '-c', 'b1', 'main');
  as('b1@x.io');
  writeFiles(repo, ticket('TWICE-1'));
  commitMsg(repo, 'add TWICE-1 on b1', at(5));
  gitRun(repo, 'switch', '-q', '-c', 'b2', 'main');
  as('b2@x.io');
  writeFiles(repo, ticket('TWICE-1'));
  commitMsg(repo, 'add TWICE-1 on b2', at(4));
  gitRun(repo, 'switch', '-q', '-c', 'b3', 'main');
  as('b3@x.io');
  writeFiles(repo, ticket('DIFF-1', '\nx\n'));
  commitMsg(repo, 'add DIFF-1 on b3', at(6));
  gitRun(repo, 'switch', '-q', '-c', 'b4', 'main');
  as('b4@x.io');
  writeFiles(repo, ticket('DIFF-1', '\ny\n'));
  commitMsg(repo, 'add DIFF-1 on b4', at(7));
  gitRun(repo, 'switch', '-q', '-c', 'b5', 'main');
  as('b5@x.io');
  writeFiles(repo, ticket('NONE-1'));
  commitMsg(repo, 'add NONE-1 on b5', at(8));
  gitRun(repo, 'switch', '-q', 'main');
  as('r1@x.io');
  writeFiles(repo, ticket('READD-1'));
  commitMsg(repo, 'add READD-1', at(10));
  as('r2@x.io');
  rmSync(join(repo, P('READD-1')));
  commitMsg(repo, 'delete READD-1', at(11));
  as('r3@x.io');
  writeFiles(repo, ticket('READD-1'));
  commitMsg(repo, 'add READD-1 again', at(12));
  as('m@x.io');
  mergeMsg(repo, 'b1', 'merge b1');
  mergeMsg(repo, 'b2', 'merge b2');
  mergeMsg(repo, 'b3', 'merge b3');
  try {
    gitRun(repo, '-c', 'commit.gpgsign=false', 'merge', '--no-commit', '--no-ff', 'b4');
  } catch {
    // add/add conflict on DIFF-1: the next commit resolves it
  }
  writeFiles(repo, ticket('DIFF-1', '\nz\n'));
  commitMsg(repo, 'merge b4 with DIFF-1 resolved by hand');
  return repo;
}

// Phase 08.9 D-03: onePathCommits, given the parent graph, the commits that add the path and what differs at each merge, lists for a draft path (no claim, the whole history) the commits a one-path added-file log lists.
// The inputs are read here by plain git calls of the test's own, apart from the code under test. The list is oldest first, the log's is newest first.
it('risk:regression onePathCommits lists for a draft path what a one-path added-file log lists (D-03)', () => {
  const repo = creatorRepo();
  const out = (...args: string[]): string => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
  const lines = (text: string): string[] => text.split('\n').map((l) => l.trim()).filter((l) => l !== '');
  const graph = new Map<string, string[]>(lines(out('log', '--topo-order', '--reverse', '--format=%H %P', 'HEAD')).map((l): [string, string[]] => {
    const [sha, ...parents] = l.split(' ');
    return [sha, parents];
  }));
  const head = out('rev-parse', 'HEAD').trim();
  const shapes: Record<string, number> = { 'ONCE-1': 1, 'TWICE-1': 1, 'READD-1': 2, 'NONE-1': 0, 'DIFF-1': 2 };
  for (const [id, count] of Object.entries(shapes)) {
    const path = ':(literal)' + P(id);
    // a test-local copy of creatorOf's log (audit-hygiene.ts) with the commit name in place of the author email
    const oracle = lines(out('-c', 'log.showSignature=false', 'log', '--no-show-signature', '--no-renames', '--diff-filter=A', '--format=%H', '--', path));
    const wrote = new Set(lines(out('log', '--no-show-signature', '--no-renames', '--full-history', '--diff-filter=A', '--format=%H', '--', path)));
    const changed = (merge: string, parent: string): boolean => out('diff', '--name-only', '--no-renames', parent, merge, '--', path).trim() !== '';
    const got = onePathCommits(graph, head, '', new Set<string>(), wrote, changed);
    expect(oracle, `${id} is built to give ${count} adding commits`).toHaveLength(count);
    expect(got, id).toEqual([...oracle].reverse());
  }
});
