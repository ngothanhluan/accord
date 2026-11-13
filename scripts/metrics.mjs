#!/usr/bin/env node
// Workflow metrics at one commit (ST-LN-95): rounds and findings per stage from accord's round records, counted by the
// 2026-11-02 study's rule, and the cost of critic and planner runs where Claude Code transcripts exist.
// Repo-internal: not shipped and not an accord command. Spawns only git, never through a shell.
// --plan-size (ST-LN-93 D-05) adds how many plans core's own size rule would refuse, at 2 x the ticket's @ac-n count.
// --plan-format (ST-LN-91 D-09, 91p-ac-5) adds how many tasks and plans core's own plan format rules would refuse (the task length cap, the fence rule, the after: line).
// Usage: node scripts/metrics.mjs [--at <commit>] [--label <name>] [--transcripts <folder>|none] [--out <dir>] [--plan-size] [--plan-format] [--stdout [--json]]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { STAGES, classifyRun, countRecord, stageTable, renderMarkdown, renderJson, weighted } from './metrics-count.mjs';
import { readSessions } from './benchmark.mjs';

const USAGE = 'usage: node scripts/metrics.mjs [--at <commit>] [--label <name>] [--transcripts <folder>|none] [--out <dir>] [--plan-size] [--plan-format] [--stdout [--json]]';
// The label names the file metrics-<label>.md, so it can hold no path separator and cannot start with a dot.
const LABEL = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const TICKET_FILE = /^accord\/tickets\/([^/]+)\//;
const RECORD = /^accord\/tickets\/([^/\0\r\n]+)\/(approach-review|plan-review|review)\.md$/;
const CONFIG = 'accord/config.yml';
const TICKET_MD = /^accord\/tickets\/([^/\0\r\n]+)\.md$/;
const PLAN_MD = /^accord\/tickets\/([^/\0\r\n]+)\/plan\.md$/;
const KIND = { 'approach-review': 'approach', 'plan-review': 'plan', review: 'review' };
const MAX_BUFFER = 64 * 1024 * 1024;

function parseArgs(argv) {
  const opts = { at: 'HEAD', label: undefined, transcripts: undefined, out: undefined, stdout: false, json: false, planSize: false, planFormat: false };
  const VALUE = { '--at': 'at', '--label': 'label', '--transcripts': 'transcripts', '--out': 'out' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--stdout') opts.stdout = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--plan-size') opts.planSize = true;
    else if (a === '--plan-format') opts.planFormat = true;
    else if (a in VALUE) {
      const v = argv[++i];
      if (v === undefined || v === '') return { error: `${a} needs a value` };
      opts[VALUE[a]] = v;
    } else return { error: `unknown argument: ${a}` };
  }
  if (opts.json && !opts.stdout) return { error: '--json goes with --stdout' };
  if (opts.label !== undefined && !LABEL.test(opts.label)) return { error: `--label must match ${LABEL.source}, got "${opts.label}"` };
  return { opts };
}

const byPath = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Every record of the three kinds in `sha`, read with one ls-tree and one cat-file --batch, and the ids of the tickets
 * that have a folder there. Ids come from the paths only. With `planSize` the same batch also reads accord/config.yml,
 * every ticket file and every plan.md, returned as `files`, with the listed paths as `tree` (the input of core's loadSnapshot).
 */
function readRecords(git, sha, planSize = false) {
  const specs = [':(literal)accord/tickets/', ...(planSize ? [`:(literal)${CONFIG}`] : [])];
  const all = git(['ls-tree', '-r', '-z', '--name-only', sha, '--', ...specs]).split('\0');
  const ids = new Set(all.map((p) => TICKET_FILE.exec(p)?.[1]).filter(Boolean));
  const extra = (p) => planSize && (p === CONFIG || TICKET_MD.test(p) || PLAN_MD.test(p));
  const paths = all.filter((p) => RECORD.test(p) || extra(p)).sort(byPath);
  const tree = all.filter(Boolean);
  const files = {};
  if (!paths.length) return { records: [], ids, files, tree };
  const raw = git(['cat-file', '--batch'], paths.map((p) => `${sha}:${p}`).join('\n') + '\n', 'buffer');
  const records = [];
  let pos = 0;
  for (const p of paths) {
    const nl = raw.indexOf(0x0a, pos);
    const header = raw.subarray(pos, nl).toString('utf8');
    const m = /^[0-9a-f]+ (\w+) (\d+)$/.exec(header);
    if (!m) {
      pos = nl + 1; // `<object> missing`: no body follows
      continue;
    }
    const size = Number(m[2]);
    const body = () => raw.subarray(nl + 1, nl + 1 + size).toString('utf8');
    const rec = RECORD.exec(p);
    if (m[1] === 'blob') {
      if (rec) records.push({ path: p, id: rec[1], kind: KIND[rec[2]], text: body() });
      else files[p] = body();
    }
    pos = nl + 1 + size + 1;
  }
  return { records, ids, files, tree };
}

/**
 * ST-LN-93 D-05: how many plans core's own sizeRefusal would refuse with no owner Ruling, taking as the expected size N the
 * number of distinct @ac-n tags of the ticket's scenarios (no old ticket records an expected size). The plans and scenarios
 * are read by core's loadSnapshot, so the count is core's and not a regex's. A ticket with a plan and no @ac-n tag is listed
 * apart and not counted. `files` is the number of plan.md files in the commit, which can exceed the plans read (core reads a
 * plan only under a ticket file that has a lane).
 */
export function planSizeCount(core, files, tree) {
  const snapshot = core.loadSnapshot({ files, tree });
  const refused = [];
  const noCriteria = [];
  let plans = 0;
  for (const id of Object.keys(snapshot.work ?? {}).sort(byPath)) {
    const plan = snapshot.work[id].plan;
    if (plan === undefined) continue;
    const expected = new Set(snapshot.tickets[id].scenarios.map((s) => s.acTag).filter((tag) => tag !== undefined)).size;
    if (expected === 0) {
      noCriteria.push(id);
      continue;
    }
    plans++;
    if (core.sizeRefusal(plan.tasks.length, expected, []) !== undefined) refused.push({ ticket: id, tasks: plan.tasks.length, expected });
  }
  return { plans, refused, noCriteria, files: tree.filter((p) => PLAN_MD.test(p)).length };
}

/** Nearest-rank percentile of an ascending list. */
const rank = (sorted, p) => (sorted.length === 0 ? 0 : sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)]);

