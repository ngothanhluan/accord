import { afterEach, expect, it } from 'vitest';
import { makeClone } from './helpers/worktree.js';
import type { Clone } from './helpers/worktree.js';
import { commitMsg, gitRun, run, writeFiles } from './helpers/repo.js';
import { LANE_BODY, laneTicket } from '../../../test/helpers/lane.js';

const clones: Clone[] = [];
afterEach(() => {
  for (const c of clones.splice(0)) c.cleanupAll();
});
const clone = (): Clone => {
  const c = makeClone();
  clones.push(c);
  return c;
};

const ticketWith = (intent: string): string =>
  laneTicket('ST-10', { body: LANE_BODY.replace('as CSV.', 'as CSV, ' + intent + '.') });
const writeIntent = (c: Clone, intent: string): string => {
  const text = ticketWith(intent);
  writeFiles(c.root, { 'accord/tickets/ST-10.md': text });
  return text;
};

function claimOnBranch(c: Clone, intent: string): string {
  c.git('switch', '-q', '-c', 't/ST-10');
  writeFiles(c.root, { 'accord/tickets/ST-10/plan.md': '# plan\n', 'src/a.ts': 'a\n' });
  writeIntent(c, 'first');
  commitMsg(c.root, 'claim: ST-10');
  const tip = writeIntent(c, intent);
  commitMsg(c.root, 'work');
  c.git('push', '-q', '-u', 'origin', 't/ST-10');
  return tip;
}

function remoteDrop(c: Clone, id: string): string | undefined {
  try {
    return gitRun(c.remote, 'rev-parse', '--verify', '-q', 'refs/heads/drop/' + id).trim();
  } catch {
    return undefined;
  }
}

it('ac-1 dropping a ticket pushes a branch from the default branch whose only change is the ticket file set to dropped', async () => {
  const c = clone();
  const tip = claimOnBranch(c, 'second');
  writeFiles(c.root, { 'src/a.ts': 'changed\n' });
  const head = c.git('rev-parse', 'HEAD');
  const r = await run(['drop', 'ST-10', '--reason', 'no longer needed'], c.root);
  expect(r.code, r.err).toBe(0);
  expect(r.out).toBe('branch: drop/ST-10\nbase: main\ntitle: drop: ST-10\n');
  const D = remoteDrop(c, 'ST-10')!;
  expect(gitRun(c.remote, 'rev-list', '--parents', '-n', '1', D).trim().split(' ')).toEqual([D, gitRun(c.remote, 'rev-parse', 'main').trim()]);
  expect(gitRun(c.remote, 'diff', '--name-only', 'main', D)).toBe('accord/tickets/ST-10.md\n');
  expect(gitRun(c.remote, 'cat-file', 'blob', D + ':accord/tickets/ST-10.md')).toBe(
    tip.replace('status: open', 'status: "dropped"') + '\n## Dropped\nno longer needed\n',
  );
  expect(gitRun(c.remote, 'cat-file', 'commit', D)).toContain('\n\ndrop: ST-10\n');
  expect(c.git('rev-parse', 'HEAD')).toBe(head);
  expect(c.git('status', '--porcelain')).toBe(' M src/a.ts\n');
  expect(c.git('for-each-ref', 'refs/heads/drop')).toBe('');
}, 120_000);

it('ac-2 dropping without a reason is refused and nothing is created committed or pushed', async () => {
  const c = clone();
  claimOnBranch(c, 'second');
  const heads = gitRun(c.remote, 'for-each-ref');
  const head = c.git('rev-parse', 'HEAD');
  for (const argv of [['drop', 'ST-10'], ['drop', 'ST-10', '--reason', '   '], ['drop', 'ST-10', '--reason', 'a\nb']]) {
    const r = await run(argv, c.root);
    expect(r.code).toBe(2);
    expect(r.err).toContain('--reason');
  }
  expect(gitRun(c.remote, 'for-each-ref')).toBe(heads);
  expect(c.git('for-each-ref', 'refs/heads/drop')).toBe('');
  expect(c.git('rev-parse', 'HEAD')).toBe(head);
  expect(c.git('status', '--porcelain')).toBe('');
}, 120_000);

