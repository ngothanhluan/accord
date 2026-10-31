import { chmodSync, writeFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { copyClone, makeClone, makeTemplate } from './helpers/worktree.js';
import type { Clone } from './helpers/worktree.js';
import { commitMsg, gitRun, mergeMsg, run, writeFiles } from './helpers/repo.js';
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

const blob = (cl: Clone, id: string): string => gitRun(cl.remote, 'cat-file', 'blob', remoteDrop(cl, id)! + ':accord/tickets/' + id + '.md');
const crlf = '﻿' + laneTicket('ST-10').replaceAll('\n', '\r\n');

// Templates (H1, rule 5): built once and copied with their own origin; a template holds no linked worktree.
let plain: Clone;
let claimed: Clone;
let crlfClaimed: Clone;
const copy = (tpl: Clone): Clone => {
  const c = copyClone(tpl);
  clones.push(c);
  return c;
};

beforeAll(() => {
  plain = makeTemplate();
  claimed = makeTemplate();
  claimOnBranch(claimed, 'second');
  crlfClaimed = makeTemplate();
  crlfClaimed.git('config', 'core.autocrlf', 'false');
  crlfClaimed.git('switch', '-q', '-c', 't/ST-10');
  writeFiles(crlfClaimed.root, { 'accord/tickets/ST-10.md': crlf });
  commitMsg(crlfClaimed.root, 'claim: ST-10');
  crlfClaimed.git('push', '-q', '-u', 'origin', 't/ST-10');
}, 120_000);

afterAll(() => {
  for (const t of [plain, claimed, crlfClaimed]) t.cleanupAll();
});

/** The worktree that holds t/ST-10 with its claim committed and pushed, then the ticket edited (added after the copy, rule 5). */
function heldWorktree(c: Clone): string {
  const s = c.sibling('ST-10');
  c.git('worktree', 'add', '-q', '-b', 't/ST-10', s, 'origin/main');
  writeFiles(s, { 'accord/tickets/ST-10.md': laneTicket('ST-10') });
  commitMsg(s, 'claim: ST-10');
  gitRun(s, 'push', '-q', '-u', 'origin', 't/ST-10');
  writeFileSync(s + '/accord/tickets/ST-10.md', laneTicket('ST-10') + '\nedited\n');
  return s;
}

it('ac-1 dropping a ticket pushes a branch from the default branch whose only change is the ticket file set to dropped', async () => {
  const c = copy(claimed);
  const tip = ticketWith('second');
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
  const c = copy(claimed);
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
  const c = copy(crlfClaimed);
  const r = await run(['drop', 'ST-10', '--reason', 'no longer needed'], c.root);
  expect(r.code, r.err).toBe(0);
  const D = remoteDrop(c, 'ST-10')!;
  expect(gitRun(c.remote, 'cat-file', 'blob', D + ':accord/tickets/ST-10.md')).toBe(
    crlf.replace('status: open', 'status: "dropped"') + '\r\n## Dropped\r\nno longer needed\r\n',
  );
}, 120_000);

it('risk:complex-branching drop reads a local claim tip ahead of origin', async () => {
  const c = copy(claimed);
  writeIntent(c, 'B');
  commitMsg(c.root, 'B');
  const r = await run(['drop', 'ST-10', '--reason', 'x'], c.root);
  expect(r.code, r.err).toBe(0);
  expect(blob(c, 'ST-10')).toContain('as CSV, B.');
}, 120_000);

it('risk:complex-branching drop reads an origin claim tip ahead of the local one', async () => {
  const c = copy(claimed);
  const o = c.otherClone();
  gitRun(o, 'switch', '-q', 't/ST-10');
  writeFiles(o, { 'accord/tickets/ST-10.md': ticketWith('C') });
  commitMsg(o, 'C');
  gitRun(o, 'push', '-q');
  const r = await run(['drop', 'ST-10', '--reason', 'x'], c.root);
  expect(r.code, r.err).toBe(0);
  expect(blob(c, 'ST-10')).toContain('as CSV, C.');
}, 120_000);

it('risk:complex-branching drop refuses diverged claim tips', async () => {
  const c = copy(claimed);
  const o = c.otherClone();
  gitRun(o, 'switch', '-q', 't/ST-10');
  writeFiles(o, { 'accord/tickets/ST-10.md': ticketWith('C') });
  commitMsg(o, 'C');
  gitRun(o, 'push', '-q');
  writeIntent(c, 'D');
  commitMsg(c.root, 'D');
  const r = await run(['drop', 'ST-10', '--reason', 'x'], c.root);
  expect(r.code).toBe(2);
  expect(r.err).toContain('diverged');
  expect(remoteDrop(c, 'ST-10')).toBeUndefined();
}, 120_000);

it('risk:complex-branching drop falls back to the default branch with no claim branch', async () => {
  const c = copy(plain);
  const r = await run(['drop', 'ST-9', '--reason', 'gone'], c.root);
  expect(r.code, r.err).toBe(0);
  expect(blob(c, 'ST-9')).toBe(laneTicket('ST-9').replace('status: open', 'status: "dropped"') + '\n## Dropped\ngone\n');
}, 120_000);

it('risk:complex-branching drop names trunk when origin HEAD is trunk', async () => {
  const d = copy(plain);
  gitRun(d.remote, 'branch', '-m', 'main', 'trunk');
  gitRun(d.remote, 'symbolic-ref', 'HEAD', 'refs/heads/trunk');
  d.git('fetch', '-q', 'origin');
  d.git('remote', 'set-head', 'origin', 'trunk');
  const r = await run(['drop', 'ST-9', '--reason', 'gone'], d.root);
  expect(r.code, r.err).toBe(0);
  expect(r.out).toContain('base: trunk\n');
  expect(gitRun(d.remote, 'rev-list', '--parents', '-n', '1', remoteDrop(d, 'ST-9')!).trim().split(' ')[1]).toBe(gitRun(d.remote, 'rev-parse', 'trunk').trim());
}, 120_000);

it('risk:data-loss drop refuses an uncommitted ticket file in the worktree holding its branch', async () => {
  const c = copy(plain);
  heldWorktree(c);
  const r = await run(['drop', 'ST-10', '--reason', 'x'], c.root);
  expect(r.code).toBe(2);
  expect(r.err).toContain('accord/tickets/ST-10.md');
  expect(r.err).toContain('uncommitted');
  expect(remoteDrop(c, 'ST-10')).toBeUndefined();
}, 120_000);

it('risk:data-loss drop proceeds once the held ticket file is committed', async () => {
  const c = copy(plain);
  commitMsg(heldWorktree(c), 'edit');
  const r = await run(['drop', 'ST-10', '--reason', 'x'], c.root);
  expect(r.code, r.err).toBe(0);
}, 120_000);

it('risk:complex-branching drop refuses a drop branch already on origin', async () => {
  const c = copy(claimed);
  let r = await run(['drop', 'ST-10', '--reason', 'x'], c.root);
  expect(r.code, r.err).toBe(0);
  r = await run(['drop', 'ST-10', '--reason', 'x'], c.root);
  expect(r.code).toBe(2);
  expect(r.err).toContain('git push origin --delete drop/ST-10');
}, 120_000);

it('risk:complex-branching drop refuses a ticket already dropped on main', async () => {
  const c = copy(claimed);
  let r = await run(['drop', 'ST-10', '--reason', 'x'], c.root);
  expect(r.code, r.err).toBe(0);
  const o = c.otherClone();
  mergeMsg(o, 'origin/drop/ST-10', 'merge drop/ST-10');
  gitRun(o, 'push', '-q', 'origin', 'main');
  c.git('push', '-q', 'origin', '--delete', 'drop/ST-10');
  r = await run(['drop', 'ST-10', '--reason', 'x'], c.root);
  expect(r.code).toBe(2);
  expect(r.err).toContain('already dropped on main');
}, 120_000);

it('risk:complex-branching drop names the quoted push when the push fails', async () => {
  const c = copy(plain);
  const hook = `${c.remote}/hooks/pre-receive`;
  writeFileSync(hook, '#!/bin/sh\nexit 1\n');
  chmodSync(hook, 0o755);
  const r = await run(['drop', 'ST-9', '--reason', 'gone'], c.root);
  expect(r.code).toBe(2);
  expect(r.err).toMatch(/git push origin [0-9a-f]{40}:refs\/heads\/drop\/ST-9/);
}, 120_000);

it('risk:complex-branching drop refuses a failed fetch', async () => {
  const c = copy(plain);
  c.git('remote', 'set-url', 'origin', c.remote + '-missing');
  const r = await run(['drop', 'ST-9', '--reason', 'gone'], c.root);
  expect(r.code).toBe(2);
  expect(r.err.startsWith('fetch from origin failed')).toBe(true);
}, 120_000);

it('risk:data-loss drop refuses a record the default branch would fail to lint', async () => {
  const c = clone();
  const o = c.otherClone();
  writeFiles(o, { 'accord/tickets/ST-11.md': laneTicket('ST-11', { frontmatter: ['depends_on: ["ST-9"]'] }) });
  commitMsg(o, 'ST-11');
  gitRun(o, 'push', '-q');
  c.git('pull', '-q');
  const r = await run(['drop', 'ST-9', '--reason', 'gone'], c.root);
  expect(r.code).toBe(2);
  expect(r.err).toContain('lint.depends-dropped');
  expect(r.err).toContain('accord/tickets/ST-11.md');
  expect(r.err).toContain('nothing was created');
  expect(remoteDrop(c, 'ST-9')).toBeUndefined();
}, 120_000);

const REC = (topic: string): string => '# ' + topic + '\n\nDate: 2026-10-30. Repository at `5c083d3`. Feeds the ticket.\n';

it('risk:data-loss drop lints the default branch with the research records its tickets list', async () => {
  const OLD = 'accord/research/2026-10-29-old.md';
  const c = copy(plain);
  const o = c.otherClone();
  writeFiles(o, { [OLD]: REC('old'), 'accord/tickets/ST-11.md': laneTicket('ST-11', { frontmatter: ['research: ["' + OLD + '"]'] }) });
  commitMsg(o, 'ST-11');
  gitRun(o, 'push', '-q');
  c.git('pull', '-q');
  const r = await run(['drop', 'ST-9', '--reason', 'gone'], c.root);
  expect(r.code, r.err).toBe(0);
  expect(remoteDrop(c, 'ST-9')).toBeDefined();
}, 120_000);

const NEW = 'accord/research/2026-10-30-new.md';
const OLD2 = 'accord/research/2026-10-29-old.md';

/** A clone whose main holds OLD2, with the branch t/ST-10 checked out from it. */
function withOldRecord(): Clone {
  const c = copy(plain);
  const o = c.otherClone();
  writeFiles(o, { [OLD2]: REC('old') });
  commitMsg(o, 'old');
  gitRun(o, 'push', '-q');
  c.git('pull', '-q');
  c.git('switch', '-q', '-c', 't/ST-10');
  return c;
}

it('risk:data-loss drop carries a listed research record the default branch lacks and leaves an identical one', async () => {
  const c = withOldRecord();
  writeFiles(c.root, { [NEW]: REC('new'), 'accord/tickets/ST-10.md': laneTicket('ST-10', { frontmatter: ['research: ["' + NEW + '", "' + OLD2 + '"]'] }) });
  commitMsg(c.root, 'claim: ST-10');
  c.git('push', '-q', '-u', 'origin', 't/ST-10');
  const r = await run(['drop', 'ST-10', '--reason', 'x'], c.root);
  expect(r.code, r.err).toBe(0);
  const D = remoteDrop(c, 'ST-10')!;
  expect(gitRun(c.remote, 'diff', '--name-only', 'main', D)).toBe(NEW + '\naccord/tickets/ST-10.md\n');
  expect(gitRun(c.remote, 'cat-file', 'blob', D + ':' + NEW)).toBe(REC('new'));
  expect(gitRun(c.remote, 'cat-file', 'blob', D + ':' + OLD2)).toBe(REC('old'));
}, 120_000);

it('risk:data-loss drop refuses a listed research record that differs from the default branch copy', async () => {
  const c = withOldRecord();
  writeFiles(c.root, { [OLD2]: REC('old edited'), 'accord/tickets/ST-10.md': laneTicket('ST-10', { frontmatter: ['research: ["' + OLD2 + '"]'] }) });
  commitMsg(c.root, 'claim: ST-10');
  c.git('push', '-q', '-u', 'origin', 't/ST-10');
  const r = await run(['drop', 'ST-10', '--reason', 'x'], c.root);
  expect(r.code).toBe(2);
  expect(r.err).toContain(OLD2 + ' on t/ST-10 differs from the copy on main');
  expect(r.err).toContain('nothing was created');
  expect(remoteDrop(c, 'ST-10')).toBeUndefined();
}, 120_000);

it('risk:data-loss drop refuses a listed research record with uncommitted changes in the worktree holding its branch', async () => {
  const EXTRA = 'accord/research/2026-10-30-extra.md';
  const c = withOldRecord();
  writeFiles(c.root, { [NEW]: REC('new'), 'accord/tickets/ST-10.md': laneTicket('ST-10', { frontmatter: ['research: ["' + NEW + '", "' + EXTRA + '"]'] }) });
  commitMsg(c.root, 'claim: ST-10');
  c.git('push', '-q', '-u', 'origin', 't/ST-10');
  writeFiles(c.root, { [NEW]: REC('new edited'), [EXTRA]: REC('extra') });
  let r = await run(['drop', 'ST-10', '--reason', 'x'], c.root);
  expect(r.code).toBe(2);
  expect(r.err).toContain(NEW + ' has uncommitted changes in ');
  expect(r.err).toContain('commit and push them on t/ST-10 first');
  expect(r.err).toContain('nothing was created');
  expect(r.err).not.toContain('fix these on');
  expect(remoteDrop(c, 'ST-10')).toBeUndefined();
  c.git('checkout', '--', NEW);
  r = await run(['drop', 'ST-10', '--reason', 'x'], c.root);
  expect(r.code).toBe(2);
  expect(r.err).toContain(EXTRA + ' has uncommitted changes in ');
  expect(r.err).not.toContain('fix these on');
  expect(remoteDrop(c, 'ST-10')).toBeUndefined();
  commitMsg(c.root, 'extra');
  c.git('push', '-q');
  r = await run(['drop', 'ST-10', '--reason', 'x'], c.root);
  expect(r.code, r.err).toBe(0);
  expect(gitRun(c.remote, 'cat-file', 'blob', remoteDrop(c, 'ST-10')! + ':' + EXTRA)).toBe(REC('extra'));
}, 120_000);

it('risk:data-loss drop refuses a listed non-Markdown research record only the claim branch holds', async () => {
  const TXT = 'accord/research/2026-10-30-measure.txt';
  const c = withOldRecord();
  writeFiles(c.root, { [TXT]: 'Date: 2026-10-30\nRepository at `5c083d3`\nmeasure\n', 'accord/tickets/ST-10.md': laneTicket('ST-10', { frontmatter: ['research: ["' + TXT + '"]'] }) });
  commitMsg(c.root, 'claim: ST-10');
  c.git('push', '-q', '-u', 'origin', 't/ST-10');
  const r = await run(['drop', 'ST-10', '--reason', 'x'], c.root);
  expect(r.code).toBe(2);
  expect(r.err).toContain(TXT);
  expect(r.err).toContain('only .md research records travel with a drop');
  expect(r.err).toContain('rename it to .md on t/ST-10');
  expect(r.err).toContain('nothing was created');
  expect(r.err).not.toContain('not a file in the repository');
  expect(remoteDrop(c, 'ST-10')).toBeUndefined();
}, 120_000);