/**
 * ST-LN-91 D-09, 91p-ac-5: how many tasks and plans core's plan format rules would refuse at the cap. The plans are read by core's
 * loadSnapshot and the tasks are measured with core's own taskLength and TASK_LINE_CAP; the snapshot's claim pins put every ticket at
 * PLAN_FORMAT_FROM (the pin the format rules read, D-15), and the fence and after: counts are the findings of core's gatePlan
 * (gate.task-code-block, gate.task-after-missing, gate.task-too-long), so the report and the gate cannot disagree. A plan is counted
 * when core reads it (a lane ticket other than S, as the format rules do); `files` is the number of plan.md files in the commit.
 */
export function planFormatCount(core, files, tree) {
  const snapshot = core.loadSnapshot({ files, tree });
  const ids = Object.keys(snapshot.work ?? {}).sort(byPath);
  snapshot.claimPins = Object.fromEntries(ids.map((id) => [id, { pin: core.PLAN_FORMAT_FROM }]));
  const lengths = [];
  let tasks = 0;
  let plans = 0;
  let tasksOver = 0;
  let plansOver = 0;
  let tasksFenced = 0;
  let plansFenced = 0;
  let plansAfterless = 0;
  let findingsOver = 0;
  for (const id of ids) {
    const plan = snapshot.work[id].plan;
    if (plan === undefined || snapshot.tickets[id]?.frontmatter?.lane === 'S') continue;
    plans++;
    const findings = core.gatePlan(snapshot, id).findings;
    const own = plan.tasks.map((t) => core.taskLength(t));
    tasks += own.length;
    lengths.push(...own);
    const over = own.filter((n) => n > core.TASK_LINE_CAP).length;
    tasksOver += over;
    if (over > 0) plansOver++;
    findingsOver += findings.filter((f) => f.rule === 'gate.task-too-long').length;
    const fences = findings.filter((f) => f.rule === 'gate.task-code-block');
    tasksFenced += plan.tasks.filter((t, i) => fences.some((f) => f.line >= t.line && (i + 1 === plan.tasks.length || f.line < plan.tasks[i + 1].line))).length;
    if (fences.length > 0) plansFenced++;
    if (findings.some((f) => f.rule === 'gate.task-after-missing')) plansAfterless++;
  }
  if (findingsOver !== tasksOver) throw new Error(`plan format count disagrees with gate plan: ${tasksOver} tasks over the cap by taskLength, ${findingsOver} gate.task-too-long findings`);
  lengths.sort((a, b) => a - b);
  return {
    cap: core.TASK_LINE_CAP,
    tasks,
    plans,
    tasksOver,
    plansOver,
    tasksFenced,
    plansFenced,
    plansAfterless,
    lengths: { p50: rank(lengths, 50), p90: rank(lengths, 90), p95: rank(lengths, 95), max: lengths.length ? lengths[lengths.length - 1] : 0 },
    files: tree.filter((p) => PLAN_MD.test(p)).length,
  };
}

/** Claude Code's project folder name for a checkout: every character but a letter or digit becomes `-`. */
export const projectPrefix = (checkout) => String(checkout).replace(/[^A-Za-z0-9]/g, '-');

/**
 * The counted critic and planner runs. `folder` holds Claude Code project folders; only those of the main checkout
 * and its worktrees (names starting with the main checkout's prefix) are read. A folder is named in the report by the
 * checkout's own name plus the rest of the folder name, so no home path reaches the report.
 */
