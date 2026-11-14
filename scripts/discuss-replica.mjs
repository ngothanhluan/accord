#!/usr/bin/env node
// The discuss replica (ST-LN-91 91r-ac-1, Phase 3 D-03): run the new discuss stage and the capped approach critic (at most two
// rounds) once on one merged ticket at its base commit, and report the gray areas, the Decisions, the critic rounds and the
// weighted tokens against the ticket's original approach rounds and tokens.
// Repo-internal: not shipped and not an accord command. It starts no model run (accord never calls a model, and the Agent tool
// is not a script's to use): it reads git and Claude Code transcripts, prepares a worktree and a brief outside the repository,
// and prints what a person dispatches from a Claude Code session opened in the main checkout, after the owner's yes.
// Spawns only git, never through a shell. Committed output holds ids, shas, counts and folder basenames only.
//   --estimate --backup <dir>                         the original runs and rounds and the estimated cost; writes nothing
//   --plan --backup <dir> --answers <live|record>     the replica worktree at the base commit and the brief, then the rows
//   --backup <dir> [--answers <live|record>]          score the dispatched runs into docs/benchmark/discuss-replica.md and .json
//   --not-run "<reason>"                              write the same two files saying the replica was not run
// Options: --config <file> (default scripts/discuss-replica.json), --bench <dir> (default accord-bench beside the main
// checkout), --transcripts <dir> (score only; default the main checkout's folders under ~/.claude/projects), --out <dir>.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { countRecord, weighted } from './metrics-count.mjs';
import { projectPrefix } from './metrics.mjs';
import { mainBench, readSessions } from './benchmark.mjs';

const USAGE =
  'usage: node scripts/discuss-replica.mjs --estimate --backup <dir>\n' +
  '       node scripts/discuss-replica.mjs --plan --backup <dir> --answers <live|record>\n' +
  '       node scripts/discuss-replica.mjs --backup <dir> [--answers <live|record>] [--transcripts <dir>] [--out <dir>]\n' +
  '       node scripts/discuss-replica.mjs --not-run "<reason>" [--out <dir>]\n' +
  '       (also: --config <file>, --bench <dir>)';
const MAX_BUFFER = 64 * 1024 * 1024;
const CONFIG_FILE = fileURLToPath(new URL('./discuss-replica.json', import.meta.url));
const REPORT = 'discuss-replica';
const TITLE = '# Discuss replica: the discuss stage and the approach critic after ST-LN-91';
const description = (ticket, step) => `bench discuss-replica ${ticket} ${step}`;

/** The gray-area groups of the planner's discuss mode, in its order; any other name is counted as `other`. */
export const GROUPS = ['direction options', 'behaviour and output', 'failure and data loss', 'scope edges', 'interfaces', 'measurement rules or heuristics', 'test strategy'];
const STEP = /^(?:discuss|scout-\d+|direction|critic-\d+|revise-\d+)$/;
const TICKET = /^[A-Za-z]+(?:-[A-Za-z]+)*-\d+$/;
const SHA = /^[0-9a-f]{40}$/;

const ANSWERS = {
  live: 'The gray areas were answered live by the owner in the session, one at a time; the owner knew how the ticket ended, which may have shaped the answers.',
  record:
    "The gray areas were answered by the session, taken from the ticket's recorded Decisions and Corrections at its approval; a gray area they do not settle took the planner's recommended default, marked as such.",
};

/** The one-ticket caveat (D-03): what the replica covers, what it leaves out, and how the gray areas were answered. */
export function caveat(answers, ticket) {
  const id = ticket && TICKET.test(ticket) ? `, ${ticket},` : '';
  return (
    `This covers one merged ticket${id} and only the discuss stage and the approach critic (at most two rounds) after the ST-LN-91 changes, ` +
    "not a whole ticket's life: plan, build, review and verify are not replayed, and one ticket shows no trend. The replica ran at the " +
    "ticket's base commit (the parent of its first approach commit) with the models and effort of the original runs; the original " +
    "figures come from the ticket's approach-review.md and the backed-up transcripts of its original runs. " +
    (ANSWERS[answers] ?? 'No gray area was answered.')
  );
}
const NOTES =
  'Weighted tokens use the study weights (fresh 1, cache write 1.25, cache read 0.1, output 5), rounded per run before any sum. ' +
  'A `-` marks a step that run did not have: the original had no discuss stage, and its option was revised in the main session, ' +
  'whose tokens are no step here. A step with no counted run is `not measured`, never zero.';

const kTok = (n) => `${Math.round(n / 1000)}k`;
const slashed = (p) => String(p).replace(/\\/g, '/');
const oneLine = (reason) => String(reason).replace(/\s+/g, ' ').trim();
const int = (n) => (typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.round(n) : null);
const byDecision = (a, b) => Number(a.slice(2)) - Number(b.slice(2));
const agentId = (file) => path.posix.basename(slashed(file), '.jsonl');

