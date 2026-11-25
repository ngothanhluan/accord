// Phase 08.9.2 D-01: a real `node` spawn of the rendered launcher against a temporary cache. The launcher is the file Claude Code
// runs for every hook; the bundle it starts is the workspace CLI, linked into the cache as a junction.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pluginTargets } from '@accord-dev/accord-core';
import { afterEach, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import { RUNNING } from '../../../test/helpers/lane.js';
import { cleanup, makeLaneRepo, run, writeFiles } from './helpers/repo.js';

const cliDir = fileURLToPath(new URL('../', import.meta.url));
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) cleanup(d);
});

const rendered = (): string => {
  const file = pluginTargets({ runtimes: ['claude'] }, { name: pkg.name, version: RUNNING }).find((f) => f.path === '.claude/accord.mjs');
  if (file === undefined) throw new Error('pluginTargets holds no .claude/accord.mjs');
  return file.text;
};

/** A sandbox repository holding the rendered launcher, and an empty cache base under the temp folder. */
function sandbox(): { repo: string; base: string; launcher: string } {
  const repo = makeLaneRepo();
  const base = mkdtempSync(join(tmpdir(), 'accord-launcher-cache-'));
  dirs.push(repo, base);
  writeFiles(repo, { '.claude/accord.mjs': rendered() });
  return { repo, base, launcher: join(repo, '.claude', 'accord.mjs') };
}

const spawn = (launcher: string, repo: string, base: string, args: string[], extra: NodeJS.ProcessEnv = {}, input?: string) =>
  spawnSync(process.execPath, [launcher, ...args], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, LOCALAPPDATA: base, XDG_CACHE_HOME: base, ...extra },
    ...(input === undefined ? {} : { input }),
  });

// Phase 08.9.2 D-01: one hook call goes through the rendered launcher to the cached bundle and answers what the CLI answers.
it('risk:regression a hook through the launcher answers what the CLI answers (D-01)', async () => {
  const { repo, base, launcher } = sandbox();
  const slot = join(base, 'accord', 'versions', RUNNING, 'node_modules', '@accord-dev');
  mkdirSync(slot, { recursive: true });
  symlinkSync(cliDir, join(slot, 'accord'), 'junction');
  expect(existsSync(join(slot, 'accord', 'dist', 'cli.js')), 'run npm run build first').toBe(true);

  const version = spawn(launcher, repo, base, [RUNNING, '--version']);
  expect(version.status).toBe(0);
  expect(version.stdout.trim()).toBe(RUNNING);

  const stdin = JSON.stringify({
    session_id: 's-1',
    cwd: repo,
    hook_event_name: 'PreToolUse',
    tool_name: 'Write',
    tool_input: { file_path: 'accord/tickets/T-1/verification.md' },
    agent_type: 'accord-executor',
  });
  const viaLauncher = spawn(launcher, repo, base, [RUNNING, 'hook', 'pre-tool-use'], {}, stdin);
  const inProcess = await run(['hook', 'pre-tool-use'], repo, {}, stdin);
  expect(viaLauncher.status).toBe(0);
  expect(inProcess.out).toContain('"permissionDecision":"deny"');
  expect(viaLauncher.stdout).toBe(inProcess.out);
  expect(viaLauncher.stderr).toBe(inProcess.err);
}, 120_000);

// Phase 08.9.2 D-01 (T-08.9.2-03, Ruling-fill-fails): a version word that is not a version builds no path and starts no npm;
// a missed fill that cannot install prints one line and lets the hook through.
it('risk:security the launcher refuses a version word that is not a version before it builds any path and fails open when the fill fails (D-01 Ruling-fill-fails)', () => {
  const { repo, base, launcher } = sandbox();
  const hook = spawn(launcher, repo, base, ['../x', 'hook', 'session-start']);
  expect(hook.status).toBe(0);
  expect(hook.stdout).toBe('');
  expect(hook.stderr.trim().split('\n')).toHaveLength(1);
  expect(hook.stderr).toContain('not a version');
  expect(hook.stderr).toContain('node .claude/accord.mjs <version> hook <event>');
  expect(spawn(launcher, repo, base, ['../x', '--version']).status).toBe(2);
  expect(readdirSync(base)).toEqual([]);

  // No registry is reachable: the install fails at once and the hook says so in one line, exit 0.
  const offline = { npm_config_offline: 'true', npm_config_fetch_retries: '0' };
  const missing = '0.0.0-no-such-build';
  const fill = spawn(launcher, repo, base, [missing, 'hook', 'session-start'], offline);
  expect(fill.status).toBe(0);
  expect(fill.stdout.trim().split('\n')).toHaveLength(1);
  expect(fill.stdout).toContain(missing);
  expect(fill.stdout).toContain(`node .claude/accord.mjs ${missing} --version`);
  const guard = spawn(launcher, repo, base, [missing, 'hook', 'pre-tool-use'], offline);
  expect(guard.status).toBe(0);
  expect(guard.stdout).toBe('');
  expect(guard.stderr.trim().split('\n')).toHaveLength(1);
  expect(spawn(launcher, repo, base, [missing, '--version'], offline).status).toBe(2);
  const left = existsSync(join(base, 'accord', 'versions')) ? readdirSync(join(base, 'accord', 'versions')) : [];
  expect(left.filter((n) => n.startsWith('.tmp-') || n === missing)).toEqual([]);
}, 120_000);
