// ST-LN-96 t1-ac-4, D-04, D-16 Option A: after a rebase or a team script rewrote the verified commit, `accord gate done` compares the contents
// of the ticket's files instead of the sha, on real git. The repository is one sandbox with a faked origin/main, as in done-on-default.test.ts.
import { chmodSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { setFrontmatterKey } from '@accord-dev/accord-core';
import { expect, it } from 'vitest';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, mergeMsg, run, writeFiles } from './helpers/repo.js';
import { building, CONFIG, discussFiles, done, P } from '../../../test/helpers/lane.js';
import type { Files } from '../../../test/helpers/lane.js';

const EXPORT = 'src/export.ts';
const UNRELATED = 'notes/unrelated.txt';
const VERIFICATION = 'accord/tickets/T-1/verification.md';
const review = (commit: string): string => `---\nticket: T-1\ncommit: ${commit}\nreviewed_on: 2026-11-14\n---\n\n## @ac-1 Export works\n\nResult: pass\n\nEvidence: ${EXPORT}\n`;

interface Setup {
  /** Text the ticket changes in src/export.ts; none when the branch's own changes are only its records. */
  work?: string;
  /** A change main brings in before the sync: path -> text. */
  main: Record<string, string>;
}

/** Remove one loose object: a commit lost from the clone, as after a force-push CI never fetched. */
const dropObject = (repo: string, sha: string): void => {
  const file = join(repo, '.git', 'objects', sha.slice(0, 2), sha.slice(2));
  chmodSync(file, 0o666);
  rmSync(file, { force: true });
};

/**
 * main holds the ticket and src/export.ts; t/T-1 holds the work (when given), then verify's commit: every criterion ticked at the work's tip `v`
 * and a verification.md naming `v`. Then main moves (`main`), and the branch is handed back unsynced: `sync` rebases it or merges main into it.
 */
