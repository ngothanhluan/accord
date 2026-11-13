// Spec §7 plan gate: the plan of an approved lane ticket covers every criterion and decision and defers
// nothing. Mechanical only — whether the plan is good is the critic's question; this gate answers whether
// it is complete. Levels live in rules.ts (D-57).
import { fencedBlocks, headingKey, LIST_MARKER, stripHtmlComments } from '../load/sections.js';
import { FIELD, fieldLines, tokens } from '../load/work.js';
import type { PlanTask, RepoSnapshot, Ticket } from '../model/snapshot.js';
import { claimPinBefore, PLAN_FORMAT_FROM, PLAN_SIZE_FROM, pinBefore } from '../round/pin.js';
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

/** ST-LN-93 D-07: a plan may hold this many times the tasks its Intent expects. A constant, not a config.yml key. */
export const SIZE_MULTIPLE = 2;

// An anchored pattern per line, no nested quantifier. The first line of ## Intent that reads `Expected size: <N> tasks`, N a positive integer.
const SIZE_LINE = /^Expected size:\s*([1-9][0-9]*)\s+tasks?\.?$/;
// The owner's allowance, in the fixed form the round allowance Ruling of round/next.ts models; a line that does not match grants nothing.
const SIZE_ALLOWANCE = /^Ruling: the owner allows ([1-9][0-9]*) plan tasks against an expected size of ([1-9][0-9]*) tasks? — ".*\S.*" — \S/;

/** N of the `Expected size: N tasks` line under `## Intent`, comments and list marker stripped; undefined when there is no such line or N is not a positive integer. */
function expectedSize(t: Ticket): number | undefined {
  const s = t.sections.find((x) => headingKey(x.heading) === 'intent');
  if (s === undefined) return undefined;
  for (const l of stripHtmlComments(s.lines)) {
    const m = SIZE_LINE.exec(l.text.replace(LIST_MARKER, '').trim());
    const n = m === null ? NaN : Number(m[1]);
    if (Number.isSafeInteger(n)) return n;
  }
  return undefined;
}

/** The reason a plan of `tasks` tasks is too large for `expected`, or undefined when it fits or an owner Ruling of `rulings` allows it. */
export function sizeRefusal(tasks: number, expected: number, rulings: readonly string[]): string | undefined {
  if (tasks <= SIZE_MULTIPLE * expected) return undefined;
  for (const r of rulings) {
    const m = SIZE_ALLOWANCE.exec(r);
    if (m !== null && Number(m[2]) === expected && Number(m[1]) >= tasks) return undefined;
  }
  return (
    `plan.md has ${tasks} tasks, more than ${SIZE_MULTIPLE} × ${expected} (Expected size: ${expected} tasks in ## Intent); ` +
    `split the work into another ticket, or add under ## Rulings in the ledger: ` +
    `Ruling: the owner allows ${tasks} plan tasks against an expected size of ${expected} tasks — "<the owner's sentence>" — <cost if wrong>`
  );
}

/** ST-LN-93: silent unless a lane M ticket has a plan and an `Expected size:` line; gate.plan-size-missing owns the ticket without one. */
export const planSize: GateRule['check'] = (snapshot, id) => {
  const t = laneTicket(snapshot, id);
  const work = workOf(snapshot, id);
  if (t === undefined || t.frontmatter?.lane === 'S' || work?.plan === undefined) return [];
  const expected = expectedSize(t);
  if (expected === undefined) return [];
  const reason = sizeRefusal(work.plan.tasks.length, expected, work.ledger?.rulings ?? []);
  return reason === undefined ? [] : [{ file: work.plan.file, reason }];
};

/**
 * ST-LN-93 D-08: a lane M ticket with a plan and no `Expected size:` line fails from PLAN_SIZE_FROM on. The pin is the one at the
 * plan's baseline: commit (and its merge base) when the host supplied it, never the working-tree pin, which always equals the running
 * version, so an upgrade does not block a ticket already in flight; without the fact the working-tree pin is all there is.
 */
