// Phase 08.9 review fixes (WR-01, WR-02, WR-03): the batched git readers answer every item as the per-item read does, also when one item is not what the loaders expect.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { CONFIG, laneTicket, P } from '../../../test/helpers/lane.js';
import { gitClaimFacts, gitClaimFactsMany } from '../src/load/claim-facts.js';
import { readCleanFacts } from '../src/load/clean-facts.js';
import { catBatch } from '../src/load/fs.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, writeFiles } from './helpers/repo.js';

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) cleanup(dirs.pop() as string);
});

const at = (n: number): Date => new Date(Date.UTC(2026, 10, 1, 12, n, 0));

function repoOn(files: Record<string, string>): string {
  const repo = makeEmptyRepo();
  dirs.push(repo);
  gitRun(repo, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  gitRun(repo, 'config', 'user.email', 'a@x.io');
  gitRun(repo, 'config', 'user.name', 'a');
  writeFiles(repo, files);
  commitMsg(repo, 'files', at(0));
  return repo;
}

// WR-01: `cat-file --batch` prints a header and the content of a tree too, so a spec that names a directory must not move the answers after it.
it('risk:regression catBatch keeps every later answer in place when a spec names a directory (WR-01)', () => {
  const repo = repoOn({ 'a.txt': 'one\n', 'b.txt': 'two\n', 'd/x.txt': 'x\n' });
  const got = catBatch(repo, ['HEAD:a.txt', 'HEAD:d', 'HEAD:b.txt', 'HEAD:nope.txt', 'HEAD:a.txt'], 'the test');
  expect(got[0]).toBe('one\n');
  expect(got[1], 'a directory is no text').toBeUndefined();
  expect(got[2]).toBe('two\n');
  expect(got[3], 'a missing path is no text').toBeUndefined();
  expect(got[4]).toBe('one\n');
});

// WR-02: rev-list peels a tag object to its commit, so the batched walk over the tag's own sha must not read as "reachable from origin".
it('risk:regression notOnOrigin leaves a tip that is not a commit unanswered and counts a commit tip (WR-02)', () => {
  const repo = repoOn({ 'a.txt': 'one\n' });
  const first = gitRun(repo, 'rev-parse', 'HEAD').trim();
  gitRun(repo, 'update-ref', 'refs/remotes/origin/main', first);
  writeFiles(repo, { 'a.txt': 'two\n' });
  commitMsg(repo, 'second', at(1));
  writeFiles(repo, { 'a.txt': 'three\n' });
  const tip = commitMsg(repo, 'third', at(2));
  gitRun(repo, 'update-ref', 'refs/heads/ahead', tip);
  gitRun(repo, '-c', 'user.email=a@x.io', '-c', 'user.name=a', 'tag', '-a', '-m', 'note', 'tagged', tip);
  const tagOid = gitRun(repo, 'rev-parse', 'refs/tags/tagged').trim();
  expect(tagOid).not.toBe(tip);
  // `git update-ref` refuses a tag object under refs/heads, so the ref file is written by hand
  writeFileSync(join(repo, '.git', 'refs', 'heads', 'tagged'), tagOid + '\n');
  const facts = readCleanFacts(repo, 'refs/heads/main');
  expect(facts.localTip('tagged'), 'the ref reads as the tag object').toBe(tagOid);
  const counts = facts.notOnOrigin([tip, tagOid]);
  expect(counts?.get(tip), 'a commit tip is counted').toBe(2);
  expect(counts?.get(tagOid), 'a tag object is left to the per-branch count').toBeUndefined();
  const perBranch = Number(execFileSync('git', ['rev-list', '--count', tagOid, '--not', '--remotes=origin'], { cwd: repo, encoding: 'utf8' }).trim());
  expect(perBranch, 'the per-branch count the caller falls back to').toBe(2);
});

// WR-03: an id that fails SAFE_ID never reaches a shared stdin line; it gets the per-id answer and no other ticket changes.
it('risk:regression gitClaimFactsMany answers an id that fails SAFE_ID as gitClaimFacts does and leaves the others alone (WR-03)', () => {
  const repo = repoOn({ 'accord/config.yml': CONFIG, [P('A-1')]: laneTicket('A-1'), [P('A-2')]: laneTicket('A-2') });
  commitMsg(repo, 'claim: A-1', at(1), true);
  commitMsg(repo, 'claim: A-2', at(2), true);
  const ids = ['A-1', 'bad\nid', 'A-2'];
  const many = gitClaimFactsMany(repo, ids);
  expect([...many.keys()].sort()).toEqual([...ids].sort());
  for (const id of ids) expect(many.get(id), JSON.stringify(id)).toEqual(gitClaimFacts(repo, id));
  expect(many.get('A-1')).toHaveProperty('sha');
  expect(many.get('A-2')).toHaveProperty('sha');
});
