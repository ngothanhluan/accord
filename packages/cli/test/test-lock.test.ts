import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { acquire } from '../../../test/lock.js';

const lockModule = pathToFileURL(join(import.meta.dirname, '../../../test/lock.ts')).href;
// Node 22.12 strips types only behind the flag; later versions accept it as a no-op.
const nodeArgs = ['--experimental-strip-types', '--disable-warning=ExperimentalWarning'];

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'accord-lock-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** A child process that takes the lock, logs its hold to `log`, holds it for `hold` ms, then releases. */
function run(lock: string, log: string, hold: number): Promise<{ code: number | null; stderr: string; stdout: string }> {
  const script = `
    import { appendFileSync } from 'node:fs';
    import { acquire } from ${JSON.stringify(lockModule)};
    const release = await acquire(${JSON.stringify(lock)}, { poll: 50 });
    appendFileSync(${JSON.stringify(log)}, 'start ' + Date.now() + '\\n');
    await new Promise((r) => setTimeout(r, ${hold}));
    appendFileSync(${JSON.stringify(log)}, 'end ' + Date.now() + '\\n');
    release();
    console.log('held');
  `;
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [...nodeArgs, '--input-type=module', '-e', script]);
    let stderr = '';
    let stdout = '';
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
    child.on('close', (code) => resolve({ code, stderr, stdout }));
  });
}

describe('machine-wide test run lock', () => {
  it('risk:concurrency two runs started together never overlap, and the second says once that it waits', async () => {
    const lock = join(dir, 'run.lock');
    const log = join(dir, 'log');
    const results = await Promise.all([run(lock, log, 1500), run(lock, log, 1500)]);
    for (const r of results) expect(r, r.stderr).toMatchObject({ code: 0, stdout: 'held\n' });

    const lines = readFileSync(log, 'utf8').trim().split('\n');
    expect(lines.map((l) => l.split(' ')[0])).toEqual(['start', 'end', 'start', 'end']);
    expect(Number(lines[2].split(' ')[1])).toBeGreaterThanOrEqual(Number(lines[1].split(' ')[1]));

    const waits = results.map((r) => r.stderr.split('\n').filter((l) => /waiting for another test run/.test(l)).length);
    expect(waits.sort()).toEqual([0, 1]);
  }, 60_000);

  it('risk:stale a lock left by a killed run is taken over', async () => {
    const lock = join(dir, 'run.lock');
    const script = `
      import { acquire } from ${JSON.stringify(lockModule)};
      await acquire(${JSON.stringify(lock)});
      console.log('held');
      setInterval(() => {}, 1000);
    `;
    const child = spawn(process.execPath, [...nodeArgs, '--input-type=module', '-e', script]);
    await new Promise<void>((resolve) => child.stdout.on('data', () => resolve()));
    const exited = new Promise((resolve) => child.on('exit', resolve));
    child.kill('SIGKILL');
    await exited;
    expect(JSON.parse(readFileSync(lock, 'utf8')).pid).toBe(child.pid);

    const lines: string[] = [];
    const release = await acquire(lock, { poll: 50, log: (l) => lines.push(l) });
    expect(JSON.parse(readFileSync(lock, 'utf8')).pid).toBe(process.pid);
    release();
    expect(() => readFileSync(lock)).toThrow();
  }, 30_000);

  it('risk:stale an empty lock file whose writer died before writing is taken over once it is old', async () => {
    const lock = join(dir, 'run.lock');
    writeFileSync(lock, '');
    const release = await acquire(lock, { poll: 50, log: () => {}, settle: 200 });
    expect(JSON.parse(readFileSync(lock, 'utf8')).pid).toBe(process.pid);
    release();
  }, 30_000);

  it('risk:data-loss a release never removes a lock another run holds', async () => {
    const lock = join(dir, 'run.lock');
    const release = await acquire(lock, { poll: 50 });
    writeFileSync(lock, JSON.stringify({ pid: process.pid + 1, started: Date.now() }));
    release();
    expect(JSON.parse(readFileSync(lock, 'utf8')).pid).toBe(process.pid + 1);
  });
});
