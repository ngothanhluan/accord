// Phase 08.9.3 D-01: two repositories under one parent folder, for the `accord repos` tests. `svc` is the main checkout (accord/config.yml declares `tools` by its remote URL)
// and `tools` is a sibling clone. Each clone's origin is the URL text of its repository (`https://github.com/acme/<name>.git`); `url.<bare>.insteadOf` sends every fetch and push to a bare
// remote in a temporary folder, so no network is touched. The `copyRepos` self-check follows `copyClone` of helpers/worktree.ts: a copy whose url sections still name the template's remotes
// would let a push reach the template.
import { cpSync, mkdirSync, mkdtempSync, readdirSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { CONFIG, discussFor, discussPath, laneTicket, RUNNING } from '../../../../test/helpers/lane.js';
import { cleanup, gitRun, writeFiles } from './repo.js';

const IDENTITY = [
  ['user.email', 'fixture@example.invalid'],
  ['user.name', 'fixture'],
  ['commit.gpgsign', 'false'],
  ['maintenance.auto', 'false'],
  ['gc.auto', '0'],
];

/** The URL text each fixture clone carries as its configured origin. */
export const SVC_URL = 'https://github.com/acme/svc.git';
export const TOOLS_URL = 'https://github.com/acme/tools.git';

const posix = (p: string): string => p.replace(/\\/g, '/');

export interface Repos {
  /** The folder holding both clones, the parent of the main checkout. */
  parent: string;
  /** The main checkout, on main, holding accord/config.yml with `repos.tools`. */
  svc: string;
  /** The sibling clone, on main, whose configured origin is TOOLS_URL. */
  tools: string;
  svcRemote: string;
  toolsRemote: string;
  git(dir: string, ...args: string[]): string;
  cleanupAll(): void;
}

/** The accord/config.yml of the main checkout: the lane CONFIG plus the `repos:` block that declares `tools` by its URL and its two test commands. */
export const REPOS_CONFIG = CONFIG + ['repos:', '  tools:', `    remote: ${TOOLS_URL}`, '    tests: node -e "process.exit(0)"', ''].join('\n');

/** The pin the tools clone's own accord install holds when `toolsAccord` is set: not the running release, so a command that read it would refuse. */
export const TOOLS_PIN = '0.0.1';

/** An empty bare remote in its own temporary folder. */
function bare(): string {
  const dir = realpathSync.native(mkdtempSync(join(tmpdir(), 'accord-repos-remote-')));
  gitRun(dir, 'init', '--bare', '-q', '-b', 'main');
  gitRun(dir, 'config', 'gc.auto', '0');
  gitRun(dir, 'config', 'receive.autogc', 'false');
  return dir;
}

/** Set the configured origin of `dir` to `url` text, and send what git does with that URL to the bare remote `remote`. */
function wire(dir: string, url: string, remote: string): void {
  gitRun(dir, 'remote', 'add', 'origin', url);
  gitRun(dir, 'config', `url.${posix(remote)}.insteadOf`, url);
}

function initClone(dir: string, url: string, remote: string, files: Record<string, string>): void {
  mkdirSync(dir, { recursive: true });
  gitRun(dir, 'init', '-q', '-b', 'main');
  for (const [k, v] of IDENTITY) gitRun(dir, 'config', k, v);
  writeFiles(dir, files);
  gitRun(dir, 'add', '-A');
  gitRun(dir, 'commit', '-q', '-m', 'init');
  wire(dir, url, remote);
  gitRun(dir, 'push', '-q', '-u', 'origin', 'main');
  gitRun(dir, 'remote', 'set-head', 'origin', 'main');
}

export interface ReposOptions {
  /** The tools clone uses accord itself: its own `accord/config.yml` (pin `TOOLS_PIN`) and one ticket, TL-1, committed on main (Phase 08.9.3 D-03). */
  toolsAccord?: boolean;
}

/** The template: a parent folder holding `svc` and `tools`, each with its own bare remote. A test takes a copy with `copyRepos`; no linked worktree is ever made in a template. */
export function makeReposTemplate(o: ReposOptions = {}): Repos {
  const parent = realpathSync.native(mkdtempSync(join(tmpdir(), 'accord-repos-')));
  const svcRemote = bare();
  const toolsRemote = bare();
  const svc = join(parent, 'svc');
  const tools = join(parent, 'tools');
  initClone(svc, SVC_URL, svcRemote, {
    'accord/config.yml': REPOS_CONFIG,
    '.gitignore': 'node_modules/\n',
    'accord/tickets/ST-9.md': laneTicket('ST-9'),
    'accord/tickets/ST-9/scout.md': 'skipped: seeded by the test helper\n',
    [discussPath('ST-9')]: discussFor('ST-9'),
  });
  initClone(tools, TOOLS_URL, toolsRemote, {
    'src/Tools.cs': 'class Tools {}\n',
    'src/Other.cs': 'class Other {}\n',
    'tests/ToolsTests.cs': 'class ToolsTests {}\n',
    ...(o.toolsAccord === true ? { 'accord/config.yml': CONFIG.replace(`accord: "${RUNNING}"`, `accord: "${TOOLS_PIN}"`), 'accord/tickets/TL-1.md': laneTicket('TL-1') } : {}),
  });
  return handle(parent, svcRemote, toolsRemote);
}

function handle(parent: string, svcRemote: string, toolsRemote: string): Repos {
  const svc = join(parent, 'svc');
  const tools = join(parent, 'tools');
  return {
    parent,
    svc,
    tools,
    svcRemote,
    toolsRemote,
    git: (dir, ...args) => gitRun(dir, ...args),
    cleanupAll() {
      // every `<clone>-<id>` folder a test opened beside a clone lives in the parent, so removing the parent takes them with it
      for (const d of [parent, svcRemote, toolsRemote]) cleanup(d);
    },
  };
}

/** The `url.<base>.insteadOf` lines of a clone's local config: `[subsection base, value]`. */
function rewrites(dir: string): [string, string][] {
  let text: string;
  try {
    // -z: `key\nvalue\0` per entry, since a temporary folder's name may hold a space (`C:/Users/Some One/...`)
    text = gitRun(dir, 'config', '--local', '-z', '--get-regexp', '^url\\..*\\.insteadof$');
  } catch {
    return []; // exit 1: no such key
  }
  return text
    .split('\0')
    .filter((e) => e !== '')
    .map((e) => {
      const nl = e.indexOf('\n');
      const key = e.slice(0, nl);
      return [key.slice('url.'.length, key.length - '.insteadof'.length), e.slice(nl + 1)];
    });
}

/**
 * A copy of the template: the parent folder with both clones and both bare remotes are copied, each copied clone's `url.<bare>.insteadOf` section is rewritten to its copied remote
 * (never a text replace of the file), and the copy throws when any url section of a copied clone still names a template remote or when a copy shares a path with its template.
 */
export function copyRepos(tpl: Repos): Repos {
  const parent = realpathSync.native(mkdtempSync(join(tmpdir(), 'accord-repos-')));
  cpSync(tpl.parent, parent, { recursive: true });
  const svcRemote = realpathSync.native(mkdtempSync(join(tmpdir(), 'accord-repos-remote-')));
  cpSync(tpl.svcRemote, svcRemote, { recursive: true });
  const toolsRemote = realpathSync.native(mkdtempSync(join(tmpdir(), 'accord-repos-remote-')));
  cpSync(tpl.toolsRemote, toolsRemote, { recursive: true });
  const made = handle(parent, svcRemote, toolsRemote);
  const pairs: [string, string, string, string][] = [
    [made.svc, SVC_URL, svcRemote, tpl.svcRemote],
    [made.tools, TOOLS_URL, toolsRemote, tpl.toolsRemote],
  ];
  const mine = new Set([svcRemote, toolsRemote, parent, made.svc, made.tools].map(posix));
  const theirs = new Set([tpl.svcRemote, tpl.toolsRemote, tpl.parent, tpl.svc, tpl.tools].map(posix));
  for (const [dir, url, remote, was] of pairs) {
    for (const [base] of rewrites(dir)) gitRun(dir, 'config', '--local', '--remove-section', `url.${base}`);
    gitRun(dir, 'config', `url.${posix(remote)}.insteadOf`, url);
    const left = rewrites(dir);
    if (left.length !== 1 || left[0][0] !== posix(remote) || left[0][1] !== url || left.some(([b]) => theirs.has(b) || b === posix(was))) {
      throw new Error(`copy url rewrite is not its own: ${JSON.stringify(left)}, copy ${remote}, template ${was}`);
    }
    // the origin text stays the configured URL, and git, which applies the rewrite, reaches the copied remote
    const configured = gitRun(dir, 'config', '--get', 'remote.origin.url').trim();
    const used = gitRun(dir, 'remote', 'get-url', 'origin').trim();
    if (configured !== url || posix(used) !== posix(remote)) throw new Error(`copy origin is not its own: configured ${configured}, used ${used}, copy ${remote}`);
  }
  const shared = [...mine].find((p) => theirs.has(p));
  if (shared !== undefined) throw new Error('copy shares a path with its template: ' + shared);
  return made;
}

let template: Repos | undefined;
const copies: Repos[] = [];

/** Registers the file's hooks: the template is built once in `beforeAll`, and each test's copy is removed after it. */
export function useRepoSandboxes(o: ReposOptions = {}): void {
  beforeAll(() => {
    template = makeReposTemplate(o);
  }, 180_000);
  afterAll(() => {
    template?.cleanupAll();
  });
  afterEach(() => {
    for (const c of copies.splice(0)) c.cleanupAll();
  });
}

/** A fresh copy of the template for one test; removed by the afterEach `useRepoSandboxes` registered. */
export function reposCopy(): Repos {
  if (template === undefined) throw new Error('no template: call useRepoSandboxes() at the top of the file');
  const c = copyRepos(template);
  copies.push(c);
  return c;
}

/** Folders beside a clone that start with the clone's name and a dash: the worktrees a command opened there. */
export const besides = (dir: string): string[] => readdirSync(dirname(dir)).filter((n) => n.startsWith(basename(dir) + '-'));
