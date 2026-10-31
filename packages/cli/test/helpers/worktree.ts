// Sandbox clones with a bare remote and sibling worktrees, for the `accord worktree` tests (ST-LN-7).
// The worktree-*.test.ts files share the sandbox and the helpers below it (ST-LN-75); each mocks proc.js and fetch-limit.js.
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { afterAll, afterEach, beforeAll, expect, vi } from 'vitest';
import * as limit from '../../src/commands/fetch-limit.js';
import * as proc from '../../src/load/proc.js';
import { approvedHash, gateReady, loadSnapshot, setFrontmatterKey } from '@accord-dev/accord-core';
import { CONFIG, gateReadyIn, LANE_BODY, LANE_S_BODY, laneTicket, P, PLAN } from '../../../../test/helpers/lane.js';
import { cleanup, commitMsg, gitRun, mergeMsg, run, writeFiles } from './repo.js';

const STEP = [
  "require('node:fs').appendFileSync('setup.log', process.argv[2] + '\\n');",
  "if (process.argv[2] === 'fail') { console.error('boom'); process.exit(1); }",
  '',
].join('\n');

const IDENTITY = [
  ['user.email', 'fixture@example.invalid'],
  ['user.name', 'fixture'],
  ['commit.gpgsign', 'false'],
];

export interface Clone {
  root: string;
  remote: string;
  sibling(id: string): string;
  git(...args: string[]): string;
  otherClone(): string;
  cleanupAll(): void;
}

export function makeClone(opts: { setup?: string[]; tickets?: string[] } = {}): Clone {
  const remote = realpathSync.native(mkdtempSync(join(tmpdir(), 'accord-wt-remote-')));
  gitRun(remote, 'init', '--bare', '-q', '-b', 'main');
  const made = realpathSync.native(mkdtempSync(join(tmpdir(), 'accord-wt-')));
  gitRun(made, 'init', '-q', '-b', 'main');
  for (const [k, v] of IDENTITY) gitRun(made, 'config', k, v);
  const setup = opts.setup === undefined ? '' : 'setup:\n' + opts.setup.map((c) => `  - ${JSON.stringify(c)}\n`).join('');
  const files: Record<string, string> = {
    'accord/config.yml': CONFIG + setup,
    '.gitignore': 'node_modules/\n',
    'setup-step.js': STEP,
  };
  for (const id of opts.tickets ?? ['ST-9']) files[`accord/tickets/${id}.md`] = laneTicket(id);
  writeFiles(made, files);
  gitRun(made, 'add', '-A');
  gitRun(made, 'commit', '-q', '-m', 'init');
  gitRun(made, 'remote', 'add', 'origin', remote);
  gitRun(made, 'push', '-q', '-u', 'origin', 'main');
  gitRun(made, 'remote', 'set-head', 'origin', 'main');
  const root = gitRun(made, 'rev-parse', '--show-toplevel').trim();
  const others: string[] = [];
  return {
    root,
    remote,
    sibling: (id) => `${dirname(root)}/${basename(root)}-${id.toLowerCase()}`,
    git: (...args) => gitRun(root, ...args),
    otherClone() {
      const dir = realpathSync.native(mkdtempSync(join(tmpdir(), 'accord-wt-other-')));
      gitRun(dir, 'clone', '-q', remote, '.');
      for (const [k, v] of IDENTITY) gitRun(dir, 'config', k, v);
      others.push(dir);
      return dir;
    },
    cleanupAll() {
      const parent = dirname(root);
      for (const name of readdirSync(parent)) if (name.startsWith(basename(root) + '-')) cleanup(join(parent, name));
      for (const d of [remote, root, ...others]) cleanup(d);
    },
  };
}

/** A clone to copy from (H6): no automatic gc or maintenance in the template, its remote, or any copy of them. */
export function makeTemplate(opts: { setup?: string[]; tickets?: string[] } = {}): Clone {
  const c = makeClone(opts);
  gitRun(c.root, 'config', 'maintenance.auto', 'false');
  gitRun(c.root, 'config', 'gc.auto', '0');
  gitRun(c.remote, 'config', 'gc.auto', '0');
  gitRun(c.remote, 'config', 'receive.autogc', 'false');
  return c;
}

