// Phase 08.9.3 plan 13 (D-01 to D-10, D-12 to D-14): a session walks a ticket across repositories with the commands the phase built.
// Asserted over the RENDERED text of every tool a runtime loads (skillTargets), not the source files.
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

it('risk:regression repos.md renders beside the stages in every tool, with its seven sections and the commands of the other repository (D-01, D-02, D-04, D-05, D-08, D-10)', () => {
  const bad: string[] = [];
  const found = rendered('repos.md');
  expect(found.length).toBeGreaterThan(0);
  for (const f of found) {
    if (f.text === '') {
      bad.push(f.label + ' is missing');
      continue;
    }
    for (const p of lacks(f.text, [
      '## The other clone',
      '## Plan',
      '## Build',
      '## Review',
      '## Verify',
      '## Pull requests',
      '## Clean',
      '`accord repos status`',
      '`accord repos set <name> <path>`',
      '`accord repos baseline <name> --id <id>`',
      '`accord worktree slice <id> <n>`',
      '`accord worktree push <id> --repo <name>`',
      '`accord pr <id> --slice <n>`',
      '`gh pr create --repo <repository> --head <head> --base <base> --draft`',
      '`accord pr ready <id> --slice <n>`',
      '`accord pr wait <id>`',
      '`released`',
      '`accord worktree clean`',
    ])) {
      bad.push(f.label + ' lacks: ' + p);
    }
    for (const link of new Set([...f.text.matchAll(/`\.\/([a-z-]+\.md)`/g)].map((m) => m[1]))) {
      if (!f.paths.has(besidePath('verify', link, f.dir))) bad.push(f.label + ' links ./' + link + ' which is not rendered beside it');
    }
    if (Buffer.byteLength(f.raw, 'utf8') > 6000) bad.push(f.label + ' is over 6000 bytes');
  }
  expect(bad).toEqual([]);
});

it('risk:security repos.md holds no git in another folder, no clone and no touch of the other repository\'s accord folder or the person\'s checkout (D-03, D-04, T-08.9.3-34)', () => {
  const bad: string[] = [];
  for (const f of rendered('repos.md')) {
    if (/git\s+-C/.test(f.raw)) bad.push(f.label + ' holds git -C');
    if (/\b(?:run|runs|running|execute)\s+`?git clone/i.test(f.text)) bad.push(f.label + ' tells a reader to run git clone');
    if (/\bcd\s+["'<]/.test(f.raw)) bad.push(f.label + ' tells a reader to cd into another folder');
    for (const p of lacks(f.text, [
      'show the owner the `git clone` line',
      'asks once for a path',
      'Never clone it',
      "never reads or writes the other repository's `accord/` folder",
      "never touches the person's own checkout",
    ])) {
      bad.push(f.label + ' lacks: ' + p);
    }
  }
  expect(bad).toEqual([]);
});

it('risk:regression the clone is found with accord repos status and a missing one is shown as the git clone line, then repos set; a tool with /add-dir adds the directory once (D-01, D-02, research question 4)', () => {
  const bad: string[] = [];
  for (const f of rendered('repos.md')) {
    const clone = between(f.text, '## The other clone', '## Plan');
    for (const p of lacks(clone, [
      '`accord repos status`',
      'not-found line',
      'show the owner the `git clone` line',
      'ends in `accord repos set <name> <path>`',
      '`/add-dir <path>`',
      'Where the tool can add a directory to the session',
    ])) {
      bad.push(f.label + ' The other clone lacks: ' + p);
    }
  }
  expect(bad).toEqual([]);
});

it('risk:regression the plan section takes the baseline and listing from accord repos baseline, one repository per slice, this repository last (D-05, D-09, D-14)', () => {
  const bad: string[] = [];
  for (const f of rendered('repos.md')) {
    const plan = between(f.text, '## Plan', '## Build');
    for (const p of lacks(plan, [
      '`accord repos baseline <name> --id <id>`',
      'baseline_<name>',
      'the listing',
      '`<name>:<path>`',
      '`repo: <name>`',
      'one repository',
      'deploy order',
      "this repository's slice last",
    ])) {
      bad.push(f.label + ' Plan lacks: ' + p);
    }
  }
  expect(bad).toEqual([]);
});

it('risk:regression the build section opens a slice of another repository in its worktree, which the brief names as Work dir, and the CLI pushes it (D-04, D-10)', () => {
  const bad: string[] = [];
  for (const f of rendered('repos.md')) {
    const build = between(f.text, '## Build', '## Review');
    for (const p of lacks(build, [
      'in repository <name>',
      '`accord worktree slice <id> <n>`',
      '`worktree:`',
      '`Work dir`',
      '`accord worktree push <id> --repo <name>`',
      'runs no git in another folder',
    ])) {
      bad.push(f.label + ' Build lacks: ' + p);
    }
  }
  expect(bad).toEqual([]);
});

it('risk:regression the verify section runs the suite from suite: and suite-dir:, counts a failing run as fail for that repository\'s criteria, hands over the record lines and waits for released (D-06, D-07, D-12, D-13)', () => {
  const bad: string[] = [];
  for (const f of rendered('repos.md')) {
    const verify = between(f.text, '## Verify', '## Pull requests');
    for (const p of lacks(verify, [
      '`accord repos status <id>`',
      '`suite:`',
      '`suite-dir:`',
      '`fail` for every criterion',
      '`record:`',
      'verbatim',
      '`## Repository <name>`',
      '`Suite:`',
      '`accord pr wait <id>`',
      '`released`',
      'earlier slice already merged',
    ])) {
      bad.push(f.label + ' Verify lacks: ' + p);
    }
  }
  expect(bad).toEqual([]);
});

