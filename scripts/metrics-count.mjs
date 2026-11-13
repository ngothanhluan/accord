// Pure logic of the workflow metrics (ST-LN-95): the 2026-11-02 study's counting rule for round records, and the report's Markdown and JSON.
// Imports nothing, reads no file, spawns nothing (the house pattern of plan-review.mjs and round.mjs).

// A record splits into cycles at these lines; the line itself belongs to no round.
const SEPARATOR = { approach: /^## Closed\b/, plan: /^## Closed\b/, review: /^## Return from verify\b/ };
// A `## Round ` line opens a section; only a numbered one is a round, so the findings of any other belong to none.
const ROUND = /^## Round ([1-9][0-9]*)/;
// A finding: Must, Should or Nice first on its line, after an optional list marker, number and bold (research Pattern 1).
const FINDING = /^\s*(?:[-*+]\s+)?(?:\d+[.)]\s*)?\**(Must|Should|Nice)\b/;
// The fences accord's own parser knows (packages/core/src/load/sections.ts): ``` or ~~~, closed by the same character, at least as long.
const FENCE_OPEN = /^(`{3,}|~{3,})(.*)$/;
const FENCE_CLOSE = /^(`{3,}|~{3,})\s*$/;

export const STAGES = ['approach', 'plan', 'review'];
export const BUCKETS = ['1', '2', '3', '4', '5+'];

/** The lines of `text` outside fenced code blocks, CRLF read as LF. Fence lines are left out too. */
function unfenced(text) {
  const out = [];
  let fence;
  for (const line of String(text).replace(/\r\n/g, '\n').split('\n')) {
    if (fence !== undefined) {
      const close = FENCE_CLOSE.exec(line);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) fence = undefined;
      continue;
    }
    const open = FENCE_OPEN.exec(line);
    // CommonMark: a backtick fence's info string may not contain a backtick.
    if (open && !(open[1][0] === '`' && open[2].includes('`'))) {
      fence = open[1];
      continue;
    }
    out.push(line);
  }
  return out;
}

/**
 * The cycles of one record, by the study's rule: a cycle ends at each separator line; a finding counts in the round
 * whose `## Round <n>` heading is above it, `n` taken from the heading, not from the heading's position. Cycles with
 * no round are left out. Returns `[{ max, rounds: [{ n, Must, Should, Nice }] }]` in record order.
 */
export function countRecord(text, kind) {
  const separator = SEPARATOR[kind];
  if (separator === undefined) throw new Error(`unknown record kind: ${kind}`);
  const cycles = [];
  let rounds = [];
  let round;
  const close = () => {
    if (rounds.length) cycles.push({ max: Math.max(...rounds.map((r) => r.n)), rounds });
    rounds = [];
    round = undefined;
  };
  for (const line of unfenced(text)) {
    if (separator.test(line)) {
      close();
      continue;
    }
    if (line.startsWith('## Round ')) {
      const h = ROUND.exec(line);
      round = h ? { n: Number(h[1]), Must: 0, Should: 0, Nice: 0 } : undefined;
      if (round) rounds.push(round);
      continue;
    }
    const f = FINDING.exec(line);
    if (f && round) round[f[1]]++;
  }
  close();
  return cycles;
}

/**
 * One stage's table: rounds run at r is the number of cycles whose highest round is r or more; the 5+ row sums
 * r = 5 up to the highest round and holds the findings of rounds 5 and later. perRound is (Must + Should) / rounds
 * run with one decimal, '0.0' when no round ran.
 */
export function stageTable(cycles) {
  const byRound = BUCKETS.map((round) => ({ round, run: 0, must: 0, should: 0, nice: 0, perRound: '0.0' }));
  const row = (n) => byRound[Math.min(n, 5) - 1];
  for (const c of cycles) {
    for (let r = 1; r <= c.max; r++) row(r).run++;
    for (const x of c.rounds) {
      const at = row(x.n);
      at.must += x.Must;
      at.should += x.Should;
      at.nice += x.Nice;
    }
  }
  for (const r of byRound) r.perRound = r.run ? ((r.must + r.should) / r.run).toFixed(1) : '0.0';
  return { cycles: cycles.length, byRound };
}