/**
 * A copy of a template clone (H1, rule 5): the folders are copied, then `origin` is pointed at the copied
 * remote with `git remote set-url`, never a text replace. Each copied clone asserts its origin is its own;
 * a copy still sharing the template's remote would let a clean or a push reach the template's branches.
 * `others` are clones of `tpl.remote` the file made (upgrade's other clone); they are copied and re-pointed too.
 */
export function copyClone(tpl: Clone, others: string[] = []): Clone & { others: string[] } {
  const linked = tpl.git('worktree', 'list', '--porcelain').split('\n').filter((l) => l.startsWith('worktree ')).length;
  if (linked > 1) throw new Error('template holds a linked worktree: ' + tpl.root);
  const remote = realpathSync.native(mkdtempSync(join(tmpdir(), 'accord-wt-remote-')));
  cpSync(tpl.remote, remote, { recursive: true });
  const made = realpathSync.native(mkdtempSync(join(tmpdir(), 'accord-wt-')));
  cpSync(tpl.root, made, { recursive: true });
  const root = gitRun(made, 'rev-parse', '--show-toplevel').trim();
  const copied = others.map((o) => {
    const dir = realpathSync.native(mkdtempSync(join(tmpdir(), 'accord-wt-other-')));
    cpSync(o, dir, { recursive: true });
    return dir;
  });
  for (const dir of [root, ...copied]) {
    gitRun(dir, 'remote', 'set-url', 'origin', remote);
    const fetchUrl = gitRun(dir, 'remote', 'get-url', 'origin').trim();
    const pushUrl = gitRun(dir, 'remote', 'get-url', '--push', 'origin').trim();
    if (fetchUrl !== remote || pushUrl !== remote || fetchUrl === tpl.remote || pushUrl === tpl.remote) {
      throw new Error(`copy origin is not its own: fetch ${fetchUrl}, push ${pushUrl}, copy ${remote}, template ${tpl.remote}`);
    }
  }
  const shared = [root === tpl.root && root, remote === tpl.remote && remote, ...copied.filter((d) => d === tpl.root || others.includes(d))].find(Boolean);
  if (shared) throw new Error('copy shares a path with its template: ' + shared);
  const mine: string[] = [];
  return {
    root,
    remote,
    others: copied,
    sibling: (id) => `${dirname(root)}/${basename(root)}-${id.toLowerCase()}`,
    git: (...args) => gitRun(root, ...args),
    otherClone() {
      const dir = realpathSync.native(mkdtempSync(join(tmpdir(), 'accord-wt-other-')));
      // H2: one spawn; `clone -c` writes the identity into the new repository's config.
      gitRun(dir, 'clone', '-q', ...[...IDENTITY, ['maintenance.auto', 'false'], ['gc.auto', '0']].flatMap(([k, v]) => ['-c', `${k}=${v}`]), remote, '.');
      mine.push(dir);
      return dir;
    },
    cleanupAll() {
      const parent = dirname(root);
      for (const name of readdirSync(parent)) if (name.startsWith(basename(root) + '-')) cleanup(join(parent, name));
      for (const d of [remote, root, ...copied, ...mine]) cleanup(d);
    },
  };
}

type Opts = Parameters<typeof makeClone>[0];
/** The clones the afterEach of `useSandboxes` removes; a test that copies a clone of its own pushes it here. */
export const clones: Clone[] = [];
export const clone = (opts?: Opts) => {
  const c = makeClone(opts);
  clones.push(c);
  return c;
};
// H1: one template per set of opts, built once per test file; a test takes a copy of it with `copy` (rule 5: `copyClone`
// checks the copy's origin and paths). A template never holds a linked worktree: any `worktree add` runs in the copy.
const TEMPLATES = new Map<string, Clone>();
const key = (o?: Opts) => JSON.stringify(o ?? {});
/** Registers the file's hooks: builds the templates its tests copy, and after each test resets the mocks and removes its clones. */
export function useSandboxes(templates: Opts[]) {
  beforeAll(() => {
    for (const o of templates) TEMPLATES.set(key(o), makeTemplate(o));
  }, 180_000);
  afterAll(() => {
    for (const t of TEMPLATES.values()) t.cleanupAll();
  });
  afterEach(() => {
    vi.mocked(proc.processTable).mockReset();
    vi.mocked(limit.fetchLimitMs).mockReset();
    vi.unstubAllEnvs();
    for (const c of clones.splice(0)) c.cleanupAll();
  });
}
export const copy = (opts?: Opts) => {
  const tpl = TEMPLATES.get(key(opts));
  if (tpl === undefined) throw new Error(`no template for ${key(opts)}; add it to this file's useSandboxes`);
  const c = copyClone(tpl);
  clones.push(c);
  return c;
};