/** Sort key of a step: discuss, scout questions, direction, then critic and revise rounds interleaved. */
function stepKey(step) {
  const n = Number(step.match(/\d+$/)?.[0] ?? 0);
  if (step === 'discuss') return [0, 0];
  if (step.startsWith('scout-')) return [1, n];
  if (step === 'direction') return [2, 0];
  return [3, step.startsWith('critic-') ? 2 * n - 1 : 2 * n];
}
const byStep = (a, b) => {
  const [x, y] = [stepKey(a), stepKey(b)];
  return x[0] - y[0] || x[1] - y[1];
};

// ---- counting ---------------------------------------------------------------------------------------------------------------

/**
 * Weighted tokens per step of the runs the brief named: a run counts when its description is
 * `bench discuss-replica <ticket> <step>`, the step one of the brief's. Every such run counts (a step dispatched twice cost
 * twice); `runs` says how many there were.
 */
export function countSteps(runs, ticket = 'ST-LN-81') {
  const prefix = `bench discuss-replica ${ticket} `;
  const out = {};
  for (const r of runs) {
    const desc = String(r?.desc ?? '');
    if (!desc.startsWith(prefix)) continue;
    const step = desc.slice(prefix.length).trim();
    if (!STEP.test(step)) continue;
    out[step] ??= { weighted: 0, runs: 0 };
    out[step].weighted += weighted(r.usage);
    out[step].runs++;
  }
  return out;
}

/** The gray areas of a discuss.md by group, and the Decisions its lines name. */
export function readDiscuss(text) {
  const groups = new Map();
  const decisions = new Set();
  for (const line of String(text).replace(/\r\n/g, '\n').split('\n')) {
    if (!line.startsWith('- ')) continue;
    const parts = line.slice(2).split(' — ');
    if (parts.length < 2) continue;
    const name = parts[0].trim().toLowerCase();
    const group = GROUPS.includes(name) ? name : 'other';
    groups.set(group, (groups.get(group) ?? 0) + 1);
    for (const d of parts.at(-1).match(/\bD-\d+\b/g) ?? []) decisions.add(d);
  }
  return { grayAreas: [...groups].map(([group, count]) => ({ group, count })), decisions: [...decisions] };
}

// ---- the report (91r-ac-1) --------------------------------------------------------------------------------------------------

function cleanRounds(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .map((x) => ({ n: int(x?.n), Must: int(x?.Must) ?? 0, Should: int(x?.Should) ?? 0 }))
    .filter((x) => x.n !== null && x.n > 0 && !seen.has(x.n) && seen.add(x.n))
    .sort((a, b) => a.n - b.n);
}

function cleanSteps(list) {
  const seen = new Set();
  const out = [];
  for (const s of Array.isArray(list) ? list : []) {
    const step = String(s?.step ?? '');
    if (!STEP.test(step) || seen.has(step)) continue;
    seen.add(step);
    const row = { step, weighted: s.skipped === true ? null : int(s.weighted) };
    if (s.skipped === true) row.skipped = true;
    if (int(s.runs) > 1) row.runs = int(s.runs);
    out.push(row);
  }
  return out.sort((a, b) => byStep(a.step, b.step));
}

/** Only the known fields of a row: nothing else (a prompt, a reply, a transcript path, gray-area text) can reach a report. */
function cleanRow(r) {
  const groups = new Map();
  for (const g of Array.isArray(r?.grayAreas) ? r.grayAreas : []) {
    const name = String(g?.group ?? '').toLowerCase();
    const group = GROUPS.includes(name) ? name : 'other';
    const count = int(g?.count);
    if (count) groups.set(group, (groups.get(group) ?? 0) + count);
  }
  const order = [...GROUPS, 'other'];
  return {
    ticket: TICKET.test(String(r?.ticket ?? '')) ? String(r.ticket) : 'unknown',
    answers: r?.answers === 'live' || r?.answers === 'record' ? r.answers : null,
    grayAreas: [...groups].map(([group, count]) => ({ group, count })).sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group)),
    decisions: [...new Set((Array.isArray(r?.decisions) ? r.decisions : []).filter((d) => typeof d === 'string' && /^D-\d+$/.test(d)))].sort(byDecision),
    rounds: cleanRounds(r?.rounds),
    steps: cleanSteps(r?.steps),
    original: { rounds: cleanRounds(r?.original?.rounds), steps: cleanSteps(r?.original?.steps) },
  };
}