// ---- critic and planner runs (study §2) ---------------------------------------------------------------------
// The 2026-10-30 study's weights (D-03): fresh x1, cache-write x1.25, cache-read x0.1, output x5; model prices ignored.
export const WEIGHTS = { input: 1, cacheWrite: 1.25, cacheRead: 0.1, output: 5 };

/** One run's weighted tokens, rounded to a whole token before any sum or median. */
export const weighted = (u) =>
  Math.round(u.input * WEIGHTS.input + u.cacheWrite * WEIGHTS.cacheWrite + u.cacheRead * WEIGHTS.cacheRead + u.output * WEIGHTS.output);

/** Median of whole numbers: an even count gives the mean of the two middle values, rounded. */
export function median(values) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

// The report prints the classes in this order.
export const CLASSES = [
  'critic: plan round 1, lens criteria',
  'critic: plan round 1, lens build',
  'critic: plan round 1, lens security',
  'critic: plan round 1, no lens',
  'critic: plan later, whole',
  'critic: plan later, diff',
  'critic: approach, first',
  'critic: approach, later',
  'critic: mode not recognised',
  'planner: writing',
  'planner: fix',
];
const MODE = /\bmode[:\s]+`?(approach|plan|diff)\b/i;
const LENS = /\blens[:\s]+`?(criteria|build|security)\b/i;

/**
 * The class of a run read by benchmark.mjs's readSessions, or undefined when the report leaves it out. As the study:
 * a critic's mode and lens come from its dispatch prompt, and it is "later" when the prompt names plan-review.md or
 * approach-review.md or its mode is diff; a planner (or the older accord-architect) is a fix run when its dispatch
 * description says fix. A run described `bench …` is a benchmark arm, not work.
 */
export function classifyRun(run) {
  if (String(run.desc ?? '').startsWith('bench ')) return undefined;
  if (run.agent === 'accord-planner' || run.agent === 'accord-architect') return run.fix ? 'planner: fix' : 'planner: writing';
  if (run.agent !== 'accord-critic') return undefined;
  const prompt = String(run.dispatch?.prompt ?? '');
  const mode = MODE.exec(prompt)?.[1].toLowerCase();
  const lens = LENS.exec(prompt)?.[1].toLowerCase();
  const later = /plan-review\.md|approach-review\.md/.test(prompt) || mode === 'diff';
  if (mode === 'approach') return later ? 'critic: approach, later' : 'critic: approach, first';
  if (mode === 'diff') return 'critic: plan later, diff';
  if (mode === 'plan') return later ? 'critic: plan later, whole' : `critic: plan round 1, ${lens ? `lens ${lens}` : 'no lens'}`;
  return 'critic: mode not recognised';
}

/** One row per class with at least one run, in CLASSES order. `runs` carry `weighted`, `peak` and `ms`. */
export function runTable(runs) {
  return CLASSES.map((name) => {
    const mine = runs.filter((r) => r.class === name);
    if (!mine.length) return undefined;
    return {
      class: name,
      runs: mine.length,
      weightedMtok: (mine.reduce((sum, r) => sum + r.weighted, 0) / 1e6).toFixed(1),
      medianWeightedK: Math.round(median(mine.map((r) => r.weighted)) / 1000),
      medianPeakK: Math.round(median(mine.map((r) => r.peak)) / 1000),
      medianMinutes: (median(mine.map((r) => r.ms)) / 60000).toFixed(1),
    };
  }).filter(Boolean);
}

const NOT = 'not measured';
const TITLE = { approach: 'Approach', plan: 'Plan', review: 'Review' };