// The pin the clones hold: their accord/config.yml is written from CONFIG, so a pin bump needs no edit here.
export const PIN = /^accord: "([^"]+)"$/m.exec(CONFIG)![1];

export const entries = (c: Clone) => c.git('worktree', 'list', '--porcelain').split('\n\n').filter((e) => e.trim() !== '');

export const stopLines = (path: string, id: string) => [
  'stop: open a session in this folder and type the line below it',
  path,
  `/accord continue ${id}`,
];

export const A = { pid: 7001, start: 'S-A', marker: 'sess-A' };
export const B = { pid: 7002, start: 'S-B', marker: 'sess-B' };
export const envOf = (s: { marker: string; pid: number }) => ({ CLAUDECODE: '1', CLAUDE_CODE_SESSION_ID: s.marker, CLAUDE_PID: String(s.pid) });
export const tableOf = (s: { pid: number; start: string }, ...others: { pid: number; start: string }[]) => [
  { pid: process.pid, ppid: s.pid, start: 'self' },
  { pid: s.pid, ppid: 1, start: s.start },
  ...others.map((o) => ({ pid: o.pid, ppid: 1, start: o.start })),
];
export const setTable = (rows: ReturnType<typeof tableOf>) => vi.mocked(proc.processTable).mockReturnValue(rows);
export const holdsFile = (c: Clone) => `${c.root}/.git/accord/holds`;
export const HELD = 'held: ST-9 by this session\n';

// H3, H7: the worktree is added by git and the remote is dropped after its last use (no fetch in these scenarios).
export const heldBy = async (c: Clone) => {
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main');
  c.git('remote', 'remove', 'origin');
  const sib = c.sibling('ST-9');
  setTable(tableOf(A));
  await run(['worktree', 'open', 'ST-9', '--continue'], sib, envOf(A));
  return sib;
};

export const DEAD = { tool: 'Claude Code', marker: 'sess-D', pid: 4141, start: 'S1', taken: '2026-10-18T00:00:00.000Z' };
export const LIVE = { tool: 'Claude Code', marker: 'sess-H', pid: 4242, start: 'S2', taken: '2026-10-18T00:00:00.000Z' };
export const writeHolds = (c: Clone, holds: object) => {
  mkdirSync(`${c.root}/.git/accord`, { recursive: true });
  writeFileSync(holdsFile(c), JSON.stringify(holds));
};
export const readHolds = (c: Clone) => JSON.parse(readFileSync(holdsFile(c), 'utf8')) as Record<string, unknown>;
export const lines = (s: string) => s.split('\n').filter((l) => l !== '');

/** A worktree `t/<id>` with one commit pushed to the remote. */
export function ticketWorktree(c: Clone, id: string, file = `${id}.txt`) {
  c.git('worktree', 'add', '-q', '-b', `t/${id}`, c.sibling(id), 'origin/main');
  writeFiles(c.sibling(id), { [file]: id + '\n' });
  gitRun(c.sibling(id), 'add', '-A');
  gitRun(c.sibling(id), 'commit', '-q', '-m', id);
  gitRun(c.sibling(id), 'push', '-q', 'origin', `t/${id}`);
}
/** Merge the pushed ticket branches into the remote main from another clone; `c` does not fetch. */
export function mergeOnRemote(c: Clone, ...ids: string[]) {
  const other = c.otherClone();
  gitRun(other, 'fetch', '-q', 'origin');
  for (const id of ids) gitRun(other, 'merge', '-q', '--no-ff', '-m', 'merge ' + id, `origin/t/${id}`);
  gitRun(other, 'push', '-q', 'origin', 'main');
}

