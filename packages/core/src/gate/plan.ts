// Spec §7 plan gate: the plan of an approved lane ticket covers every criterion and decision and defers
// nothing. Mechanical only — whether the plan is good is the critic's question; this gate answers whether
// it is complete. Levels live in rules.ts (D-57).
import { headingKey, LIST_MARKER, stripHtmlComments, taskBlocks } from '../load/sections.js';
import { UNFINISHED_MARKER } from '../load/unfinished.js';
import { sliceSplit } from '../pr/size.js';
import { FIELD, fieldLines, tokens } from '../load/work.js';
import type { Plan, PlanSlice, PlanTask, RepoSnapshot, Ticket } from '../model/snapshot.js';
import { afterCycles } from '../plan/waves.js';
import { claimPinBefore, claimPinNote, PLAN_FORMAT_FROM, PLAN_LARGE_FROM, PLAN_MODEL_FROM, PLAN_SIZE_FROM, PLAN_WAVES_FROM, pinBefore, SLICES_FROM } from '../round/pin.js';
import { isSha } from './done.js';
import type { GateRule } from './rules.js';
import { laneTicket, planFile, stageLaneTicket, workOf } from './work.js';

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

// Issue #361: a line that starts like a size line but is not in its form, so the refusal names the form instead of calling the line missing.
const SIZE_LIKE = /^expected size\s*:/i;

/** The `## Intent` lines with comments and list marker stripped, trimmed. */
function intentLines(t: Ticket): string[] {
  const s = t.sections.find((x) => headingKey(x.heading) === 'intent');
  return s === undefined ? [] : stripHtmlComments(s.lines).map((l) => l.text.replace(LIST_MARKER, '').trim());
}

/** N of the `Expected size: N tasks` line under `## Intent`, comments and list marker stripped; undefined when there is no such line or N is not a positive integer. */
function expectedSize(t: Ticket): number | undefined {
  for (const text of intentLines(t)) {
    const m = SIZE_LINE.exec(text);
    const n = m === null ? NaN : Number(m[1]);
    if (Number.isSafeInteger(n)) return n;
  }
  return undefined;
}

/** ST-LN-28 D-17: the words both the size refusal and the plan-large warning use to point at an epic. */
const SPLIT_HINT = 'split the work into an epic of smaller stories with /accord <request> (lane L)';

