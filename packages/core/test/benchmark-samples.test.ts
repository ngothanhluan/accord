import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

type Run = { dispatch: { prompt: string; cwd: string; ts: number }; reads: { path: string; text: string }[] };
type Sample = Record<string, unknown>;

it('risk:data-loss a sample snapshot keeps the dispatch and every named file and is never overwritten', async () => {
  const { snapshotSample } = (await import(new URL('../../../scripts/benchmark.mjs', import.meta.url).href)) as {
    snapshotSample: (repo: string, s: Sample, run: Run | undefined, bench: string) => { problems: string[]; kept: boolean };
  };
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  const t = tmp.replaceAll('\\', '/');
  try {
    const repo = t + '/repo';
    mkdirSync(repo + '/accord/tickets/T-1', { recursive: true });
    mkdirSync(repo + '/src');
    const git = (...a: string[]) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    writeFileSync(repo + '/accord/tickets/T-1.md', '---\nid: "T-1"\n---\n\n## Intent\nx\n');
    writeFileSync(repo + '/accord/tickets/T-1/plan.md', '## Task 1: a\ncovers: @ac-1\nfiles: src/a.ts\nverify: a.test.ts#risk:parsing-x\n');
    writeFileSync(repo + '/src/a.ts', 'a\n');
    git('init', '-q');
    git('add', '.');
    writeFileSync(t + '/msg.txt', 'init\n');
    git('-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-q', '--no-verify', '-F', t + '/msg.txt', '--cleanup=verbatim');
    const H = git('rev-parse', 'HEAD');
    const brief = t + '/brief.md';
    writeFileSync(brief, 'line one\n');
    const bench = t + '/bench';
    const prompt = 'Work in ' + repo + '. Brief: ' + brief + '. Read ' + repo + '/src/a.ts.';
    const sample: Sample = { agent: 'accord-executor', n: 1, transcript: 'X/S/subagents/agent-1.jsonl', ticket: 'T-1', task: '1', kind: 'risk', base: H, main: H, root: repo, elsewhere: [], files: [{ path: brief, from: 'copy' }], pairs: [] };
    const mk = (over: Partial<Run['dispatch']> = {}, reads?: Run['reads']): Run => ({ dispatch: { prompt, cwd: repo, ts: Date.now() + 60_000, ...over }, reads: reads ?? [{ path: brief, text: 'line one' }] });
    const run = mk();
    let i = 0;
    const fresh = () => `${bench}-${++i}`;

    expect(snapshotSample(repo, sample, run, bench)).toEqual({ problems: [], kept: false });
    const file = bench + '/samples/executor-1/sample.json';
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ transcript: sample.transcript, prompt, cwd: repo, ts: run.dispatch.ts, reads: { [brief]: 'line one' } });
    const bytes = readFileSync(file, 'utf8');

    rmSync(brief);
    expect(snapshotSample(repo, sample, undefined, bench)).toEqual({ problems: [], kept: true });
    expect(readFileSync(file, 'utf8')).toBe(bytes);
    writeFileSync(brief, 'line one\n');

    const other = snapshotSample(repo, { ...sample, transcript: 'X/S/subagents/agent-2.jsonl' }, run, bench);
    expect(other.kept).toBe(true);
    expect(other.problems).toHaveLength(1);
    expect(other.problems[0]).toContain('is of X/S/subagents/agent-1.jsonl');
    expect(readFileSync(file, 'utf8')).toBe(bytes);

    const back = repo.replaceAll('/', '\\');
    expect(snapshotSample(repo, sample, mk({ prompt: prompt + ' Read ' + back + '\\src\\a.ts.' }), fresh())).toEqual({ problems: [], kept: false });

    const refused = (s: Sample, r: Run | undefined, quoted: string) => {
      const b = fresh();
      const out = snapshotSample(repo, s, r, b);
      expect(out.problems.join('\n')).toContain(quoted);
      expect(existsSync(b + '/samples/executor-1/sample.json')).toBe(false);
    };
    refused({ ...sample, kind: 'plain' }, run, 'risk');
    refused(sample, mk({ prompt: prompt + ' ' + repo + '/src/missing.ts' }), 'src/missing.ts');
    refused(sample, mk({ prompt: prompt + ' ' + back + '\\src\\missing.ts' }), 'src/missing.ts');
    refused(sample, mk({ ts: Date.now() - 3_600_000 }), 'modified after the dispatch');
    refused(sample, mk({ prompt: prompt + ' C:/Elsewhere/x.txt' }), 'outside the bench root');
    const two = { ...sample, files: [{ path: brief, from: 'copy' }, { path: t + '/b2.md', from: 'brief', task: '1' }] };
    refused(two, mk({ prompt: prompt + ' ' + t + '/b2.md' }, [{ path: brief, text: 'line one' }, { path: t + '/b2.md', text: 'Work in C:/Elsewhere/y' }]), 'outside the bench root');
    refused(sample, undefined, 'no run');
    refused(sample, mk({ prompt: 'Probe run for a check. ' + prompt }), 'probe');
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);

