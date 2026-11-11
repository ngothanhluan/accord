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

const NOT = 'not measured';
const TITLE = { approach: 'Approach', plan: 'Plan', review: 'Review' };

/** The report in a fixed key order, so two runs on the same inputs give the same bytes. */
function ordered(report) {
  const stage = (s) => ({
    records: s.records,
    cycles: s.cycles,
    byRound: s.byRound.map((r) => ({ round: r.round, run: r.run, must: r.must, should: r.should, nice: r.nice, perRound: r.perRound })),
  });
  return {
    label: report.label,
    commit: report.commit,
    date: report.date,
    stages: Object.fromEntries(STAGES.map((k) => [k, stage(report.stages[k])])),
    transcripts: { measured: report.transcripts.measured, folders: [...report.transcripts.folders], runs: report.transcripts.runs },
  };
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
  out.push('## Critic and planner runs', '');
  out.push(`Transcripts: ${NOT}`, '');
  out.push('| Run class | Runs | Weighted Mtok | Median weighted k | Median peak k | Median minutes |', '|---|---:|---:|---:|---:|---:|');
  out.push(`| critic and planner runs | ${NOT} | ${NOT} | ${NOT} | ${NOT} | ${NOT} |`);
  return out.join('\n') + '\n';
}
