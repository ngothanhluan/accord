// Phase 15 plan 18 (D-07, D-08, D-10, D-28, SC-2): a sliced ticket's session builds, reviews, verifies and puts up its slices one by one, stacked, with one integration review at the last.
// Asserted over the RENDERED text of every tool a runtime loads (skillTargets), not the source files.
import { expect, it } from 'vitest';
import { skillDirs, skillTargets } from '../src/index.js';
import type { AccordConfig } from '../src/index.js';
import { besidePath, stagePath } from './helpers/stage-files.js';

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

interface Rendered {
  label: string;
  text: string;
  raw: string;
  paths: ReadonlySet<string>;
  dir: string;
}

/** Every rendered `file` beside the accord stages (`<dir>/accord/<file>`), one per skill directory a runtime loads. */
function rendered(file: string): Rendered[] {
  return RUNTIMES.flatMap((runtime) => {
    const targets = skillTargets(config(runtime));
    const paths = new Set(targets.map((t) => t.path));
    return skillDirs(config(runtime)).map((dir) => {
      const path = besidePath('verify', file, dir);
      const raw = targets.find((t) => t.path === path)?.text ?? '';
      return { label: `${runtime}: ${path}`, text: flat(raw), raw, paths, dir };
    });
  });
}

/** The text of `text` from the first occurrence of `from` to the next occurrence of `to` (or the end). */
function between(text: string, from: string, to: string): string {
  const start = text.indexOf(from);
  if (start < 0) return '';
  const end = text.indexOf(to, start + from.length);
  return end < 0 ? text.slice(start) : text.slice(start, end);
}

it('risk:regression build step 8 hands a sliced ticket to slices.md, which renders beside it and every relative link resolves (D-07)', () => {
  const bad: string[] = [];
  for (const f of rendered('build.md')) {
    if (f.text === '') {
      bad.push(f.label + ' is missing');
      continue;
    }
    const step8 = f.text.slice(f.text.indexOf('8. When every task has a ledger line'), f.text.indexOf('## Rules'));
    if (!step8.includes('./slices.md')) bad.push(f.label + ' step 8 names no ./slices.md');
    if (f.text.split('./slices.md').length !== 2) bad.push(f.label + ' names ./slices.md other than once');
    if (!step8.includes('`## Slice`')) bad.push(f.label + ' step 8 does not say the pointer is for a plan with `## Slice` sections');
  }
  for (const f of rendered('slices.md')) {
    if (f.text === '') {
      bad.push(f.label + ' is missing');
      continue;
    }
    for (const link of new Set([...f.text.matchAll(/`\.\/([a-z-]+\.md)`/g)].map((m) => m[1]))) {
      if (!f.paths.has(besidePath('verify', link, f.dir))) bad.push(f.label + ' links ./' + link + ' which is not rendered beside it');
    }
  }
  expect(bad).toEqual([]);
});

it('risk:regression slices.md runs build, review, verify, push, pull request and the next slice in that order, with no wait for a merge (D-07)', () => {
  const bad: string[] = [];
  for (const f of rendered('slices.md')) {
    const order = [
      'the tasks of the slice this checkout is on',
      '`./review.md`',
      '`accord gate done <id> --slice <n>`',
      'without `--slice`',
      '`accord worktree push <id> --branch`',
      '`accord pr <id> --slice <n>`',
      '`gh pr create --draft --base <base>`',
      '`accord worktree slice <id> <n+1>`',
      '`./build.md`',
      'Do not wait for the merge',
      '`./finish.md`',
      '`./pr-wait.md`',
    ];
    let at = -1;
    for (const p of order) {
      const i = f.text.indexOf(p, at + 1);
      if (i < 0) bad.push(f.label + ' lacks or misorders: ' + p);
      else at = i;
    }
    for (const p of lacks(f.text, ['the default branch for slice 1', 'the claim branch for slice 2', '`slice/<id>/<n-1>`'])) bad.push(f.label + ' lacks: ' + p);
  }
  expect(bad).toEqual([]);
});

it('risk:regression each slice is reviewed on its own diff and the last slice reads the whole ticket once from the plan baseline (D-10)', () => {
  const bad: string[] = [];
  for (const f of rendered('slices.md')) {
    for (const p of lacks(f.text, [
      'the sha the `Slice:` line of `accord anchor` prints after `from`',
      "in place of the plan's `baseline:`",
      "At the last slice it reads from the plan's `baseline:`",
      'the one integration review',
      'A slice before the last ticks only the criteria its `covers:` line names',
    ])) {
      bad.push(f.label + ' lacks: ' + p);
    }
  }
  expect(bad).toEqual([]);
});

