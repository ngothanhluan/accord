// Phase 11 plan 15 (11-ac-8, 11-ac-11; D-07, D-10, D-11, D-16): the rendered verify, build, verifier, executor and reviewer text for a `ui: true` ticket. The verify stage takes UI evidence from the
// first tier available and falls back to the owner's check; the build stage dispatches the agent the brief names; a mapped skill stays inside its stage. Asserted over the RENDERED text of every
// tool a runtime loads (skillTargets, agentTargets), not the source files, except the `loads:` list, which a render strips.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { agentTargets, skillDirs, skillTargets } from '../src/index.js';
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
const bytes = (text: string): number => Buffer.byteLength(text, 'utf8');

/** A tool, a skill or a plugin by its own name: stage and agent text names roles only (D-11). */
const OTHER_NAMES = /impeccable|ui-ux-pro-max|superpowers|playwright|cypress|webdriverio|puppeteer|selenium|agent-browser|agent-desktop|context7|figma|GSD/i;

interface Rendered {
  label: string;
  text: string;
  raw: string;
  paths: ReadonlySet<string>;
  dir: string;
}

/** Every rendered `file` beside the accord stages (`<dir>/accord/<file>`), one per skill directory a runtime loads. */
function rendered(stage: string, file: string): Rendered[] {
  return RUNTIMES.flatMap((runtime) => {
    const targets = skillTargets(config(runtime));
    const paths = new Set(targets.map((t) => t.path));
    return skillDirs(config(runtime)).map((dir) => {
      const path = besidePath(stage, file, dir);
      const raw = targets.find((t) => t.path === path)?.text ?? '';
      return { label: `${runtime}: ${path}`, text: flat(raw), raw, paths, dir };
    });
  });
}

/** Every render of an agent: one per runtime that renders agents. */
const agentsNamed = (name: string) =>
  RUNTIMES.flatMap((runtime) =>
    agentTargets(config(runtime))
      .filter((f) => f.path.endsWith(`/${name}.md`))
      .map((f) => ({ label: `${runtime}: ${f.path}`, text: flat(f.text), raw: f.text })),
  );

/** The text of `text` from the first occurrence of `from` to the next occurrence of `to` (or the end). */
function between(text: string, from: string, to: string): string {
  const start = text.indexOf(from);
  if (start < 0) return '';
  const end = text.indexOf(to, start + from.length);
  return end < 0 ? text.slice(start) : text.slice(start, end);
}

it('risk:regression the rendered verify stage sends a ui ticket to ./verify-ui.md in steps 2, 4, 5 and 6 and stays within its byte cap (11-ac-11, D-10, D-16)', () => {
  const bad: string[] = [];
  const files = rendered('verify', 'verify.md');
  if (files.length === 0) bad.push('verify.md is not rendered');
  for (const f of files) {
    if (f.text === '') {
      bad.push(f.label + ' is missing');
      continue;
    }
    const step2 = between(f.text, '2. **Sync and suite.**', '3. **Verifier.**');
    const step4 = between(f.text, '4. **Report.**', '5. **Owner.**');
    const step5 = between(f.text, '5. **Owner.**', '6. Run `accord gate done');
    const step6 = between(f.text, '6. Run `accord gate done', '7. Report the finish');
    for (const [name, step] of [['2', step2], ['4', step4], ['5', step5]] as const) if (!step.includes('./verify-ui.md')) bad.push(f.label + ' step ' + name + ' does not point to ./verify-ui.md');
    for (const p of lacks(step4, ['tier'])) bad.push(f.label + ' step 4 lacks: ' + p);
    for (const p of lacks(step5, ['`blocked` criterion', '`@ui`: owner check'])) bad.push(f.label + ' step 5 lacks: ' + p);
    for (const p of lacks(step6, ['`accord/tickets/<id>/evidence/`'])) bad.push(f.label + ' step 6 lacks: ' + p);
    if (bytes(f.raw) > 5980) bad.push(f.label + ' is ' + bytes(f.raw) + ' bytes, over 5980');
    if (f.raw.split('\n').length > 121) bad.push(f.label + ' is over 120 lines');
  }
  expect(bad).toEqual([]);
});

