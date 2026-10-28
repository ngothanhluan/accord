// BUG-LN-13 D-01, D-04: a ticket counts as done for the dashboard and for its dependants only once its done records
// are on the default branch. The template has main (and a faked origin/main) holding S-1 readied but unreviewed,
// T-1 and T-2 approved; t/S-1 adds S-1's verdict; t/T-1 adds T-1's plan, ledger, review and bound ticks.
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { cleanup, commitMsg, copyRepo, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { approve, CONFIG, done, gateReadyIn, LANE_S_BODY, laneTicket, P } from '../../../test/helpers/lane.js';
import type { Files } from '../../../test/helpers/lane.js';
import { doneRef } from '../src/load/fs.js';

const REVIEWED = '## Round 1\n\nNo findings\n\nverdict: converged\n';

let tpl = '';
beforeAll(() => {
  const files: Files = {
    'accord/config.yml': CONFIG,
    [P('S-1')]: laneTicket('S-1', { lane: 'S', body: LANE_S_BODY }),
    [P('T-1')]: laneTicket('T-1'),
    [P('T-2')]: laneTicket('T-2', { frontmatter: ['depends_on: ["T-1"]'] }),
  };
  if (gateReadyIn(files, 'S-1') !== 'pass') throw new Error('S-1 did not pass gate ready');
  approve(files, 'T-1');
  approve(files, 'T-2');
  tpl = makeEmptyRepo();
  appendFileSync(join(tpl, '.git', 'config'), '[user]\n\temail = an@example.com\n\tname = an\n[commit]\n\tgpgsign = false\n');
  writeFiles(tpl, files);
  commitMsg(tpl, 'base');
  gitRun(tpl, 'branch', '-M', 'main');
  gitRun(tpl, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  gitRun(tpl, 'switch', '-q', '-c', 't/S-1');
  writeFiles(tpl, { 'accord/tickets/S-1/review.md': REVIEWED });
  commitMsg(tpl, 'review: S-1');
  gitRun(tpl, 'switch', '-q', 'main');
  gitRun(tpl, 'switch', '-q', '-c', 't/T-1');
  const t1: Files = {};
  done(t1, 'T-1');
  writeFiles(tpl, t1);
  commitMsg(tpl, 'verify: T-1');
  gitRun(tpl, 'switch', '-q', 'main');
});
afterAll(() => {
  if (tpl !== '') cleanup(tpl);
});

interface Row { id: string; stage?: string; next?: string; blockedBy?: string[] }
interface Board { yours: { rows: Row[] }; team: { rows: Row[] }; ready: { rows: Row[] }; upNext: { rows: Row[] }; summary: { done: number } }
const rowsOf = (j: Board): Row[] => [...j.yours.rows, ...j.team.rows, ...j.ready.rows, ...j.upNext.rows];
const summaryLine = (text: string) => text.split('\n').find((l) => l.includes(' in progress, ')) as string;

it('ac-1 a lane S ticket reviewed only on its claim branch stays in yours with its next step', async () => {
  const repo = copyRepo(tpl);
  try {
    const json = await run(['dashboard', '--json'], repo);
    expect(json.code).toBe(0);
    const j = JSON.parse(json.out) as Board;
    const row = j.yours.rows.find((r) => r.id === 'S-1');
    expect(row).toBeDefined();
    expect(row?.stage).toBe('done');
    expect(row?.next).toBe('the pull request; run accord gate done (lane-s.md)');
    expect(j.summary.done).toBe(0);
    const text = await run(['dashboard'], repo);
    expect(text.code).toBe(0);
    const lines = text.out.split('\n');
    const at = lines.indexOf('YOURS');
    expect(at).toBeGreaterThanOrEqual(0);
    const end = lines.indexOf('', at);
    const line = lines.slice(at, end < 0 ? undefined : end).find((l) => l.startsWith('  S-1'));
    expect(line).toBeDefined();
    expect(line).toContain('done, next: the pull request; run accord gate done (lane-s.md)');
    expect(summaryLine(text.out)).toContain(', 0 done');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:complex-branching the default ref is the origin one and falls back to a local main only without an origin remote', async () => {
  const repo = copyRepo(tpl);
  try {
    expect(doneRef(repo)).toBe('refs/remotes/origin/main');
    gitRun(repo, 'update-ref', '-d', 'refs/remotes/origin/main');
    expect(doneRef(repo)).toBe('refs/heads/main');
    const local = JSON.parse((await run(['dashboard', '--json'], repo)).out) as Board;
    expect(local.yours.rows.find((r) => r.id === 'S-1')?.stage).toBe('done');
    gitRun(repo, 'remote', 'add', 'origin', 'https://example.invalid/none.git');
    expect(doneRef(repo)).toBeUndefined();
    const checkout = JSON.parse((await run(['dashboard', '--json'], repo)).out) as Board;
    expect(rowsOf(checkout).some((r) => r.id === 'S-1')).toBe(false);
    expect(checkout.summary.done).toBe(2);
  } finally {
    cleanup(repo);
  }
}, 120_000);
