// ST-LN-96 t1-ac-3: `runTeamCommand`, the one runner for committed team commands (git.sync, later tracker.command): the ticket reaches the script only in its environment.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import { runTeamCommand } from '../src/load/team-run.js';

const dir = mkdtempSync(join(tmpdir(), 'accord-team-run-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** A fixture script written as a .mjs file and run as `node <path>` (never `./x.sh`: cmd.exe cannot run it). */
function fixture(name: string, body: string): string {
  const path = join(dir, name).replaceAll('\\', '/');
  writeFileSync(path, body);
  return `node ${path}`;
}

const BASE = { timeoutMs: 20_000, maxBuffer: 1024 * 1024 };

it('risk:security a team command gets the ticket only through its environment (ST-LN-96 t1-ac-3)', () => {
  const out = join(dir, 'seen.json').replaceAll('\\', '/');
  const command = fixture(
    'env.mjs',
    `import { writeFileSync } from 'node:fs';
writeFileSync(${JSON.stringify(out)}, JSON.stringify({ env: process.env, argv: process.argv.slice(2), cwd: process.cwd() }));
`,
  );
  const env = { ...process.env, ACCORD_TICKET: 'ST-9', ACCORD_BRANCH: 't/ST-9', ACCORD_BASE_REF: 'refs/remotes/origin/main', ACCORD_ROOT: dir };
  const r = runTeamCommand(command, { cwd: dir, env, ...BASE });
  expect(r).toMatchObject({ code: 0, timedOut: false, oversize: false });
  const seen = JSON.parse(readFileSync(out, 'utf8')) as { env: Record<string, string>; argv: string[]; cwd: string };
  expect(seen.env.ACCORD_TICKET).toBe('ST-9');
  expect(seen.env.ACCORD_BRANCH).toBe('t/ST-9');
  expect(seen.env.ACCORD_BASE_REF).toBe('refs/remotes/origin/main');
  expect(seen.env.ACCORD_ROOT).toBe(dir);
  // nothing accord added reaches argv, and the command text it was given holds none of the values
  expect(seen.argv).toEqual([]);
  for (const v of ['ST-9', 't/ST-9', 'refs/remotes/origin/main']) expect(command).not.toContain(v);
});

it('risk:security a team command that fails or writes is reported with its output, never thrown (ST-LN-96 t1-ac-3)', () => {
  const bad = runTeamCommand(fixture('fail.mjs', "console.error('boom'); console.log('said'); process.exit(3);\n"), { cwd: dir, env: process.env, ...BASE });
  expect(bad).toMatchObject({ code: 3, timedOut: false, oversize: false });
  expect(bad.stderr).toContain('boom');
  expect(bad.stdout).toContain('said');
  const echo = runTeamCommand(fixture('stdin.mjs', "let s = ''; process.stdin.on('data', (d) => (s += d)); process.stdin.on('end', () => process.stdout.write('got:' + s));\n"), {
    cwd: dir,
    env: process.env,
    input: 'hello',
    ...BASE,
  });
  expect(echo.stdout).toBe('got:hello');
  // no input: stdin is empty, not the terminal
  const none = runTeamCommand(fixture('stdin2.mjs', "let s = ''; process.stdin.on('data', (d) => (s += d)); process.stdin.on('end', () => process.stdout.write('got:' + s));\n"), { cwd: dir, env: process.env, ...BASE });
  expect(none.stdout).toBe('got:');
});

it('risk:complex-branching a command that outlives its timeout is killed and reported (ST-LN-96 t1-ac-3)', () => {
  const t0 = Date.now();
  const r = runTeamCommand(fixture('sleep.mjs', 'setTimeout(() => {}, 3000);\n'), { cwd: dir, env: process.env, timeoutMs: 1000, maxBuffer: 1024 });
  expect(r.timedOut).toBe(true);
  expect(r.code).not.toBe(0);
  expect(Date.now() - t0).toBeLessThan(30_000);
});

it('risk:complex-branching output over maxBuffer is reported, not thrown (ST-LN-96 t1-ac-3)', () => {
  const r = runTeamCommand(fixture('big.mjs', "process.stdout.write('x'.repeat(200000));\n"), { cwd: dir, env: process.env, timeoutMs: 20_000, maxBuffer: 1024 });
  expect(r.oversize).toBe(true);
  expect(r.timedOut).toBe(false);
  expect(r.code).not.toBe(0);
});

/** A script that starts a long-lived child in `folder` (so the child holds it as its cwd), records the child's pid, then does `then`. */
function treeScript(folder: string, pidFile: string, then: string): string {
  const path = join(folder, 'tree.mjs').replaceAll('\\', '/');
  writeFileSync(
    path,
    `import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const c = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 20000)'], { stdio: 'ignore', cwd: ${JSON.stringify(folder)} });
writeFileSync(${JSON.stringify(pidFile)}, String(c.pid));
${then}
`,
  );
  return `node ${path}`;
}

/** True while a process with this id exists and is not a zombie (killed, not yet reaped by init). */
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
  try {
    // Linux: field 3 of /proc/<pid>/stat is the state; Z is a killed process its new parent has not reaped yet.
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    return stat.slice(stat.lastIndexOf(')') + 2).split(' ')[0] !== 'Z';
  } catch {
    return true;
  }
}

// ST-LN-96 t1-ac-3: a killed team command takes its whole process tree with it, so the ticket's worktree can be removed at once.
it.each([
  ['times out', 'setTimeout(() => {}, 20000);', { timeoutMs: 3000, maxBuffer: 1024 * 1024 }, 'timedOut'],
  ['prints too much', "process.stdout.write('x'.repeat(200000)); setTimeout(() => {}, 20000);", { timeoutMs: 20_000, maxBuffer: 1024 }, 'oversize'],
] as const)(
  'risk:resource a team command that %s leaves no process holding the worktree (ST-LN-96 t1-ac-3)',
  (_name, then, limits, flag) => {
    const folder = mkdtempSync(join(tmpdir(), 'accord-team-tree-'));
    const pidFile = join(dir, `child-${flag}.pid`);
    const r = runTeamCommand(treeScript(folder, pidFile, then), { cwd: folder, env: process.env, ...limits });
    expect(r[flag]).toBe(true);
    expect(existsSync(pidFile)).toBe(true);
    // at once: no retry and no wait for the child; a child still running holds the folder (EBUSY on Windows)
    rmSync(folder, { recursive: true });
    expect(existsSync(folder)).toBe(false);
    expect(alive(Number(readFileSync(pidFile, 'utf8')))).toBe(false);
  },
);

// WR-04 (phase 3.1 review): on POSIX the script runs in its own session so a timeout can kill its group, which also hides it from the terminal's
// Ctrl-C and from a harness that kills accord; `runTeamCommand` blocks, so no handler of accord's can forward the signal. The script and its
// descendants must end within seconds of accord's death instead of running on for the 600 s sync limit.
const pidsOf = (file: string): { script: number; grandchild: number } => JSON.parse(readFileSync(file, 'utf8'));

async function until(ok: () => boolean, ms: number): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (ok()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return ok();
}

it.skipIf(process.platform === 'win32').each([
  ['Ctrl-C reaches accord and its process group', 'group', 'SIGINT'],
  ['a harness kills the accord process group', 'group', 'SIGTERM'],
  ['accord alone is killed outright', 'pid', 'SIGKILL'],
] as const)(
  'risk:resource when %s the team command and its descendants end (WR-04)',
  async (_name, scope, signal) => {
    const pidFile = join(dir, `die-${scope}-${signal}.pid`).replaceAll('\\', '/');
    const script = join(dir, `die-${signal}.mjs`).replaceAll('\\', '/');
    // the script and a grandchild each live 60 s, far past the bound below
    writeFileSync(
      script,
      `import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const c = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' });
writeFileSync(${JSON.stringify(pidFile)}, JSON.stringify({ script: process.pid, grandchild: c.pid }));
setTimeout(() => {}, 60000);
`,
    );
    // a stand-in for accord: it runs the script through runTeamCommand, which blocks until the script ends
    const host = join(dir, `die-host-${signal}.mjs`).replaceAll('\\', '/');
    const source = new URL('../src/load/team-run.ts', import.meta.url).href;
    writeFileSync(
      host,
      `import { runTeamCommand } from ${JSON.stringify(source)};
runTeamCommand(${JSON.stringify(`node ${script}`)}, { cwd: ${JSON.stringify(dir)}, env: process.env, timeoutMs: 120000, maxBuffer: 1024 * 1024 });
`,
    );
    // Node before 22.18 strips types only behind the flag
    const flags = process.features.typescript ? [] : ['--experimental-strip-types'];
    // detached: the stand-in leads its own group, so a group kill reaches it and what shares its group, as Ctrl-C does accord
    const accord = spawn(process.execPath, [...flags, host], { detached: true, stdio: 'ignore' });
    let pids: { script: number; grandchild: number } | undefined;
    try {
      expect(await until(() => existsSync(pidFile) && readFileSync(pidFile, 'utf8').endsWith('}'), 30_000)).toBe(true);
      pids = pidsOf(pidFile);
      process.kill(scope === 'group' ? -accord.pid! : accord.pid!, signal);
      // wide for a loaded machine, and well below the 60 s the script lives
      const gone = await until(() => !alive(pids!.script) && !alive(pids!.grandchild), 20_000);
      expect({ gone, script: alive(pids.script), grandchild: alive(pids.grandchild) }).toEqual({ gone: true, script: false, grandchild: false });
    } finally {
      for (const p of [pids?.script, pids?.grandchild, accord.pid]) {
        try {
          if (p !== undefined) process.kill(p, 'SIGKILL');
        } catch {
          /* already gone */
        }
      }
    }
  },
  60_000,
);