function summarize(raw) {
  const row = cleanRow(raw);
  const sum = (steps) => steps.reduce((n, s) => n + (s.weighted ?? 0), 0);
  const notMeasured = row.steps.filter((s) => s.weighted === null && !s.skipped).map((s) => s.step);
  const originalNotMeasured = row.original.steps.filter((s) => s.weighted === null).map((s) => s.step);
  const replicaRounds = row.rounds.length ? Math.max(...row.rounds.map((x) => x.n)) : 0;
  const originalRounds = row.original.rounds.length ? Math.max(...row.original.rounds.map((x) => x.n)) : 0;
  const tokensMeasured = row.steps.length > 0 && notMeasured.length === 0 && originalNotMeasured.length === 0 && row.original.steps.length > 0;
  return {
    row,
    replicaWeighted: sum(row.steps),
    originalWeighted: sum(row.original.steps),
    notMeasured,
    originalNotMeasured,
    replicaRounds,
    originalRounds,
    fewerRounds: replicaRounds && originalRounds ? replicaRounds < originalRounds : null,
    fewerTokens: tokensMeasured ? sum(row.steps) < sum(row.original.steps) : null,
  };
}

const yesNo = (b) => (b ? 'yes' : 'no');
const stepCell = (s) => (s === undefined ? '-' : s.skipped ? 'not run (the loop had ended)' : s.weighted === null ? 'not measured' : kTok(s.weighted));

/** The report as Markdown: the caveat first, the gray areas by group, the Decisions, the rounds, the tokens per step, the verdicts. */
export function renderDiscussReplica(raw) {
  const s = summarize(raw);
  const r = s.row;
  const out = [TITLE, '', caveat(r.answers, r.ticket), '', NOTES, '', '## Gray areas', ''];
  const total = r.grayAreas.reduce((n, g) => n + g.count, 0);
  if (total) out.push(`${total} gray areas raised, by group:`, '', ...r.grayAreas.map((g) => `- ${g.group}: ${g.count}`), '');
  else out.push('No gray area was recorded.', '');
  out.push('## Decisions', '', r.decisions.length ? `Written by the replica: ${r.decisions.join(', ')}` : 'No Decision was recorded.', '');

  out.push('## Approach critic rounds', '', '| Round | Replica Must | Replica Should | Original Must | Original Should |', '| ---: | ---: | ---: | ---: | ---: |');
  const last = Math.max(s.replicaRounds, s.originalRounds);
  for (let n = 1; n <= last; n++) {
    const a = r.rounds.find((x) => x.n === n);
    const b = r.original.rounds.find((x) => x.n === n);
    out.push(`| ${n} | ${a ? a.Must : '-'} | ${a ? a.Should : '-'} | ${b ? b.Must : '-'} | ${b ? b.Should : '-'} |`);
  }
  out.push('');

  out.push('## Weighted tokens per step', '', '| Step | Replica weighted k | Original weighted k |', '| --- | ---: | ---: |');
  const names = [...new Set([...r.steps.map((x) => x.step), ...r.original.steps.map((x) => x.step)])].sort(byStep);
  for (const name of names) out.push(`| ${name} | ${stepCell(r.steps.find((x) => x.step === name))} | ${stepCell(r.original.steps.find((x) => x.step === name))} |`);
  out.push(`| Total | ${kTok(s.replicaWeighted)} | ${kTok(s.originalWeighted)} |`, '');
  if (s.notMeasured.length) out.push(`The replica total leaves out the steps with no counted run: ${s.notMeasured.join(', ')}.`, '');
  const repeats = r.steps.filter((x) => x.runs);
  if (repeats.length) out.push(`More than one counted run, all counted: ${repeats.map((x) => `${x.step} (${x.runs} runs)`).join(', ')}.`, '');

  out.push(
    s.fewerRounds === null
      ? 'Fewer approach critic rounds than the original: not measured (no critic round was recorded)'
      : `Fewer approach critic rounds than the original: ${yesNo(s.fewerRounds)} (${s.replicaRounds} against ${s.originalRounds})`,
  );
  if (s.fewerTokens === null) {
    const missing = [...s.notMeasured, ...s.originalNotMeasured.map((x) => `original ${x}`)];
    out.push(`Fewer weighted tokens than the original: not measured (${missing.length ? `no counted run for ${missing.join(', ')}` : 'no step was counted'})`);
  } else out.push(`Fewer weighted tokens than the original: ${yesNo(s.fewerTokens)} (${kTok(s.replicaWeighted)} against ${kTok(s.originalWeighted)})`);
  return out.join('\n') + '\n';
}

/** The same numbers as JSON. */
export function renderDiscussReplicaJson(raw) {
  const s = summarize(raw);
  const r = s.row;
  return (
    JSON.stringify(
      {
        caveat: caveat(r.answers, r.ticket),
        ticket: r.ticket,
        answers: r.answers,
        grayAreas: r.grayAreas,
        decisions: r.decisions,
        rounds: { replica: r.rounds, original: r.original.rounds },
        steps: { replica: r.steps, original: r.original.steps },
        replicaWeighted: s.replicaWeighted,
        originalWeighted: s.originalWeighted,
        notMeasured: s.notMeasured,
        fewerRounds: s.fewerRounds,
        fewerTokens: s.fewerTokens,
      },
      null,
      2,
    ) + '\n'
  );
}