/** The ticket file as verify leaves it: every criterion ticked at verified commit `v`. */
export function doneTicket(id: string, v: string): string {
  const t = loadSnapshot({ files: { 'accord/config.yml': CONFIG, ['accord/tickets/' + id + '.md']: laneTicket(id) }, tree: [] });
  const a = approvedHash(t.tickets[id]);
  const h = gateReady(t, id).acHash;
  return laneTicket(id, {
    frontmatter: ['approved_hash: "' + a + '"', 'ac_hash: "' + h + '"', 'verified: [ac-1, ac-2]', 'verified_hash: "' + h + '"', 'verified_commit: "' + v + '"'],
  });
}
/** Verify's commits on each ticket branch, then its merge into the remote main, from a teammate's clone; returns each id's tick commit. */
export function doneOnRemote(c: Clone, ids: string[], opts: { squash?: boolean; local?: boolean } = {}): Record<string, string> {
  const o = c.otherClone();
  const out: Record<string, string> = {};
  const onBranches: string[] = [];
  const refspecs: string[] = [];
  for (const id of ids) {
    const onBranch = has(o, `refs/remotes/origin/t/${id}`);
    if (onBranch) gitRun(o, 'switch', '-q', '--detach', `origin/t/${id}`);
    verifyStage(o, id);
    const v = gitRun(o, 'rev-parse', 'HEAD').trim();
    writeFiles(o, { [`accord/tickets/${id}.md`]: doneTicket(id, v) });
    const tip = commitMsg(o, 'verify: ' + id);
    if (onBranch) {
      onBranches.push(id);
      refspecs.push(`${tip}:refs/heads/t/${id}`);
      gitRun(o, 'switch', '-q', 'main');
      if (opts.squash) {
        gitRun(o, 'merge', '--squash', '-q', tip);
        commitMsg(o, 'merge ' + id);
      } else mergeMsg(o, tip, 'merge ' + id);
    }
    out[id] = tip;
  }
  gitRun(o, 'push', '-q', 'origin', 'main', ...refspecs); // one push for the ticket branches and main
  if (opts.local) {
    for (const id of onBranches) {
      c.git('fetch', '-q', 'origin', `t/${id}`);
      if (existsSync(c.sibling(id))) gitRun(c.sibling(id), 'merge', '--ff-only', '-q', `origin/t/${id}`);
      else c.git('update-ref', `refs/heads/t/${id}`, out[id]);
    }
  }
  return out;
}

/** A branch `t/<id>` with one commit, pushed and tracking `origin/t/<id>`, no worktree. */
export function ticketBranch(c: Clone, id: string) {
  c.git('switch', '-q', '-c', `t/${id}`, 'main');
  writeFiles(c.root, { [`${id}.txt`]: id + '\n' });
  c.git('add', '-A');
  c.git('commit', '-q', '-m', id);
  c.git('push', '-q', '-u', 'origin', `t/${id}`);
  c.git('switch', '-q', 'main');
}
/** The branches `ticketBranch` makes, pushed together in one `git push` (same refs, same tracking). */
export function ticketBranches(c: Clone, ids: string[]) {
  for (const id of ids) {
    c.git('switch', '-q', '-c', `t/${id}`, 'main');
    writeFiles(c.root, { [`${id}.txt`]: id + '\n' });
    c.git('add', '-A');
    c.git('commit', '-q', '-m', id);
  }
  c.git('switch', '-q', 'main');
  c.git('push', '-q', '-u', 'origin', ...ids.map((id) => `t/${id}`));
}
export const sha = (c: Clone, ref: string) => c.git('rev-parse', ref).trim();