it('risk:regression verify-ui.md holds the four tiers in order, the {dir} command run at step 2, the file names, the owner check and the public warning (11-ac-11, D-10, D-16)', () => {
  const bad: string[] = [];
  const files = rendered('verify', 'verify-ui.md');
  if (files.length === 0) bad.push('verify-ui.md is not rendered');
  for (const f of files) {
    if (f.text === '') {
      bad.push(f.label + ' is missing');
      continue;
    }
    const wanted = [
      '`ui.screenshots`',
      '`{dir}`',
      '`accord/tickets/<id>/evidence`',
      'right after `tests.full`',
      'at the same commit',
      'accord never runs it',
      '`ac-<n>-<state>.<ext>`',
      '`Tier: command`',
      '`Tier: verifier`',
      '`Tier: manual`',
      '`Tier: owner check`',
      '`Evidence commit: <sha>`',
      'headless',
      'one criterion at a time',
      './ask.md',
      'outside the working tree',
      'a fresh `accord-verifier` in `owner check mode`',
      '`Result: blocked`',
      '`Result: pass`',
      '`Result: fail`',
      '`Owner: "<the owner\'s words>"`',
      'weaker than a screenshot',
      'committed with `verification.md`',
      'public',
    ];
    for (const p of lacks(f.text, wanted)) bad.push(f.label + ' lacks: ' + p);
    // the tiers come in the order of D-10: command, verifier, manual, owner check
    const order = ['`Tier: command`', '`Tier: verifier`', '`Tier: manual`', '`Tier: owner check`'].map((p) => f.text.indexOf(p));
    if (order.some((at) => at < 0) || order.some((at, i) => i > 0 && at < order[i - 1])) bad.push(f.label + ' does not list the tiers in order');
    if (bytes(f.raw) > 6000) bad.push(f.label + ' is ' + bytes(f.raw) + ' bytes, over 6000');
    for (const link of new Set([...f.text.matchAll(/`\.\/([a-z-]+\.md)`/g)].map((m) => m[1]))) {
      if (!f.paths.has(besidePath('verify', link, f.dir))) bad.push(f.label + ' links ./' + link + ' which is not rendered beside it');
    }
  }
  expect(bad).toEqual([]);
});

it('risk:regression the verifier writes verification.md and tier-verifier screenshots only, names the tier and the commit, has the owner check mode and no longer blocks for a missing browser (11-ac-11, D-10, D-16, T-11-32)', () => {
  const bad: string[] = [];
  const files = agentsNamed('accord-verifier');
  if (files.length === 0) bad.push('no accord-verifier is rendered');
  for (const f of files) {
    for (const p of lacks(f.text, [
      '`accord/tickets/<id>/verification.md`',
      'at tier `verifier`',
      'screenshots under `accord/tickets/<id>/evidence/`',
      'Tier: command | verifier | manual | owner check',
      'Evidence commit: <the commit you verified>',
      '`owner check mode`',
      'Owner: "<the owner\'s words>"',
      'rewrite only the `@ui` blocks',
      'is a `fail`',
    ])) {
      bad.push(f.label + ' lacks: ' + p);
    }
    if (f.text.includes('without a browser available')) bad.push(f.label + ' still blocks a @ui scenario for a missing browser');
    if (!/^tools: "?Read, Grep, Glob, Bash, Write, Edit"?$/m.test(f.raw)) bad.push(f.label + ' changed the verifier tools line');
    if (OTHER_NAMES.test(f.text)) bad.push(f.label + ' names a tool or skill');
  }
  expect(bad).toEqual([]);
});

it('risk:regression no rendered verify, verify-ui or verifier text names a browser tool, a test tool or a skill by name (D-11)', () => {
  const bad: string[] = [];
  const all = [...rendered('verify', 'verify.md'), ...rendered('verify', 'verify-ui.md'), ...agentsNamed('accord-verifier')];
  expect(all.length).toBeGreaterThan(0);
  for (const f of all) {
    const hit = OTHER_NAMES.exec(f.text);
    if (hit !== null) bad.push(f.label + ' names ' + hit[0]);
  }
  expect(bad).toEqual([]);
});

