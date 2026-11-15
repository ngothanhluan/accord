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
] as const;
export type SubjectName = (typeof SUBJECT_NAMES)[number];

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
