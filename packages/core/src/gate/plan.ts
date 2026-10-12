// Spec §7 plan gate: the plan of an approved lane ticket covers every criterion and decision and defers
// nothing. Mechanical only — whether the plan is good is the critic's question; this gate answers whether
// it is complete. Levels live in rules.ts (D-57).
import { headingKey, LIST_MARKER, stripHtmlComments } from '../load/sections.js';
import { FIELD } from '../load/work.js';
import type { PlanTask, RepoSnapshot, Ticket } from '../model/snapshot.js';
import type { GateRule } from './rules.js';
import { laneTicket, planFile, workOf } from './work.js';

const DECISION = /^(D-[0-9]+)\b/;
// Letter-or-digit boundaries on both sides: `v10` and `laterally` are not deferrals, `v1.` and `later.` are.
const DEFERRAL = /(?<![\p{L}\p{N}])(TODO|TBD|placeholder|v1|for now|later)(?![\p{L}\p{N}])/iu;

/** `D-nn` at the start of a line under `## Decisions`, list marker and comments stripped; unique, in order. */
export function decisionIds(t: Ticket): string[] {
  const s = t.sections.find((x) => headingKey(x.heading) === 'decisions');
  if (s === undefined) return [];
  const ids = stripHtmlComments(s.lines).flatMap((l) => {
    const m = DECISION.exec(l.text.replace(LIST_MARKER, '').trim());
    return m ? [m[1]] : [];
  });
  return [...new Set(ids)];
}

const acTags = (t: Ticket): string[] => [
  ...new Set(t.scenarios.flatMap((s) => (s.acTag === undefined ? [] : ['@' + s.acTag]))),
];
const tasksOf = (snapshot: RepoSnapshot, id: string): PlanTask[] =>
  laneTicket(snapshot, id) === undefined ? [] : (workOf(snapshot, id)?.plan?.tasks ?? []);

/** The plan gate exists only for lane tickets; a 0.1.0 ticket keeps its `## Plan` section and lint rules. */
export const laneMissing: GateRule['check'] = (snapshot, id) => {
  const t = Object.hasOwn(snapshot.tickets, id) ? snapshot.tickets[id] : undefined;
  if (t?.frontmatter === undefined || t.frontmatter.lane !== undefined) return [];
  return [{ file: t.file, pointer: '/lane', reason: 'gate plan applies to lane tickets; this ticket has no lane:' }];
};

export const planMissing: GateRule['check'] = (snapshot, id) => {
  if (laneTicket(snapshot, id) === undefined || workOf(snapshot, id)?.plan !== undefined) return [];
  return [{ file: planFile(id), reason: 'no plan; write ' + planFile(id) }];
};

export const planEmpty: GateRule['check'] = (snapshot, id) => {
  const plan = laneTicket(snapshot, id) === undefined ? undefined : workOf(snapshot, id)?.plan;
  if (plan === undefined || plan.tasks.length > 0) return [];
  return [{ file: plan.file, reason: 'the plan has no "## Task <n>: <title>" section' }];
};

export const taskCoversMissing: GateRule['check'] = (snapshot, id) =>
  tasksOf(snapshot, id)
    .filter((t) => t.covers.length === 0)
    .map((t) => ({
      file: planFile(id),
      line: t.line,
      reason: `task ${t.n} has no covers: line naming the criteria and decisions it serves`,
    }));

export const taskVerifyMissing: GateRule['check'] = (snapshot, id) =>
  tasksOf(snapshot, id)
    .filter((t) => t.verify.length === 0)
    .map((t) => ({
      file: planFile(id),
      line: t.line,
      reason: `task ${t.n} has no verify: line naming the report cases that prove it`,
    }));

export const acUncovered: GateRule['check'] = (snapshot, id) => {
  const t = laneTicket(snapshot, id);
  const tasks = tasksOf(snapshot, id);
  if (t === undefined || tasks.length === 0) return []; // planMissing and planEmpty own those cases
  const covered = new Set(tasks.flatMap((x) => x.covers));
  return acTags(t)
    .filter((a) => !covered.has(a))
    .map((a) => ({ file: planFile(id), reason: `${a} is covered by no task` }));
};

export const decisionUncited: GateRule['check'] = (snapshot, id) => {
  const t = laneTicket(snapshot, id);
  const tasks = tasksOf(snapshot, id);
  if (t === undefined || tasks.length === 0) return [];
  const covered = new Set(tasks.flatMap((x) => x.covers));
  return decisionIds(t)
    .filter((d) => !covered.has(d))
    .map((d) => ({ file: planFile(id), reason: `${d} is cited by no task` }));
};

export const refUnknown: GateRule['check'] = (snapshot, id) => {
  const t = laneTicket(snapshot, id);
  if (t === undefined) return [];
  const known = new Set([...acTags(t), ...decisionIds(t)]);
  return tasksOf(snapshot, id).flatMap((x) =>
    x.covers
      .filter((c) => !known.has(c))
      .map((c) => ({
        file: planFile(id),
        line: x.line,
        reason: `task ${x.n} covers "${c}", which is not a criterion or decision of ${id}`,
      })),
  );
};

/**
 * Spec §7: one finding per line, title included, naming the first deferral word on it. The `covers:`,
 * `files:` and `verify:` lines are skipped: they hold ids and paths, and `src/api/v1/x.ts` defers nothing.
 */
export const deferral: GateRule['check'] = (snapshot, id) =>
  tasksOf(snapshot, id).flatMap((x) =>
    [
      { line: x.line, text: x.title },
      ...stripHtmlComments(x.lines).filter((l) => !FIELD.test(l.text.replace(LIST_MARKER, '').trim())),
    ].flatMap((l) => {
      const m = DEFERRAL.exec(l.text);
      return m ? [{ file: planFile(id), line: l.line, reason: `task ${x.n} defers work: "${m[1]}"` }] : [];
    }),
  );
