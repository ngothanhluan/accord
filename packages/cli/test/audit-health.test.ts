// Phase 8.1 G3b (D-08 group 2, D-18): `accord audit` runs under a pin mismatch and reports it as a gap, reads the pin apart from the schema,
// and changes nothing in the repository; every other repository-reading command still refuses (D-94).
import { afterEach, expect, it } from 'vitest';
import { CONFIG, pinned, RUNNING } from '../../../test/helpers/lane.js';
import { cleanup, commitAll, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) cleanup(dirs.pop() as string);
});

/** A version of the same shape as the running one with its minor or patch number raised, derived so no release number is written here. */
const raised = (part: 'minor' | 'patch'): string => {
  const [major, minor, patch] = RUNNING.split('.').map(Number);
  return part === 'minor' ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
};

/** A committed repository holding `files` beside a config.yml (`config`, default the lane fixture's) and a scaffolded conventions file. */
function committed(files: Record<string, string>, config = CONFIG): string {
  const repo = makeEmptyRepo();
  dirs.push(repo);
  writeFiles(repo, { 'accord/config.yml': config, 'accord/product/conventions.md': '# Conventions\n\n<!-- One rule per line. -->\n', ...files });
  commitAll(repo);
  return repo;
}

const audit = async (repo: string): Promise<{ lines: string[]; out: string; code: number }> => {
  const r = await run(['audit'], repo);
  return { lines: r.out.split('\n').filter((l) => l !== ''), out: r.out + r.err, code: r.code };
};
const status = (repo: string): string => gitRun(repo, 'status', '--porcelain');

it('risk:regression accord audit runs under a pin mismatch and reports it as a gap with its fix (8.1-ac-15)', async () => {
  const pin = raised('patch');
  const repo = committed({}, pinned(pin));
  const before = status(repo);
  const r = await audit(repo);
  expect(r.code, r.out).toBe(0);
  const line = r.lines.find((l) => l.startsWith('gap: pin-mismatch:')) ?? '';
  expect(line, r.out).toContain(pin);
  expect(line).toContain(RUNNING);
  expect(line).toMatch(/ - fix: \S/);
  expect(status(repo)).toBe(before);
});

it('risk:security every other repository-reading command still refuses a pin mismatch (D-18)', async () => {
  const pin = raised('patch');
  const repo = committed({}, pinned(pin));
  for (const argv of [['lint'], ['status'], ['commit', 'check', 'message.txt']]) {
    const r = await run(argv, repo);
    expect(r.code, argv.join(' ') + ': ' + r.out + r.err).toBe(2);
    expect(r.err, argv.join(' ')).toContain(`config.yml pins accord ${pin}`);
    expect(r.out).toBe('');
  }
  const version = await run(['--version'], repo);
  expect(version.code).toBe(0);
  expect(version.out.trim()).toBe(RUNNING);
  const help = await run(['--help'], repo);
  expect(help.code).toBe(0);
  expect(help.out).toContain('audit');
});

it('risk:parsing accord audit reports the pin when config.yml sets a key this CLI does not know (D-18)', async () => {
  const pin = raised('minor');
  const repo = committed({}, pinned(pin) + 'future_key: x\n');
  const before = status(repo);
  const r = await audit(repo);
  expect(r.code, r.out).toBe(0);
  const mismatch = r.lines.find((l) => l.startsWith('gap: pin-mismatch:')) ?? '';
  expect(mismatch, r.out).toContain(pin);
  expect(mismatch).toContain(RUNNING);
  const invalid = r.lines.find((l) => l.startsWith('gap: config-invalid:')) ?? '';
  expect(invalid, r.out).toContain('accord lint');
  expect(r.lines.find((l) => l.startsWith('fact: commit-rule:')), r.out).toContain('not checked');
  expect(status(repo)).toBe(before);

  // a pin that is not a string gives no pin-mismatch line and no crash
  const odd = await audit(committed({}, CONFIG.replace(/accord: "[^"]*"/, 'accord: 5')));
  expect(odd.code, odd.out).toBe(0);
  expect(odd.lines.some((l) => l.startsWith('gap: pin-mismatch:')), odd.out).toBe(false);
  expect(odd.lines.some((l) => l.startsWith('gap: config-invalid:')), odd.out).toBe(true);
});
