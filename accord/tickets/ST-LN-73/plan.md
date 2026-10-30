---
baseline: dd93c14019308d75d1f7d0be67ca47a49b36f999
plan_hash: "fnv1a64:31d7d65e254d0c7a"
---

Review mode `outcome`: one branch, no slices. Every task below can be finished from its own section, this
preamble, the ticket and its ledger.

Order: Task 1 is the wiring. It makes the root config's globalSetup (`setup` in `test/lock.ts`, already named by
`vitest.config.ts:19`) wait for free memory once it holds the lock and lower the fork count of the run to what the
free memory allows (ac-1 to ac-4), and proves with one real vitest run on a small fixture that vitest honours the
lowered count. Task 2 adds the macOS reading of the free memory from `vm_stat` (ac-5, D-04), which becomes the
default reader.

Figures (D-06, ledger Rulings 2 and 3; the measurement is done and no task measures again): each fork needs
0.6 GB, 4 GB is kept free for the rest of the machine, GB is 10^9 bytes. 4 GB plus one fork, 4.6 GB, fits what a
16 GB CI runner has free after the build (ledger Ruling 3), which settles the approach's CI check.

Rules for every task:
- Commits carry no trailer of any kind: no `Co-Authored-By:` line, no `Signed-off-by:` or other `-by:` line, and
  no "Generated with" line, in the subject or the body.
- No task touches any file under the repository's top-level `accord/` folder.
- Test ids: every test named on a `verify:` line is a top-level `it(...)` in
  `packages/cli/test/test-memory.test.ts`, with no `describe` around it. Its report id is the test file's path from
  the repository root, then `#`, then the `it` title with each whitespace run turned into `-`
  (`packages/core/src/load/junit.ts:40`). No test title holds `@`, `#` or a comma. No existing test is renamed or
  changed. Every new test is named on some task's `verify:` line, and no other new test is added.
- Tests: run the test command your brief prints. When it prints none, run only the test files your task's
  `files:` line names that end in `.test.ts`, with `npx vitest run <files> --reporter=default --reporter=junit
  --outputFile.junit=node_modules/.cache/accord/junit.xml`; never `tests.full`. Then find each id of the task's
  `verify:` line in `node_modules/.cache/accord/junit.xml` before reporting done. Also run
  `packages/cli/test/test-lock.test.ts` and `packages/cli/test/vitest-config.test.ts` the same way; both pass
  unchanged.
- End every task with `npm run build`, `npm run lint` and `npm run typecheck`, then its tests. `npm run typecheck`
  covers `test/lock.ts` and every file under `packages/cli/test/` (`packages/cli/tsconfig.json` includes `test`).
- `test/lock.ts` stays runnable by `node --experimental-strip-types`, because `packages/cli/test/test-lock.test.ts`
  imports it in a child node process: only erasable TypeScript (no `enum`, no `namespace`, no parameter
  properties), type-only imports written `import type`, and no import of `vitest` or of `vitest.config.ts`.
- Files are LF with no BOM. Add no dependency. Nothing under `packages/core/` or `packages/cli/src/` changes.
- The real `LOCK` path is never used by a test: every test passes a `lock` path inside its own temporary folder,
  since the run that executes the test already holds `LOCK` and a test that waited on it would wait on its own run.

## Task 1: Wiring: the run waits for free memory after the lock and lowers its fork count
covers: @ac-1, @ac-2, @ac-3, @ac-4, D-01, D-02, D-03, D-05, D-06, D-07
files: test/lock.ts, vitest.config.ts, packages/cli/test/test-memory.test.ts (new), packages/cli/test/fixtures/fork-cap/fork-cap.config.ts (new), packages/cli/test/fixtures/fork-cap/setup.ts (new), packages/cli/test/fixtures/fork-cap/a.check.ts (new), packages/cli/test/fixtures/fork-cap/b.check.ts (new), packages/cli/test/fixtures/fork-cap/c.check.ts (new)
verify: packages/cli/test/test-memory.test.ts#risk:regression-a-real-vitest-run-starts-one-fork-when-the-free-memory-allows-one, packages/cli/test/test-memory.test.ts#ac-1-the-fork-count-follows-the-free-memory-capped-by-half-the-CPUs (@ac-1), packages/cli/test/test-memory.test.ts#ac-2-an-explicit-ACCORD_TEST_WORKERS-is-a-cap-the-free-memory-can-lower (@ac-2), packages/cli/test/test-memory.test.ts#ac-3-a-run-waits-with-one-line-until-one-fork-fits-and-has-no-time-limit (@ac-3), packages/cli/test/test-memory.test.ts#ac-4-the-fork-count-is-read-once-the-lock-is-held (@ac-4)