it('risk:regression pull requests of another repository are opened with gh pr create --repo and marked ready only with accord pr ready, and clean removes the worktree after the merge (D-08, D-10)', () => {
  const bad: string[] = [];
  for (const f of rendered('repos.md')) {
    const prs = between(f.text, '## Pull requests', '## Clean');
    for (const p of lacks(prs, [
      '`accord pr <id> --slice <n>`',
      '`gh pr create --repo <repository> --head <head> --base <base> --draft`',
      '`accord pr ready <id> --slice <n>`',
      'never `gh pr ready`',
    ])) {
      bad.push(f.label + ' Pull requests lacks: ' + p);
    }
    const clean = f.text.slice(f.text.indexOf('## Clean'));
    for (const p of lacks(clean, ['`accord worktree clean`', 'after the merge'])) bad.push(f.label + ' Clean lacks: ' + p);
  }
  expect(bad).toEqual([]);
});

it('risk:regression slices.md sends a slice whose anchor line says in repository to repos.md, and the accord skill loads and names repos.md (D-04, D-10)', () => {
  const bad: string[] = [];
  for (const f of rendered('slices.md')) {
    if (f.text === '') {
      bad.push(f.label + ' is missing');
      continue;
    }
    const pointer = f.text.split('. ').filter((s) => s.includes('./repos.md'));
    if (pointer.length !== 1) bad.push(f.label + ' names ./repos.md in ' + pointer.length + ' sentences');
    else if (!pointer[0].includes('in repository')) bad.push(f.label + ' pointer does not name the `in repository` anchor line: ' + pointer[0]);
    if (!f.paths.has(besidePath('verify', 'repos.md', f.dir))) bad.push(f.label + ' renders no repos.md beside it');
  }
  for (const runtime of RUNTIMES) {
    const targets = skillTargets(config(runtime));
    for (const dir of skillDirs(config(runtime))) {
      const skill = flat(targets.find((t) => t.path === `${dir}/accord/SKILL.md`)?.text ?? '');
      if (!skill.includes('./repos.md')) bad.push(`${runtime}: ${dir}/accord/SKILL.md names no ./repos.md`);
    }
  }
  expect(bad).toEqual([]);
});

