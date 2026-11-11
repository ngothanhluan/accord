#!/usr/bin/env node
// The round-2 replica (ST-LN-91 91-ac-5, D-04): re-run the round-2 plan critic of a few merged tickets once each with the
// new critic prompt and rules, on the same plan text at the same base commit, and report whether round 2 gave fewer
// findings or fewer weighted tokens than the backed-up original.
// Repo-internal: not shipped and not an accord command. It starts no model run (accord never calls a model, and the Agent
// tool is not a script's to use): it reads git and Claude Code transcripts, prepares worktrees and prompt files outside the
// repository, and prints the dispatch rows a person dispatches from a Claude Code session opened in the ST-LN-91 worktree.
// Spawns only git, never through a shell. Committed output holds ids, shas, counts and folder basenames only.
//   --estimate --backup <dir>                    candidates, the original cost, the cost of each proposed set; writes nothing
//   --plan --tickets <ids> --backup <dir>        worktrees, diffs and prompt files, then the dispatch rows
//   --tickets <ids> --backup <dir>               score the dispatched runs into docs/benchmark/round2-replica.md and .json
//   --not-run "<reason>"                         write the same two files saying the replica was not run
// Options: --candidates <file> (default scripts/round2-replica.json), --bench <dir> (default accord-bench beside the main
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
  'usage: node scripts/round2-replica.mjs --estimate --backup <dir>\n' +
  '       node scripts/round2-replica.mjs --plan --tickets <ids> --backup <dir>\n' +
  '       node scripts/round2-replica.mjs --tickets <ids> --backup <dir> [--transcripts <dir>] [--out <dir>]\n' +
  '       node scripts/round2-replica.mjs --not-run "<reason>" [--out <dir>]\n' +
  '       (also: --candidates <file>, --bench <dir>)';
const MAX_BUFFER = 64 * 1024 * 1024;
const CANDIDATES_FILE = fileURLToPath(new URL('./round2-replica.json', import.meta.url));
const REPORT = 'round2-replica';
const AGENT = 'accord-critic';
const description = (id) => `bench round2-replica ${id}`;

export const CAVEAT =
  'This measures round 2 of the plan critic on three replicated merged tickets after the ST-LN-91 changes, not a whole ticket\'s life: ' +
  'approach rounds, the other plan rounds, build and review are not replayed. Old figures come from the tickets\' records and the ' +
  'backed-up transcripts of the original round-2 runs; new figures come from one re-run each with the new critic prompt and rules, ' +
  'on the same plan text at the same base commit.';
const COLUMNS =
  'Old Must + Should (record) is what the ticket\'s plan-review.md recorded for round 2; (reply) counts the original critic\'s own reply. ' +
  'New would block counts the new reply\'s Musts and Shoulds that carry a ticket line, a risk tag, a test or a command, which the ' +
  'new rule blocks on; New would defer counts those that carry none, which it defers. Weighted tokens use the study weights ' +
  '(fresh 1, cache write 1.25, cache read 0.1, output 5), rounded per run before any sum; peak is the largest single message context.';

const byId = (a, b) => a.localeCompare(b, 'en', { numeric: true });
const kTok = (n) => `${Math.round(n / 1000)}k`;
const slashed = (p) => String(p).replace(/\\/g, '/');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---- counting a critic's reply (D-11) -------------------------------------------------------------------------------------

