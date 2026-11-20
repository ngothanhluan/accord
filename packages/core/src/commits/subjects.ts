// ST-LN-50 D-06: the subject of each commit accord writes or reads is a template with one `{id}`. Pure: no I/O.
// Accord writes the current template and reads the current and the legacy ones, comparing each subject exactly (a `--grep` only narrows a log).
import type { AccordConfig } from '../model/snapshot.js';

/** Every subject kind, in the order RESEARCH §2 lists them. Only `claim` and `plan_ready` are read back; the rest are written only. */
export const SUBJECT_NAMES = [
  'claim',
  'plan_ready',
  'plan_round',
  'approach_round',
  'intent',
  'ticket_understood',
  'ticket_question',
  'scout',
  'drop',
  'rebind',
  'ruleset_backfill',
  'queue',
  'people',
  'conventions',
] as const;
export type SubjectName = (typeof SUBJECT_NAMES)[number];

/**
 * Phase 8.1 D-06 (plan check W3a): the subjects accord commits on a branch that is not a ticket branch, so the commit rule (`commits.message`, judged by task-done and gate done on a ticket
 * branch alone) never reads them and `lint.commit-rule` does not judge them: `drop` on `drop/<id>` (commands/drop.ts), `queue` on `backlog/<id>-<date>` (commands/queue.ts) and `conventions` on `conventions/<date>` (commands/conventions.ts), all cut from
 * origin's default branch. Every other name is committed on the ticket branch and judged; a name added later is judged unless it is listed here on purpose. Like the `upgrade: accord <version>`
 * commit of a pin PR (an `upgrade/<version>` branch, no subject name), these are outside the rule.
 */
export const OFF_TICKET_BRANCH: readonly SubjectName[] = ['drop', 'queue', 'conventions'];

/** Today's text for each kind, so with no `commits.subjects` every subject is unchanged byte for byte. */
export const DEFAULT_SUBJECTS: Readonly<Record<SubjectName, string>> = {
  claim: 'claim: {id}',
  plan_ready: 'plan: {id} ready',
  plan_round: 'plan: {id}',
  approach_round: 'approach: {id}',
  intent: 'intent: {id}',
  ticket_understood: 'ticket: {id} understood',
  ticket_question: 'ticket: {id} question',
  scout: 'scout: {id} report',
  drop: 'drop: {id}',
  rebind: 'verify: {id} rebound after rebase',
  ruleset_backfill: 'ruleset: {id} from its claim commit',
  queue: 'backlog: queue {id}', // ST-LN-83 D-03: the draft an idea is queued as; the repository convention for queue PRs
  people: 'people: {id}', // Phase 8.1 W2: {id} holds the email of the people entry the worktree skill commits to the ticket branch, as `conventions` holds a date
  conventions: 'conventions: {id}', // Phase 8.1 G3a: {id} holds the UTC date of the conventions/<date> branch the conventions draft is committed on
};

type WithCommits = Pick<AccordConfig, 'commits'> | undefined;

const place = (template: string, id: string): string => template.replace('{id}', () => id); // a function, so `$&` in an id is written as is

const templateOf = (config: WithCommits, name: SubjectName): string => config?.commits?.subjects?.[name] ?? DEFAULT_SUBJECTS[name];

/** The subject accord writes for `name` and ticket `id`; a free `tail` (a round count, "moved to lane S") follows after one space. */
export function renderSubject(config: WithCommits, name: SubjectName, id: string, tail?: string): string {
  const head = place(templateOf(config, name), id);
  return tail === undefined || tail === '' ? head : head + ' ' + tail;
}

/** The subjects that count as `name` for `id`: the current rendering first, then each legacy one, each once. */
export function subjectsFor(config: WithCommits, name: SubjectName, id: string): string[] {
  const legacy = config?.commits?.legacy_subjects?.[name] ?? [];
  return [...new Set([place(templateOf(config, name), id), ...legacy.map((t) => place(t, id))])];
}

/** Whether `subject` is exactly one of the subjects of `name` for `id`. */
export function matchesSubject(config: WithCommits, name: SubjectName, id: string, subject: string): boolean {
  return subjectsFor(config, name, id).includes(subject);
}

/** The template in force for `name`: the one `commits.subjects` sets, else today's default. */
export function effectiveSubject(config: WithCommits, name: SubjectName): string {
  return templateOf(config, name);
}

/** The subject kinds accord reads back, so a template of another kind that renders alike would be mistaken for one. */
const READ_BACK: readonly SubjectName[] = ['claim', 'plan_ready'];

/** One template of `name`: `current`, or a `legacy` entry (listed for the read-back names only). */
interface Entry {
  name: SubjectName;
  legacy: boolean;
  template: string;
}

export interface SubjectCollision {
  /** the read-back template, as a config key and a JSON pointer */
  key: string;
  pointer: string;
  /** the other template it equals */
  other: string;
  /** the template text, `{id}` in place */
  template: string;
  /** the kinds of commit one of the two would be read as: `claim`, `plan ready`, or both */
  readAs: string[];
}

const keyOf = (e: Entry): { key: string; pointer: string } =>
  e.legacy ? { key: `commits.legacy_subjects.${e.name}`, pointer: `/commits/legacy_subjects/${e.name}` } : { key: `commits.subjects.${e.name}`, pointer: `/commits/subjects/${e.name}` };

/**
 * Pairs of templates of different kinds that are equal where at least one is read back (claim or plan_ready, current or legacy):
 * a subject accord writes for the other kind would be read as a claim or a plan-ready commit. Two write-only kinds that agree
 * collide with nothing, and a template equal to its own legacy entry is one template. Read-back entries come first in a pair.
 */
export function subjectCollisions(config: WithCommits): SubjectCollision[] {
  const entries: Entry[] = [];
  for (const name of SUBJECT_NAMES) entries.push({ name, legacy: false, template: templateOf(config, name) });
  for (const name of READ_BACK) for (const template of config?.commits?.legacy_subjects?.[name] ?? []) entries.push({ name, legacy: true, template });
  const out: SubjectCollision[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [x, y] = [entries[i], entries[j]];
      if (x.name === y.name || x.template !== y.template || (!READ_BACK.includes(x.name) && !READ_BACK.includes(y.name))) continue;
      const [a, b] = READ_BACK.includes(x.name) ? [x, y] : [y, x];
      const id = `${keyOf(a).key}|${keyOf(b).key}|${a.template}`;
      const mirror = `${keyOf(b).key}|${keyOf(a).key}|${a.template}`;
      if (seen.has(id) || seen.has(mirror)) continue;
      seen.add(id);
      out.push({
        key: keyOf(a).key,
        pointer: keyOf(a).pointer,
        other: keyOf(b).key,
        template: a.template,
        readAs: READ_BACK.filter((n) => n === a.name || n === b.name).map((n) => (n === 'claim' ? 'claim' : 'plan ready')),
      });
    }
  }
  return out;
}