/** A recorder git can run as an ssh program: appends its arguments to a log and fails; named `ssh` so it counts as OpenSSH. */
export function recorder(c: Clone, name = 'ssh') {
  const dir = `${c.root}/.git/rec-${name}`;
  mkdirSync(dir, { recursive: true });
  const log = `${dir}/log`;
  const file = `${dir}/${name}`;
  writeFileSync(file, `#!/usr/bin/env node
require('node:fs').appendFileSync(${JSON.stringify(log)}, process.argv.slice(2).join(' ') + '\\n'); process.exit(1);
`);
  chmodSync(file, 0o755);
  return { file, seen: () => (existsSync(log) ? readFileSync(log, 'utf8') : '') };
}
export function worktreeAndSshRemote(c: Clone) {
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main');
  c.git('remote', 'set-url', 'origin', 'ssh://example.invalid/repo.git');
}

// The teammate (y@example.invalid) has pushed the branches a test needs; `me` is the identity of the claims that are mine.
export const ME = ['-c', 'user.email=fixture@example.invalid'];
export const teammate = (c: Clone) => {
  const o = c.otherClone();
  gitRun(o, 'config', 'user.email', 'y@example.invalid');
  return o;
};
export const pushedWork = (o: string, id: string, file: string) => {
  gitRun(o, 'switch', '-q', '-c', 't/' + id, 'main');
  writeFiles(o, { [file]: 'x\n' });
  gitRun(o, 'add', '-A');
  gitRun(o, 'commit', '-q', '-m', 'work');
  gitRun(o, 'push', '-q', 'origin', 't/' + id);
};

export const C = { pid: 7003, start: 'S-C', marker: 'sess-C' };

// H1, H2, H4: the two pinned-worktree tests share this set-up; the pick-up whose origin main pins another version is its own test.
export const pinnedWorktree = (c: Clone) => {
  c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main');
  const cfg = `${c.sibling('ST-9')}/accord/config.yml`;
  writeFileSync(cfg, readFileSync(cfg, 'utf8').replace(`accord: "${PIN}"`, 'accord: "0.0.9"'));
  gitRun(c.sibling('ST-9'), 'commit', '-q', '-am', 'pin');
  setTable(tableOf(A));
};

export const C3 = { pid: 7003, start: 'S-C', marker: 'sess-C' };
export const WORKS = ['this session works ST-9', 'open a new session in the main checkout', 'without "/accord"'];

// ST-LN-34: clean deletes the worktree and branches of a ticket dropped on the default branch.
export const has = (dir: string, ref: string) => {
  try {
    gitRun(dir, 'rev-parse', '--verify', '-q', ref);
    return true;
  } catch {
    return false;
  }
};

/** A worktree `t/<id>` with one commit pushed to the remote; returns that commit. */
export function claimWorktree(c: Clone, id: string, files: Record<string, string> = { [`${id}.txt`]: id + '\n' }) {
  c.git('worktree', 'add', '-q', '-b', `t/${id}`, c.sibling(id), 'origin/main');
  writeFiles(c.sibling(id), files);
  const tip = commitMsg(c.sibling(id), id);
  gitRun(c.sibling(id), 'push', '-q', '-u', 'origin', `t/${id}`);
  return tip;
}

/** Put each ticket on the remote main as dropped, from another clone; `c` does not fetch. */
export function dropOnRemote(c: Clone, ids: string[]) {
  const o = c.otherClone();
  for (const id of ids) {
    writeFiles(o, { [`accord/tickets/${id}.md`]: laneTicket(id, { frontmatter: ['status: dropped'], body: LANE_BODY + '\n## Dropped\ngone\n' }) });
  }
  commitMsg(o, 'drop');
  gitRun(o, 'push', '-q', 'origin', 'main');
}

export async function dropAndMerge(c: Clone, id: string) {
  expect((await run(['drop', id, '--reason', 'no longer needed'], c.root)).code).toBe(0);
  const o = c.otherClone();
  mergeMsg(o, `origin/drop/${id}`, `merge drop/${id}`);
  gitRun(o, 'push', '-q', 'origin', 'main');
}

export const pushNext = (c: Clone) => {
  const o = c.otherClone();
  writeFiles(o, { 'next.txt': 'next\n' });
  gitRun(o, 'add', '-A');
  gitRun(o, 'commit', '-q', '-m', 'next');
  gitRun(o, 'push', '-q', 'origin', 'main');
  return gitRun(o, 'rev-parse', 'HEAD').trim();
};