/** The report in a fixed key order, so two runs on the same inputs give the same bytes. Runs keep numbers, ids and relative paths only. */
function ordered(report) {
  const stage = (s) => ({
    records: s.records,
    cycles: s.cycles,
    byRound: s.byRound.map((r) => ({ round: r.round, run: r.run, must: r.must, should: r.should, nice: r.nice, perRound: r.perRound })),
  });
  const runs = report.runs ?? [];
  return {
    label: report.label,
    commit: report.commit,
    date: report.date,
    stages: Object.fromEntries(STAGES.map((k) => [k, stage(report.stages[k])])),
    transcripts: { measured: runs.length > 0, folders: [...report.transcripts.folders], runs: runs.length },
    runs: runs.map((r) => ({ file: r.file, ticket: r.ticket, class: r.class, weighted: r.weighted, peak: r.peak, minutes: Number((r.ms / 60000).toFixed(1)) })),
    // ST-LN-93 D-05, only with --plan-size: the key is absent otherwise, so the default report keeps its bytes.
    ...(report.planSize === undefined
      ? {}
      : {
          planSize: {
            plans: report.planSize.plans,
            refused: report.planSize.refused.map((x) => ({ ticket: x.ticket, tasks: x.tasks, expected: x.expected })),
            noCriteria: [...report.planSize.noCriteria],
          },
        }),
    // ST-LN-91 D-09, only with --plan-format: the key is absent otherwise.
    ...(report.planFormat === undefined ? {} : { planFormat: { ...report.planFormat, lengths: { ...report.planFormat.lengths } } }),
  };
}

/** The `## Plan size (D-05)` section: the stand-in sentence, the counts, the refused plans, the plans with no criteria. */
function planSizeSection(report) {
  const p = report.planSize;
  const refused = [...p.refused].sort((a, b) => (a.ticket < b.ticket ? -1 : a.ticket > b.ticket ? 1 : 0));
  const out = [
    '## Plan size (D-05)',
    '',
    'Old tickets state no expected size, so the stand-in N is the ticket\'s number of distinct @ac-n criteria. The count shows how the size rule would bite today\'s plans, not how owners would have sized their tickets. Each plan is checked by core\'s own `sizeRefusal` over core\'s own plan parse, with no owner Ruling.',
    '',
    `Plans counted: ${p.plans}`,
    `Refused at more than 2 × N tasks: ${refused.length} of ${p.plans}`,
    '',
  ];
  if (refused.length) {
    out.push('| Ticket | Tasks | N |', '|---|---:|---:|');
    for (const x of refused) out.push(`| ${x.ticket} | ${x.tasks} | ${x.expected} |`);
    out.push('');
  }
  out.push(`No criteria, not counted: ${p.noCriteria.length ? p.noCriteria.join(', ') : 'none'}`);
  if (report.planSize.files !== undefined) out.push(`Plan files in the commit: ${report.planSize.files}`);
  out.push('');
  return out;
}

/** The `## Plan format (ST-LN-91 D-09)` section: the cap line first, then the fence and after: counts and the task length distribution. */
function planFormatSection(report) {
  const p = report.planFormat;
  const out = [
    '## Plan format (ST-LN-91 D-09)',
    '',
    `Task length cap: ${p.cap} non-blank lines; refuses ${p.tasksOver} of ${p.tasks} tasks in ${p.plansOver} of ${p.plans} plans`,
    '',
    "Each plan is read by core's own loadSnapshot; a task is measured with core's own `taskLength` (non-blank lines under its heading, comments outside fences left out, fenced lines counted) against `TASK_LINE_CAP`. The fence and after: counts are the findings of core's own `gatePlan` with every ticket at the pin the format rules read, so this report and the gate cannot disagree. Only lane tickets other than S with a plan are counted.",
    '',
    `Plans with a fenced block other than interfaces: ${p.plansFenced} of ${p.plans}`,
    `Tasks with a fenced block other than interfaces: ${p.tasksFenced} of ${p.tasks}`,
    `Plans with a task lacking after:: ${p.plansAfterless} of ${p.plans}`,
    '',
    'Task length in non-blank lines (nearest rank):',
    '',
    '| p50 | p90 | p95 | max |',
    '|---:|---:|---:|---:|',
    `| ${p.lengths.p50} | ${p.lengths.p90} | ${p.lengths.p95} | ${p.lengths.max} |`,
    '',
  ];
  if (p.files !== undefined) out.push(`Plan files in the commit: ${p.files}`, '');
  return out;
}