/** The stop path's caveat: what the replica would have covered, with nothing claimed as run or answered. */
export function notRunCaveat(ticket) {
  const id = ticket && TICKET.test(ticket) ? `, ${ticket},` : '';
  return (
    `This would have covered one merged ticket${id} and only the discuss stage and the approach critic (at most two rounds) after the ST-LN-91 changes, ` +
    "not a whole ticket's life, and one ticket shows no trend. No model run was dispatched, so no gray area was raised or answered, " +
    'no Decision was written and no critic round was counted: every replica step is not measured, and no verdict is drawn.'
  );
}

/** The stop path: the caveat and the not-run line, and no verdict. */
export function renderNotRun(reason, ticket) {
  const why = oneLine(reason);
  const text = notRunCaveat(ticket);
  return {
    md: [TITLE, '', text, '', `The replica was not run: ${why}`, ''].join('\n'),
    json: JSON.stringify({ caveat: text, notRun: true, reason: why }, null, 2) + '\n',
  };
}

// ---- arguments ----------------------------------------------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { estimate: false, plan: false };
  const VALUE = { '--not-run': 'notRun', '--backup': 'backup', '--config': 'config', '--bench': 'bench', '--out': 'out', '--transcripts': 'transcripts', '--answers': 'answers' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--estimate') opts.estimate = true;
    else if (a === '--plan') opts.plan = true;
    else if (a in VALUE) {
      const v = argv[++i];
      if (v === undefined || (v === '' && a !== '--not-run')) return { error: `${a} needs a value` };
      opts[VALUE[a]] = v;
    } else return { error: `unknown argument: ${a}` };
  }
  if (opts.notRun !== undefined && oneLine(opts.notRun) === '') return { error: '--not-run needs a reason' };
  if (opts.answers !== undefined && opts.answers !== 'live' && opts.answers !== 'record') return { error: '--answers is live or record' };
  if (opts.estimate && opts.plan) return { error: '--estimate and --plan do not go together' };
  if (opts.notRun === undefined && opts.backup === undefined) return { error: 'this mode needs --backup <dir>' };
  if (opts.plan && opts.answers === undefined) return { error: '--plan needs --answers live or --answers record' };
  return { opts };
}

function readConfig(file) {
  const c = JSON.parse(fs.readFileSync(file, 'utf8'));
  const files = (list) => Array.isArray(list) && list.every((f) => typeof f === 'string' && /^[^\\:]+\.jsonl$/.test(f) && !f.split('/').includes('..'));
  if (!TICKET.test(String(c.ticket ?? ''))) throw new Error('ticket is not an id');
  if (!SHA.test(String(c.base ?? '')) || !SHA.test(String(c.merge ?? ''))) throw new Error('base and merge must be full shas');
  if (!files(c.original?.planner) || !c.original.planner.length) throw new Error('original.planner must list run files relative to the backup');
  if (!files(c.original?.critic) || !c.original.critic.length) throw new Error('original.critic must list run files relative to the backup');
  if (c.original.scout !== undefined && !files(c.original.scout)) throw new Error('original.scout must list run files relative to the backup');
  return c;
}

const modelOf = (run) => {
  const m = run.turns[0]?.requestedModel || run.turns[0]?.model || run.metaModel || '';
  return (m.match(/opus|sonnet|haiku/) ?? [m || 'default'])[0];
};
const effortOf = (run) => run.turns[0]?.effort || run.metaEffort || 'default';

// ---- main -----------------------------------------------------------------------------------------------------------------------