it('risk:regression a base whose config predates the setup key gets the repository setup', async () => {
  const { setupAt } = (await import(new URL('../../../scripts/benchmark.mjs', import.meta.url).href)) as {
    setupAt: (dir: string, repo: string) => string[];
  };
  const tmp = mkdtempSync(join(tmpdir(), 'bench-setup-'));
  try {
    const put = (d: string, text: string) => { mkdirSync(join(tmp, d, 'accord'), { recursive: true }); writeFileSync(join(tmp, d, 'accord', 'config.yml'), text); };
    put('repo', 'setup:\n  - npm ci\ntests:\n  full: x\n');
    put('old', 'tests:\n  full: x\n');
    put('new', 'setup:\n  - pnpm i\n');
    expect(setupAt(join(tmp, 'old'), join(tmp, 'repo'))).toEqual(['npm ci']);
    expect(setupAt(join(tmp, 'new'), join(tmp, 'repo'))).toEqual(['pnpm i']);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

it('risk:data-loss the committed sample list passes its checks before the transcripts expire', async () => {
  const { checkSamples } = (await import(new URL('../../../scripts/round.mjs', import.meta.url).href)) as {
    checkSamples: (list: unknown) => string[];
  };
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const list = JSON.parse(readFileSync(join(root, 'scripts', 'benchmark-samples.json'), 'utf8')) as { samples: { agent: string; transcript: string }[] };
  expect(checkSamples(list)).toEqual([]);
  expect(list.samples).toHaveLength(45);
  expect(list.samples.some((s) => s.agent === 'accord-debugger')).toBe(false);
  expect(list.samples.every((s) => /^C--Work-accord/.test(s.transcript))).toBe(true);
});

it('risk:regression a review-package file base that is not an ancestor of the sample base is refused before any brief is written', async () => {
  const { checkFileBases, packageDrift } = (await import(new URL('../../../scripts/benchmark.mjs', import.meta.url).href)) as {
    checkFileBases: (repo: string, list: unknown) => string[];
    packageDrift: (s: Sample, f: Sample, read: string | undefined, built: string) => string | undefined;
  };
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  try {
    const git = (env: Record<string, string>, ...a: string[]) =>
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...a], { cwd: tmp, encoding: 'utf8', env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    git({}, 'init', '-q');
    const at = { GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z' };
    const tree = (name: string) => { writeFileSync(join(tmp, 'f.txt'), name); git({}, 'add', '.'); return git({}, 'write-tree'); };
    const [tA, tB] = [tree('a'), tree('b')];
    const mk = (t: string, committed: string, parent?: string) =>
      git({ ...at, GIT_COMMITTER_DATE: committed }, 'commit-tree', t, ...(parent ? ['-p', parent] : []), '-m', 'x');
    const A = mk(tA, '2026-01-01T00:00:00Z');
    const B = mk(tB, '2026-01-01T00:00:00Z', A);
    const A2 = mk(tA, '2026-02-01T00:00:00Z');
    const B2 = mk(tB, '2026-02-01T00:00:00Z', A2);
    expect(B).not.toBe(B2);
    const list = (base: string) => ({ samples: [{ agent: 'accord-reviewer', n: 3, base: B2, files: [{ path: '/p/package.md', from: 'review-package', base }, { path: '/p/c.md', from: 'copy' }] }] });
    const bad = checkFileBases(tmp, list(A));
    expect(bad).toHaveLength(1);
    expect(bad[0]).toContain('accord-reviewer 3');
    expect(bad[0]).toContain('/p/package.md');
    expect(bad[0]).toContain(A);
    expect(checkFileBases(tmp, list(A2))).toEqual([]);

    const f = { path: '/p/package.md' };
    const s = { agent: 'accord-reviewer', n: 3 };
    const pkg = (head: string, ...files: string[]) => `# Review package: T (${head})\n\n## Commits\n${head} x\n\n## Diff\n\n` + files.map((p) => `diff --git a/${p} b/${p}\n--- a/${p}\n+++ b/${p}\n+diff --git a/z b/z\n`).join('');
    expect(packageDrift(s, f, pkg('fd80243...HEAD', 'a.ts', 'b.ts'), pkg('f67b830' + '0'.repeat(33) + '...HEAD', 'b.ts', 'a.ts'))).toBeUndefined();
    const extra = packageDrift(s, f, pkg('fd80243...HEAD', 'a.ts'), pkg('f67b830...HEAD', 'a.ts', 'c.ts'));
    expect(extra).toContain('accord-reviewer 3');
    expect(extra).toContain('c.ts');
    expect(extra).not.toContain('a.ts');
    // a read cut short inside its last file leaves the later files of the rebuild unjudged
    expect(packageDrift(s, f, pkg('fd80243...HEAD', 'a.ts', 'b.ts').slice(0, -12), pkg('f67b830...HEAD', 'a.ts', 'b.ts', 'c.ts'))).toBeUndefined();
    expect(packageDrift(s, f, pkg('fd80243...HEAD', 'a.ts', 'b.ts').slice(0, -12), pkg('f67b830...HEAD', 'a.ts', 'x.ts', 'b.ts'))).toContain('x.ts');
    expect(packageDrift(s, f, 'File content (300KB) exceeds maximum allowed size (256KB)', 'wider')).toBeUndefined();
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

it('risk:regression a sample whose run read a file under root that differs from its base is refused before any snapshot', async () => {
  type Read = { path: string; start: number; total: number | null; whole: boolean; text: string };
  const { sampleDrift, snapshotSample } = (await import(new URL('../../../scripts/benchmark.mjs', import.meta.url).href)) as {
    sampleDrift: (repo: string, s: Sample, reads: Read[]) => string[];
    snapshotSample: (repo: string, s: Sample, run: unknown, bench: string) => { problems: string[]; kept: boolean };
  };
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')));
  const t = tmp.replaceAll('\\', '/');
  try {
    const repo = t + '/repo';
    mkdirSync(repo + '/accord/tickets/T-1', { recursive: true });
    const git = (...a: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...a], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    const plan = 'accord/tickets/T-1/plan.md';
    writeFileSync(repo + '/accord/tickets/T-1.md', '---\nid: "T-1"\n---\n\n## Intent\nx\n');
    writeFileSync(repo + '/' + plan, 'l1\nl2\nl3\n');
    git('init', '-q');
    git('add', '.');
    git('commit', '-q', '-m', 'init');
    const H = git('rev-parse', 'HEAD');
    writeFileSync(repo + '/' + plan, 'v2\n');
    git('commit', '-q', '-am', 'later');
    const V2 = git('rev-parse', 'HEAD');
    const sample: Sample = { agent: 'accord-critic', n: 1, transcript: 'X/S/subagents/agent-1.jsonl', ticket: 'T-1', base: H, main: H, root: repo, elsewhere: [], files: [], pairs: [] };
    const read = (text: string, o: Partial<Read> = {}): Read => ({ path: plan, start: 1, total: null, whole: true, text, ...o });

    const bad = sampleDrift(repo, sample, [read('v2')]);
    expect(bad).toHaveLength(1);
    expect(bad[0]).toContain(plan);
    expect(bad[0]).toContain('line 1');
    expect(sampleDrift(repo, sample, [read('l1\nl2\nl3')])).toEqual([]);
    // a partial read is compared by its line numbers and its totalLines
    expect(sampleDrift(repo, sample, [read('l2\nl3', { start: 2, whole: false, total: 3 })])).toEqual([]);
    expect(sampleDrift(repo, sample, [read('l2\nX', { start: 2, whole: false, total: 3 })])[0]).toContain('line 3');
    expect(sampleDrift(repo, sample, [read('l2', { start: 2, whole: false, total: 9 })])[0]).toContain('totalLines');

    // an overlay holds what the run read
    const over = (from: string) => ({ ...sample, overlay: [{ path: plan, from }] });
    expect(sampleDrift(repo, over('read'), [read('v2')])).toEqual([]);
    expect(sampleDrift(repo, over(V2), [read('v2')])).toEqual([]);
    expect(sampleDrift(repo, over('read'), [read('v2', { start: 2, whole: false })])[0]).toContain('partial');

    // the snapshot is refused and nothing is written
    const prompt = 'Work in ' + repo + '.';
    const run = { dispatch: { prompt, cwd: repo, ts: Date.now() }, sends: [], reads: [{ path: repo + '/' + plan, text: 'v2', ts: 1, start: 1, total: null, wrote: false, whole: true }] };
    const out = snapshotSample(repo, sample, run, t + '/bench');
    expect(out.problems.join('\n')).toContain(plan);
    expect(existsSync(t + '/bench')).toBe(false);
    // a read after a later coordinator message, or after the run wrote the file, is not drift
    const late = { ...run, sends: [{ ts: 0 }] };
    expect(snapshotSample(repo, sample, late, t + '/bench').problems).toEqual([]);
    expect(snapshotSample(repo, sample, { ...run, reads: [{ ...run.reads[0], wrote: true }] }, t + '/bench2').problems).toEqual([]);
    expect(JSON.parse(readFileSync(t + '/bench/samples/critic-1/root-reads.json', 'utf8'))).toEqual([]);
  } finally {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
}, 120_000);