const NUMBERED = /^\s*\d+\.\s*\**\s*(Must|Should|Nice)\b/;
// The grounds the new critic definition names: `rests on:` an ac, a Decision or a quote from a Veto, Correction or the Intent;
// a data-loss or security risk; a test or a command that reproduces it.
const RESTS_ON = /\brests on:[^\n]*?(?:\bac-\d+\b|\bD-\d+\b|\b(?:Veto|Correction|Intent)\s*")/;
const RISK = /\brisk:\s*(?:data-loss|security)\b/;
const PROOF = /\b(?:test|command):[ \t]*\S/;

/**
 * A reply's findings by severity, and of the Musts and Shoulds how many carry a ground (they would block under the new rule)
 * and how many carry none (they would be deferred). A finding is a block from a numbered `Must|Should|Nice` line to the next
 * one; a block also ends at a blank line followed by a line that starts at column 0, so a closing paragraph ("Not checked: ...")
 * grounds nothing. A reply of `No findings` counts zero of everything.
 */
export function countReply(text) {
  const counts = { Must: 0, Should: 0, Nice: 0, grounded: 0, ungrounded: 0 };
  const blocks = [];
  let open = false;
  let blank = false;
  for (const line of String(text).replace(/\r\n/g, '\n').split('\n')) {
    if (line.trim() === '') {
      blank = true;
      continue;
    }
    const m = NUMBERED.exec(line);
    if (m) {
      blocks.push({ severity: m[1], text: line });
      open = true;
    } else if (open && blank && !/^\s/.test(line)) open = false;
    else if (open) blocks[blocks.length - 1].text += '\n' + line;
    blank = false;
  }
  for (const b of blocks) {
    counts[b.severity]++;
    if (b.severity === 'Nice') continue;
    if (RESTS_ON.test(b.text) || RISK.test(b.text) || PROOF.test(b.text)) counts.grounded++;
    else counts.ungrounded++;
  }
  return counts;
}

// ---- the replica prompt (D-04, research Pitfall 12) --------------------------------------------------------------------------

const DIFF_PATH = /[A-Za-z]:[\\/][^\s"'`<>|*?]*?\.diff(?![A-Za-z0-9_-])/g;

/** The distinct paths in a prompt that name a diff file, as written. */
export const diffPathsIn = (prompt) => [...new Set(String(prompt).match(DIFF_PATH) ?? [])];

function swapPath(text, from, to) {
  const f = slashed(from);
  const t = slashed(to);
  // The next character may not continue a name, so `accord-st-ln-8` does not match inside `accord-st-ln-80`.
  const re = new RegExp(`${escapeRe(f)}(?![A-Za-z0-9_-])|${escapeRe(f.replace(/\//g, '\\'))}(?![A-Za-z0-9_-])`, 'g');
  return text.replace(re, (hit) => (hit.includes('\\') ? t.replace(/\//g, '\\') : t));
}

/** How often a path occurs in a prompt, in either slash form. */
export const countPath = (prompt, from) => (String(prompt).match(new RegExp(`${escapeRe(slashed(from))}(?![A-Za-z0-9_-])|${escapeRe(slashed(from).replace(/\//g, '\\'))}(?![A-Za-z0-9_-])`, 'g')) ?? []).length;

/**
 * The original dispatch prompt with the original worktree root and the original diff file path replaced in whichever slash
 * form each occurrence uses; every other character is unchanged. The diff path goes first, so a diff file under the root is
 * still the diff file.
 */
export function rewritePrompt(prompt, { fromRoot, toRoot, fromDiff, toDiff }) {
  return swapPath(swapPath(String(prompt), fromDiff, toDiff), fromRoot, toRoot);
}

// ---- the report (91-ac-5) ---------------------------------------------------------------------------------------------------------

const NUM_KEYS = ['oldRecord', 'oldReply', 'newMust', 'newShould', 'wouldBlock', 'wouldDefer', 'oldWeighted', 'newWeighted', 'oldPeak', 'newPeak'];

/** Only the known fields of a row: nothing else (a prompt, a reply, a transcript path) can reach a report. */
function cleanRow(r) {
  const row = { ticket: String(r.ticket), measured: r.measured !== false };
  for (const key of NUM_KEYS) row[key] = Number.isFinite(r[key]) ? r[key] : null;
  if (!row.measured) for (const key of ['newMust', 'newShould', 'wouldBlock', 'wouldDefer', 'newWeighted', 'newPeak']) row[key] = null;
  if (Number.isFinite(r.runs) && r.runs > 1) row.runs = r.runs;
  return row;
}

function summarize(rows) {
  const sorted = rows.map(cleanRow).sort((a, b) => byId(a.ticket, b.ticket));
  const done = sorted.filter((r) => r.measured);
  const sum = (key) => done.reduce((n, r) => n + (r[key] ?? 0), 0);
  const totals = {
    oldRecord: sum('oldRecord'),
    oldReply: sum('oldReply'),
    newFindings: sum('newMust') + sum('newShould'),
    wouldBlock: sum('wouldBlock'),
    wouldDefer: sum('wouldDefer'),
    oldWeighted: sum('oldWeighted'),
    newWeighted: sum('newWeighted'),
  };
  const notMeasured = sorted.filter((r) => !r.measured).map((r) => r.ticket);
  const measured = notMeasured.length === 0 && done.length > 0;
  return {
    rows: sorted,
    totals,
    notMeasured,
    fewerFindings: measured ? totals.wouldBlock < totals.oldRecord : null,
    fewerTokens: measured ? totals.newWeighted < totals.oldWeighted : null,
  };
}

const yesNo = (b) => (b ? 'yes' : 'no');
const cell = (n, fmt = String) => (n === null ? 'not measured' : fmt(n));

/** The report as Markdown: the D-04 caveat first, one row per ticket sorted by id, totals, then the two verdict lines. */
export function renderReplica(rows) {
  const s = summarize(rows);
  const t = s.totals;
  const out = [
    '# Round 2 replica: the plan critic after the ST-LN-91 changes',
    '',
    CAVEAT,
    '',
    COLUMNS,
    '',
    '| Ticket | Old Must + Should (record) | Old Must + Should (reply) | New Must + Should | New would block | New would defer | Old weighted k | New weighted k | Old peak k | New peak k |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const r of s.rows) {
    const found = r.newMust === null ? null : r.newMust + r.newShould;
    out.push(
      `| ${r.ticket} | ${cell(r.oldRecord)} | ${cell(r.oldReply)} | ${cell(found)} | ${cell(r.wouldBlock)} | ${cell(r.wouldDefer)} | ${cell(r.oldWeighted, kTok)} | ${cell(r.newWeighted, kTok)} | ${cell(r.oldPeak, kTok)} | ${cell(r.newPeak, kTok)} |`,
    );
  }
  out.push(`| Total | ${t.oldRecord} | ${t.oldReply} | ${t.newFindings} | ${t.wouldBlock} | ${t.wouldDefer} | ${kTok(t.oldWeighted)} | ${kTok(t.newWeighted)} | - | - |`, '');
  if (s.notMeasured.length) out.push(`Totals leave out the tickets with no counted run: ${s.notMeasured.join(', ')}.`, '');
  const repeats = s.rows.filter((r) => r.runs);
  if (repeats.length) out.push(`More than one counted run, the earliest scored: ${repeats.map((r) => `${r.ticket} (${r.runs} runs)`).join(', ')}.`, '');
  if (s.fewerFindings === null) {
    const named = s.notMeasured.length ? `no counted run for ${s.notMeasured.join(', ')}` : 'no ticket was counted';
    out.push(`Fewer findings than the baseline: not measured (${named})`, `Fewer weighted tokens than the baseline: not measured (${named})`);
  } else {
    out.push(
      `Fewer findings than the baseline: ${yesNo(s.fewerFindings)} (${t.wouldBlock} against ${t.oldRecord})`,
      `Fewer weighted tokens than the baseline: ${yesNo(s.fewerTokens)} (${kTok(t.newWeighted)} against ${kTok(t.oldWeighted)})`,
    );
  }
  return out.join('\n') + '\n';
}

/** The same numbers as JSON. */
export function renderReplicaJson(rows) {
  const s = summarize(rows);
  return JSON.stringify({ caveat: CAVEAT, rows: s.rows, totals: s.totals, notMeasured: s.notMeasured, fewerFindings: s.fewerFindings, fewerTokens: s.fewerTokens }, null, 2) + '\n';
}

const oneLine = (reason) => String(reason).replace(/\s+/g, ' ').trim();

/** The stop path: the caveat and the not-run line, and no verdict. */
export function renderNotRun(reason) {
  const why = oneLine(reason);
  return {
    md: ['# Round 2 replica: the plan critic after the ST-LN-91 changes', '', CAVEAT, '', `The replica was not run: ${why}`, ''].join('\n'),
    json: JSON.stringify({ caveat: CAVEAT, notRun: true, reason: why }, null, 2) + '\n',
  };
}

// ---- arguments ----------------------------------------------------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { estimate: false, plan: false };
  const VALUE = { '--not-run': 'notRun', '--tickets': 'tickets', '--backup': 'backup', '--candidates': 'candidates', '--bench': 'bench', '--out': 'out', '--transcripts': 'transcripts' };
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
  if (opts.estimate && opts.plan) return { error: '--estimate and --plan do not go together' };
  if (opts.notRun === undefined && !opts.estimate && !opts.plan && opts.tickets === undefined) return { error: 'give --estimate, --plan, --tickets or --not-run' };
  if (opts.notRun === undefined && opts.backup === undefined) return { error: 'this mode needs --backup <dir>' };
  if ((opts.plan || (!opts.estimate && opts.notRun === undefined)) && opts.tickets === undefined) return { error: 'this mode needs --tickets <ids>' };
  return { opts };
}

// ---- main -----------------------------------------------------------------------------------------------------------------------

export async function main(argv, { cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr } = {}) {
  const parsed = parseArgs(argv);
  if (parsed.error) {
    stderr.write(`round2-replica: ${parsed.error}\n${USAGE}\n`);
    return 2;
  }
  const { opts } = parsed;
  const fail = (message) => {
    stderr.write(`round2-replica: ${message}\n`);
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
      const file = path.join(out, `${REPORT}.${ext}`);
      fs.writeFileSync(file, text);
      written.push(`wrote ${REPORT}.${ext}\n`);
    }
    stdout.write(written.join(''));
    return 0;
  };

  if (opts.notRun !== undefined) {
    const { md, json } = renderNotRun(opts.notRun);
    return writeReport(md, json);
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(opts.candidates === undefined ? CANDIDATES_FILE : path.resolve(cwd, opts.candidates), 'utf8'));
  } catch (e) {
    return fail(`the candidates file does not read: ${e.message}`);
  }
  const candidates = [...config.candidates].sort((a, b) => byId(a.id, b.id));
  const sets = config.sets ?? {};

  // The tickets asked for, each a known candidate.
  let chosen = candidates;
  if (opts.tickets !== undefined) {
    const ids = [...new Set(opts.tickets.split(/[\s,]+/).filter(Boolean))].sort(byId);
    const unknown = ids.filter((id) => !candidates.some((c) => c.id === id));
    if (unknown.length) return fail(`no candidate ${unknown.join(', ')} in the candidates file (${candidates.map((c) => c.id).join(', ')})`);
    if (!ids.length) return fail('--tickets names no ticket');
    chosen = candidates.filter((c) => ids.includes(c.id));
  }

  // The original round-2 runs, read from the backup by the file name the candidates file keeps.
  const backup = path.resolve(cwd, opts.backup);
  if (!fs.existsSync(backup)) return fail('the backup folder is not there');
  const folders = [...new Set(chosen.map((c) => c.run.split('/')[0]))].sort();
  const originals = new Map();
  for (const run of readSessions(folders.map((f) => path.join(backup, f)).filter((d) => fs.existsSync(d))).runs) originals.set(run.file, run);
  const missing = chosen.filter((c) => !originals.has(c.run));
  if (missing.length) return fail(`no original run in the backup for ${missing.map((c) => `${c.id} (${c.run})`).join(', ')}`);

  const recordRound2 = (c) => {
    let text;
    try {
      text = git(['cat-file', 'blob', `${c.r2}:accord/tickets/${c.id}/plan-review.md`]);
    } catch {
      return undefined;
    }
    const cycle = countRecord(text, 'plan').findLast((cy) => cy.rounds.some((r) => r.n === 2));
    const round = cycle?.rounds.find((r) => r.n === 2);
    return round === undefined ? 0 : round.Must + round.Should;
  };
  const figures = chosen.map((c) => {
    const run = originals.get(c.run);
    return { c, run, weighted: weighted(run.usage), peak: run.peak, record: recordRound2(c) };
  });
  const unread = figures.filter((f) => f.record === undefined);
  if (unread.length) return fail(`plan-review.md is not at ${unread.map((f) => `${f.c.id} ${f.c.r2.slice(0, 8)}`).join(', ')} in this repository`);

  if (opts.estimate) {
    stdout.write('| Ticket | r1 | r2 | Old weighted k | Old peak k | Record round-2 Must + Should |\n| --- | --- | --- | ---: | ---: | ---: |\n');
    for (const f of figures) stdout.write(`| ${f.c.id} | ${f.c.r1.slice(0, 8)} | ${f.c.r2.slice(0, 8)} | ${kTok(f.weighted)} | ${kTok(f.peak)} | ${f.record} |\n`);
    stdout.write('\n');
    for (const [name, ids] of Object.entries(sets)) {
      const total = figures.filter((f) => ids.includes(f.c.id)).reduce((n, f) => n + f.weighted, 0);
      stdout.write(`Estimated weighted cost of ${name}: ${kTok(total)}\n`);
    }
    stdout.write('\nPaths each original prompt names, as the rewrite will find them (nothing is written):\n');
    for (const f of figures) {
      const prompt = f.run.dispatch?.prompt ?? '';
      stdout.write(`- ${f.c.id}: worktree root x${f.run.dispatch?.cwd ? countPath(prompt, f.run.dispatch.cwd) : 0}, diff file x${diffPathsIn(prompt).length}\n`);
    }
    const noted = figures.filter((f) => f.c.note);
    if (noted.length) stdout.write(`\nNotes:\n${noted.map((f) => `- ${f.c.id}: ${f.c.note}\n`).join('')}`);
    return 0;
  }

  if (opts.plan) return plan({ opts, git, cwd, stdout, fail, figures });
  return score({ opts, cwd, stderr, fail, figures, writeReport });
}

// ---- --plan ----------------------------------------------------------------------------------------------------------------------

function plan({ opts, git, cwd, stdout, fail, figures }) {
  let bench;
  try {
    bench = opts.bench === undefined ? mainBench(cwd).bench : slashed(path.resolve(cwd, opts.bench));
  } catch {
    return fail(`${slashed(cwd)} is not inside a git repository`);
  }
  const work = `${bench}/round2-replica`;
  const briefs = `${bench}/briefs/round2-replica`;
  const rows = [];
  for (const { c, run, weighted: cost } of figures) {
    const dispatch = run.dispatch;
    if (!dispatch?.prompt || !dispatch.cwd) return fail(`${c.id}: the original run has no dispatch prompt or working folder in the backup`);
    const diffs = diffPathsIn(dispatch.prompt);
    if (diffs.length !== 1) return fail(`${c.id}: the original prompt names ${diffs.length} diff files, not one`);
    if (countPath(dispatch.prompt, dispatch.cwd) === 0) return fail(`${c.id}: the original prompt never names its working folder`);

    const dir = `${work}/${c.id}`;
    if (fs.existsSync(dir)) {
      if (!fs.existsSync(path.join(dir, '.git'))) return fail(`${c.id}: ${dir} exists and is not a worktree`);
      let head = '';
      try {
        head = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
      } catch {
        // an unreadable worktree is reported below as not at r1
      }
      if (head !== c.r1) return fail(`${c.id}: ${dir} is not at ${c.r1.slice(0, 8)}, it is at ${head.slice(0, 8) || 'nothing readable'}; remove the worktree and run again`);
    } else {
      fs.mkdirSync(work, { recursive: true });
      git(['worktree', 'add', '--detach', dir, c.r1]);
    }

    // What the original critic read after the planner's fix: plan.md, the ticket and its ledger as round 2 holds them. The
    // record stays as round 1 left it.
    const overlay = [`accord/tickets/${c.id}/plan.md`, `accord/tickets/${c.id}.md`, `accord/tickets/${c.id}/ledger.md`];
    for (const [i, rel] of overlay.entries()) {
      let blob;
      try {
        blob = git(['cat-file', 'blob', `${c.r2}:${rel}`], 'buffer');
      } catch {
        if (i === 0) return fail(`${c.id}: ${rel} is not at ${c.r2.slice(0, 8)}`);
        continue;
      }
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), blob);
    }
    const diffFile = `${work}/${c.id}.diff`;
    fs.writeFileSync(diffFile, git(['diff', c.r1, c.r2, '--', `accord/tickets/${c.id}/plan.md`], 'buffer'));

    const paths = { fromRoot: dispatch.cwd, toRoot: dir, fromDiff: diffs[0], toDiff: diffFile };
    const prompt = rewritePrompt(dispatch.prompt, paths);
    // Only the paths may differ: undo the rewrite and the original must come back.
    if (rewritePrompt(prompt, { fromRoot: dir, toRoot: dispatch.cwd, fromDiff: diffFile, toDiff: diffs[0] }) !== dispatch.prompt) return fail(`${c.id}: the rewritten prompt differs from the original in more than its paths`);
    fs.mkdirSync(briefs, { recursive: true });
    const promptFile = `${briefs}/${c.id}.md`;
    fs.writeFileSync(promptFile, prompt);
    rows.push({ id: c.id, model: c.model, effort: c.effort, promptFile, cost });
  }
  stdout.write('| Description | subagent_type | model | effort | Prompt file | Estimated weighted k |\n| --- | --- | --- | --- | --- | ---: |\n');
  for (const r of rows) stdout.write(`| ${description(r.id)} | ${AGENT} | ${r.model} | ${r.effort} | ${r.promptFile} | ${kTok(r.cost)} |\n`);
  stdout.write(`\nEstimated total: ${kTok(rows.reduce((n, r) => n + r.cost, 0))} weighted tokens in ${rows.length} runs.\n`);
  stdout.write('Nothing is dispatched. Dispatch every row once, from a Claude Code session opened in the ST-LN-91 worktree (its .claude/agents/accord-critic.md is the new one), with the Agent tool: subagent_type, model, effort and description as shown, and the prompt file\'s text as the prompt.\n');
  return 0;
}