function ticketBranch(setup: Setup): { repo: string; v: string; sync: (how: 'rebase' | 'merge') => void } {
  const repo = makeEmptyRepo();
  gitRun(repo, 'config', 'user.email', 'an@example.com');
  gitRun(repo, 'config', 'user.name', 'an');
  gitRun(repo, 'config', 'commit.gpgsign', 'false');
  const files: Files = { 'accord/config.yml': CONFIG, [EXPORT]: 'export const write = 1;\n', [UNRELATED]: 'one\n', ...discussFiles('T-1') };
  building(files, 'T-1'); // approved and planned on main; verify's ticks come on the branch
  writeFiles(repo, files);
  commitMsg(repo, 'base');
  gitRun(repo, 'branch', '-M', 'main');
  gitRun(repo, 'switch', '-q', '-c', 't/T-1');
  let v: string;
  if (setup.work !== undefined) {
    writeFiles(repo, { [EXPORT]: setup.work });
    v = commitMsg(repo, 'T-1 work');
  } else {
    writeFiles(repo, { 'accord/tickets/T-1/ledger.md': '## Tasks\n- task 1 done abc1234\n' });
    v = commitMsg(repo, 'T-1 records');
  }
  const ticked: Files = {};
  done(ticked, 'T-1');
  ticked[P('T-1')] = setFrontmatterKey(ticked[P('T-1')], 'verified_commit', v);
  writeFiles(repo, { ...ticked, [VERIFICATION]: review(v) });
  commitMsg(repo, 'verify: T-1');
  gitRun(repo, 'switch', '-q', 'main');
  writeFiles(repo, setup.main);
  commitMsg(repo, 'main moves');
  gitRun(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  gitRun(repo, 'switch', '-q', 't/T-1');
  return {
    repo,
    v,
    sync: (how) => {
      if (how === 'rebase') gitRun(repo, 'rebase', '-q', 'main');
      else mergeMsg(repo, 'main', 'merge main');
    },
  };
}

type Found = { rule: string; reason: string };
async function stale(repo: string): Promise<Found[]> {
  const gate = await run(['gate', 'done', 'T-1', '--json'], repo);
  expect(gate.err).toBe('');
  return (JSON.parse(gate.out).findings as Found[]).filter((f) => f.rule === 'gate.tick-stale-commit' || f.rule === 'gate.stale-review');
}
const isAncestor = (repo: string, v: string): boolean => {
  try {
    gitRun(repo, 'merge-base', '--is-ancestor', v, 'HEAD');
    return true;
  } catch {
    return false;
  }
};

it('risk:complex-branching gate done after a rebase compares contents, not shas (ST-LN-96 t1-ac-4)', async () => {
  const t = ticketBranch({ work: 'export const write = 2;\n', main: { [UNRELATED]: 'two\n' } });
  try {
    t.sync('rebase');
    // The verified commit was rewritten: the sha comparison alone cannot hold.
    expect(isAncestor(t.repo, t.v)).toBe(false);
    // A change main brought to an unrelated file is not the ticket's: the verification stands.
    expect(await stale(t.repo)).toEqual([]);

    // The ticket edits one of its own code files after the rebase: the verification is refused, naming that file and no other.
    writeFiles(t.repo, { [EXPORT]: 'export const write = 3;\n' });
    commitMsg(t.repo, 'T-1 edits the export after verify');
    const found = await stale(t.repo);
    expect(found.map((f) => f.rule).sort()).toEqual(['gate.stale-review', 'gate.tick-stale-commit']);
    for (const f of found) {
      expect(f.reason).toContain('which is not in the history of the gated commit');
      expect(f.reason).toMatch(new RegExp('these ticket files changed since: ' + EXPORT + '$'));
      expect(f.reason).not.toContain(UNRELATED);
    }
  } finally {
    cleanup(t.repo);
  }
}, 120_000);

it('risk:security a rewritten verified commit that is not in this clone is refused with the not-in-this-clone sentence (ST-LN-96 t1-ac-4)', async () => {
  const t = ticketBranch({ work: 'export const write = 2;\n', main: { [UNRELATED]: 'two\n' } });
  try {
    t.sync('rebase');
    expect(await stale(t.repo)).toEqual([]);
    dropObject(t.repo, t.v);
    const found = await stale(t.repo);
    expect(found.map((f) => f.rule).sort()).toEqual(['gate.stale-review', 'gate.tick-stale-commit']);
    for (const f of found) expect(f.reason).toMatch(/; the verified commit is not in this clone, so its contents cannot be compared - verify again$/);
  } finally {
    cleanup(t.repo);
  }
}, 120_000);

it('risk:regression a merge of main after verify still asks for verification again, exactly as today (ST-LN-96 t1-ac-4)', async () => {
  const t = ticketBranch({ work: 'export const write = 2;\n', main: { [UNRELATED]: 'two\n' } });
  try {
    t.sync('merge');
    expect(isAncestor(t.repo, t.v)).toBe(true);
    const head = gitRun(t.repo, 'rev-parse', 'HEAD').trim();
    const found = await stale(t.repo);
    expect(found.find((f) => f.rule === 'gate.tick-stale-commit')?.reason).toBe(`the ticks were made against commit ${t.v}; the gated commit is ${head}`);
    expect(found.find((f) => f.rule === 'gate.stale-review')?.reason).toBe(`the review was written against commit ${t.v}; the gated commit is ${head}`);
  } finally {
    cleanup(t.repo);
  }
}, 120_000);

it('risk:complex-branching contents that are byte-identical at the two commits count as unchanged although the shas differ (ST-LN-96 t1-ac-4)', async () => {
  // main brings in the very change the ticket made: the rebase drops the work commit as already applied, so the shas cannot match.
  const same = 'export const write = 2;\n';
  const t = ticketBranch({ work: same, main: { [EXPORT]: same } });
  try {
    t.sync('rebase');
    expect(isAncestor(t.repo, t.v)).toBe(false);
    expect(await stale(t.repo)).toEqual([]);
  } finally {
    cleanup(t.repo);
  }
}, 120_000);

it('risk:complex-branching a branch whose own changes are only its records keeps its verification through a rewrite (ST-LN-96 t1-ac-4)', async () => {
  const t = ticketBranch({ main: { [UNRELATED]: 'two\n', [EXPORT]: 'export const write = 9;\n' } });
  try {
    t.sync('rebase');
    expect(isAncestor(t.repo, t.v)).toBe(false);
    // No ticket file besides its records, so there is nothing to compare: an empty path set is no change, not "every file".
    expect(await stale(t.repo)).toEqual([]);
  } finally {
    cleanup(t.repo);
  }
}, 120_000);
