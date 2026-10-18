// Sandbox clones with a bare remote and sibling worktrees, for the `accord worktree` tests (ST-LN-7).
import { mkdtempSync, readdirSync, realpathSync } from 'node:fs';
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
