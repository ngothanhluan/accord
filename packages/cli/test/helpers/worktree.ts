// Sandbox clones with a bare remote and sibling worktrees, for the `accord worktree` tests (ST-LN-7).
import { cpSync, mkdtempSync, readdirSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { CONFIG, laneTicket } from '../../../../test/helpers/lane.js';
import { cleanup, gitRun, writeFiles } from './repo.js';

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
      gitRun(dir, 'clone', '-q', ...IDENTITY.flatMap(([k, v]) => ['-c', `${k}=${v}`]), remote, '.');
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
