// LINT-03 scenario shape, D-46 one @ac-n per scenario, D-69 test tags, D-72 report round trip.
// Rules over `ScenarioRef`; findings sit on the Scenario line (steps carry no line of their own).
// Levels live in rules.ts (D-57).
import { AC_TAG } from '../load/gherkin.js';
import { headingKey } from '../load/sections.js';
import { normaliseKey } from '../load/snapshot.js';
import type { RepoSnapshot, ScenarioRef, Ticket } from '../model/snapshot.js';
import type { Draft, Rule } from './rules.js';

const CONFIG = 'accord/config.yml';
const isTest = (tag: string) => tag.startsWith('@test:');

/** One draft per reason `f` returns, at that scenario's line. */
const perScenario = (snapshot: RepoSnapshot, f: (s: ScenarioRef, t: Ticket) => string[]): Draft[] =>
  Object.values(snapshot.tickets).flatMap((t) =>
    t.scenarios.flatMap((s) => f(s, t).map((reason) => ({ file: t.file, line: s.line, reason }))),
  );

/** LINT-03: every scenario carries an `@ac-n` tag. */
export const acTagMissing: Rule['check'] = (snapshot) =>
  perScenario(snapshot, (s) => (s.acTag === undefined ? [`scenario "${s.name}" has no @ac-n tag`] : []));

/** D-46: exactly one `@ac-n` per scenario. */
export const acTagMultiple: Rule['check'] = (snapshot) =>
  perScenario(snapshot, (s) =>
    s.tags.filter((tag) => AC_TAG.test(tag)).length > 1 ? [`scenario "${s.name}" carries more than one @ac-n tag`] : [],
  );

/** LINT-03: an `@ac-n` already used earlier in the same ticket; reported on the later scenario. */
export const acTagDuplicate: Rule['check'] = (snapshot) =>
  Object.values(snapshot.tickets).flatMap((t) => {
    const first = new Map<string, string>();
    const out: Draft[] = [];
    for (const s of t.scenarios) {
      if (s.acTag === undefined) continue;
      const seen = first.get(s.acTag);
      if (seen === undefined) first.set(s.acTag, s.name);
      else out.push({ file: t.file, line: s.line, reason: `@${s.acTag} is already used by scenario "${seen}"` });
    }
    return out;
  });

/** LINT-03: a step that is only its keyword (no whitespace after collapsing), or a scenario with no steps. */
export const stepEmpty: Rule['check'] = (snapshot) =>
  perScenario(snapshot, (s) =>
    s.steps.length === 0
      ? [`scenario "${s.name}" has no steps`]
      : s.steps.flatMap((step, i) => (/\s/.test(step) ? [] : [`scenario "${s.name}" step ${i + 1} "${step}" has no text`])),
  );

/** LINT-03: a story or bug with no scenario; at the `## Acceptance criteria` heading when present (Pitfall 9: needs frontmatter). */
export const noScenarios: Rule['check'] = (snapshot) =>
  Object.values(snapshot.tickets).flatMap((t) => {
    const type = t.frontmatter?.type;
    if ((type !== 'story' && type !== 'bug') || t.scenarios.length > 0) return [];
    const ac = t.sections.find((s) => headingKey(s.heading) === 'acceptance criteria');
    return [{ file: t.file, ...(ac === undefined ? {} : { line: ac.line }), reason: `a ${type} needs at least one tagged scenario` }];
  });

/** A scenario not tagged `@ui` carries a `@test:<id>` tag (D-69); the finding sits on the Scenario line (D-46). */
export const testTagMissing: Rule['check'] = (snapshot) =>
  perScenario(snapshot, (s) =>
    !s.tags.includes('@ui') && !s.tags.some(isTest) ? [`scenario "${s.name}" has no @test:<id> tag and is not @ui`] : [],
  );

/** D-69: one `@test:` tag per scenario. */
export const testTagDuplicate: Rule['check'] = (snapshot) =>
  perScenario(snapshot, (s) => (s.tags.filter(isTest).length > 1 ? [`scenario "${s.name}" carries more than one @test: tag`] : []));

/** D-69: `@ui` scenarios are verified by hand, so a `@test:` tag on one is a contradiction. */
export const testTagOnUi: Rule['check'] = (snapshot) =>
  perScenario(snapshot, (s) =>
    s.tags.includes('@ui') && s.tags.some(isTest) ? [`scenario "${s.name}" is @ui and carries a @test: tag`] : [],
  );

/** D-72: with a report loaded, every `@test:` id must be a key of `snapshot.tests`; exact lookup, never a guess (T-03-09). */
export const testIdUnknown: Rule['check'] = (snapshot) => {
  const tests = snapshot.tests;
  const report = snapshot.config?.tests?.report;
  if (tests === undefined || report === undefined) return [];
  return perScenario(snapshot, (s) =>
    s.tags
      .filter(isTest)
      .map((tag) => tag.slice(6))
      .filter((id) => !Object.hasOwn(tests, id))
      .map((id) => `@test:${id} not found in ${report}; ids are classname#name with spaces as '-'`),
  );
};

/** D-72: `tests.report` is configured but the file was not in the snapshot. */
export const reportMissing: Rule['check'] = (snapshot) => {
  const report = snapshot.config?.tests?.report;
  if (report === undefined || normaliseKey(report) in snapshot.files) return [];
  return [{ file: CONFIG, pointer: '/tests/report', reason: `tests.report "${report}" is not in the snapshot` }];
};
