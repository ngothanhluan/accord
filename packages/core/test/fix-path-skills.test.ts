// Phase 8.5 D-02, D-13, D-19 (8.5-ac-8): no skill assembles a fix brief by hand; every fix path names `accord brief <id> --fix`. Started in 08.5-04 with the review stage (the review fix, the
// same-round re-dispatch with its failing output, the final review fix) and widened to every other fix path in 08.5-05. Asserted over the RENDERED skills of every runtime, whitespace runs read as one space.
import { expect, it } from 'vitest';
import { skillDirs, skillTargets } from '../src/index.js';
import type { AccordConfig } from '../src/index.js';
import { stagePath } from './helpers/stage-files.js';

const config = { accord: '0.1.0', profile: 'build', tracker: { adapter: 'none' }, design: { tokens: '' }, roles: ['ba', 'dev'], runtimes: ['claude', 'codex', 'cursor', 'copilot'] } as AccordConfig;
const everyFile = new Map(skillTargets(config).map((f) => [f.path, f.text.replace(/\s+/g, ' ')]));

const BRIEF = 'accord brief <id> --fix';
/** The text of `text` from `from` up to `to` (end when `to` is absent); empty when `from` is missing, so a missing anchor fails its test. */
const between = (text: string, from: string, to?: string): string => {
  const start = text.indexOf(from);
  if (start < 0) return '';
  const end = to === undefined ? -1 : text.indexOf(to, start);
  return end < 0 ? text.slice(start) : text.slice(start, end);
};

it('risk:regression the review stage builds every fix brief with accord brief --fix (8.5-ac-8 D-02 D-13)', () => {
  const bad: string[] = [];
  for (const dir of skillDirs(config)) {
    const path = stagePath('review', undefined, dir);
    const skill = everyFile.get(path) ?? '';
    if (skill === '') {
      bad.push(path + ' is missing');
      continue;
    }
    const step4 = between(skill, '4. **Classify.**', '5. **Converged**');
    const fix = between(step4, 'Fix every Must and Should marked `patch`', 'When it reports');
    const redispatch = between(step4, 'When it reports', 'Copy every Ruling');
    const final = between(skill, '7. **Final review.**', '8. **Record.**');
    for (const [name, part] of [
      ['step 4 fix bullet', fix],
      ['step 4 re-dispatch bullet', redispatch],
      ['step 7 final review fix', final],
    ] as const) {
      if (!part.includes(BRIEF)) bad.push(`${path} ${name} lacks: ${BRIEF}`);
    }
    // D-13: the failing output goes into the findings file, and the brief is built again from it
    if (!redispatch.includes('findings file')) bad.push(path + ' step 4 re-dispatch bullet lacks: findings file');
    if (!redispatch.includes('saved whole to its own file outside the working tree')) bad.push(path + ' step 4 re-dispatch bullet lacks the file for output too long for the line checks');
    for (const gone of ['copy the ticket file byte for byte', 'Write a brief file', 'the same brief plus the failing output']) {
      if (skill.includes(gone)) bad.push(`${path} still holds: ${gone}`);
    }
  }
  expect(bad).toEqual([]);
});

it('risk:regression the review record states the fix-report refusal and its cut-off (D-19 8.5-ac-7)', () => {
  const bad: string[] = [];
  for (const dir of skillDirs(config)) {
    const path = stagePath('review', 'record', dir);
    const record = everyFile.get(path) ?? '';
    const anchor = '`accord round` and `accord gate done` refuse a fixed finding with no `checked:` mark';
    if (!record.includes(anchor)) {
      bad.push(`${path} lacks the 0.6.0 refusals paragraph`);
      continue;
    }
    const after = record.slice(record.indexOf(anchor));
    const sentence = after.split(/(?<=\.) /).find((s) => s.includes('executor fix report')) ?? '';
    for (const p of ['`accord round`', 'executor fix report', '0.13.0', 'lane S']) {
      if (!sentence.includes(p)) bad.push(`${path}: the sentence naming the executor fix report lacks ${p}`);
    }
    if (!after.includes('another machine')) bad.push(`${path} does not say a fix made on another machine is run again`);
  }
  expect(bad).toEqual([]);
});

