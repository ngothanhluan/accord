// ST-LN-96 t1-ac-3: `runTeamCommand`, the one runner for committed team commands (git.sync, later tracker.command): the ticket reaches the script only in its environment.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  const r = runTeamCommand(fixture('sleep.mjs', 'setTimeout(() => {}, 60000);\n'), { cwd: dir, env: process.env, timeoutMs: 1000, maxBuffer: 1024 });
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
