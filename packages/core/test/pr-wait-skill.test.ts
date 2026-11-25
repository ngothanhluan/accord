// Phase 15 plan 07 (D-19, D-20, D-21, D-22, D-32): the finish report hands over to `./pr-wait.md`, which says what the session does on each last line of `accord pr wait`,
// asserted over the RENDERED text of every tool a runtime loads (skillTargets), not the source files.
import { expect, it } from 'vitest';
import { skillDirs, skillTargets } from '../src/index.js';
import type { AccordConfig } from '../src/index.js';
import { besidePath } from './helpers/stage-files.js';

const RUNTIMES: AccordConfig['runtimes'] = ['claude', 'codex', 'cursor', 'copilot'];
const config = (runtime: AccordConfig['runtimes'][number]): AccordConfig => ({
  accord: '0.1.0',
  profile: 'build',
  tracker: { adapter: 'none' },
  design: { tokens: '' },
  roles: ['ba', 'dev'],
  runtimes: [runtime],
});

const flat = (text: string): string => text.replace(/\s+/g, ' ');
const lacks = (text: string, parts: readonly string[]): string[] => parts.filter((p) => !text.includes(p));

/** Every rendered `file` beside the accord stages, one per skill directory a runtime loads, with the set of paths that runtime renders. */
function rendered(file: string): Array<{ label: string; text: string; paths: ReadonlySet<string>; dir: string }> {
  return RUNTIMES.flatMap((runtime) => {
    const targets = skillTargets(config(runtime));
    const paths = new Set(targets.map((t) => t.path));
    return skillDirs(config(runtime)).map((dir) => {
      const path = besidePath('verify', file, dir);
      const found = targets.find((t) => t.path === path);
      return { label: `${runtime}: ${path}`, text: flat(found?.text ?? ''), paths, dir };
    });
  });
}

it('risk:regression the finish report hands over to pr-wait.md and never says to end the turn without it (D-19)', () => {
  const bad: string[] = [];
  for (const f of rendered('finish.md')) {
    if (f.text === '') bad.push(f.label + ' is missing');
    if (f.text.includes('Never wait for the merge')) bad.push(f.label + ' still says Never wait for the merge');
    for (const p of lacks(f.text, ['follow `./pr-wait.md` in place of ending the turn', "Never remove the ticket's worktree or branches by hand"])) bad.push(f.label + ' lacks: ' + p);
  }
  expect(bad).toEqual([]);
});

it('risk:regression pr-wait.md renders beside every stage that loads finish.md and every relative link resolves (D-19)', () => {
  const bad: string[] = [];
  for (const f of rendered('pr-wait.md')) {
    if (f.text === '') {
      bad.push(f.label + ' is missing');
      continue;
    }
    for (const link of new Set([...f.text.matchAll(/`\.\/([a-z-]+\.md)`/g)].map((m) => m[1]))) {
      if (!f.paths.has(besidePath('verify', link, f.dir))) bad.push(f.label + ' links ./' + link + ' which is not rendered beside it');
    }
    for (const p of lacks(f.text, [
      'Run `accord pr wait <id>` with the Bash tool in the background',
      'with `timeout` set to the limit plus one minute, in milliseconds, and at most 7200000 (120 minutes)',
      'Run one wait at a time',
      '`accord config get pr.wait_minutes`',
    ])) {
      bad.push(f.label + ' lacks: ' + p);
    }
  }
  expect(bad).toEqual([]);
});

it('risk:regression a merge leaves the worktree with ExitWorktree keep, then cleans from the main checkout, and no line removes a folder by hand (D-20)', () => {
  const bad: string[] = [];
  for (const f of rendered('pr-wait.md')) {
    for (const p of lacks(f.text, [
      '`pr-wait: merged #<n>`',
      'leave this worktree with `ExitWorktree`, action `keep`',
      'from the main checkout, run `accord worktree clean --after-merge <id>`',
      'refuses (exit 2) while this session still stands in that worktree',
      'When `ExitWorktree` is missing or refuses, print one line, `<id> merged: its folder and branch go at the next session start in another folder`, and end the turn',
      'Never remove the folder by hand',
    ])) {
      bad.push(f.label + ' lacks: ' + p);
    }
    if (f.text.includes('git worktree remove')) bad.push(f.label + ' names git worktree remove');
  }
  expect(bad).toEqual([]);
});

it('risk:regression feedback starts the resolve step with replies held for the owner and a failed check follows failure.md (D-20, D-32)', () => {
  const bad: string[] = [];
  for (const f of rendered('pr-wait.md')) {
    for (const p of lacks(f.text, [
      '`pr-wait: feedback #<n>: ...`',
      'load `/accord-resolve-pr` for pull request <n>',
      "Its replies wait for the owner's yes (`review.post` is `draft`)",
      '`pr-wait: ci-failed #<n>: <names>`',
      'follow `./failure.md` from its step 1',
      '`pr-wait: closed #<n>`',
      '`<id>: PR #<n> was closed without a merge`',
    ])) {
      bad.push(f.label + ' lacks: ' + p);
    }
  }
  expect(bad).toEqual([]);
});

it('risk:regression the wait never restarts in a tight loop after feedback that produced no new commit (D-22)', () => {
  const bad: string[] = [];
  for (const f of rendered('pr-wait.md')) {
    for (const p of lacks(f.text, [
      'Note `git rev-parse HEAD`',
      'When it ends with a new commit pushed, start the next wait as in Start',
      'When it ends with no new commit',
      'stop and tell the owner in one line what waits for them',
      'Start no more than three waits in one session after a feedback line',
    ])) {
      bad.push(f.label + ' lacks: ' + p);
    }
  }
  expect(bad).toEqual([]);
});

it('risk:regression the limit, a run the harness stopped and a wait that never started each end the turn with one line and no new wait (D-22)', () => {
  const bad: string[] = [];
  for (const f of rendered('pr-wait.md')) {
    for (const p of lacks(f.text, [
      'A run whose last line is none of the lines below, or that printed nothing, was stopped by the harness: read it as `limit`',
      '`pr-wait: limit #<n> after <m> minutes (<f> polls failed)`',
      'type /accord continue <id> to pick it up again',
      'Start no new wait',
      'When `<f>` is 3 or more',
      '`gh auth status` and `gh --version`',
      '`pr-wait: unavailable: ...`',
      '`pr-wait: no pull request for <branch>`',
      'the wait never started, so nothing watches the pull request',
      'the merge is made up at the next session start, and end the turn',
    ])) {
      bad.push(f.label + ' lacks: ' + p);
    }
  }
  expect(bad).toEqual([]);
});

it('risk:regression nothing in the wait writes the merge into a ticket and no inbox or server is named (D-21, D-30, D-16)', () => {
  const bad: string[] = [];
  for (const f of rendered('pr-wait.md')) {
    for (const p of lacks(f.text, ['Nothing here edits the ticket to record a merge'])) bad.push(f.label + ' lacks: ' + p);
    for (const word of ['accord inbox', 'daemon', 'server']) if (f.text.includes(word)) bad.push(f.label + ' names ' + word);
  }
  expect(bad).toEqual([]);
});