export async function main(argv, { cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr } = {}) {
  const parsed = parseArgs(argv);
  if (parsed.error) {
    stderr.write(`discuss-replica: ${parsed.error}\n${USAGE}\n`);
    return 2;
  }
  const { opts } = parsed;
  const fail = (message) => {
    stderr.write(`discuss-replica: ${message}\n`);
    return 2;
  };
  const git = (args, as) =>
    execFileSync('git', args, { cwd, maxBuffer: MAX_BUFFER, stdio: ['ignore', 'pipe', 'pipe'], ...(as === 'buffer' ? {} : { encoding: 'utf8' }) });
  const root = () => {
    try {
      return git(['rev-parse', '--show-toplevel']).trim();
    } catch {
      return undefined;
    }
  };
  const writeReport = (md, json) => {
    let out = opts.out === undefined ? undefined : path.resolve(cwd, opts.out);
    if (out === undefined) {
      const top = root();
      if (top === undefined) return fail(`${slashed(cwd)} is not inside a git repository`);
      out = path.join(top, 'docs', 'benchmark');
    }
    fs.mkdirSync(out, { recursive: true });
    const written = [];
    for (const [ext, text] of [['md', md], ['json', json]]) {
      fs.writeFileSync(path.join(out, `${REPORT}.${ext}`), text);
      written.push(`wrote ${REPORT}.${ext}\n`);
    }
    stdout.write(written.join(''));
    return 0;
  };

  if (opts.notRun !== undefined) {
    let ticket;
    try {
      ticket = readConfig(opts.config === undefined ? CONFIG_FILE : path.resolve(cwd, opts.config)).ticket;
    } catch {
      ticket = undefined; // the not-run report stands without the config; it then names no ticket
    }
    const { md, json } = renderNotRun(opts.notRun, ticket);
    return writeReport(md, json);
  }

  let config;
  try {
    config = readConfig(opts.config === undefined ? CONFIG_FILE : path.resolve(cwd, opts.config));
  } catch (e) {
    return fail(`the config file does not read: ${e.message}`);
  }
  const t = config.ticket;

  // The base commit: the parent of the first commit whose subject starts `approach: <id> `. The body may name it anywhere.
  let first;
  try {
    const log = git(['log', '--reverse', '--format=%H%x09%s', '--fixed-strings', `--grep=approach: ${t}`]);
    first = log.split('\n').map((l) => l.split('\t')).find(([, subject]) => subject?.startsWith(`approach: ${t} `))?.[0];
  } catch {
    return fail(`${slashed(cwd)} is not inside a git repository`);
  }
  if (!first) return fail(`no commit whose subject starts "approach: ${t} " in this repository`);
  let parent = '';
  try {
    parent = git(['rev-parse', `${first}^`]).trim();
  } catch {
    // a root commit has no parent; reported below
  }
  if (parent !== config.base) return fail(`${config.base.slice(0, 8)} is not the parent of the first approach commit ${first.slice(0, 8)} (its parent is ${parent.slice(0, 8) || 'none'})`);

  // The original rounds, from approach-review.md at the approval commit: the last cycle.
  let review;
  try {
    review = git(['cat-file', 'blob', `${config.merge}:accord/tickets/${t}/approach-review.md`]);
  } catch {
    return fail(`approach-review.md is not at ${config.merge.slice(0, 8)} in this repository`);
  }
  const originalRounds = (countRecord(review, 'approach').at(-1)?.rounds ?? []).map(({ n, Must, Should }) => ({ n, Must, Should }));

  // The original runs, read from the backup by the file names the config keeps.
  const backup = path.resolve(cwd, opts.backup);
  if (!fs.existsSync(backup)) return fail('the backup folder is not there');
  const wanted = [...config.original.planner, ...config.original.critic, ...(config.original.scout ?? [])];
  const folders = [...new Set(wanted.map((f) => f.split('/')[0]))].sort();
  const byFile = new Map();
  for (const run of readSessions(folders.map((f) => path.join(backup, f)).filter((d) => fs.existsSync(d))).runs) byFile.set(run.file, run);
  const missing = wanted.filter((f) => !byFile.has(f));
  if (missing.length) return fail(`no original run in the backup for ${missing.join(', ')}`);
  const byStart = (a, b) => (a.start ?? 0) - (b.start ?? 0);
  const planners = config.original.planner.map((f) => byFile.get(f)).sort(byStart);
  const critics = config.original.critic.map((f) => byFile.get(f)).sort(byStart);
  const scout = (config.original.scout ?? []).map((f) => byFile.get(f)).sort(byStart)[0];
  const w = (run) => weighted(run.usage);

  const originalSteps = [
    { step: 'direction', run: planners[0] },
    ...planners.slice(1).map((run, i) => ({ step: `revise-${i + 1}`, run })),
    ...critics.map((run, i) => ({ step: `critic-${i + 1}`, run })),
  ].sort((a, b) => byStep(a.step, b.step));

  // The estimate: one discuss run (taken as the largest direction run), one direction run, critic round 1, one revision (the
  // original revision run, or one direction run when the main session revised), critic round 2.
  const largest = [...planners].sort((a, b) => w(b) - w(a))[0];
  const revision = planners[1];
  const estimate = [
    { step: 'discuss', as: `the largest original direction run (${agentId(largest.file)})`, k: w(largest) },
    { step: 'direction', as: `the original direction run (${agentId(planners[0].file)})`, k: w(planners[0]) },
    { step: 'critic-1', as: `original critic round 1 (${agentId(critics[0].file)})`, k: w(critics[0]) },
    revision
      ? { step: 'revise-1', as: `the original revision run (${agentId(revision.file)})`, k: w(revision) }
      : { step: 'revise-1', as: `no original revision run (the main session revised the option); one direction run (${agentId(largest.file)})`, k: w(largest) },
    { step: 'critic-2', as: `original critic round ${critics[1] ? 2 : 1} (${agentId((critics[1] ?? critics[0]).file)})`, k: w(critics[1] ?? critics[0]) },
  ];
  const estimated = estimate.reduce((n, e) => n + e.k, 0);
  const originalTotal = originalSteps.reduce((n, s) => n + w(s.run), 0);

  const printEstimate = () => {
    const lines = [
      `Ticket ${t}: base ${config.base.slice(0, 8)} (the parent of the first approach commit ${first.slice(0, 8)}), approved at ${config.merge.slice(0, 8)}.`,
      '',
      '| Step | Original run | Weighted k |',
      '| --- | --- | ---: |',
      ...originalSteps.map((s) => `| ${s.step} | ${s.run.agent} ${agentId(s.run.file)} | ${kTok(w(s.run))} |`),
      '',
      '| Original round | Must | Should | Must + Should |',
      '| ---: | ---: | ---: | ---: |',
      ...originalRounds.map((x) => `| ${x.n} | ${x.Must} | ${x.Should} | ${x.Must + x.Should} |`),
      '',
      `Original approach: ${originalRounds.length} critic rounds, ${kTok(originalTotal)} weighted over the ${revision ? 'direction, revision and critic runs above' : 'direction and critic runs above; the option was revised in the main session, which no step counts'}.`,
      '',
      '| Replica step | Taken as | Estimated weighted k |',
      '| --- | --- | ---: |',
      ...estimate.map((e) => `| ${e.step} | ${e.as} | ${kTok(e.k)} |`),
      '',
    ];
    if (scout) lines.push(`Scout questions (scout-<n>) are not in the estimate: each would add about ${kTok(w(scout))}, the original scout run (${agentId(scout.file)}).`, '');
    lines.push(`Estimated weighted cost: ${kTok(estimated)}`, '');
    stdout.write(lines.join('\n'));
  };

  if (opts.estimate) {
    printEstimate();
    return 0;
  }

  let bench;
  let mainCheckout;
  try {
    const found = mainBench(cwd);
    mainCheckout = found.main;
    bench = opts.bench === undefined ? found.bench : slashed(path.resolve(cwd, opts.bench));
  } catch {
    return fail(`${slashed(cwd)} is not inside a git repository`);
  }
  const dir = `${bench}/discuss-replica/${t}`;
  const brief = `${bench}/briefs/discuss-replica/${t}.md`;

  if (opts.plan) {
    if (fs.existsSync(dir)) {
      if (!fs.existsSync(path.join(dir, '.git'))) return fail(`${dir} exists and is not a worktree`);
      let head = '';
      try {
        head = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
      } catch {
        // an unreadable worktree is reported below as not at the base
      }
      if (head !== config.base) return fail(`${dir} is not at ${config.base.slice(0, 8)}, it is at ${head.slice(0, 8) || 'nothing readable'}; remove the worktree and run again`);
    } else {
      fs.mkdirSync(path.dirname(dir), { recursive: true });
      try {
        git(['worktree', 'add', '--detach', dir, config.base]);
      } catch (e) {
        const why = String(e.stderr ?? e.message).split('\n').find((l) => l.startsWith('fatal:')) ?? 'git failed';
        return fail(`git worktree add ${dir} failed (${why.trim()}); on Windows a long --bench path can pass the 260-character limit. Remove anything left at ${dir}, run git worktree prune, and run again`);
      }
    }
    // The merged discuss stage hands the planner the saved scout report; when the base commit has none, the original scout
    // run's report stands in for it, outside the repository.
    const scoutFile = path.join(dir, 'accord', 'tickets', t, 'scout.md');
    if (scout && scout.lastText.trim() && !fs.existsSync(scoutFile)) {
      fs.mkdirSync(path.dirname(scoutFile), { recursive: true });
      fs.writeFileSync(scoutFile, scout.lastText);
    }
    const roles = {
      planner: { model: modelOf(planners[0]), effort: effortOf(planners[0]) },
      critic: { model: modelOf(critics[0]), effort: effortOf(critics[0]) },
      scout: scout ? { model: modelOf(scout), effort: effortOf(scout) } : { model: 'sonnet', effort: 'low' },
    };
    fs.mkdirSync(path.dirname(brief), { recursive: true });
    fs.writeFileSync(brief, writeBrief({ t, dir, bench, base: config.base, merge: config.merge, mainCheckout, answers: opts.answers, roles }));
    printEstimate();
    stdout.write(`Replica worktree: ${dir} (detached at ${config.base.slice(0, 8)})\nBrief: ${brief}\n\n`);
    stdout.write('| Description | subagent_type | mode | model | effort |\n| --- | --- | --- | --- | --- |\n');
    for (const [step, agent, mode, role] of STEPS) stdout.write(`| ${description(t, step)} | ${agent} | ${mode} | ${roles[role].model} | ${roles[role].effort} |\n`);
    stdout.write(
      '\nNothing is dispatched. After the owner\'s recorded yes, open Claude Code in the main checkout and give it the brief: it dispatches each step once, in order, with the Agent tool.\n',
    );
    return 0;
  }

  return score({ opts, cwd, stderr, t, dir, brief, mainCheckout, originalRounds, originalSteps: originalSteps.map((s) => ({ step: s.step, weighted: w(s.run) })), writeReport });
}

