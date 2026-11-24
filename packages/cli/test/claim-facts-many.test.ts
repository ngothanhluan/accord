// Phase 08.9 D-03: the batched claim-fact reader against the per-ticket oracle. gitClaimFactsMany(root, ids, config) must hold, for every id, exactly what gitClaimFacts(root, id, config) returns,
// `{ error }` and undefined included; each fixture below is a real git repository read by both. D-02 is the second case: the claim commits of any number of tickets come from one log.
import { afterEach, expect, it, vi } from 'vitest';
import { CONFIG, laneTicket, P } from '../../../test/helpers/lane.js';
import { gitClaimFacts, gitClaimFactsMany } from '../src/load/claim-facts.js';
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
function same(repo: string, kinds: Record<string, Kind>, config?: Parameters<typeof gitClaimFacts>[2]): void {
  const ids = Object.keys(kinds);
  const many = gitClaimFactsMany(repo, ids, config);
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
  }
});