/** The reason a plan of `tasks` tasks is too large for `expected`, or undefined when it fits or an owner Ruling of `rulings` allows it. */
export function sizeRefusal(tasks: number, expected: number, rulings: readonly string[]): string | undefined {
  if (tasks <= SIZE_MULTIPLE * expected) return undefined;
  for (const r of rulings) {
    const m = SIZE_ALLOWANCE.exec(r);
    if (m !== null && Number(m[2]) === expected && Number(m[1]) >= tasks) return undefined;
  }
  return (
    `plan.md has ${tasks} tasks, more than ${SIZE_MULTIPLE} × ${expected} (Expected size: ${expected} tasks in ## Intent); ` +
    `${SPLIT_HINT}, or into another ticket, or add under ## Rulings in the ledger: ` +
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

/** ST-LN-28 D-17: a lane M plan of this many tasks or more is often an epic (ST-LN-44's plan reached 39 tasks). A constant, not a config.yml key. */
export const PLAN_LARGE_TASKS = 15;

/**
 * ST-LN-28 D-17: a warning on a lane M plan of PLAN_LARGE_TASKS tasks or more, naming the epic split; it fails nothing. Judged only for a ticket not claimed before PLAN_LARGE_FROM (the claim fact, or
 * the working-tree pin when there is none, and a failed claim read judges it), so no plan that exists when the rule ships gets it.
 */
export const planLarge: GateRule['check'] = (snapshot, id) => {
  const t = laneTicket(snapshot, id);
  const plan = workOf(snapshot, id)?.plan;
  if (t === undefined || t.frontmatter?.lane === 'S' || plan === undefined || plan.tasks.length < PLAN_LARGE_TASKS) return [];
  if (claimPinBefore(snapshot, id, PLAN_LARGE_FROM)) return [];
  return [
    {
      file: plan.file,
      reason: `plan.md has ${plan.tasks.length} tasks: work this size is often an epic; if it is, ${SPLIT_HINT}`,
    },
  ];
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
  const malformed = intentLines(t).find((text) => SIZE_LIKE.test(text));
  return [
    {
      file: t.file,
      reason:
        malformed === undefined
          ? `## Intent has no "Expected size: <N> tasks" line; from accord ${PLAN_SIZE_FROM} gate plan needs it: ask the owner how many plan tasks ` +
            'the work should take, write the line into ## Intent, and have the Intent approved again'
          : `## Intent line "${malformed}" is not in the form "Expected size: <N> tasks" (N a positive integer, nothing after it but an optional full stop); ` +
            'rewrite it in that form, move any other words to their own line, and have the Intent approved again',
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

/**
 * ST-LN-91 WR-04: a format rule applies to a ticket whose claim pin git could not read (fail closed), and then each finding says why: the git error and that the
 * new plan rules apply because of it. A ticket whose claim pin was read is answered as before.
 */
const withNote =
  (check: GateRule['check']): GateRule['check'] =>
  (snapshot, id) => {
    const note = claimPinNote(snapshot, id);
    const drafts = check(snapshot, id);
    return note === undefined ? drafts : drafts.map((d) => ({ ...d, reason: `${d.reason}; ${note}` }));
  };

/**
 * The plan.md of a lane ticket other than lane S (no plan) and lane R (its own plan table refuses any plan) that still carries UNFINISHED_MARKER; undefined otherwise. The one predicate for gate plan's refusal and for the Unfinished line of `accord anchor`
 * (status/anchor.ts), so the two cannot disagree on which tickets it applies to.
 */
export const unfinishedPlan = (snapshot: RepoSnapshot, id: string): Plan | undefined => {
  const plan = stageLaneTicket(snapshot, id) === undefined ? undefined : workOf(snapshot, id)?.plan;
  return plan?.unfinished === undefined ? undefined : plan;
};

/**
 * ST-LN-72 D-11: a plan.md that still carries UNFINISHED_MARKER is a plan the planner has not finished, so it never passes gate plan and never reaches a brief. Lane tickets other than lane S, whatever
 * their claim pin: the owner's decision of 2026-11-16, an exception to D-16 (only a 0.6.0 agent writes the marker, so a ticket claimed earlier cannot be refused wrongly, and exempting it would let a
 * stalled agent's half-written plan through after an upgrade). The plan stage's own switch removes the row (STAGE_OF 'plan').
 */
export const planUnfinished: GateRule['check'] = (snapshot, id) => {
  const plan = unfinishedPlan(snapshot, id);
  if (plan?.unfinished === undefined) return [];
  return [
    {
      file: plan.file,
      line: plan.unfinished,
      reason: `${plan.file} still carries the line ${UNFINISHED_MARKER}: the planner has not finished it; the plan stage resumes the planner, which removes the line as its last step`,
    },
  ];
};

const NEAR_AFTER = /^(after\s*:)/i;

/**
 * The first line of the task outside its accepted interfaces blocks (any other fence line hides nothing, ST-LN-91 group 2 round 3) that looks like the `after:` key and is not (`After:`, `after :`): the key is read in lowercase, as `covers:`,
 * `files:` and `verify:` are, so a task that wrote it another way is told which line was skipped.
 */
function skippedAfter(t: PlanTask): string {
  const { blocks } = taskBlocks(t.lines);
  for (const l of t.lines) {
    if (blocks.some((b) => l.line >= b.open && l.line <= b.close)) continue;
    const m = NEAR_AFTER.exec(l.text.replace(LIST_MARKER, '').trim());
    if (m !== null && m[1] !== 'after:') return `; line ${l.line} starts with "${m[1]}", which is not read: write the key in lowercase, as covers:, files: and verify: are`;
  }
  return '';
}

/** ST-LN-91 91p-ac-2: every task names the tasks it follows (`after: 1, 2`) or says `after: none`. */
export const taskAfterMissing: GateRule['check'] = withNote((snapshot, id) =>
  formatTasks(snapshot, id)
    .filter((t) => t.after === undefined)
    .map((t) => ({
      file: planFile(id),
      line: t.line,
      reason: `task ${t.n} has no after: line naming the tasks it follows (after: 1, 2), or after: none${skippedAfter(t)}`,
    })),
);

/** ST-LN-91 91p-ac-2: an `after:` token that is not a task of the plan. A self reference or a cycle is taskAfterCycle's (ST-LN-92). */
export const taskAfterUnknown: GateRule['check'] = withNote((snapshot, id) => {
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
});

/**
 * ST-LN-92 cycle Ruling and D-16: the tasks the after: cycle rule reads: those of a lane ticket that is not lane S, unless its claim pin is below PLAN_WAVES_FROM (claimPinBefore: a
 * failed read and a non-plain pin apply the rule). Its own reader, as modelTasks is for the model-file rules, so a ticket claimed before the release answers as before.
 */
const wavesTasks = (snapshot: RepoSnapshot, id: string): PlanTask[] => {
  const t = laneTicket(snapshot, id);
  if (t === undefined || t.frontmatter?.lane === 'S' || claimPinBefore(snapshot, id, PLAN_WAVES_FROM)) return [];
  return workOf(snapshot, id)?.plan?.tasks ?? [];
};

/**
 * ST-LN-92 92-ac-1: a task whose `after:` line names itself, or tasks whose `after:` lines name each other, so no wave order can meet them. One finding per cycle, at the
 * `after:` line of its lowest task. It reads afterCycles, the same reading the wave builder falls back on, so `accord waves` and gate plan answer a cycle alike. It reads
 * no config.runtimes: a CLI check holds in all four tools (D-18).
 */
export const taskAfterCycle: GateRule['check'] = withNote((snapshot, id) => {
  const tasks = wavesTasks(snapshot, id);
  const lineOf = new Map(tasks.map((t) => [t.n, t.after?.line ?? t.line]));
  return afterCycles(tasks).map((cycle) => ({
    file: planFile(id),
    line: lineOf.get(cycle[0])!,
    reason:
      cycle.length === 1
        ? `task ${cycle[0]} after: names itself`
        : `tasks ${cycle.join(', ')} name each other in their after: lines, a cycle no wave order can meet`,
  }));
});

/** ST-LN-91 D-09: a plan task holds at most this many non-blank lines, fenced lines and interfaces blocks included. A constant, not a config.yml key. */
export const TASK_LINE_CAP = 120;

/** The non-blank lines under the task's heading, as `accord brief` prints them: comment lines and fenced lines count (WR-01), so the gate measures what the executor receives. */
export const taskLength = (task: PlanTask): number => task.lines.filter((l) => l.text.trim() !== '').length;

/** The one form a plan task's interfaces block may take (ST-LN-91 D-09, group 2 round 3), as each refusal says it. */
const ONE_FORM =
  'a plan task says what, not how: the only block it may hold is an interfaces block, opened by a line that is exactly ```interfaces at column 0 and closed by the first line that is exactly ``` at column 0; ' +
  'no other line may start with three backticks or tildes, even after spaces, tabs, > or a list marker, inside the block or out';

/** ST-LN-91 91p-ac-1: a plan task says what, not how; it holds interfaces blocks only in the one form, and each other fence-like line is refused at its own line. */
export const taskCodeBlock: GateRule['check'] = withNote((snapshot, id) =>
  formatTasks(snapshot, id).flatMap((t) =>
    taskBlocks(t.lines).refused.map((f) => ({
      file: planFile(id),
      line: f.line,
      reason:
        (f.kind === 'unclosed'
          ? `task ${t.n} opens an interfaces block at line ${f.line} that no line closes`
          : `task ${t.n} holds a fence line at line ${f.line}` +
            (f.info === '' ? '' : ` (${f.info})`) +
            (f.quoted ? ' in a blockquote' : '') +
            (f.from === undefined ? '' : ` inside the interfaces block opened at line ${f.from}`)) +
        '; ' +
        ONE_FORM,
    })),
  ),
);

/** ST-LN-91 91p-ac-1: a task longer than TASK_LINE_CAP names its length. */
export const taskTooLong: GateRule['check'] = withNote((snapshot, id) =>
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
  }),
);

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

/**
 * ST-LN-10 D-12 and D-16: the tasks the model-file rules read: those of a lane ticket that is not lane S, unless its claim pin is below PLAN_MODEL_FROM (claimPinBefore: a failed read
 * and a non-plain pin apply the rules). Its own reader, as formatTasks is for the plan format rules, so a ticket claimed before the release keeps its bare `(new)`.
 */
const modelTasks = (snapshot: RepoSnapshot, id: string): PlanTask[] => {
  const t = laneTicket(snapshot, id);
  if (t === undefined || t.frontmatter?.lane === 'S' || claimPinBefore(snapshot, id, PLAN_MODEL_FROM)) return [];
  return workOf(snapshot, id)?.plan?.tasks ?? [];
};

/** ST-LN-10 10-ac-1: a new path names no model file: it is a bare `(new)`, or its clause is neither `(new, like <path>)` nor `(new, no model: <reason>)`. */
export const taskModelMissing: GateRule['check'] = withNote((snapshot, id) =>
  modelTasks(snapshot, id).flatMap((t) =>
    t.models.flatMap((m) =>
      m.like !== undefined || m.none !== undefined
        ? []
        : [
            {
              file: planFile(id),
              line: t.line,
              reason:
                m.unread === undefined
                  ? `task ${t.n} creates ${m.path} with no model file: write ${m.path} (new, like <an existing file to model it on>), or ${m.path} (new, no model: <why no file of its kind exists>)`
                  : `task ${t.n} marks ${m.path} with "${m.unread}", which is not read: write (new, like <path>) or (new, no model: <reason>)`,
            },
          ],
    ),
  ),
);

/**
 * ST-LN-10 10-ac-1: a model file that does not exist at the plan baseline. Only when the host supplied the baseline's files, as taskFileUnknown. A model the plan itself creates, and a path that
 * names itself, are not at the baseline either, so they are refused here.
 */
export const taskModelUnknown: GateRule['check'] = withNote((snapshot, id) => {
  const sha = planOf(snapshot, id)?.baseline;
  if (sha === undefined || snapshot.baselineFiles === undefined || !Object.hasOwn(snapshot.baselineFiles, sha)) return [];
  const exist = new Set(snapshot.baselineFiles[sha]);
  return modelTasks(snapshot, id).flatMap((t) =>
    t.models.flatMap((m) =>
      m.like === undefined || exist.has(m.like)
        ? []
        : [
            {
              file: planFile(id),
              line: t.line,
              reason: `task ${t.n} models ${m.path} on ${m.like}, which does not exist at baseline ${sha}; name a file that exists at the baseline, or write (new, no model: <reason>)`,
            },
          ],
    ),
  );
});

export const acUncovered: GateRule['check'] = (snapshot, id) => {
  const t = laneTicket(snapshot, id);
  const tasks = tasksOf(snapshot, id);
  if (t === undefined || tasks.length === 0) return []; // planMissing and planEmpty own those cases
  const covered = new Set(tasks.flatMap((x) => x.covers));
  return acTags(t)
    .filter((a) => !covered.has(a))
    .map((a) => ({ file: planFile(id), reason: `${a} is covered by no task` }));
};

/**
 * Phase 15 D-09: the slices a slice rule reads: those of a lane ticket that is not lane S whose plan holds a `## Slice` section, unless its claim pin is below SLICES_FROM (claimPinBefore: a failed
 * read and a non-plain pin apply the rules). Its own reader, as wavesTasks is for the wave rules, so a ticket claimed before the release, and a plan with no slice, answer as before.
 */
const slicesOf = (snapshot: RepoSnapshot, id: string): { plan: Plan; slices: PlanSlice[] } | undefined => {
  const t = laneTicket(snapshot, id);
  const plan = workOf(snapshot, id)?.plan;
  if (t === undefined || t.frontmatter?.lane === 'S' || plan?.slices === undefined || claimPinBefore(snapshot, id, SLICES_FROM)) return undefined;
  return { plan, slices: plan.slices };
};

/** Phase 15 D-03: a plan of more than this many slices gets the warning gate.slice-many. A constant, not a config.yml key. */
export const SLICES_MANY = 3;

/** Phase 15 D-06: the lines added plus deleted of code, tests, docs and skills a reviewer reads in one slice, when `review.slice_lines` is not set. */
export const SLICE_LINES_DEFAULT = 1000;

/** `1`, `1 and 2`, `1, 2 and 3`. */
const andList = (xs: number[]): string => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/**
 * Phase 15 D-09: every task of the plan is in exactly one slice, every task a slice names is a task of the plan, a slice names at least one task, and the slices are numbered 1 to N without a gap.
 * One finding per fault, at the slice heading or the task heading.
 */
export const sliceTasks: GateRule['check'] = withNote((snapshot, id) => {
  const read = slicesOf(snapshot, id);
  if (read === undefined) return [];
  const { plan, slices } = read;
  const file = planFile(id);
  const known = new Set(plan.tasks.map((t) => t.n));
  const out: { file: string; line?: number; reason: string }[] = [];
  const numbers = slices.map((s) => s.n).sort((a, b) => a - b);
  if (numbers.some((n, i) => n !== i + 1)) {
    out.push({ file, line: slices[0].line, reason: `slices are numbered ${numbers.join(', ')}; number them 1 to ${numbers.length} with no gap` });
  }
  for (const s of slices) {
    if (s.tasks.length === 0) out.push({ file, line: s.line, reason: `slice ${s.n} names no task on its tasks: line (tasks: 1, 2)` });
    for (const n of new Set(s.tasks)) {
      if (!known.has(n)) out.push({ file, line: s.line, reason: `slice ${s.n} names task ${n}, which is not a task of this plan` });
      else if (s.tasks.filter((x) => x === n).length > 1) out.push({ file, line: s.line, reason: `slice ${s.n} names task ${n} twice` });
    }
  }
  for (const t of plan.tasks) {
    const holding = slices.filter((s) => s.tasks.includes(t.n)).map((s) => s.n);
    if (holding.length === 0) out.push({ file, line: t.line, reason: `task ${t.n} is in no slice: name it on the tasks: line of the slice that builds it` });
    else if (holding.length > 1) out.push({ file, line: t.line, reason: `task ${t.n} is in slices ${andList(holding)}: name it in one slice` });
  }
  return out;
});

/** Phase 15 D-09: a slice delivers at least one criterion, and each criterion its covers: line names is covered by one of its own tasks. */
export const sliceAcMissing: GateRule['check'] = withNote((snapshot, id) => {
  const read = slicesOf(snapshot, id);
  if (read === undefined) return [];
  const { plan, slices } = read;
  return slices.flatMap((s) => {
    const delivered = s.covers.filter((c) => c.startsWith('@'));
    if (delivered.length === 0) {
      return [{ file: planFile(id), line: s.line, reason: `slice ${s.n} delivers no criterion: its covers: line names the criteria it delivers (covers: @ac-1)` }];
    }
    const covered = new Set(plan.tasks.filter((t) => s.tasks.includes(t.n)).flatMap((t) => t.covers));
    return delivered
      .filter((a) => !covered.has(a))
      .map((a) => ({ file: planFile(id), line: s.line, reason: `slice ${s.n} covers ${a}, which none of its tasks covers` }));
  });
});

/** Phase 15 D-09: a task never follows (`after:`) a task of a later slice, because slices merge in order; a task in no slice or in two is sliceTasks'. */
export const sliceOrder: GateRule['check'] = withNote((snapshot, id) => {
  const read = slicesOf(snapshot, id);
  if (read === undefined) return [];
  const { plan, slices } = read;
  const sliceOf = new Map<number, number>();
  for (const t of plan.tasks) {
    const holding = slices.filter((s) => s.tasks.includes(t.n));
    if (holding.length === 1) sliceOf.set(t.n, holding[0].n);
  }
  return plan.tasks.flatMap((t) =>
    (t.after?.tasks ?? []).flatMap((u) => {
      const mine = sliceOf.get(t.n);
      const theirs = sliceOf.get(u);
      return mine === undefined || theirs === undefined || theirs <= mine
        ? []
        : [
            {
              file: planFile(id),
              line: t.after!.line,
              reason: `task ${t.n} (slice ${mine}) follows task ${u}, which is in slice ${theirs}: slices merge in order, so move task ${t.n} to slice ${theirs} or later`,
            },
          ];
    }),
  );
});

/** Phase 15 D-03: a warning on a plan of more than SLICES_MANY slices, naming the epic split; it fails nothing. */
export const sliceMany: GateRule['check'] = (snapshot, id) => {
  const read = slicesOf(snapshot, id);
  if (read === undefined || read.slices.length <= SLICES_MANY) return [];
  return [{ file: read.plan.file, reason: `plan.md has ${read.slices.length} slices: work this size is often an epic; if it is, ${SPLIT_HINT}` }];
};

/** The review budget of a slice in lines: `review.slice_lines` when it reads as a positive whole number, else SLICE_LINES_DEFAULT. */
export const sliceBudget = (snapshot: RepoSnapshot): number => {
  const n = Number(snapshot.config?.review?.slice_lines);
  return Number.isSafeInteger(n) && n > 0 ? n : SLICE_LINES_DEFAULT;
};

/** Phase 15 D-06: a warning on a slice whose estimate (lines added plus deleted of code, tests, docs and skills) is over the review budget; it shows the split and fails nothing. */
export const sliceLarge: GateRule['check'] = (snapshot, id) => {
  const read = slicesOf(snapshot, id);
  if (read === undefined) return [];
  const budget = sliceBudget(snapshot);
  return read.slices.flatMap((s) => {
    const parts = (['code', 'test', 'docs'] as const).flatMap((k) => (s.estimate?.[k] === undefined ? [] : [`${k} ${s.estimate[k]}`]));
    const total = (s.estimate?.code ?? 0) + (s.estimate?.test ?? 0) + (s.estimate?.docs ?? 0);
    // Review B-WR-05: an estimate token that does not read adds nothing to the total, so a typo would dodge the budget; it is said next to the size, which is judged on what did read.
    const typo =
      s.estimateUnread === undefined
        ? []
        : [{ file: read.plan.file, line: s.line, reason: `slice ${s.n} has an estimate that does not read: ${s.estimateUnread.map((t) => JSON.stringify(t)).join(', ')} (write estimate: code 300, test 600, docs 150)` }];
    return total <= budget
      ? typo
      : [...typo, { file: read.plan.file, line: s.line, reason: `slice ${s.n} is about ${total} lines (${parts.join(', ')}), over the review budget of ${budget}` }];
  });
};

/**
 * Phase 15 D-06, SC-3: a warning at Done when the slice `gate done --slice n` judged measures more lines (added plus deleted: code, tests, docs and skills, ticket records, rendered copies and lockfiles left
 * out) than the review budget. The measurement is the host's (`snapshot.sliceSize`, loaded only for a `--slice` run); without it, for a ticket claimed before SLICES_FROM, or for a lane S ticket
 * (its own Done table never holds this rule) nothing is said. It shows the split and fails nothing.
 */
export const sliceDiffLarge: GateRule['check'] = (snapshot, id) => {
  const size = snapshot.sliceSize !== undefined && Object.hasOwn(snapshot.sliceSize, id) ? snapshot.sliceSize[id] : undefined;
  if (size === undefined || laneTicket(snapshot, id) === undefined || claimPinBefore(snapshot, id, SLICES_FROM)) return [];
  const budget = sliceBudget(snapshot);
  if (size.total <= budget) return [];
  return [{ file: workOf(snapshot, id)?.plan?.file ?? planFile(id), reason: `slice ${size.n} is ${size.total} lines (${sliceSplit(size)}), over the review budget of ${budget}` }];
};

/** Phase 15 D-09, T-15-29: a criterion of the ticket that no slice's `covers:` line names, so a slice pull request could pass without it. */
export const sliceAcUncovered: GateRule['check'] = withNote((snapshot, id) => {
  const t = laneTicket(snapshot, id);
  const read = slicesOf(snapshot, id);
  if (t === undefined || read === undefined) return [];
  const delivered = new Set(read.slices.flatMap((s) => s.covers));
  return acTags(t)
    .filter((a) => !delivered.has(a))
    .map((a) => ({ file: planFile(id), reason: `${a} is delivered by no slice: name it on the covers: line of the slice that delivers it` }));
});

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
