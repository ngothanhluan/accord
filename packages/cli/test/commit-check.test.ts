// Phase 8.1 G1 (D-04, D-05): `accord commit check <file>` judges a message file against commits.message with the one core function the gates use.
// Real files in tmp sandboxes; nothing here reaches the real origin.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { CONFIG } from '../../../test/helpers/lane.js';
import { cleanup, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) cleanup(dirs.pop() as string);
});

function sandbox(config: string): string {
  const repo = makeEmptyRepo();
  dirs.push(repo);
  writeFiles(repo, { 'accord/config.yml': config });
  return repo;
}

/** A message file outside the repository, as an agent writes one before `git commit -F`. */
function message(text: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'accord-msg-'));
  dirs.push(dir);
  const file = join(dir, 'msg.txt');
  writeFileSync(file, text);
  return file;
}

const PRESET = CONFIG + 'commits:\n  message:\n    preset: conventional\n';

it('risk:complex-branching accord commit check exits 0 on a conventional message and 1 naming the rule on another (8.1-ac-4)', async () => {
  const repo = sandbox(PRESET);
  const ok = await run(['commit', 'check', message('feat(cart): add coupon field\n\nbody\n')], repo);
  expect([ok.code, ok.out + ok.err]).toEqual([0, expect.any(String)]);

  const bad = await run(['commit', 'check', message('added coupon\n')], repo);
  expect(bad.code, bad.out + bad.err).toBe(1);
  expect(bad.out + bad.err).toContain('commits.message.preset conventional');
  expect(bad.out + bad.err).toContain('feat(cart): add coupon field');

  const missing = await run(['commit', 'check', join(repo, 'nope.txt')], repo);
  expect(missing.code, missing.out + missing.err).toBe(2);

  const none = sandbox(CONFIG);
  const free = await run(['commit', 'check', message('added coupon\n')], none);
  expect(free.code, free.out + free.err).toBe(0);
  expect(free.out).toContain('commits.message is not set; every message passes');
});

it('risk:parsing accord commit check names accord lint when the configured pattern is not in force (D-04)', async () => {
  const repo = sandbox(CONFIG + "commits:\n  message:\n    pattern: '(a+)+$'\n    example: aaa\n");
  const r = await run(['commit', 'check', message('aaa\n')], repo);
  expect(r.code, r.out + r.err).toBe(2);
  expect(r.err).toContain('accord lint');
});

it('risk:security accord commit check fails an 80000-character first line at once under a quadratic team pattern (CR-01)', async () => {
  const repo = sandbox(CONFIG + 'commits:\n  message:\n    pattern: ' + JSON.stringify(String.raw`\(.*\): .+`) + "\n    example: '(x): y'\n");
  const started = Date.now();
  const r = await run(['commit', 'check', message('('.repeat(80000) + '\n')], repo);
  expect(Date.now() - started).toBeLessThan(5000);
  expect(r.code, r.out + r.err).toBe(1);
  expect(r.out + r.err).toContain('shorten the first line');
});
