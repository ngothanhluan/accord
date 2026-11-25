// Phase 08.9.2 D-05 D-06: the flightdeck pane draws from one `dashboard --json` call, so that call carries the current ticket's detail (what `show <id> --json` prints for the same
// checkout) and a `--no-fetch` flag lets the pane draw from the refs already in the clone. Real git in tmp sandboxes; the one count is of the git processes accord starts, never a timing.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { CONFIG, laneTicket, P } from '../../../test/helpers/lane.js';
import { spawnLog } from './helpers/git-spawns.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import type { Clone } from './helpers/worktree.js';
import { copyClone, makeTemplate } from './helpers/worktree.js';

vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig()));

const CONFIG_WHO = CONFIG + "people:\n  a@x.io: AX\n";

/** An empty claim commit on a new branch t/<id>, authored by `author`; the checkout stays on that branch. */
function claimBranch(repo: string, id: string, author: string): void {
  gitRun(repo, 'switch', '-q', '-c', `t/${id}`);
  const folder = mkdtempSync(join(tmpdir(), 'accord-msg-'));
  try {
    const file = join(folder, 'msg.txt');
    writeFileSync(file, `claim: ${id}\n`);
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.GIT_AUTHOR_EMAIL;
    delete env.GIT_AUTHOR_NAME;
    delete env.GIT_COMMITTER_NAME;
    delete env.GIT_COMMITTER_EMAIL;
    execFileSync('git', ['-c', `user.email=${author}`, '-c', 'user.name=who', '-c', 'commit.gpgsign=false', 'commit', '-q', '--allow-empty', '-F', file, '--cleanup=verbatim'], {
      cwd: repo,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } finally {
    cleanup(folder);
  }
}

type Json = Record<string, unknown>;
const parse = (out: string): Json => JSON.parse(out) as Json;

let repo = '';
beforeAll(() => {
  repo = makeEmptyRepo();
  gitRun(repo, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  gitRun(repo, 'config', 'user.email', 'v@x.io');
  gitRun(repo, 'config', 'user.name', 'viewer');
  writeFiles(repo, {
    'accord/config.yml': CONFIG_WHO,
    [P('T-1')]: laneTicket('T-1'),
    [P('T-2')]: laneTicket('T-2', { frontmatter: ['depends_on: ["T-3"]'] }),
    [P('T-3')]: laneTicket('T-3', { frontmatter: ['status: dropped'], body: ['## Dropped', 'Not wanted.', '', '## Intent', 'Gone.', ''].join('\n') }),
  });
  commitMsg(repo, 'add tickets');
});
afterAll(() => {
  if (repo !== '') cleanup(repo);
});

// Phase 08.9.2 D-05: `currentDetail` is the TicketDetail `show --json` prints, built by the same function, so the pane reads one command.
it('risk:regression dashboard json carries the current ticket detail equal to show json (D-05)', async () => {
  // on the default branch there is no current ticket and no detail
  const off = await run(['dashboard', '--json'], repo);
  expect(off.code, off.err).toBe(0);
  expect(Object.hasOwn(parse(off.out), 'current')).toBe(false);
  expect(Object.hasOwn(parse(off.out), 'currentDetail')).toBe(false);

  for (const id of ['T-1', 'T-3']) {
    claimBranch(repo, id, 'a@x.io');
    const board = await run(['dashboard', '--json'], repo);
    const shown = await run(['show', id, '--json'], repo);
    expect([board.code, shown.code], board.err + shown.err).toEqual([0, 0]);
    const d = parse(board.out);
    expect(d.current, id).toBe(id);
    // the key sits after `current` and before `offline` (the clone has no origin, so there is none)
    expect(Object.keys(d).slice(-2), id).toEqual(['current', 'currentDetail']);
    expect(d.currentDetail, id).toEqual(parse(shown.out));
    // the session log rides along, as it does in show
    expect(Array.isArray((d.currentDetail as Json).log), id).toBe(true);
    gitRun(repo, 'switch', '-q', 'main');
  }

  // initials mode: the holder is shown through the one display function, in both
  gitRun(repo, 'config', 'accord.who', 'initials');
  gitRun(repo, 'switch', '-q', 't/T-1');
  const board = await run(['dashboard', '--json'], repo);
  const shown = await run(['show', 'T-1', '--json'], repo);
  expect([board.code, shown.code], board.err + shown.err).toEqual([0, 0]);
  const detail = parse(board.out).currentDetail as Json;
  expect(detail.holderShown).toBe('AX');
  expect(detail).toEqual(parse(shown.out));
  gitRun(repo, 'switch', '-q', 'main');
  gitRun(repo, 'config', '--unset', 'accord.who');
}, 120_000);

let tpl: Clone;
beforeAll(() => {
  tpl = makeTemplate();
}, 60_000);
afterAll(() => {
  tpl.cleanupAll();
});

// Phase 08.9.2 D-06: the flag the pane passes for its first draw; without it the bounded fetch runs as before.
it('risk:resource dashboard --no-fetch starts no git fetch (D-06)', async () => {
  const c = copyClone(tpl);
  try {
    spawnLog.calls = [];
    spawnLog.on = true;
    const local = await run(['dashboard', '--json', '--no-fetch'], c.root);
    spawnLog.on = false;
    expect(local.code, local.err).toBe(0);
    expect(spawnLog.calls.filter((a) => a[0] === 'fetch')).toEqual([]);
    expect(Object.keys(parse(local.out))).toEqual(expect.arrayContaining(['yours', 'team', 'ready', 'upNext', 'epics', 'summary']));

    spawnLog.calls = [];
    spawnLog.on = true;
    const fetched = await run(['dashboard', '--json'], c.root);
    spawnLog.on = false;
    expect(fetched.code, fetched.err).toBe(0);
    expect(spawnLog.calls.filter((a) => a[0] === 'fetch').length).toBeGreaterThan(0);
    expect(Object.keys(parse(fetched.out))).toEqual(expect.arrayContaining(['yours', 'team', 'ready', 'upNext', 'epics', 'summary']));
  } finally {
    spawnLog.on = false;
    c.cleanupAll();
  }
}, 120_000);