function readRuns(folder, main, ids, before) {
  const prefix = projectPrefix(main).toLowerCase();
  const names = fs
    .readdirSync(folder, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.toLowerCase().startsWith(prefix))
    .map((d) => d.name)
    .sort(byPath);
  const own = projectPrefix(path.basename(main));
  const labelOf = (name) => own + name.slice(prefix.length);
  const runs = [];
  for (const run of readSessions(names.map((n) => path.join(folder, n))).runs) {
    const cls = classifyRun(run);
    if (cls === undefined || run.start === null || run.start > before || !ids.has(run.ticket)) continue;
    const name = run.file.slice(0, run.file.indexOf('/'));
    runs.push({ file: labelOf(name) + run.file.slice(name.length), ticket: run.ticket, class: cls, weighted: weighted(run.usage), peak: run.peak, ms: run.ms });
  }
  return { folders: names.map(labelOf), runs: runs.sort((a, b) => byPath(a.file, b.file)) };
}

export async function main(argv, { cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr } = {}) {
  const parsed = parseArgs(argv);
  if (parsed.error) {
    stderr.write(`metrics: ${parsed.error}\n${USAGE}\n`);
    return 2;
  }
  const { opts } = parsed;
  const git = (args, input, as) =>
    execFileSync('git', args, {
      cwd,
      maxBuffer: MAX_BUFFER,
      stdio: ['pipe', 'pipe', 'pipe'],
      ...(input === undefined ? {} : { input }),
      ...(as === 'buffer' ? {} : { encoding: 'utf8' }),
    });

  let root;
  try {
    root = git(['rev-parse', '--show-toplevel']).trim();
  } catch {
    stderr.write(`metrics: ${cwd} is not inside a git repository\n`);
    return 2;
  }
  let sha;
  try {
    sha = git(['rev-parse', '--verify', '--end-of-options', `${opts.at}^{commit}`]).trim();
  } catch {
    stderr.write(`metrics: "${opts.at}" is not a commit in this repository\n`);
    return 2;
  }
  const [date, seconds] = git(['-c', 'log.showSignature=false', 'log', '-1', '--no-show-signature', '--format=%cs%x00%ct', sha]).trim().split('\0');
  const label = opts.label ?? date;

  let core;
  if (opts.planSize || opts.planFormat) {
    const coreFile = fileURLToPath(new URL('../packages/core/dist/index.js', import.meta.url));
    if (!fs.existsSync(coreFile)) {
      stderr.write(`metrics: ${coreFile.split(path.sep).join('/')} is missing; run npm run build first\n`);
      return 2;
    }
    core = await import(pathToFileURL(coreFile).href);
  }
  const { records, ids, files, tree } = readRecords(git, sha, opts.planSize || opts.planFormat);
  const stages = {};
  for (const kind of STAGES) {
    const mine = records.filter((r) => r.kind === kind);
    stages[kind] = { records: mine.length, ...stageTable(mine.flatMap((r) => countRecord(r.text, kind))) };
  }

  // Transcripts: the named folder, else ~/.claude/projects when it exists; `none`, or a folder that is not there, is not measured.
  const home = path.join(os.homedir(), '.claude', 'projects');
  const folder = opts.transcripts === 'none' ? undefined : opts.transcripts === undefined ? (fs.existsSync(home) ? home : undefined) : path.resolve(cwd, opts.transcripts);
  let transcripts = { folders: [], runs: [] };
  if (folder !== undefined && !fs.existsSync(folder)) stderr.write(`metrics: no transcript folder at ${opts.transcripts}; the run columns are not measured\n`);
  else if (folder !== undefined) {
    const main = path.dirname(git(['rev-parse', '--path-format=absolute', '--git-common-dir']).trim());
    transcripts = readRuns(folder, main, ids, Number(seconds) * 1000);
  }
  const report = { label, commit: sha, date, stages, transcripts: { folders: transcripts.folders }, runs: transcripts.runs };
  if (opts.planSize) report.planSize = planSizeCount(core, files, tree);
  if (opts.planFormat) report.planFormat = planFormatCount(core, files, tree);
  const md = renderMarkdown(report);
  const json = renderJson(report);

  if (opts.stdout) {
    stdout.write(opts.json ? json : md);
    return 0;
  }
  const out = opts.out === undefined ? path.join(root, 'docs', 'benchmark') : path.resolve(cwd, opts.out);
  fs.mkdirSync(out, { recursive: true });
  const written = [];
  for (const [ext, text] of [['md', md], ['json', json]]) {
    const file = path.join(out, `metrics-${label}.${ext}`);
    fs.writeFileSync(file, text);
    written.push(path.relative(root, file).split(path.sep).join('/'));
  }
  stdout.write(written.map((f) => `wrote ${f}\n`).join(''));
  return 0;
}

// Last: the entry runs only once every top-level declaration above has been evaluated.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) process.exitCode = await main(process.argv.slice(2));
