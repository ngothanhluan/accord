// Phase 08.9.2 D-04, D-07: a full-mode session start tells the person, once, how to switch accord off for themselves in this clone. The line follows the session body, comes
// before the clean's report, never shows on a resume, and an off clone prints nothing at all.
import { readFileSync } from 'node:fs';
import { afterEach, expect, it } from 'vitest';
import { OFF_LINE } from '../src/commands/off.js';
import { cleanup, commitAll, gitRun, makeLaneRepo, run } from './helpers/repo.js';

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) cleanup(dirs.pop() as string);
});

function repoOnDefaultBranch(): string {
  const repo = makeLaneRepo();
  dirs.push(repo);
  commitAll(repo);
  return repo;
}

const startInput = (cwd: string): string => JSON.stringify({ cwd, session_id: 's-1', source: 'startup' });
const SESSION_LINE = /accord: \d+ in progress, \d+ ready to pick up · type \/accord\n/;

/** How many times `needle` occurs in `text`. */
const occurrences = (text: string, needle: string): number => text.split(needle).length - 1;

// Phase 08.9.2 D-04, D-07: the off line comes once, after the session body and before the clean's report; the ruleset is still the first line.
it('risk:regression full-mode session start prints the off line once after the session line (D-04 D-07)', async () => {
  const repo = repoOnDefaultBranch();
  const onDefault = await run(['hook', 'session-start'], repo, {}, startInput(repo));
  expect(onDefault.code).toBe(0);
  expect(onDefault.out.startsWith('# accord rules\n')).toBe(true);
  expect(occurrences(onDefault.out, OFF_LINE)).toBe(1);
  const sessionAt = onDefault.out.search(SESSION_LINE);
  expect(sessionAt).toBeGreaterThan(0);
  expect(onDefault.out.indexOf(OFF_LINE)).toBeGreaterThan(sessionAt);
  const reportAt = onDefault.out.indexOf('tell the owner the lines above');
  if (reportAt >= 0) expect(onDefault.out.indexOf(OFF_LINE)).toBeLessThan(reportAt);

  gitRun(repo, 'checkout', '-q', '-b', 't/T-1');
  const onTicket = await run(['hook', 'session-start'], repo, {}, startInput(repo));
  expect(onTicket.code).toBe(0);
  expect(onTicket.out.startsWith('# accord rules\n')).toBe(true);
  expect(occurrences(onTicket.out, OFF_LINE)).toBe(1);
  expect(onTicket.out.indexOf(OFF_LINE)).toBeGreaterThan(onTicket.out.search(SESSION_LINE));
});

// Phase 08.9.2 D-04: a resume repeats nothing, and a clone that is off prints nothing.
it('risk:regression session resume and an off clone print no off line (D-04)', async () => {
  const repo = repoOnDefaultBranch();
  const resumed = await run(['hook', 'session-resume'], repo, {}, JSON.stringify({ cwd: repo, session_id: 's-1', source: 'compact' }));
  expect(resumed.code).toBe(0);
  expect(resumed.out.startsWith('# accord rules\n')).toBe(true);
  expect(resumed.out).not.toContain(OFF_LINE);

  // control: with accord on, the same clone's session start does carry the line, so its absence below means something
  expect((await run(['hook', 'session-start'], repo, {}, startInput(repo))).out).toContain(OFF_LINE);

  expect((await run(['off'], repo)).code).toBe(0);
  const off = await run(['hook', 'session-start'], repo, {}, startInput(repo));
  expect(off.code).toBe(0);
  expect(off.out).toBe('');
});

// Phase 08.9.2 Ruling-off-accord: `accord worktree check` is the first command /accord runs; when the person switched accord off it names the switch with its next action, and its exit code stays.
it('risk:regression worktree check names the off switch with its next action and keeps its exit code (Ruling-off-accord)', async () => {
  const repo = repoOnDefaultBranch();
  const on = await run(['worktree', 'check'], repo);
  expect(on.code).toBe(0);
  expect(on.out).toBe('');

  expect((await run(['off'], repo)).code).toBe(0);
  const off = await run(['worktree', 'check'], repo);
  expect(off.code).toBe(0);
  expect(off.err).toBe('');
  const lines = off.out.split('\n').filter((l) => l !== '');
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatch(/^accord is switched off for you in this clone - next: /);
  expect(lines[0]).toContain('node .claude/accord.mjs on');
  expect(lines[0]).toContain('yes');
});

// Phase 08.9.2 D-04: the readme tells anyone how to work in an accord repository without accord, in both copies.
it('risk:regression the readme explains how to work in an accord repository without accord (D-04)', () => {
  const heading = '### 10. Not using accord in this repository';
  const root = readFileSync(new URL('../../../README.md', import.meta.url), 'utf8');
  const cli = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  expect(cli).toContain(heading);
  expect(root).toContain(heading);
  const start = root.indexOf(heading);
  const end = root.indexOf('\n## ', start);
  const section = root.slice(start, end < 0 ? undefined : end);
  expect(section).toContain('node .claude/accord.mjs off');
  expect(section).toContain('node .claude/accord.mjs on');
  expect(section).toContain('accord-off');
  // Phase 08.9.2 G-08.9.2-10: off writes only the marker, so the section says the pane command still works while accord is off
  expect(section).toContain('/accord-panel');
});