it('risk:data-loss drop pushes a crlf ticket file with a bom byte for byte outside the status value and the dropped section', async () => {
  const c = clone();
  c.git('config', 'core.autocrlf', 'false');
  c.git('switch', '-q', '-c', 't/ST-10');
  const crlf = '﻿' + laneTicket('ST-10').replaceAll('\n', '\r\n');
  writeFiles(c.root, { 'accord/tickets/ST-10.md': crlf });
  commitMsg(c.root, 'claim: ST-10');
  c.git('push', '-q', '-u', 'origin', 't/ST-10');
  const r = await run(['drop', 'ST-10', '--reason', 'no longer needed'], c.root);
  expect(r.code, r.err).toBe(0);
  const D = remoteDrop(c, 'ST-10')!;
  expect(gitRun(c.remote, 'cat-file', 'blob', D + ':accord/tickets/ST-10.md')).toBe(
    crlf.replace('status: open', 'status: "dropped"') + '\r\n## Dropped\r\nno longer needed\r\n',
  );
}, 120_000);

it('risk:complex-branching drop reads the claim tip that holds the other refuses diverged tips and falls back to the default branch', async () => {
  const c = clone();
  const blob = (cl: Clone, id: string): string => gitRun(cl.remote, 'cat-file', 'blob', remoteDrop(cl, id)! + ':accord/tickets/' + id + '.md');
  const undrop = (cl: Clone, id: string): string => cl.git('push', '-q', 'origin', '--delete', 'drop/' + id);
  claimOnBranch(c, 'A');
  writeIntent(c, 'B');
  commitMsg(c.root, 'B');
  let r = await run(['drop', 'ST-10', '--reason', 'x'], c.root);
  expect(r.code, r.err).toBe(0);
  expect(blob(c, 'ST-10')).toContain('as CSV, B.');
  undrop(c, 'ST-10');

  c.git('push', '-q');
  const o = c.otherClone();
  gitRun(o, 'switch', '-q', 't/ST-10');
  writeFiles(o, { 'accord/tickets/ST-10.md': ticketWith('C') });
  commitMsg(o, 'C');
  gitRun(o, 'push', '-q');
  r = await run(['drop', 'ST-10', '--reason', 'x'], c.root);
  expect(r.code, r.err).toBe(0);
  expect(blob(c, 'ST-10')).toContain('as CSV, C.');
  undrop(c, 'ST-10');

  writeIntent(c, 'D');
  commitMsg(c.root, 'D');
  r = await run(['drop', 'ST-10', '--reason', 'x'], c.root);
  expect(r.code).toBe(2);
  expect(r.err).toContain('diverged');
  expect(remoteDrop(c, 'ST-10')).toBeUndefined();

  r = await run(['drop', 'ST-9', '--reason', 'gone'], c.root);
  expect(r.code, r.err).toBe(0);
  expect(blob(c, 'ST-9')).toBe(laneTicket('ST-9').replace('status: open', 'status: "dropped"') + '\n## Dropped\ngone\n');

  const d = clone();
  gitRun(d.remote, 'branch', '-m', 'main', 'trunk');
  gitRun(d.remote, 'symbolic-ref', 'HEAD', 'refs/heads/trunk');
  d.git('fetch', '-q', 'origin');
  d.git('remote', 'set-head', 'origin', 'trunk');
  r = await run(['drop', 'ST-9', '--reason', 'gone'], d.root);
  expect(r.code, r.err).toBe(0);
  expect(r.out).toContain('base: trunk\n');
  expect(gitRun(d.remote, 'rev-list', '--parents', '-n', '1', remoteDrop(d, 'ST-9')!).trim().split(' ')[1]).toBe(gitRun(d.remote, 'rev-parse', 'trunk').trim());
}, 120_000);