it('risk:regression the accord skill loads verify-ui.md in sorted order and names it at the verify row, and every tool renders it beside verify.md (11-ac-11, D-10)', () => {
  const bad: string[] = [];
  const source = readFileSync(fileURLToPath(new URL('../skills/accord/SKILL.md', import.meta.url)), 'utf8');
  const loads = /^loads: \[(.*)\]$/m.exec(source)?.[1].split(', ') ?? [];
  if (!loads.includes('accord/verify-ui.md')) bad.push('SKILL.md does not list accord/verify-ui.md in loads');
  if (loads.join(',') !== [...loads].sort().join(',')) bad.push('the loads list is not sorted');
  const row = between(flat(source), '- lane M, rows `verify`', '\nAn `Unfinished:`');
  if (!row.includes('./verify-ui.md')) bad.push('the verify row of SKILL.md does not name ./verify-ui.md');
  if ((source.match(/accord\/verify-ui\.md/g) ?? []).length !== 1) bad.push('SKILL.md names accord/verify-ui.md other than once in loads');
  expect(bad).toEqual([]);
});

it('risk:regression the build stage dispatches the agent the brief names wherever it dispatches an executor, and stays within 6000 bytes (11-ac-8, D-07)', () => {
  const bad: string[] = [];
  const files = rendered('build', 'build.md');
  if (files.length === 0) bad.push('build.md is not rendered');
  for (const f of files) {
    if (f.text === '') {
      bad.push(f.label + ' is missing');
      continue;
    }
    const step2 = between(f.text, '2. **Dispatch.**', '3. **Record.**');
    for (const p of lacks(step2, ['the brief\'s `agent:` line names', '`accord-executor`', 'in any build file or for a fix', './build-waves.md', 'refuses'])) bad.push(f.label + ' step 2 lacks: ' + p);
    // the rule is stated once, and no other step of this stage names a bare `accord-executor` dispatch
    if ((f.text.match(/`agent:` line/g) ?? []).length !== 1) bad.push(f.label + ' does not state the agent rule exactly once');
    if (bytes(f.raw) > 6000) bad.push(f.label + ' is ' + bytes(f.raw) + ' bytes, over 6000');
    if (OTHER_NAMES.test(f.text)) bad.push(f.label + ' names a tool or skill');
  }
  expect(bad).toEqual([]);
});

it('risk:regression the executor and the reviewer keep a skill preloaded for UI work inside the task or the lens, and the ui lens line is the checklist (11-ac-8, D-07, T-11-34)', () => {
  const bad: string[] = [];
  const executors = agentsNamed('accord-executor');
  const reviewers = agentsNamed('accord-reviewer');
  if (executors.length === 0) bad.push('no accord-executor is rendered');
  if (reviewers.length === 0) bad.push('no accord-reviewer is rendered');
  for (const f of executors) {
    for (const p of lacks(f.text, ['A skill preloaded for UI work guides the craft of this task only', 'never runs its own intent, planning or done steps', 'your brief stays the work'])) bad.push(f.label + ' lacks: ' + p);
    if (OTHER_NAMES.test(f.text)) bad.push(f.label + ' names a tool or skill');
  }
  for (const f of reviewers) {
    for (const p of lacks(f.text, ['A skill preloaded for UI work guides the craft of this lens only', 'never runs its own intent, planning or done steps', 'Lens `ui`', '`### Lens ui (built in)`', 'is your contract', 'judges the craft as well', 'carries no ` — lens:` mark'])) {
      bad.push(f.label + ' lacks: ' + p);
    }
    if (OTHER_NAMES.test(f.text)) bad.push(f.label + ' names a tool or skill');
  }
  expect(bad).toEqual([]);
});

it('risk:regression review-lenses.md sends the ui lens to the agent its line names and says a ui finding carries no lens mark (11-ac-8, D-07, hand-off of plan 11-13)', () => {
  const bad: string[] = [];
  const files = rendered('review', 'review-lenses.md');
  if (files.length === 0) bad.push('review-lenses.md is not rendered');
  for (const f of files) {
    for (const p of lacks(f.text, [
      'the `ui` lens goes to the agent its `### Lens ui` line names',
      'A finding of the built-in `ui` lens carries no ` — lens:` mark',
      'blocks like any built-in finding',
      'one `accord-reviewer`',
      'each ending ` — lens: <name>`',
    ])) {
      bad.push(f.label + ' lacks: ' + p);
    }
    if (OTHER_NAMES.test(f.text)) bad.push(f.label + ' names a tool or skill');
  }
  expect(bad).toEqual([]);
});