Consumes: `acquire(file, options)`, `LOCK` and `Options` (`poll`, `log`, `settle`) in `test/lock.ts` as they are at
the baseline; `workers(env, cpus)` exported by `vitest.config.ts`; vitest 5.0.0, which calls a globalSetup's
default export with the root `TestProject` (`node_modules/vitest/dist/chunks/index.B89dZ0-N.js:12116`) before it
reads the worker count of each project when the tests start (`:21044-21046`, `resolveMaxWorkers` at `:11780-11782`:
a project's own `config.maxWorkers` when set, otherwise the root `vitest.config.maxWorkers`). Produces: the default
export `setup(project, options)` that the root config already runs as its globalSetup, and the exports `GB`,
`PER_FORK`, `RESERVE` and `VitestRun` that Task 2 and the tests use.

Tests first, in the new file `packages/cli/test/test-memory.test.ts`.
- Imports: `spawn` from `node:child_process`; `appendFileSync`, `mkdtempSync`, `readFileSync`, `rmSync`,
  `writeFileSync` from `node:fs` (drop any that ends up unused, for lint); `tmpdir` from `node:os`; `join` from
  `node:path`; `afterEach`, `beforeEach`, `expect`, `it` from `vitest`;
  `setup, { GB, type VitestRun } from '../../../test/lock.js'`; `{ workers } from '../../../vitest.config.js'`.
- Top-level, as in `test-lock.test.ts`: `let dir: string;` with `beforeEach` making
  `mkdtempSync(join(tmpdir(), 'accord-memory-'))` and `afterEach` removing it with `{ recursive: true, force: true }`.
- Helpers at module level:
  - `const run = (cap: number): VitestRun => ({ vitest: { config: { maxWorkers: cap }, projects: [{ config: {} }, { config: { maxWorkers: cap } }] } });`
    a stand-in for the root project: one project without its own count (as `packages/core` and `packages/cli`
    are) and one with it (as `--maxWorkers` or `VITEST_MAX_WORKERS` makes every project).
  - `const counts = (r: VitestRun) => [r.vitest.config.maxWorkers, ...r.vitest.projects.map((p) => p.config.maxWorkers)];`
  - `const figures = (lines: string[]) => ({ lock: join(dir, 'run.lock'), perFork: GB, reserve: 4 * GB, poll: 0, log: (l: string) => lines.push(l) });`
    (the criteria's figures: each fork needs 1 GB, 4 GB kept free).
  - `const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));`
- `it('risk:regression a real vitest run starts one fork when the free memory allows one', ..., 120_000)`: guards the
  approach's premise that vitest reads the count after globalSetup, so a vitest upgrade that reads it earlier
  brings back the 2026-10-30 out-of-memory stop and fails here.
  - `fixture = join(import.meta.dirname, 'fixtures', 'fork-cap')`;
    `vitest = join(import.meta.dirname, '..', '..', '..', 'node_modules', 'vitest', 'vitest.mjs')`;
    `log = join(dir, 'pool-ids')`.
  - `env`: every entry of `process.env` whose key does not start with `VITEST`, plus
    `ACCORD_FORK_CAP_LOCK: join(dir, 'run.lock')`, `ACCORD_FORK_CAP_LOG: log`,
    `ACCORD_FORK_CAP_CACHE: join(dir, 'vite-cache')`.
  - `spawn(process.execPath, [vitest, 'run', '--config', 'fork-cap.config.ts'], { cwd: fixture, env })`; collect
    stdout and stderr; resolve on `close` with the exit code.
  - Expect the code to be 0 (message: stdout and stderr), and
    `readFileSync(log, 'utf8').trim().split('\n')` to equal `['1', '1', '1']`: every test file ran in pool slot 1,
    the only slot vitest makes when the count is 1 (`index.B89dZ0-N.js:11412-11415`).
  - Once Task 1's code is in, check the test can fail: set the fixture's `free` to `() => 10 * GB` (6 forks fit,
    so the count stays 3), see this test fail on the pool ids, then restore `() => 5 * GB`. This edit is not
    committed.
- `it('ac-1 the fork count follows the free memory capped by half the CPUs')`: for each `[free, expected]` of
  `[[10, 6], [30, 8]]`: `lines: string[] = []`, `r = run(workers({}, 16))` (half the CPUs is 8),
  `release = await setup(r, { ...figures(lines), free: () => free * GB })`; `counts(r)` equals
  `[expected, expected, expected]`; `lines` equals `[]`; `release()`.
- `it('ac-2 an explicit ACCORD_TEST_WORKERS is a cap the free memory can lower')`: the same steps with
  `r = run(workers({ ACCORD_TEST_WORKERS: '20' }, 4))` (half the CPUs is 2) and 10 GB free, giving 6 for every
  count; then `r = run(workers({ ACCORD_TEST_WORKERS: '3' }, 4))` and 30 GB free, giving 3 for every count.
- `it('ac-3 a run waits with one line until one fork fits and has no time limit')`:
  - `let free = 4.5 * GB; let reads = 0; const lines: string[] = []; const r = run(workers({}, 16));`
  - `const pending = setup(r, { ...figures(lines), free: () => { reads++; return free; } });`
    `let settled = false; void pending.then(() => { settled = true; });`
  - `while (reads < 20) await sleep(5);` then `settled` is `false`, `counts(r)` equals `[8, undefined, 8]`
    (untouched) and `lines` equals
    `['accord: waiting for free memory (4.5 GB free, 5 GB needed: 4 GB kept free for the rest of the machine plus 1 GB for one fork)']`.
  - `free = 7 * GB; const release = await pending;` then `counts(r)` equals `[3, 3, 3]` and `lines` still holds
    only that one line; `release()`.
- `it('ac-4 the fork count is read once the lock is held')`:
  - `writeFileSync(join(dir, 'run.lock'), JSON.stringify({ pid: process.pid, cwd: 'another run' }))` (a live
    holder, so `acquire` waits); `let free = 2 * GB; const lines: string[] = []; const r = run(workers({}, 16));`
  - `const pending = setup(r, { ...figures(lines), free: () => free });`
  - `while (!lines.some((l) => l.includes('waiting for another test run'))) await sleep(5);`
  - `free = 10 * GB; rmSync(join(dir, 'run.lock'));` (that run ends with 10 GB free)
  - `const release = await pending;` then `counts(r)` equals `[6, 6, 6]`; `lines` has length 1 and holds no
    `waiting for free memory`; `JSON.parse(readFileSync(join(dir, 'run.lock'), 'utf8')).cwd` equals
    `process.cwd()`; `release()`; then reading the lock file throws.
  A setup that read the free memory before taking the lock would see 2 GB, print the memory line and wait for
  ever, so this test would time out.
All five fail at the baseline (the baseline `setup` takes no options and changes no count).

The fixture, `packages/cli/test/fixtures/fork-cap/`, a vitest run shaped like the root one: a root config that
runs no tests itself, two projects, a globalSetup, a cap of 3. No file in it ends in `.test.ts`, so the `cli`
project (`include: ['test/**/*.test.ts']`) never runs it, and its config is not named `vitest.config.*`, so no
editor extension runs it on its own.
- `fork-cap.config.ts`: a first-line comment saying it is the ST-LN-73 `risk:regression` fixture run by
  `packages/cli/test/test-memory.test.ts`; then
  `export default defineConfig({ cacheDir: process.env.ACCORD_FORK_CAP_CACHE, test: { pool: 'forks', maxWorkers: 3, globalSetup: ['./setup.ts'], projects: [{ test: { name: 'a', pool: 'forks', include: ['a.check.ts'] } }, { test: { name: 'b', pool: 'forks', include: ['b.check.ts', 'c.check.ts'] } }] } })`
  with `defineConfig` from `vitest/config`. The projects carry no `extends`: a project that inherited
  `globalSetup` would run `setup` again in the same process and wait on its own lock. `cacheDir` keeps vitest's
  cache in the test's temporary folder.
- `setup.ts`: `import setup, { GB, type VitestRun } from '../../../../../test/lock.js';` and
  `export default (project: VitestRun) => setup(project, { lock: process.env.ACCORD_FORK_CAP_LOCK, free: () => 5 * GB, perFork: GB, reserve: 4 * GB, poll: 0, log: () => {} });`
  (5 GB free with 4 GB kept free and 1 GB per fork fits exactly one fork).
- `a.check.ts`, `b.check.ts`, `c.check.ts`, the same body:
  `test('holds a fork', async () => { appendFileSync(String(process.env.ACCORD_FORK_CAP_LOG), String(process.env.VITEST_POOL_ID) + '\n'); await new Promise((r) => setTimeout(r, 1000)); });`
  with `test` from `vitest` and `appendFileSync` from `node:fs`. The 1 s hold makes the three files overlap when
  more than one fork is allowed, so the ids would then differ.
If the fixture run exits non-zero for a reason outside `test/lock.ts` (vitest refusing the inline projects, a
config or module that does not resolve), stop with `BLOCKED` and its stdout and stderr.

Interface, `test/lock.ts`:
- Import `freemem` from `node:os` beside `tmpdir`.
- Exported constants, directly below `LOCK`:
  - `export const GB = 1_000_000_000;`
  - `export const PER_FORK = 600_000_000;` and `export const RESERVE = 4_000_000_000;` (integers, so
    `(free - reserve) / perFork` divides exact integers), under one comment holding the measurement (D-06):
    measured at dd93c14 with one full run at ACCORD_TEST_WORKERS=4 on Windows 11 (20 CPUs, 34.0 GB), 91 files,
    1694 passed, 627 s, sampled every 500 ms: the free memory fell from 9.32 GB to 7.10 GB, 2.22 GB over 4 forks,
    rounded up to 0.6 GB per fork; the fall counts memory the run commits but does not keep resident, which the
    1.21 GB working-set peak misses. 4 GB is kept free because Windows turns sluggish below about 2-3 GB free;
    4 GB plus one fork, 4.6 GB, fits what a 16 GB CI runner has free after the build. GB is 10^9 bytes.
- `export interface VitestRun { vitest: { config: { maxWorkers?: number }; projects: readonly { config: { maxWorkers?: number } }[] } }`
  with a doc comment: the part of the `TestProject` vitest hands a globalSetup that `setup` reads and writes.
- `interface SetupOptions extends Options` adding: `lock?: string` (default `LOCK`); `free?: () => number`, the
  free memory in bytes (default `freemem` from `node:os`; Task 2 replaces this default); `perFork?: number`
  (default `PER_FORK`); `reserve?: number` (default `RESERVE`). Each with a one-line doc comment.
- `const gb = (bytes: number) => String(Number((bytes / GB).toFixed(1)));` (4.5e9 gives `4.5`, 5e9 gives `5`).
- The default export becomes
  `export default async function setup(project: VitestRun, options: SetupOptions = {}): Promise<() => void>`:
  1. `release = await acquire(options.lock ?? LOCK, options)` (unchanged `acquire`, so the lock wait and its line
     stay as they are).
  2. `log` is `options.log` or the same stderr writer `acquire` uses; `poll` is `options.poll ?? 1000`;
     `needed = reserve + perFork`. `let free = read();` and, while `free < needed`: print once for the whole wait
     `accord: waiting for free memory (${gb(free)} GB free, ${gb(needed)} GB needed: ${gb(reserve)} GB kept free for the rest of the machine plus ${gb(perFork)} GB for one fork)`,
     wait `poll` ms, read again. No time limit (D-02).
  3. `fit = Math.floor((free - reserve) / perFork)` from the last reading (at least 1 after step 2).
     `cap = (n: number | undefined) => (n !== undefined && n > 0 ? Math.min(n, fit) : fit)`;
     `root = project.vitest.config.maxWorkers`; for every `p` of `project.vitest.projects`,
     `p.config.maxWorkers = cap(p.config.maxWorkers || root)`; then `project.vitest.config.maxWorkers = cap(root)`.
     Every project ends with the same value, as vitest requires of projects sharing one group order
     (`index.B89dZ0-N.js:11839-11841`). The cap is the root config's value: half the CPUs, or the validated
     `ACCORD_TEST_WORKERS` alone when it is set (D-03).
  4. Return `release`.
  Its doc comment: vitest globalSetup; holds the lock for the whole run, then waits until the free memory fits
  the reserve plus one fork, then lowers every project's fork count to what the free memory allows.
- The header comment keeps its three ST-LN-67 lines and gains: ST-LN-73: once the run holds the lock it waits until
  the free memory fits the memory kept free for the rest of the machine plus one fork, then lowers the fork count
  of every project to what the free memory allows; vitest reads the count when the tests start, after
  globalSetup; watch mode runs globalSetup once, so a rerun keeps the first count; `os.freemem()` reads the
  host's memory, not a container's memory limit.

Interface, `vitest.config.ts`: only the comment above `workers()` changes (D-03). Its second sentence
`ACCORD_TEST_WORKERS sets the count; the default is half the CPUs.` becomes
`ACCORD_TEST_WORKERS sets the cap, otherwise half the CPUs; once the run holds the lock, test/lock.ts lowers it to the forks the free memory allows (ST-LN-73).`

Must not change: `acquire`, `LOCK`, `Options`, `takeOver` and the lock file format, so the four tests of
`packages/cli/test/test-lock.test.ts` pass unchanged; `workers()`, the config object of `vitest.config.ts` and its
`globalSetup: ['./test/lock.ts']`, so the five tests of `packages/cli/test/vitest-config.test.ts` pass unchanged;
the root config takes no lock and reads no memory (approach).

## Task 2: On macOS the free memory is read from vm_stat
covers: @ac-5, D-01, D-04, D-07
files: test/lock.ts, packages/cli/test/test-memory.test.ts (new), packages/cli/test/fixtures/vm_stat.txt (new)
verify: packages/cli/test/test-memory.test.ts#ac-5-the-macOS-free-memory-is-the-free-inactive-and-speculative-pages-times-the-page-size (@ac-5), packages/cli/test/test-memory.test.ts#risk:parsing-a-vm_stat-output-missing-a-count-or-the-page-size-is-refused

Consumes: `setup` and `SetupOptions` from Task 1. Produces: `vmStatFree(text)` and `freeMemory()` exported by
`test/lock.ts`, and `freeMemory` as the default reader of `setup`, so a run on macOS counts the memory the system
can release at once (D-04) while Windows and Linux keep `os.freemem()` (the approach).

Tests first, appended at the end of `packages/cli/test/test-memory.test.ts`, top-level, with `vmStatFree` added to
the import from `../../../test/lock.js` and
`const vmStat = readFileSync(join(import.meta.dirname, 'fixtures', 'vm_stat.txt'), 'utf8');` at module level.
Both run on every OS (D-04).
- `it('ac-5 the macOS free memory is the free inactive and speculative pages times the page size')`:
  `vmStatFree(vmStat)` equals `(13181 + 390340 + 4562) * 16384`, written as that expression.
- `it('risk:parsing a vm_stat output missing a count or the page size is refused')`: for each of
  `['Pages free', 'Pages inactive', 'Pages speculative']`, `vmStatFree` of `vmStat` with that line removed
  (`vmStat.replace(new RegExp('^' + label + ':.*$', 'm'), '')`) throws an error whose message contains the label;
  `vmStatFree(vmStat.replace('(page size of 16384 bytes)', ''))` throws an error whose message contains
  `page size`. A missing count would otherwise give NaN, which skips the wait and sets NaN as the fork count.
Both fail at the baseline of this task (`vmStatFree` does not exist).

`packages/cli/test/fixtures/vm_stat.txt`, exactly these lines, LF, ending with one newline (the format macOS's
`vm_stat` prints on Apple silicon, page size 16384):
```
Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free:                               13181.
Pages active:                            395580.
Pages inactive:                          390340.
Pages speculative:                         4562.
Pages throttled:                              0.
Pages wired down:                        150384.
Pages purgeable:                          27434.
"Translation faults":                 812345679.
Pages copy-on-write:                   23456789.
Pages zero filled:                    345678901.
Pages reactivated:                     12345678.
Pages purged:                           3456789.
File-backed pages:                       312345.
Anonymous pages:                         478137.
Pages stored in compressor:              912345.
Pages occupied by compressor:            301234.
Decompressions:                        23456789.
Compressions:                          34567890.
Pageins:                               12345678.
Pageouts:                                123456.
Swapins:                                      0.
Swapouts:                                     0.
```

Interface, `test/lock.ts`:
- `export function vmStatFree(text: string): number`: the page size is the number in `/page size of (\d+) bytes/`;
  each count is the number in `/^<label>:\s+(\d+)\./m` for the labels `Pages free`, `Pages inactive` and
  `Pages speculative` (anchored at the line start, so `Pages purgeable` or `Pages wired down` never match).
  Returns (free + inactive + speculative) x page size. When the page size or a label is missing it throws
  `new Error('accord: vm_stat printed no "<label>" line')`, with `page size` as the label for the page size.
- `export function freeMemory(): number`: on `process.platform === 'darwin'`,
  `vmStatFree(execFileSync('/usr/bin/vm_stat', { encoding: 'utf8' }))` with `execFileSync` imported from
  `node:child_process`; on every other platform `freemem()`.
- `setup`'s default `free` becomes `freeMemory`; the `SetupOptions.free` doc comment says so.
- The header comment's ST-LN-73 part gains: on macOS the free memory is `vm_stat`'s free, inactive and speculative
  pages, which the system can release at once (D-04).

Must not change: Task 1's five tests and the lock tests, byte for byte; `setup`'s order (lock, then memory, then
count) and its line; `acquire` and `LOCK`. `test/lock.ts` still imports nothing from `vitest`.