/** A ticket at the verify stage, committed in `dir`: approved, planned, both tasks done, review ended with a verdict. */
export function verifyStage(dir: string, id: string, opts: { review?: boolean } = {}) {
  let text = laneTicket(id);
  const hash = approvedHash(loadSnapshot({ files: { 'accord/config.yml': CONFIG, ['accord/tickets/' + id + '.md']: text }, tree: [] }).tickets[id]);
  text = setFrontmatterKey(text, 'approved_hash', hash);
  const files: Record<string, string> = {
    ['accord/tickets/' + id + '.md']: text,
    ['accord/tickets/' + id + '/plan.md']: PLAN,
    ['accord/tickets/' + id + '/ledger.md']: '## Tasks\n- task 1 done abc1234\n- task 2 done abc1234\n',
  };
  if (opts.review !== false) files['accord/tickets/' + id + '/review.md'] = 'verdict: converged\n';
  writeFiles(dir, files);
  gitRun(dir, 'add', '-A');
  gitRun(dir, 'commit', '-q', '-m', 'review: ' + id);
}

/** Commit a file on the remote main from a second clone, which `c` has not fetched; returns the new tip. */
export function pushMain(c: Clone, file: string, text: string): string {
  const o = c.otherClone();
  writeFiles(o, { [file]: text });
  gitRun(o, 'add', '-A');
  gitRun(o, 'commit', '-q', '-m', file);
  gitRun(o, 'push', '-q', 'origin', 'main');
  return gitRun(o, 'rev-parse', 'HEAD').trim();
}

export const BEHIND = 'behind: t/ST-9 is 2 commits behind origin/main; merge them with git merge origin/main';
export const twoOnMain = (k: Clone) => {
  const x = k.otherClone();
  for (const f of ['a.txt', 'b.txt']) {
    writeFiles(x, { [f]: f + '\n' });
    commitMsg(x, f);
  }
  gitRun(x, 'push', '-q', 'origin', 'main');
};

export const REVIEWED = '## Round 1\n\nNo findings\n\nverdict: converged\n';
/** A lane S ticket on `t/<id>`, ready and reviewed in its sibling and pushed; returns the review commit. */
export async function laneSBranch(c: Clone, id: string, file?: string, edit?: () => void): Promise<string> {
  ticketWorktree(c, id, file);
  const sx = c.sibling(id);
  writeFiles(sx, { [`accord/tickets/${id}.md`]: laneTicket(id, { lane: 'S', body: LANE_S_BODY }) });
  edit?.();
  // The core form of `accord gate ready`: it writes ac_hash into the ticket; the CLI exit 0 is made by lane-s.test.ts ac-2.
  const files = { 'accord/config.yml': readFileSync(`${sx}/accord/config.yml`, 'utf8'), [P(id)]: readFileSync(`${sx}/${P(id)}`, 'utf8') };
  expect(gateReadyIn(files, id)).toBe('pass');
  writeFiles(sx, { [P(id)]: files[P(id)] });
  writeFiles(sx, { [`accord/tickets/${id}/review.md`]: REVIEWED });
  const t = commitMsg(sx, 'review: ' + id);
  gitRun(sx, 'push', '-q', 'origin', `t/${id}`);
  return t;
}

/** The remote main squash-merges the pushed lane S branch `t/ST-14`, then edits the same file, so merging the branch into main conflicts; returns the clone that did it. */
export function conflictOnMain(g: Clone) {
  const go = g.otherClone();
  gitRun(go, 'fetch', '-q', 'origin');
  gitRun(go, 'merge', '--squash', '-q', 'origin/t/ST-14');
  commitMsg(go, 'merge ST-14');
  writeFiles(go, { 'added.txt': 'main\n' });
  commitMsg(go, 'main edit');
  gitRun(go, 'push', '-q', 'origin', 'main');
  return go;
}

// BUG-LN-14: a /clear frees the holds its window took.
export const T = '2026-10-27T03:03:00.000Z';
export const A2 = { ...A, marker: 'sess-A2' };
export const clearOf = (cwd: string, s: { marker: string; pid: number }) =>
  run(['hook', 'session-resume'], cwd, envOf(s), JSON.stringify({ session_id: s.marker, cwd, source: 'clear' }));