// ---- the brief (--plan) ----------------------------------------------------------------------------------------------------------

const STEPS = [
  ['discuss', 'accord-planner', 'discuss', 'planner'],
  ['scout-<n>', 'accord-scout', 'question', 'scout'],
  ['direction', 'accord-planner', 'direction', 'planner'],
  ['critic-1', 'accord-critic', 'approach', 'critic'],
  ['revise-1', 'accord-planner', 'direction', 'planner'],
  ['critic-2', 'accord-critic', 'approach', 'critic'],
];

function writeBrief({ t, dir, bench, base, merge, mainCheckout, answers, roles }) {
  const ticket = `${dir}/accord/tickets/${t}.md`;
  const folder = `${dir}/accord/tickets/${t}`;
  const diff = `${bench}/discuss-replica/${t}-r2.diff`;
  const prompts = {
    discuss: `Mode: discuss. Ticket: ${ticket} (repository root ${dir}). Scout report: ${folder}/scout.md. Reply with every gray area the ticket leaves open, grouped as your instructions define, each in plain words with two or three options, the one you recommend first, the consequence of each, and the file and line that prompted it. Write no file.`,
    'scout-<n>': `Question: <the question, as the discuss reply names it>. Repository root ${dir}. Answer it from the code at that root, in the reply form your instructions define. Write no file.`,
    direction: `Mode: direction. Ticket: ${ticket} (repository root ${dir}; read the ticket verbatim, its Decisions included, its research records, and accord/tickets/${t}/ledger.md Rulings). Write only accord/tickets/${t}/direction.md. Return the direction report your instructions define: impact list with file:line, two or three options in ladder order lightest-that-works first, each added layer naming the criterion or constraint requiring it, one marked Recommended with its reason.`,
    'critic-1': `Mode: approach. Round 1 (whole). Ticket: ${ticket} (repository root ${dir}). Argue the strongest case against the option its ## Approach names, checked against its Vetoes, Decisions and Corrections, and its ledger Rulings at accord/tickets/${t}/ledger.md. Report findings as your instructions define. The rules of accord 0.4.1 and later apply.`,
    'revise-1': `Mode: direction. Ticket: ${ticket} (repository root ${dir}). Option: <the option ## Approach names>. Review record: ${folder}/approach-review.md. Open findings: <every Must and Should open or unverified, labelled 1.<n>, verbatim>. Keep the option and its name; return the revised option and its impact list, and for a finding you do not fix reply \`unverified: <reason>\` under its label. Write only accord/tickets/${t}/direction.md.`,
    'critic-2': `Mode: approach. Round 2 (diff). Ticket: ${ticket} (repository root ${dir}). Diff of the amended ## Approach since round 1: ${diff}. Review record: ${folder}/approach-review.md. Ledger Rulings: ${folder}/ledger.md. List which open findings are fixed (after \`fixed:\`) or withdrawn (after \`withdrawn:\`), and any new finding, a repeat starting \`repeats <round>.<n>:\`. The rules of accord 0.4.1 and later apply.`,
  };
  const after = {
    discuss: `Then write \`accord/tickets/${t}/discuss.md\` in the replica worktree as discuss.md step 2 says, and settle every gray area one at a time as its steps 3 to 6 say, with the answers named above.`,
    'scout-<n>': 'Only when the discuss reply names a question the code answers: one step per question, n from 1. Give the reply to the discuss run with SendMessage, not as a new dispatch, so its tokens stay with that step.',
    direction: `Then write into \`## Approach\` only the chosen option's name, what it does and its impact list, and the ladder Ruling into accord/tickets/${t}/ledger.md, as approach step 2 says. Commit in the replica worktree.`,
    'critic-1': 'Then record round 1 in approach-review.md as critique.md says ("The rounds", step 2), and commit. When it leaves no Must and no Should open, the loop has converged: skip revise-1 and critic-2.',
    'revise-1': `Only when critic-1 leaves a Must or Should open. Then write the revised option into \`## Approach\` (critique.md "The rounds", step 5), commit, and write \`git diff <the round-1 commit> -- accord/tickets/${t}.md\` of the replica worktree to ${diff}.`,
    'critic-2': 'Then record round 2 (from round 2 a new Must or Should with no ground is recorded `deferred`), write `## Approach` in full with every finding still open as a risk (approach step 4), commit, and stop.',
  };
  const answerRule =
    answers === 'live'
      ? '- Answers (live): the owner answers each gray area in the session, one at a time, as discuss.md step 3 and `./ask.md` say. Write each answer as a `D-nn` line with the owner\'s words.'
      : `- Answers (record): the session answers each gray area from the Decisions and Corrections of the ticket at its approval, read with \`git -C ${mainCheckout} show ${merge}:accord/tickets/${t}.md\`, quoting the recorded words. A gray area they do not settle takes the planner's recommended default: write its line as \`- D-nn <decision> — default: the planner's recommendation\` and end its discuss.md line with \`D-nn (default)\`. Ask the owner nothing.`;
  const out = [
    `# Discuss replica brief: ${t}`,
    '',
    "Nothing here has been dispatched. Dispatch only after the owner's recorded yes on the estimate and the ticket, from a Claude Code session opened in the main checkout, whose `.claude/agents/` hold the merged planner and critic. Dispatch each step below once, in order, with the Agent tool: the description, subagent_type, model and effort as written, and the prompt as written with its `<...>` filled in.",
    '',
    `Replica worktree: ${dir}`,
    `Base commit: ${base} (detached; the parent of the first \`approach: ${t}\` commit)`,
    `Answers: ${answers}`,
    '',
    '## Rules',
    '',
    '- Write only inside the replica worktree: discuss.md, the ticket\'s `## Decisions` and `## Approach`, direction.md, approach-review.md and the ledger, as the merged `accord-intent` discuss.md and `accord-approach` critique.md say. Commit there; never push, and never write in the main checkout.',
    "- The replica measures the rules of accord 0.4.1 and later (the discuss stage, the cap of two approach rounds, the grounds rule from round 2), although the replica worktree's config pins an older accord: apply them, and never read that pin to choose rules.",
    '- No accord command runs in the replica worktree: its config pins the accord of its base commit, which the running CLI refuses. Skip each step of the skills that runs `accord round`, `accord gate ready`, `accord worktree push`, `accord scout check`, `accord show` or `accord approve`; the order and the cap of this brief stand in for them.',
    '- The cap is at most two approach critic rounds: critic-1 reads the whole `## Approach`, critic-2 only the fixes. There is no round 3. Findings still open after critic-2 go into `## Approach` as risks, and the replica stops there: no approval, no owner yes, no `accord approve`.',
    answerRule,
    '- Dispatch nothing outside this list. A step that fails is reported to the owner, not retried, unless the owner says so.',
    '',
    '## Steps',
    '',
  ];
  STEPS.forEach(([step, agent, mode, role], i) => {
    out.push(
      `### ${i + 1}. ${step}`,
      '',
      `- description: ${description(t, step)}`,
      `- subagent_type: ${agent}`,
      `- mode: ${mode}`,
      `- model: ${roles[role].model}`,
      `- effort: ${roles[role].effort}`,
      '- prompt:',
      '',
      `    ${prompts[step]}`,
      '',
      after[step],
      '',
    );
  });
  return out.join('\n');
}