export const planSizeMissing: GateRule['check'] = (snapshot, id) => {
  const t = laneTicket(snapshot, id);
  const plan = workOf(snapshot, id)?.plan;
  // planMissing and planEmpty own a ticket with no plan or no task.
  if (t === undefined || t.frontmatter?.lane === 'S' || plan === undefined || plan.tasks.length === 0 || expectedSize(t) !== undefined) return [];
  const { pin, basePin } = Object.hasOwn(snapshot.planPins ?? {}, id) ? snapshot.planPins![id] : { pin: snapshot.config?.accord, basePin: undefined };
  if (pinBefore(PLAN_SIZE_FROM, pin, basePin)) return [];
  return [
    {
      file: t.file,
      reason:
        `## Intent has no "Expected size: <N> tasks" line; from accord ${PLAN_SIZE_FROM} gate plan needs it: ask the owner how many plan tasks ` +
        'the work should take, write the line into ## Intent, and have the Intent approved again',
    },
  ];
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

/**
 * ST-LN-91 D-09, D-15 and D-18: the tasks the plan format rules read: those of a lane ticket that is not lane S, unless its claim pin is below
 * PLAN_FORMAT_FROM (claimPinBefore: the claim commit's pin, then the merge base's, a failed read and a non-plain pin applying the rules). The plan
 * baseline pin does not decide these rules, so a plan written after an upgrade on a ticket claimed before it keeps the older format.
 */
const formatTasks = (snapshot: RepoSnapshot, id: string): PlanTask[] => {
  const t = laneTicket(snapshot, id);
  if (t === undefined || t.frontmatter?.lane === 'S' || claimPinBefore(snapshot, id, PLAN_FORMAT_FROM)) return [];
  return workOf(snapshot, id)?.plan?.tasks ?? [];
};

/** ST-LN-91 91p-ac-2: every task names the tasks it follows (`after: 1, 2`) or says `after: none`. */
export const taskAfterMissing: GateRule['check'] = (snapshot, id) =>
  formatTasks(snapshot, id)
    .filter((t) => t.after === undefined)
    .map((t) => ({
      file: planFile(id),
      line: t.line,
      reason: `task ${t.n} has no after: line naming the tasks it follows (after: 1, 2), or after: none`,
    }));

/** ST-LN-91 91p-ac-2: an `after:` token that is not a task of the plan. A self reference or a cycle is left to the wave builder (Phase 4). */
export const taskAfterUnknown: GateRule['check'] = (snapshot, id) => {
  const tasks = formatTasks(snapshot, id);
  const known = new Set(tasks.map((t) => t.n));
  return tasks.flatMap((t) =>
    t.after === undefined
      ? []
      : [...t.after.tasks.filter((n) => !known.has(n)).map(String), ...t.after.unread].map((token) => ({
          file: planFile(id),
          line: t.after!.line,
          reason: `task ${t.n} after: names ${token}, which is not a task of this plan`,
        })),
  );
};

/** ST-LN-91 D-09: a plan task holds at most this many non-blank lines, fenced lines and interfaces blocks included. A constant, not a config.yml key. */
export const TASK_LINE_CAP = 120;

/** The non-blank lines under the task's heading, as `accord brief` prints them: comment lines and fenced lines count (WR-01), so the gate measures what the executor receives. */
export const taskLength = (task: PlanTask): number => task.lines.filter((l) => l.text.trim() !== '').length;

/** ST-LN-91 91p-ac-1: a plan task says what, not how; the one block it may hold is a fence whose info string starts with the word interfaces. */
export const taskCodeBlock: GateRule['check'] = (snapshot, id) =>
  formatTasks(snapshot, id).flatMap((t) =>
    fencedBlocks(t.lines)
      .filter((f) => f.quoted === true || f.info.split(/\s+/)[0] !== 'interfaces')
      .map((f) => ({
        file: planFile(id),
        line: f.open,
        reason:
          `task ${t.n} holds a fenced code block${f.quoted === true ? ' in a blockquote' : ''} at line ${f.open}` +
          (f.info === '' ? '' : ` (${f.info})`) +
          '; a plan task says what, not how: the only block allowed is an interfaces block, a fence whose info string starts with interfaces, outside a blockquote',
      })),
  );

/** ST-LN-91 91p-ac-1: a task longer than TASK_LINE_CAP names its length. */
export const taskTooLong: GateRule['check'] = (snapshot, id) =>
  formatTasks(snapshot, id).flatMap((t) => {
    const length = taskLength(t);
    return length <= TASK_LINE_CAP
      ? []
      : [
          {
            file: planFile(id),
            line: t.line,
            reason: `task ${t.n} is ${length} non-blank lines, more than ${TASK_LINE_CAP}; a plan task says what, not how: leave the how to the executor, or split the task`,
          },
        ];
  });

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

/** D-05: a comma touching text on both sides splits one id into two; the chunk is named as written. */
export const verifyComma: GateRule['check'] = (snapshot, id) =>
  tasksOf(snapshot, id).flatMap((task) => {
    const verify = fieldLines(task.lines).verify;
    if (verify === undefined) return [];
    return verify.value
      .trim()
      .split(/\s+/)
      .filter((chunk) => /\S,\S/.test(chunk))
      .map((chunk) => ({
        file: planFile(id),
        line: verify.line,
        reason: `task ${task.n} verify id "${chunk}" holds a comma, which splits it into two ids; name the test without a comma`,
      }));
  });

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
