// Spec §7 plan gate: the plan of an approved lane ticket covers every criterion and decision and defers
// nothing. Mechanical only — whether the plan is good is the critic's question; this gate answers whether
// it is complete. Levels live in rules.ts (D-57).
import { headingKey, LIST_MARKER, stripHtmlComments } from '../load/sections.js';
import { FIELD, fieldLines, tokens } from '../load/work.js';
import type { PlanTask, RepoSnapshot, Ticket } from '../model/snapshot.js';
import { isSha } from './done.js';
import type { GateRule } from './rules.js';
import { laneTicket, planFile, workOf } from './work.js';

const DECISION = /^(D-[0-9]+)\b/;
// Letter-or-digit boundaries on both sides: `v10` and `laterally` are not deferrals, `v1.` and `later.` are.
const DEFERRAL = /(?<![\p{L}\p{N}])(TODO|TBD|placeholder|v1|for now|later)(?![\p{L}\p{N}])/iu;
// A field holds ids and paths: only a token, or the whole value, that IS a deferral word defers work.
const DEFERRAL_TOKEN = /^(TODO|TBD|placeholder|v1|for now|later)$/iu;

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

const planOf = (snapshot: RepoSnapshot, id: string) =>
  laneTicket(snapshot, id) === undefined ? undefined : workOf(snapshot, id)?.plan;

export const planBaselineMissing: GateRule['check'] = (snapshot, id) => {
  const plan = planOf(snapshot, id);
  if (plan === undefined || (plan.baseline !== undefined && isSha(plan.baseline))) return [];
  return [
    {
      file: plan.file,
      reason: 'plan.md has no baseline:; write the commit the plan was written against (git rev-parse HEAD) into its frontmatter',
    },
  ];
};

/** Spec §7: only when the host supplied ancestry facts; pure callers without a repository skip it, like `git?`. */
export const planBaselineUnknown: GateRule['check'] = (snapshot, id) => {
  const plan = planOf(snapshot, id);
  const sha = plan?.baseline;
  if (plan === undefined || sha === undefined || !isSha(sha) || snapshot.ancestors === undefined) return [];
  if (Object.hasOwn(snapshot.ancestors, sha) && snapshot.ancestors[sha]) return [];
  return [{ file: plan.file, reason: `baseline ${sha} is not a commit on the history of HEAD` }];
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

/** Spec §7: only when the host supplied the baseline's files; the baseline rules own a missing or unknown baseline. */
export const taskFileUnknown: GateRule['check'] = (snapshot, id) => {
  const sha = planOf(snapshot, id)?.baseline;
  if (sha === undefined || snapshot.baselineFiles === undefined || !Object.hasOwn(snapshot.baselineFiles, sha)) return [];
  const exist = new Set(snapshot.baselineFiles[sha]);
  return tasksOf(snapshot, id).flatMap((t) =>
    t.files
      .filter((f) => !t.newFiles.includes(f) && !exist.has(f))
      .map((f) => ({
        file: planFile(id),
        line: t.line,
        reason: `task ${t.n} names ${f}, which does not exist at baseline ${sha}; correct the path, or write (new) after it if the task creates it`,
      })),
  );
};

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

const uiTags = (t: Ticket): Set<string> =>
  new Set(t.scenarios.flatMap((s) => (s.acTag !== undefined && s.tags.includes('@ui') ? ['@' + s.acTag] : [])));
const mapsOf = (snapshot: RepoSnapshot, id: string) => tasksOf(snapshot, id).flatMap((x) => x.maps);

export const testUnmapped: GateRule['check'] = (snapshot, id) => {
  const t = laneTicket(snapshot, id);
  const tasks = tasksOf(snapshot, id);
  if (t === undefined || tasks.length === 0) return [];
  const mapped = new Set(mapsOf(snapshot, id).map((m) => m.ac));
  const ui = uiTags(t);
  return acTags(t)
    .filter((a) => !ui.has(a) && !mapped.has(a))
    .map((a) => ({ file: planFile(id), reason: `${a} is mapped to no test; write (${a}) after the verify id that proves it` }));
};

export const testRepeated: GateRule['check'] = (snapshot, id) => {
  if (laneTicket(snapshot, id) === undefined) return [];
  const maps = mapsOf(snapshot, id);
  return [...new Set(maps.map((m) => m.ac))].flatMap((a) => {
    const tests = maps.filter((m) => m.ac === a).map((m) => m.test);
    return tests.length < 2
      ? []
      : [{ file: planFile(id), reason: `${a} is mapped more than once: ${tests.join(', ')}` }];
  });
};

export const mapInvalid: GateRule['check'] = (snapshot, id) => {
  const t = laneTicket(snapshot, id);
  if (t === undefined) return [];
  const known = new Set(acTags(t));
  const ui = uiTags(t);
  return tasksOf(snapshot, id).flatMap((x) =>
    x.maps.flatMap((m) => {
      const why = !known.has(m.ac)
        ? `which is not a scenario of ${id}`
        : ui.has(m.ac)
          ? 'a @ui scenario; a @ui scenario carries no @test tag'
          : undefined;
      return why === undefined
        ? []
        : [{ file: planFile(id), line: x.line, reason: `task ${x.n} maps ${m.test} to ${m.ac}, ${why}` }];
    }),
  );
};

/**
 * Spec §7: one finding per line, title included, naming the first deferral word on it. A `covers:`,
 * `files:` or `verify:` line is matched token by token, so `files: TBD` defers and `src/later.ts` does not.
 */
const deferred = (text: string): string | undefined => {
  const f = FIELD.exec(text.replace(LIST_MARKER, '').trim());
  if (f === null) return DEFERRAL.exec(text)?.[1];
  return [f[2].trim(), ...tokens(f[2])].find((t) => DEFERRAL_TOKEN.test(t));
};

export const deferral: GateRule['check'] = (snapshot, id) =>
  tasksOf(snapshot, id).flatMap((x) =>
    [
      { line: x.line, word: DEFERRAL.exec(x.title)?.[1] },
      ...stripHtmlComments(x.lines).map((l) => ({ line: l.line, word: deferred(l.text) })),
    ].flatMap(({ line, word }) =>
      word === undefined ? [] : [{ file: planFile(id), line, reason: `task ${x.n} defers work: "${word}"` }],
    ),
  );

/** An `@` in a verify id splits its `@test:` tag; the `(@ac-n)` marker never reaches `verify`. */
export const verifyAt: GateRule['check'] = (snapshot, id) =>
  tasksOf(snapshot, id).flatMap((task) =>
    task.verify
      .filter((verifyId) => verifyId.includes('@'))
      .map((verifyId) => ({
        file: planFile(id),
        line: fieldLines(task.lines).verify?.line ?? task.line,
        reason: `task ${task.n} verify id "${verifyId}" holds @, which splits its @test: tag; name the test and its path without @`,
      })),
  );

/** D-03..D-06: a warning that asks; the question is answered only at the plan stage's baseline tests step. */
export const testsBaselineMissing: GateRule['check'] = (snapshot, id) => {
  if (laneTicket(snapshot, id) === undefined) return [];
  if (snapshot.config?.tests?.report === undefined || snapshot.testsBaseline !== undefined) return [];
  return [
    {
      file: 'accord/tests-baseline.txt',
      reason:
        "accord/tests-baseline.txt does not exist, so every test case already in the suite counts as untraced at the Done gate; ask the owner, at the plan stage's baseline tests step and never before it, whether to run accord tests baseline",
    },
  ];
};