// ---- score ----------------------------------------------------------------------------------------------------------------------

function score({ opts, cwd, stderr, t, dir, brief, mainCheckout, originalRounds, originalSteps, writeReport }) {
  // The replica runs: an explicit folder holds Claude Code project folders and every one is read; by default the main
  // checkout's own and its worktrees' folders under ~/.claude/projects (the encoded-path prefix, as scripts/metrics.mjs reads them).
  let dirs = [];
  if (opts.transcripts !== undefined) {
    const folder = path.resolve(cwd, opts.transcripts);
    if (fs.existsSync(folder)) dirs = fs.readdirSync(folder, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => path.join(folder, d.name));
    else stderr.write('discuss-replica: no transcript folder at the given path; no replica run is counted\n');
  } else {
    const home = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'projects');
    const prefix = projectPrefix(mainCheckout).toLowerCase();
    if (fs.existsSync(home)) dirs = fs.readdirSync(home, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name.toLowerCase().startsWith(prefix)).map((d) => path.join(home, d.name));
    else stderr.write('discuss-replica: no Claude Code projects folder; no replica run is counted\n');
  }
  const counted = countSteps(readSessions(dirs.sort()).runs, t);

  const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : undefined);
  const discussText = read(path.join(dir, 'accord', 'tickets', t, 'discuss.md'));
  const { grayAreas, decisions } = discussText === undefined ? { grayAreas: [], decisions: [] } : readDiscuss(discussText);
  const reviewText = read(path.join(dir, 'accord', 'tickets', t, 'approach-review.md'));
  const rounds = reviewText === undefined ? [] : (countRecord(reviewText, 'approach').at(-1)?.rounds ?? []).map(({ n, Must, Should }) => ({ n, Must, Should }));
  const first = rounds.find((x) => x.n === 1);
  const converged = first !== undefined && first.Must + first.Should === 0;

  const scouts = Object.keys(counted).filter((s) => s.startsWith('scout-'));
  const expected = [...new Set(['discuss', ...scouts, 'direction', 'critic-1', 'revise-1', 'critic-2', ...Object.keys(counted)])].sort(byStep);
  const steps = expected.map((step) => {
    if (counted[step]) return { step, weighted: counted[step].weighted, runs: counted[step].runs };
    if (converged && (step === 'revise-1' || step === 'critic-2')) return { step, skipped: true };
    return { step, weighted: null };
  });
  const answers = opts.answers ?? read(brief)?.match(/^Answers: (live|record)$/m)?.[1] ?? null;
  const row = { ticket: t, answers, grayAreas, decisions, rounds, steps, original: { rounds: originalRounds, steps: originalSteps } };
  return writeReport(renderDiscussReplica(row), renderDiscussReplicaJson(row));
}

// Last: the entry runs only once every top-level declaration above has been evaluated.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) process.exitCode = await main(process.argv.slice(2));