it('risk:regression review.md is untouched by the slice flow and stays within its byte cap (R15)', () => {
  const bad: string[] = [];
  for (const f of rendered('review.md')) {
    if (f.text.includes('slices.md')) bad.push(f.label + ' names slices.md');
    if (Buffer.byteLength(f.raw, 'utf8') > 6000) bad.push(f.label + ' is over 6000 bytes');
  }
  expect(bad).toEqual([]);
});

it('risk:regression verify step 6 names the slice form through slices.md and the verify stage keeps its byte cap (D-07)', () => {
  const bad: string[] = [];
  for (const f of rendered('verify.md')) {
    const step6 = between(f.text, '6. Run `accord gate done <id>`', '7. Report the finish');
    if (!step6.includes('`--slice <n>`') || !step6.includes('./slices.md')) bad.push(f.label + ' step 6 names no `--slice <n>` through ./slices.md');
    if (Buffer.byteLength(f.raw, 'utf8') > 5980) bad.push(f.label + ' is over 5980 bytes');
  }
  const stage = rendered('verify.md').length;
  expect(stage).toBeGreaterThan(0);
  expect(bad).toEqual([]);
});

it('risk:regression the CI step opens a slice pull request with accord pr --slice and a base, and runs the gate on the slice (D-07, D-31)', () => {
  const bad: string[] = [];
  for (const f of rendered('verify-ci.md')) {
    const step4 = between(f.text, '4. When that list was empty', 'Then run the suite');
    for (const p of lacks(step4, ['`accord pr <id> --slice <n>`', '`--base <the previous slice\'s branch>`', 'no `--base` for slice 1', './slices.md'])) bad.push(f.label + ' step 4 lacks: ' + p);
    const finish2 = between(f.text, '2. Run `accord lint`', '3. Run `git status --porcelain --branch`');
    if (!finish2.includes('`accord gate done <id> --slice <n>`')) bad.push(f.label + ' Finish step 2 lacks `accord gate done <id> --slice <n>` for a slice before the last');
  }
  expect(bad).toEqual([]);
});

it('risk:regression a change to an earlier slice is committed there and merged forward in order with accord worktree sync, never rebased or force-pushed (D-08)', () => {
  const bad: string[] = [];
  for (const f of rendered('slices.md')) {
    for (const p of lacks(f.text, [
      "is committed on that slice's branch",
      'each later slice branch, in order',
      '`accord worktree sync <id>`',
      '`accord worktree push <id> --branch`',
      'Slices merge in order, and `accord pr wait` moves the next slice\'s base',
    ])) {
      bad.push(f.label + ' lacks: ' + p);
    }
    if (/git rebase/.test(f.raw)) bad.push(f.label + ' holds a git rebase command');
    if (/--force/.test(f.raw)) bad.push(f.label + ' holds a --force flag');
    if (/force-with-lease|push -f\b/.test(f.raw)) bad.push(f.label + ' holds a forced push');
  }
  expect(bad).toEqual([]);
});

it('risk:regression the wait follows the lowest open slice pull request and a missing next slice mid-wait is not read as a wait that never started (D-28)', () => {
  const bad: string[] = [];
  for (const f of rendered('pr-wait.md')) {
    for (const p of lacks(f.text, [
      'the lowest slice pull request still open',
      'ends `merged` only when the last slice has merged',
      '`slice/<id>/<n>`',
      'open it with `accord pr <id> --slice <n>` as `./slices.md` says, then start the wait again as in Start',
      'the wait never started, so nothing watches the pull request',
    ])) {
      bad.push(f.label + ' lacks: ' + p);
    }
  }
  expect(bad).toEqual([]);
});

it('risk:regression the accord skill routes the build row to slices.md and every tool renders it beside the stage files (D-07)', () => {
  const bad: string[] = [];
  for (const runtime of RUNTIMES) {
    const targets = skillTargets(config(runtime));
    for (const dir of skillDirs(config(runtime))) {
      const skill = flat(targets.find((t) => t.path === `${dir}/accord/SKILL.md`)?.text ?? '');
      if (skill === '') {
        bad.push(`${runtime}: ${dir}/accord/SKILL.md is missing`);
        continue;
      }
      const row = skill.slice(skill.indexOf('- lane M, row `build`:'), skill.indexOf('- lane M, row `review`:'));
      if (!row.includes('`./slices.md` at its step 8')) bad.push(`${runtime}: ${dir} SKILL.md build row names no ./slices.md at its step 8`);
      if (targets.find((t) => t.path === besidePath('verify', 'slices.md', dir)) === undefined) bad.push(`${runtime}: ${dir} renders no slices.md`);
    }
  }
  expect(stagePath('build')).toContain('accord/build.md');
  expect(bad).toEqual([]);
});