export function renderJson(report) {
  return JSON.stringify(ordered(report), null, 2) + '\n';
}

export function renderMarkdown(report) {
  const r = ordered(report);
  const out = [
    `# Workflow metrics at ${r.label}`,
    '',
    `Commit: ${r.commit} (${r.date})`,
    '',
    '## Method',
    '',
    '- Records: every `accord/tickets/<id>/approach-review.md`, `plan-review.md` and `review.md` in the commit, read from git, not from the working tree.',
    '- Counting rule of the 2026-11-02 study (`accord/research/2026-11-02-critic-loop-practice.md` §1): a record splits into cycles at each `## Closed` line (approach, plan) or `## Return from verify` line (review); a finding is a line that starts with Must, Should or Nice (after an optional list marker or number), `repeats` findings and Nice included, and it counts in the round of the `## Round <n>` heading above it, `n` read from the heading. Rounds run at r is the number of cycles whose highest round is r or more; the 5+ row sums r = 5 up to the highest round and holds the findings of rounds 5 and later. Must + Should per round is (Must + Should) / rounds run.',
    '- Lines inside fenced code blocks (``` or ~~~) are left out, as accord\'s own record parser does.',
    '- At 2266d21f this rule gives every row of the study\'s plan table exactly, though it counts 47 plan cycles where the study\'s text says 45. Its review counts there (65 cycles, 487 findings) differ from the study\'s 63 cycles and 481 findings, because the study\'s review regex was not kept; the rule is not tuned toward those figures.',
    '',
  ];
  for (const k of STAGES) {
    const s = r.stages[k];
    out.push(`## ${TITLE[k]}`, '', `Records: ${s.records}`, `Cycles: ${s.cycles}`, '');
    out.push('| Round | Rounds run | Must | Should | Nice | Must + Should per round |', '|---|---:|---:|---:|---:|---:|');
    for (const x of s.byRound) out.push(`| ${x.round} | ${x.run} | ${x.must} | ${x.should} | ${x.nice} | ${x.perRound} |`);
    out.push('');
  }
  if (r.planSize !== undefined) out.push(...planSizeSection(report));
  if (r.planFormat !== undefined) out.push(...planFormatSection(report));
  out.push('## Critic and planner runs', '');
  out.push(
    '- Runs of `accord-critic`, `accord-planner` and `accord-architect` in the Claude Code project folders of this repository and its worktrees, read as `scripts/benchmark.mjs` reads them (usage the max per message id). A run counts when it started at or before the commit\'s time and its ticket has a file under `accord/tickets/<id>/` in the commit; a run described `bench …` is a benchmark arm and is left out.',
    '- Weighted tokens: fresh x1, cache-write x1.25, cache-read x0.1, output x5, rounded per run. Peak: the largest single-message context. Minutes: active time, a gap over 10 minutes not counted. Medians of an even count are the mean of the two middle runs.',
    '',
  );
  const rows = runTable(report.runs ?? []);
  out.push(r.transcripts.measured ? `Transcripts: ${r.transcripts.folders.length} folders, ${r.transcripts.runs} runs counted` : `Transcripts: ${NOT}`, '');
  out.push('| Run class | Runs | Weighted Mtok | Median weighted k | Median peak k | Median minutes |', '|---|---:|---:|---:|---:|---:|');
  if (!rows.length) out.push(`| critic and planner runs | ${NOT} | ${NOT} | ${NOT} | ${NOT} | ${NOT} |`);
  for (const x of rows) out.push(`| ${x.class} | ${x.runs} | ${x.weightedMtok} | ${x.medianWeightedK} | ${x.medianPeakK} | ${x.medianMinutes} |`);
  return out.join('\n') + '\n';
}
