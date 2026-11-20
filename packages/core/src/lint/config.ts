// ST-LN-80: models.architect still validates so an old config loads, but nothing reads it any more.
import { commitRuleOf, commitRuleProblem } from '../commits/rule.js';
import type { CommitRule } from '../commits/rule.js';
import { OFF_TICKET_BRANCH, renderSubject, SUBJECT_NAMES, subjectCollisions } from '../commits/subjects.js';
import type { SubjectName } from '../commits/subjects.js';
import { floorProblems } from '../gate/floor.js';
import { teamSectionProblems } from '../scaffold/sections.js';
import type { Rule } from './rules.js';

export const modelRetired: Rule['check'] = (snapshot) =>
  snapshot.config?.models?.architect === undefined
    ? []
    : [
        {
          file: 'accord/config.yml',
          pointer: '/models/architect',
          reason:
            'models.architect has no effect: accord no longer renders accord-architect, and the planner drafts the approach, so models.planner now applies; remove models.architect',
        },
      ];

/** ST-LN-50 D-06: two templates that render one subject, where one is read back, would let a written subject be read as a claim or a plan-ready commit. */
export const subjectDuplicate: Rule['check'] = (snapshot) =>
  subjectCollisions(snapshot.config).map((c) => ({
    file: 'accord/config.yml',
    pointer: c.pointer,
    reason: `${c.key} and ${c.other} render the same subject "${c.template.replace('{id}', '<id>')}"; a written subject would be read as a ${c.readAs.join(' or ')} commit - give them different templates`,
  }));

/** The tail each subject's writers pass to `renderSubject` or `accord subject` (a round count, "moved to lane S"), so lint renders the subject as it is written; none for the rest. */
const SAMPLE_TAIL: Partial<Record<SubjectName, string>> = { plan_round: 'round 1, 0 Must, 0 Should', approach_round: 'round 1, 0 Must, 0 Should', intent: 'moved to lane S' };

/** A template with one `{id}` built from the rule's own example whose rendering passes the rule, or undefined when none of the few shapes tried does. */
function passingTemplate(rule: CommitRule, name: SubjectName, sampleId: string): string | undefined {
  const ex = rule.example.replace(/[\r\n]+.*$/s, '').trim();
  if (ex === '' || /[{}']/.test(ex)) return undefined;
  const words = ex.split(' ');
  const candidates = [`${ex} {id}`, words.length > 1 ? [...words.slice(0, -1), '{id}'].join(' ') : undefined];
  return candidates.find((c): c is string => c !== undefined && commitRuleProblem(rule, renderSubject({ commits: { subjects: { [name]: c } } }, name, sampleId, SAMPLE_TAIL[name])) === undefined);
}

/** One subject accord commits on a ticket branch that the commit rule refuses as `commits.subjects` renders it: the name, the rendered subject, the rule's reason and the fix (`accord audit` reads the same list as `lint.commit-rule`). */
export interface SubjectRuleProblem {
  name: SubjectName;
  subject: string;
  problem: string;
  fix: string;
}

/** Every subject accord commits on a ticket branch (every SUBJECT_NAMES name but OFF_TICKET_BRANCH) that breaks `rule`, in SUBJECT_NAMES order. */
export function subjectRuleProblems(snapshot: Parameters<Rule['check']>[0], rule: CommitRule): SubjectRuleProblem[] {
  const config = snapshot.config;
  const ids = Object.keys(snapshot.tickets).sort();
  const people = Object.keys(config?.people ?? {}).sort();
  const out: SubjectRuleProblem[] = [];
  for (const name of SUBJECT_NAMES.filter((n) => !OFF_TICKET_BRANCH.includes(n))) {
    const sampleId = name === 'people' ? (people[0] ?? 'dev@example.com') : (ids[0] ?? 'ST-XX-1');
    const subject = renderSubject(config, name, sampleId, SAMPLE_TAIL[name]);
    const problem = commitRuleProblem(rule, subject);
    if (problem === undefined) continue;
    const template = passingTemplate(rule, name, sampleId);
    const fix = `accord config set commits.subjects.${name} '${template ?? '<a template with {id} whose subject passes the rule>'}'` + (template === undefined ? ` (a subject that ${rule.text} accepts, such as ${rule.example === '' ? 'your example' : rule.example})` : '');
    out.push({ name, subject, problem, fix });
  }
  return out;
}

/**
 * Phase 8.1 D-04, D-06 (8.1-ac-5): `commits.message` must be in force (the pattern compiles and the backtracking guard accepts it), its example must pass it, and every subject accord commits on a
 * ticket branch (every SUBJECT_NAMES name but OFF_TICKET_BRANCH) must pass it as `commits.subjects` renders it, else the ticket's own claim or planning commit would be refused by task-done.
 * Config-level, so no cut-off (it reads no ticket); a merge commit, a default-branch commit, and the pin PR's upgrade commit are outside the rule.
 */
export const commitRule: Rule['check'] = (snapshot) => {
  const config = snapshot.config;
  const rule = commitRuleOf(config);
  const file = 'accord/config.yml';
  if (rule === undefined) return [];
  if ('problem' in rule) return [{ file, pointer: '/commits/message/pattern', reason: `${rule.problem} - fix: change commits.message.pattern (accord config set commits.message.pattern '<pattern>') or use commits.message.preset conventional` }];
  const out: { file: string; pointer: string; reason: string }[] = [];
  const own = rule.example === '' ? undefined : commitRuleProblem(rule, rule.example);
  if (own !== undefined) {
    out.push({ file, pointer: '/commits/message/example', reason: `commits.message.example breaks its own rule: ${own} - fix: change commits.message.example to a first line that ${rule.text} accepts` });
  }
  for (const p of subjectRuleProblems(snapshot, rule)) {
    out.push({ file, pointer: `/commits/subjects/${p.name}`, reason: `commits.subjects.${p.name} renders "${p.subject}", which breaks the commit rule: ${p.problem} - fix: ${p.fix}; \`accord commit check <file>\` checks a message first` });
  }
  return out;
};

/** ST-LN-50 D-08, D-09: a `strictness.levels` key the engines ignore (the rule is on the floor, belongs to a stage, does not exist, or cannot be turned off) is an error, so a hand edit never passes unseen. LOCKED itself. */
export const configFloor: Rule['check'] = (snapshot) =>
  floorProblems(snapshot.config)
    .filter((p) => !p.pointer.startsWith('/template/')) // named once, by lint.template-section
    .map((p) => ({ file: 'accord/config.yml', pointer: p.pointer, reason: p.reason }));

/** ST-LN-50 D-10, t2-ac-7: a `template.sections` entry that replaces a required section, names acceptance criteria or repeats another is an error, so a hand edit never passes unseen. LOCKED itself. */
export const templateSection: Rule['check'] = (snapshot) =>
  teamSectionProblems(snapshot.config?.template?.sections).map((p) => ({ file: 'accord/config.yml', pointer: p.pointer, reason: p.reason }));
