#!/usr/bin/env node
// Workflow metrics at one commit (ST-LN-95): rounds and findings per stage from accord's round records, counted by the
// 2026-11-02 study's rule, and the cost of critic and planner runs where Claude Code transcripts exist.
// Repo-internal: not shipped and not an accord command. Spawns only git, never through a shell.
// Usage: node scripts/metrics.mjs [--at <commit>] [--label <name>] [--transcripts <folder>|none] [--out <dir>] [--stdout [--json]]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { STAGES, countRecord, stageTable, renderMarkdown, renderJson } from './metrics-count.mjs';

const USAGE = 'usage: node scripts/metrics.mjs [--at <commit>] [--label <name>] [--transcripts <folder>|none] [--out <dir>] [--stdout [--json]]';
// The label names the file metrics-<label>.md, so it can hold no path separator and cannot start with a dot.
const LABEL = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const RECORD = /^accord\/tickets\/([^/\0\r\n]+)\/(approach-review|plan-review|review)\.md$/;
const KIND = { 'approach-review': 'approach', 'plan-review': 'plan', review: 'review' };
const MAX_BUFFER = 64 * 1024 * 1024;

function parseArgs(argv) {
  const opts = { at: 'HEAD', label: undefined, transcripts: undefined, out: undefined, stdout: false, json: false };
  const VALUE = { '--at': 'at', '--label': 'label', '--transcripts': 'transcripts', '--out': 'out' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--stdout') opts.stdout = true;
    else if (a === '--json') opts.json = true;
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

/** Every record of the three kinds in `sha`, read with one ls-tree and one cat-file --batch; ids come from the paths only. */
function readRecords(git, sha) {
  const paths = git(['ls-tree', '-r', '-z', '--name-only', sha, '--', ':(literal)accord/tickets/'])
    .split('\0')
    .filter((p) => RECORD.test(p))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (!paths.length) return [];
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
    const [, id, name] = RECORD.exec(p);
    if (m[1] === 'blob') records.push({ path: p, id, kind: KIND[name], text: raw.subarray(nl + 1, nl + 1 + size).toString('utf8') });
    pos = nl + 1 + size + 1;
  }
  return records;
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
  const [date] = git(['-c', 'log.showSignature=false', 'log', '-1', '--no-show-signature', '--format=%cs%x00%ct', sha]).trim().split('\0');
  const label = opts.label ?? date;

  const records = readRecords(git, sha);
  const stages = {};
  for (const kind of STAGES) {
    const mine = records.filter((r) => r.kind === kind);
    stages[kind] = { records: mine.length, ...stageTable(mine.flatMap((r) => countRecord(r.text, kind))) };
  }
  const report = { label, commit: sha, date, stages, transcripts: { measured: false, folders: [], runs: 0 } };
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