// 08.5-05: the other fix paths. Debug step 4, the failure variant's step 3, resolve-pr step 5 and the comment run's two briefs build the fix brief with `accord brief --fix`.
it('risk:regression every fix path builds its brief with accord brief --fix (8.5-ac-8 D-02 R-7)', () => {
  const bad: string[] = [];
  for (const dir of skillDirs(config)) {
    const text = (rel: string): string => everyFile.get(`${dir}/${rel}`) ?? '';
    const debug = text('accord-debug/SKILL.md');
    const failure = text('accord-debug/failure.md');
    const resolve = text('accord-resolve-pr/SKILL.md');
    const comment = text('accord-debug/debug-comment.md');
    for (const [name, file] of [
      ['accord-debug/SKILL.md', debug],
      ['accord-debug/failure.md', failure],
      ['accord-resolve-pr/SKILL.md', resolve],
      ['accord-debug/debug-comment.md', comment],
    ] as const) {
      if (file === '') bad.push(`${dir}/${name} is missing`);
    }
    const debugFix = between(debug, '4. **Fix.**', '5. **Check.**');
    if (!debugFix.includes(BRIEF)) bad.push(`${dir} debug step 4 lacks: ${BRIEF}`);
    if (!debugFix.includes('findings file')) bad.push(`${dir} debug step 4 lacks: findings file`);
    if (!debugFix.includes('--out fix-brief.md')) bad.push(`${dir} debug step 4 lacks: --out fix-brief.md`);
    if (!debugFix.includes('Dispatch a fresh `accord-executor` with the path its `file:` line prints.')) bad.push(`${dir} debug step 4 lacks the dispatch with the printed path`);
    const failureStep3 = between(failure, '3. A failure only another operating system shows', '4. After the fix');
    if (!failureStep3.includes(BRIEF)) bad.push(`${dir} failure step 3 lacks: ${BRIEF}`);
    if (!failureStep3.includes('findings file')) bad.push(`${dir} failure step 3 lacks: findings file`);
    if (!failureStep3.includes('saved whole to its own file outside the working tree')) bad.push(`${dir} failure step 3 lacks the file for a log too long for the line checks`);
    if (!failureStep3.includes('the reproduction test is skipped on this operating system')) bad.push(`${dir} failure step 3 lost the skipped reproduction test note`);
    const resolveFix = between(resolve, '5. **Fix.**', '6. **Reply.**');
    if (!resolveFix.includes(BRIEF)) bad.push(`${dir} resolve-pr step 5 lacks: ${BRIEF}`);
    const testOnly = between(comment, '**Test only.**', '**Hand back.**');
    for (const p of ['--fix', '--test-only', '--out test-only-brief.md', 'ends with the line']) if (!testOnly.includes(p)) bad.push(`${dir} debug-comment.md Test only paragraph lacks: ${p}`);
    const holds = between(comment, '**Holds.**', '**No fix.**');
    if (!holds.includes('--fix')) bad.push(`${dir} debug-comment.md Holds paragraph lacks: --fix`);
    if (holds.includes('--test-only')) bad.push(`${dir} debug-comment.md Holds paragraph holds: --test-only`);
  }
  expect(bad).toEqual([]);
});

it('risk:regression no skill tells the session to write a brief by hand (8.5-ac-8 D-02 D-13 D-23)', () => {
  const bad: string[] = [];
  const gone = ['copy the ticket file byte for byte', 'Write a brief file', 'write the brief as step 4 says', 'the same brief plus the failing output', 'as the last line of the brief'];
  for (const [path, text] of everyFile) {
    for (const g of gone) if (text.includes(g)) bad.push(`${path} still holds: ${g}`);
  }
  for (const dir of skillDirs(config)) {
    // the failing-output paths put the output into the findings file
    const failure = everyFile.get(`${dir}/accord-debug/failure.md`) ?? '';
    if (!between(failure, '3. A failure only another operating system shows', '4. After the fix').includes('findings file')) bad.push(`${dir} failure step 3 lacks: findings file`);
    // the build stage's task briefs are written with --out
    for (const [path, anchor] of [
      [stagePath('build', undefined, dir), 'accord brief <id> <n> --out'],
      [stagePath('build', 'waves', dir), 'accord brief <id> <n> --out'],
      [stagePath('build', 'no-plan', dir), 'accord brief <id> 1 --out'],
    ] as const) {
      const text = everyFile.get(path) ?? '';
      if (!text.includes(anchor)) bad.push(`${path} lacks: ${anchor}`);
    }
  }
  expect(bad).toEqual([]);
});
