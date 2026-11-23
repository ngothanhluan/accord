// Phase 8.1 G3b (D-08 group 6, D-19, 8.1-ac-16): `accord audit` runs the team's `audit.command` only after `accord trust`, and shows its first output line as a `team-audit` gap
// when it exits non-zero. The marker a script writes lives in a folder of its own, outside the repository. Real files in tmp sandboxes.
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { CONFIG } from '../../../test/helpers/lane.js';
import { cleanup, commitAll, makeEmptyRepo, run, trustAllow, writeFiles } from './helpers/repo.js';

// A test seam: the audit's 300 s timeout is capped for the one test that waits for it; the script itself still runs through the real runner.
const cap = vi.hoisted(() => ({ ms: Number.POSITIVE_INFINITY }));
vi.mock('../src/load/team-run.js', async (orig) => {
  const real = await orig<typeof import('../src/load/team-run.js')>();
  return { ...real, runTeamCommand: (command: string, o: Parameters<typeof real.runTeamCommand>[1]) => real.runTeamCommand(command, { ...o, timeoutMs: Math.min(o.timeoutMs, cap.ms) }) };
});

const SCRIPT_CONFIG = CONFIG + 'audit:\n  command: node scripts/audit.mjs\n';

const dirs: string[] = [];
afterEach(() => {
  cap.ms = Number.POSITIVE_INFINITY;
  while (dirs.length > 0) cleanup(dirs.pop() as string);
});

const posix = (p: string): string => p.replaceAll('\\', '/');

/** A repository whose committed script is scripts/audit.mjs, and a folder outside it holding the marker the script writes when it runs. */
function sandbox(body: string): { repo: string; marker: string } {
  const folder = mkdtempSync(join(tmpdir(), 'accord-audit-script-'));
  dirs.push(folder);
  const marker = posix(join(folder, 'marker.txt'));
  const repo = makeEmptyRepo();
  dirs.push(repo);
  writeFiles(repo, {
    'accord/config.yml': SCRIPT_CONFIG,
    'accord/product/conventions.md': '# Conventions\n\n<!-- One rule per line. -->\n',
    'scripts/audit.mjs': `import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(marker)}, process.env.ACCORD_ROOT + ' ' + (process.env.ACCORD_BASE_REF ?? ''));\n${body}\n`,
  });
  commitAll(repo);
  return { repo, marker };
}

const audit = async (repo: string): Promise<{ lines: string[]; out: string; code: number }> => {
  const r = await run(['audit'], repo);
  return { lines: r.out.split('\n').filter((l) => l !== ''), out: r.out + r.err, code: r.code };
};
const FAILING = "process.stdout.write('\\nlicense GPL-3.0 found in left-pad\\nsecond line\\n'); process.exit(1);";

it('risk:security a trusted team audit script failure line is a gap and an untrusted one never runs (8.1-ac-16)', async () => {
  const failing = sandbox(FAILING);
  expect((await trustAllow(failing.repo, ['audit.command'])).code).toBe(0);
  const r = await audit(failing.repo);
  expect(r.code, r.out).toBe(0);
  expect(existsSync(failing.marker)).toBe(true);
  expect(r.lines.find((l) => l.startsWith('gap: team-audit:')), r.out).toBe('gap: team-audit: license GPL-3.0 found in left-pad - fix: read the output of audit.command');
  expect(r.lines.some((l) => l.includes('second line'))).toBe(false);

  const passing = sandbox('process.exit(0);');
  expect((await trustAllow(passing.repo, ['audit.command'])).code).toBe(0);
  const ok = await audit(passing.repo);
  expect(ok.lines, ok.out).toContain('fact: team-audit: passed');
  expect(ok.lines.some((l) => l.startsWith('gap: team-audit:'))).toBe(false);

  // untrusted: the script never runs, and the report names accord trust
  const untrusted = sandbox(FAILING);
  const u = await audit(untrusted.repo);
  expect(u.code, u.out).toBe(0);
  expect(existsSync(untrusted.marker)).toBe(false);
  const line = u.lines.find((l) => l.startsWith('gap: script-untrusted: audit.command')) ?? '';
  expect(line, u.out).toContain('accord trust');
  expect(u.lines.some((l) => l.startsWith('gap: team-audit:') || l === 'fact: team-audit: passed')).toBe(false);
});

it('risk:resource a team audit script that outlives its timeout is a team-audit gap that says so (D-19)', async () => {
  const slow = sandbox('setTimeout(() => {}, 30000);');
  expect((await trustAllow(slow.repo, ['audit.command'])).code).toBe(0);
  cap.ms = 3000;
  const r = await audit(slow.repo);
  expect(r.code, r.out).toBe(0);
  expect(r.lines.find((l) => l.startsWith('gap: team-audit:')), r.out).toContain('did not finish');
});

it('risk:security a config that fails the schema runs no team audit script (D-19)', async () => {
  const { repo, marker } = sandbox(FAILING);
  writeFiles(repo, { 'accord/config.yml': SCRIPT_CONFIG + 'future_key: x\n' });
  commitAll(repo);
  const r = await audit(repo);
  expect(r.code, r.out).toBe(0);
  expect(existsSync(marker)).toBe(false);
  expect(r.lines).toContain("fact: team-audit: not checked (config.yml does not pass this CLI's schema)");
});

// Phase 08.8 D-16 (IN-05): the team audit line is cut to its length before it is escaped, so an escape sequence is never cut in half.
it('risk:parsing the team audit line is cut before it is escaped (D-16)', async () => {
  const { repo } = sandbox("process.stdout.write('a'.repeat(199) + String.fromCharCode(27) + 'more text\\n'); process.exit(1);");
  expect((await trustAllow(repo, ['audit.command'])).code).toBe(0);
  const r = await audit(repo);
  expect(r.code, r.out).toBe(0);
  const gap = (r.lines.find((l) => l.startsWith('gap: team-audit:')) ?? '').split(' - fix:')[0];
  // 199 characters and the whole escape: `<U+001B>` is one character of the cut line, never a stub such as `<U+00`
  expect(gap, r.out).toBe('gap: team-audit: ' + 'a'.repeat(199) + '<U+001B>');
});
