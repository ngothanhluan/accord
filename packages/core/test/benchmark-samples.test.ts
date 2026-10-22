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
    expect(packageDrift(s, f, 'same\n', 'same')).toBeUndefined();
    expect(packageDrift(s, f, 'same\n', 'wider')).toContain('accord-reviewer 3');
    expect(packageDrift(s, f, 'File content (300KB) exceeds maximum allowed size (256KB)', 'wider')).toBeUndefined();
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

it('risk:regression every file base of the committed sample list lies in its sample history', async () => {
  const { checkFileBases } = (await import(new URL('../../../scripts/benchmark.mjs', import.meta.url).href)) as {
    checkFileBases: (repo: string, list: unknown) => string[];
  };
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const list = JSON.parse(readFileSync(join(root, 'scripts', 'benchmark-samples.json'), 'utf8'));
  expect(checkFileBases(root, list)).toEqual([]);
});
