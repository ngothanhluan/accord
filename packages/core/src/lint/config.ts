// ST-LN-80: models.architect still validates so an old config loads, but nothing reads it any more.
import { subjectCollisions } from '../commits/subjects.js';
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

/** ST-LN-50 D-08, D-09: a `strictness.levels` key the engines ignore (the rule is on the floor, belongs to a stage, does not exist, or cannot be turned off) is an error, so a hand edit never passes unseen. LOCKED itself. */
export const configFloor: Rule['check'] = (snapshot) =>
  floorProblems(snapshot.config)
    .filter((p) => !p.pointer.startsWith('/template/')) // named once, by lint.template-section
    .map((p) => ({ file: 'accord/config.yml', pointer: p.pointer, reason: p.reason }));

/** ST-LN-50 D-10, t2-ac-7: a `template.sections` entry that replaces a required section, names acceptance criteria or repeats another is an error, so a hand edit never passes unseen. LOCKED itself. */
export const templateSection: Rule['check'] = (snapshot) =>
  teamSectionProblems(snapshot.config?.template?.sections).map((p) => ({ file: 'accord/config.yml', pointer: p.pointer, reason: p.reason }));