it('risk:regression plan.md step 2 takes the baseline of each other repository from accord repos baseline and gives the planner its listing path (D-05)', () => {
  const bad: string[] = [];
  for (const f of rendered('plan.md')) {
    const step2 = between(f.text, '2. **Plan.**', '3. **Slices.**');
    for (const p of lacks(step2, [
      '`accord repos baseline <name> --id <id>`',
      'another repository',
      '`baseline_<name>`',
      'the `files:` listing path',
      '`./repos.md`',
    ])) {
      bad.push(f.label + ' step 2 lacks: ' + p);
    }
    if (f.text.split('`accord repos baseline <name> --id <id>`').length !== 2) bad.push(f.label + ' names accord repos baseline other than once');
    if (Buffer.byteLength(f.raw, 'utf8') > 5980) bad.push(f.label + ' is over 5980 bytes');
  }
  expect(rendered('plan.md').length).toBeGreaterThan(0);
  expect(bad).toEqual([]);
});

it('risk:regression plan-slices.md says a slice of another repository carries repo: <name> and holds that repository\'s tasks only, the slices are the deploy order, and the last is in this repository (D-08, D-09, D-14)', () => {
  const bad: string[] = [];
  for (const f of rendered('plan-slices.md')) {
    for (const p of lacks(f.text, [
      '`repo: <name>`',
      "that repository's tasks only",
      'one repository',
      'The slices are the deploy order',
      'the last slice is in this repository',
    ])) {
      bad.push(f.label + ' lacks: ' + p);
    }
    for (const part of ['`repo: <name>`', 'The slices are the deploy order']) {
      if (f.text.split(part).length !== 2) bad.push(f.label + ' names ' + part + ' other than once');
    }
  }
  expect(rendered('plan-slices.md').length).toBeGreaterThan(0);
  expect(bad).toEqual([]);
});

it('risk:regression build step 8 and review step 2 each send the multi-repository case to repos.md once, and review.md keeps its byte cap (D-04, R15)', () => {
  const bad: string[] = [];
  for (const f of rendered('build.md')) {
    const step8 = between(f.text, '8. When every task has a ledger line', '## Rules');
    if (!step8.includes('`./repos.md`')) bad.push(f.label + ' step 8 names no `./repos.md`');
    if (f.text.split('./repos.md').length !== 2) bad.push(f.label + ' names ./repos.md other than once');
    if (!/another repository[^.]*`\.\/repos\.md`|`\.\/repos\.md`[^.]*another repository/i.test(step8)) bad.push(f.label + ' step 8 does not say the pointer is for another repository');
    if (Buffer.byteLength(f.raw, 'utf8') > 6000) bad.push(f.label + ' is over 6000 bytes');
  }
  for (const f of rendered('review.md')) {
    const step2 = between(f.text, '2. **Package.**', '3. **Reviewers.**');
    if (!step2.includes('`./repos.md`')) bad.push(f.label + ' step 2 names no `./repos.md`');
    if (f.text.split('./repos.md').length !== 2) bad.push(f.label + ' names ./repos.md other than once');
    if (!/another repository[^.]*`\.\/repos\.md`|`\.\/repos\.md`[^.]*another repository/i.test(step2)) bad.push(f.label + ' step 2 does not say the pointer is for another repository');
    if (Buffer.byteLength(f.raw, 'utf8') > 6000) bad.push(f.label + ' is over 6000 bytes');
  }
  expect(rendered('build.md').length).toBeGreaterThan(0);
  expect(rendered('review.md').length).toBeGreaterThan(0);
  expect(bad).toEqual([]);
});

it('risk:security no line the plan, build and review stage files gain for another repository holds git -C or an instruction to clone (T-08.9.3-34)', () => {
  const bad: string[] = [];
  for (const file of ['plan.md', 'plan-slices.md', 'build.md', 'review.md']) {
    for (const f of rendered(file)) {
      for (const sentence of f.text.split(/(?<=\.) /).filter((s) => /another repository|`\.\/repos\.md`|`repo: <name>`/.test(s))) {
        if (/git\s+-C|git clone|\bclone\b/i.test(sentence)) bad.push(f.label + ': ' + sentence);
      }
    }
  }
  expect(bad).toEqual([]);
});