// ---- score -------------------------------------------------------------------------------------------------------------------------

function score({ opts, cwd, stderr, fail, figures, writeReport }) {
  // The new runs: an explicit folder holds Claude Code project folders and every one is read; by default the main checkout's
  // own and its worktrees' folders under ~/.claude/projects (the encoded-path prefix, as scripts/metrics.mjs reads them).
  let dirs = [];
  if (opts.transcripts !== undefined) {
    const folder = path.resolve(cwd, opts.transcripts);
    if (fs.existsSync(folder)) dirs = fs.readdirSync(folder, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => path.join(folder, d.name));
    else stderr.write('round2-replica: no transcript folder at the given path; no replica run is counted\n');
  } else {
    const home = path.join(os.homedir(), '.claude', 'projects');
    let main;
    try {
      main = mainBench(cwd).main;
    } catch {
      return fail(`${slashed(cwd)} is not inside a git repository`);
    }
    const prefix = projectPrefix(main).toLowerCase();
    if (fs.existsSync(home)) dirs = fs.readdirSync(home, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name.toLowerCase().startsWith(prefix)).map((d) => path.join(home, d.name));
    else stderr.write('round2-replica: no ~/.claude/projects folder; no replica run is counted\n');
  }
  const found = readSessions(dirs.sort()).runs.filter((r) => r.agent === AGENT);
  const rows = figures.map(({ c, run, weighted: oldWeighted, peak: oldPeak, record }) => {
    const counted = found.filter((r) => r.desc === description(c.id) && r.lastText.trim() !== '').sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
    const old = countReply(run.lastText);
    const row = { ticket: c.id, oldRecord: record, oldReply: old.Must + old.Should, oldWeighted, oldPeak, measured: counted.length > 0 };
    if (counted.length) {
      const now = countReply(counted[0].lastText);
      Object.assign(row, { newMust: now.Must, newShould: now.Should, wouldBlock: now.grounded, wouldDefer: now.ungrounded, newWeighted: weighted(counted[0].usage), newPeak: counted[0].peak, runs: counted.length });
    }
    return row;
  });
  return writeReport(renderReplica(rows), renderReplicaJson(rows));
}

// Last: the entry runs only once every top-level declaration above has been evaluated.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) process.exitCode = await main(process.argv.slice(2));
