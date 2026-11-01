#!/usr/bin/env node
// Benchmark of accord agent runs: reads Claude Code subagent transcripts plus git, prints Markdown.
// Not shipped; the prototype of a future `accord runs`. Numbers only, no model call.
// Usage: node scripts/benchmark.mjs [projectsDir ...] > report.md
// Default projectsDir: every ~/.claude/projects/<dir> whose name starts with this repo's encoded path.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync, execSync } from 'node:child_process';
import { parse as parseYaml } from 'yaml';
import { parsePlanReview } from './plan-review.mjs';
import { median, ROLES, WRITERS, checkSamples, readDiffers, runMatrix, rewriteBrief, dispatchTable, matchRuns, mustsOf, judgeBrief, parseVerdict, holds, turnFlags, report, carryJudgeBriefs, escapes, exitState, runProblem } from './round.mjs';
import { compliance, render as renderCompliance, parseCompliance, mergeCompliance } from './compliance.mjs';
import { standsFor, firstCall, pendingProbes, probeVersion, textsOf, measure, render, ticketShares, PROBE_BRANCH, PROBE_BRIEF, PROBE_DESCRIPTION, PROBE_FORMS, PROBE_PREFIX, dispatchPrompt, phaseOne, shellLine } from './fixed-context.mjs';

const projectsRoot = path.join(os.homedir(), '.claude', 'projects');
const defaultDirs = (repo) => {
  const encoded = repo.replace(/[:\\/]/g, '-');
  return fs.readdirSync(projectsRoot).filter((d) => d.startsWith(encoded)).map((d) => path.join(projectsRoot, d));
};

const ID = /\b([A-Z]+(?:-[A-Z]+)?-\d+)\b/;
const min = (ms) => (ms / 60000).toFixed(1);
const k = (n) => (n / 1000).toFixed(0) + 'k';

// ---- transcripts -------------------------------------------------------------
// A subagent run of a fixed-context probe (ST-LN-79): measurement, not work, so the round tools leave it out.
const probeRun = (meta, lines) => String(meta.description ?? '').startsWith(PROBE_DESCRIPTION) || lines.some((o) => o.gitBranch === PROBE_BRANCH);

function readRun(jsonl, meta) {
  const lines = fs.readFileSync(jsonl, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  if (probeRun(meta, lines)) return null;
  const seen = new Set();
  let input = 0, output = 0, tools = 0, model = '', effort = '', branch = '', lastText = '', handedBack = false;
  for (const o of lines) {
    if (o.effort && !effort) effort = o.effort;
    if (o.gitBranch && !branch) branch = o.gitBranch;
    if (o.type !== 'assistant' || !o.message) continue;
    const m = o.message;
    if (m.model && m.model !== '<synthetic>') model = m.model;
    for (const c of Array.isArray(m.content) ? m.content : []) {
      if (c.type === 'tool_use') tools++;
      // The report is the last hand-back; a text written after it (a woken run's reply) is not the report.
      if (c.type === 'text' && c.text.trim() && !handedBack) lastText = c.text;
      if (c.type === 'tool_use' && c.name === 'SubagentHandback') { lastText = String(c.input?.message ?? ''); handedBack = true; }
      // shortcut: the transcript keeps the usage from the stream's start, so output is estimated at 4 characters a token.
      output += (c.text ?? c.thinking ?? JSON.stringify(c.input ?? '')).length / 4;
    }
    // A streamed message repeats its usage on every content block; count it once.
    const id = m.id ?? o.requestId ?? o.uuid;
    if (m.usage && !seen.has(id)) {
      seen.add(id);
      input += (m.usage.input_tokens ?? 0) + (m.usage.cache_creation_input_tokens ?? 0) + (m.usage.cache_read_input_tokens ?? 0);
    }
  }
  const times = lines.map((o) => Date.parse(o.timestamp)).filter((t) => !Number.isNaN(t)).sort((a, b) => a - b);
  // Active time: a gap over 10 minutes is an idle agent later resumed, not work.
  const active = times.slice(1).reduce((sum, t, i) => sum + Math.min(t - times[i], 10 * 60000), 0);
  const desc = meta.description ?? '';
  const ticket = (desc.match(ID) ?? branch.match(ID) ?? [])[1] ?? '';
  const task = Number((desc.match(/\btask\s+(\d+)/i) ?? [])[1]) || null;
  const findings = { Must: 0, Should: 0, Nice: 0 };
  for (const f of lastText.matchAll(/^\s*\d+\.\s*\**\s*(Must|Should|Nice)\b/gm)) findings[f[1]]++;
  return {
    agent: meta.agentType, desc, ticket, task, model, effort, input, output, tools,
    start: Math.min(...times), ms: active,
    outcome: (lastText.match(/^\s*(DONE|BLOCKED[^\n]*|NEEDS_CONTEXT)/) ?? [])[1]?.slice(0, 40) ?? '',
    findings, fix: /\bfix/i.test(desc),
  };
}

export function legacyReport(dirs) {
const repo = process.cwd();
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const runs = [];
for (const dir of dirs) {
  for (const session of fs.readdirSync(dir)) {
    const sub = path.join(dir, session, 'subagents');
    if (!fs.existsSync(sub)) continue;
    for (const f of fs.readdirSync(sub).filter((f) => f.endsWith('.meta.json'))) {
      const jsonl = path.join(sub, f.slice(0, -'.meta.json'.length) + '.jsonl');
      const run = fs.existsSync(jsonl) ? readRun(jsonl, JSON.parse(fs.readFileSync(path.join(sub, f), 'utf8'))) : null;
      if (run) runs.push(run);
    }
  }
}
const accordRuns = runs.filter((r) => r.agent?.startsWith('accord-'));

// ---- git ---------------------------------------------------------------------
const subjects = git('-c', 'log.showSignature=false', 'log', '--no-show-signature', '--format=%s', 'HEAD').split('\n');
const ticketsDir = path.join(repo, 'accord', 'tickets');
const ticketIds = fs.readdirSync(ticketsDir).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));

function planTasks(id) {
  const p = path.join(ticketsDir, id, 'plan.md');
  if (!fs.existsSync(p)) return new Map();
  const tasks = new Map();
  for (const part of fs.readFileSync(p, 'utf8').split(/^## Task /m).slice(1)) {
    const n = Number(part.match(/^(\d+)/)?.[1]);
    const verify = part.match(/^verify:(.*)$/m)?.[1] ?? '';
    const kinds = [...new Set([...verify.matchAll(/risk:(data-loss|complex-branching|[a-z]+)/g)].map((m) => m[1]))];
    if (/\(@ac-\d+\)/.test(verify)) kinds.unshift('ac');
    tasks.set(n, kinds.join(',') || '-');
  }
  return tasks;
}

function reviewRounds(id) {
  const p = path.join(ticketsDir, id, 'review.md');
  if (!fs.existsSync(p)) return null;
  const rounds = fs.readFileSync(p, 'utf8').split(/^## Round /m).slice(1);
  const count = (re) => rounds.reduce((n, r) => n + (r.match(re) ?? []).length, 0);
  return { rounds: rounds.length, must: count(/^Must \d+/gm), should: count(/^Should \d+/gm), nice: count(/^Nice \d+/gm) };
}

function planRounds(id) {
  const p = path.join(ticketsDir, id, 'plan-review.md');
  if (fs.existsSync(p)) return { ...parsePlanReview(fs.readFileSync(p, 'utf8')), source: 'plan-review.md' };
  // Older tickets: the subject counts what the round reported, not what stayed open.
  let must = 0, should = 0, rounds = 0;
  for (const s of subjects) {
    const m = s.match(new RegExp(`^plan: ${id} round \\d+, (\\d+) Must, (\\d+) Should`));
    if (m) { rounds++; must += Number(m[1]); should += Number(m[2]); }
  }
  return { rounds, must, should, wholeAfterFirst: null, source: 'subjects' };
}

// ---- report ------------------------------------------------------------------
const out = [];
const row = (...cells) => out.push('| ' + cells.join(' | ') + ' |');
const first = Math.min(...runs.map((r) => r.start)), last = Math.max(...runs.map((r) => r.start));
out.push('# accord agent benchmark', '');
out.push(`${runs.length} subagent runs (${accordRuns.length} accord agents) from ${new Date(first).toISOString().slice(0, 10)} to ${new Date(last).toISOString().slice(0, 10)}, read from ${dirs.length} transcript folder(s).`, '');

out.push('## By agent', '');
row('agent', 'runs', 'model', 'effort', 'median min', 'total min', 'median tools', '~output tok', 'input tok');
row('---', '---:', '---', '---', '---:', '---:', '---:', '---:', '---:');
const byAgent = Object.groupBy(runs, (r) => r.agent);
for (const [agent, rs] of Object.entries(byAgent).sort((a, b) => b[1].length - a[1].length)) {
  const tally = (key) => Object.entries(Object.groupBy(rs, (r) => r[key] || '?')).map(([v, x]) => `${v} ${x.length}`).join(', ');
  row(agent, rs.length, tally('model'), tally('effort'), min(median(rs.map((r) => r.ms))), min(rs.reduce((s, r) => s + r.ms, 0)),
    median(rs.map((r) => r.tools)), k(rs.reduce((s, r) => s + r.output, 0)), k(rs.reduce((s, r) => s + r.input, 0)));
}

out.push('', '## By ticket', '');
row('ticket', 'accord runs', 'executor runs', 'critic runs', 'agent min', '~output tok', 'plan rounds (Must/Should first reported; whole reads after round 1; source)', 'review rounds (Must/Should/Nice)');
row('---', '---:', '---:', '---:', '---:', '---:', '---', '---');
for (const id of ticketIds) {
  const rs = accordRuns.filter((r) => r.ticket === id);
  const pr = planRounds(id), rv = reviewRounds(id);
  if (!rs.length && !pr.rounds && !rv) continue;
  row(id, rs.length, rs.filter((r) => r.agent === 'accord-executor').length, rs.filter((r) => r.agent === 'accord-critic').length,
    min(rs.reduce((s, r) => s + r.ms, 0)), k(rs.reduce((s, r) => s + r.output, 0)),
    `${pr.rounds} (${pr.must}/${pr.should}; ${pr.wholeAfterFirst ?? '?'}; ${pr.source})`, rv ? `${rv.rounds} (${rv.must}/${rv.should}/${rv.nice})` : '-');
}

out.push('', '## Executor runs per plan task', '');
out.push('Kinds come from the task\'s `verify:` line: `ac` when it proves a criterion, then each `risk:<kind>`. A build run is one whose description does not say fix; more than one build run on a task is a retry.', '');
row('ticket', 'task', 'kinds', 'build runs', 'fix runs', 'model', 'outcomes', 'min', '~output tok');
row('---', '---:', '---', '---:', '---:', '---', '---', '---:', '---:');
const execs = accordRuns.filter((r) => r.agent === 'accord-executor');
const perTask = Object.groupBy(execs.filter((r) => r.ticket && r.task), (r) => `${r.ticket}#${r.task}`);
for (const [key, rs] of Object.entries(perTask).sort()) {
  const [id, n] = key.split('#');
  const kinds = planTasks(id).get(Number(n)) ?? '?';
  row(id, n, kinds, rs.filter((r) => !r.fix).length, rs.filter((r) => r.fix).length, [...new Set(rs.map((r) => r.model))].join(', '),
    rs.map((r) => r.outcome || '?').join(', '), min(rs.reduce((s, r) => s + r.ms, 0)), k(rs.reduce((s, r) => s + r.output, 0)));
}
const unmatched = execs.filter((r) => !(r.ticket && r.task));
if (unmatched.length) {
  out.push('', `Executor runs not tied to a task (${unmatched.length}): ` + unmatched.map((r) => `"${r.desc}"`).join(', '));
}

out.push('', '## Findings reported by critics and reviewers', '');
row('agent', 'runs', 'runs with Must', 'Must', 'Should', 'Nice');
row('---', '---:', '---:', '---:', '---:', '---:');
for (const agent of ['accord-critic', 'accord-reviewer', 'accord-final-reviewer', 'accord-auditor']) {
  const rs = accordRuns.filter((r) => r.agent === agent);
  const sum = (s) => rs.reduce((n, r) => n + r.findings[s], 0);
  row(agent, rs.length, rs.filter((r) => r.findings.Must).length, sum('Must'), sum('Should'), sum('Nice'));
}
out.push('', 'Counts come from numbered `n. Must|Should|Nice` lines in each run\'s last message, so a report in another shape counts as zero.');

return out.join('\n') + '\n';
}

// ---- readers shared by the compliance check and the round (ST-LN-14) ------------
const slash = (p) => String(p).replace(/\\/g, '/');
const readLines = (file) => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const items = (o) => (Array.isArray(o.message?.content) ? o.message.content : []);
const pick = (o, key) => o[key] ?? o.message?.[key];
const stamp = (o) => { const t = Date.parse(o.timestamp); return Number.isNaN(t) ? null : t; };
const resultText = (c) => (typeof c.content === 'string' ? c.content : Array.isArray(c.content) ? c.content.filter((x) => x.type === 'text').map((x) => x.text).join('\n') : '');
const ownFiles = (p, ext) => (fs.existsSync(p) ? fs.readdirSync(p, { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith(ext)).map((e) => e.name) : []);

function refusalsIn(file, lines) {
  const found = [];
  for (const o of lines) {
    if (o.type !== 'user') continue;
    for (const c of items(o)) {
      if (c.type !== 'tool_result') continue;
      const rows = resultText(c).split('\n');
      rows.forEach((row, i) => {
        const m = row.match(/^task (\d+) of (\S+) is not done:$/);
        if (!m) return;
        const reasons = [];
        for (let j = i + 1; j < rows.length && rows[j].startsWith('  '); j++) reasons.push(rows[j].trim());
        found.push({ file, ts: stamp(o), ticket: m[2], task: Number(m[1]), reasons });
      });
    }
  }
  return found;
}

// `git commit`, also with options between: git -c k=v commit, git -C dir commit.
const GIT_COMMIT = /\bgit(?:\s+(?:-[cC]\s+(?:"[^"]*"|'[^']*'|\S+)|--?[\w-]+(?:=\S+)?))*\s+commit\b/;

function parseRun(file, id, meta, lines, session) {
  const turnsById = new Map();
  const toolById = new Map();
  const edits = [], reads = [], handbacks = [], commitRows = [];
  const times = lines.map(stamp).filter((t) => t !== null).sort((a, b) => a - b);
  let branch = '', lastText = '';
  for (const o of lines) {
    if (o.gitBranch && !branch) branch = o.gitBranch;
    if (o.type === 'user') {
      for (const c of items(o)) {
        if (c.type !== 'tool_result') continue;
        const use = toolById.get(c.tool_use_id);
        if (!use) continue;
        const text = resultText(c);
        // Only the Read tool and a bare one-file `cat` are compared with the replay (rootReads, sampleDrift): recovering the files a `grep`, `head` or `sed` read from its arguments is guesswork. Uncommitted state read that way, the verifiers' tests.report, is recreated by --plan instead.
        if (use.name === 'Read') {
          const body = text.split('\n');
          const cut = body.findIndex((l) => l.startsWith('<system-reminder>'));
          const shown = cut < 0 ? body : body.slice(0, cut);
          // The line numbers say which lines a cut read shows; without a numbered first line the read is not comparable.
          const start = Number(shown[0]?.match(/^\s*(\d+)\t/)?.[1]) || null;
          const total = o.toolUseResult?.file?.totalLines ?? null;
          reads.push({ path: use.path, text: shown.map((l) => l.replace(/^\s*\d+\t/, '')).join('\n').replace(/\n+$/, ''), ts: use.ts, start, total, wrote: use.wrote, whole: start === 1 && (total === null ? use.whole : shown.filter(Boolean).length >= total - 1) });
        } else if (use.name === 'Bash' && /^\s*cat\s+("[^"]+"|'[^']+'|\S+)\s*$/.test(String(use.input?.command ?? ''))) {
          const file = slash(String(use.input.command).trim().replace(/^cat\s+/, '').replace(/^(["'])(.*)\1$/, '$2'));
          reads.push({ path: file, text: text.replace(/\n+$/, ''), ts: use.ts, start: 1, total: null, wrote: edits.some((e) => sameFile(e.path, file)), whole: true });
        } else if (use.name === 'Bash' && GIT_COMMIT.test(String(use.input?.command ?? ''))) {
          // Only git's own summary line, `[<branch> <sha>] <subject>` or `[<branch> (root-commit) <sha>]`; a log line is an older commit.
          for (const m of text.matchAll(/^\[[^\]\n]* ([0-9a-f]{7,40})\]/gm)) commitRows.push(m[1]);
        }
      }
      continue;
    }
    if (o.type !== 'assistant' || !o.message) continue;
    const m = o.message;
    const mid = m.id ?? o.requestId ?? o.uuid;
    let t = turnsById.get(mid);
    if (!t && m.model !== '<synthetic>') {
      t = { id: mid, ts: stamp(o), model: '', requestedModel: '', effort: '', perTurnEffort: '', u: { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 }, chars: 0 };
      turnsById.set(mid, t);
    }
    if (t) {
      t.model ||= m.model ?? '';
      t.requestedModel ||= pick(o, 'requestedModel') ?? '';
      t.effort ||= pick(o, 'effort') ?? '';
      t.perTurnEffort ||= pick(o, 'perTurnEffort') ?? '';
      const u = m.usage ?? {};
      t.u.input = Math.max(t.u.input, u.input_tokens ?? 0);
      t.u.cacheRead = Math.max(t.u.cacheRead, u.cache_read_input_tokens ?? 0);
      t.u.cacheWrite = Math.max(t.u.cacheWrite, u.cache_creation_input_tokens ?? 0);
      t.u.output = Math.max(t.u.output, u.output_tokens ?? 0);
    }
    for (const c of items(o)) {
      // The report is the last hand-back; a text written after it (a woken run's reply) is not the report.
      if (c.type === 'text' && c.text.trim() && !handbacks.length) lastText = c.text;
      if (c.type === 'tool_use') {
        if (toolById.has(c.id)) continue;
        const input = c.input ?? {};
        const p = slash(input.file_path ?? input.notebook_path ?? '');
        toolById.set(c.id, { name: c.name, input, path: p, ts: stamp(o), whole: input.offset == null && input.limit == null, wrote: edits.some((e) => sameFile(e.path, p)) });
        if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(c.name)) edits.push({ path: p, ts: stamp(o) });
        if (c.name === 'SubagentHandback') {
          lastText = String(input.message ?? '');
          handbacks.push({ ts: stamp(o), text: lastText });
          for (const row of lastText.matchAll(/^commits:(.*)$/gm)) for (const h of row[1].matchAll(/\b[0-9a-f]{7,40}\b/g)) commitRows.push(h[0]);
        }
      }
      if (t) t.chars += (c.text ?? c.thinking ?? (c.type === 'tool_use' ? JSON.stringify(c.input ?? '') : '')).length;
    }
  }
  const usage = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, estimated: false };
  for (const t of turnsById.values()) {
    const est = Math.ceil(t.chars / 4);
    if (est > t.u.output) { t.u.output = est; usage.estimated = true; }
    for (const key of ['input', 'cacheRead', 'cacheWrite', 'output']) usage[key] += t.u[key];
  }
  const desc = meta.description ?? '';
  const use = session.uses.get(meta.toolUseId);
  return {
    file, id, agent: meta.agentType, desc,
    ticket: (desc.match(ID) ?? branch.match(ID) ?? [])[1] ?? '',
    task: Number((desc.match(/\btask\s+(\d+)/i) ?? [])[1]) || null,
    fix: /\bfix/i.test(desc), metaModel: meta.model ?? '', metaEffort: meta.effort ?? '',
    start: times[0] ?? null, end: times.at(-1) ?? null,
    // Active time: a gap over 10 minutes is an idle agent later resumed, not work.
    ms: times.slice(1).reduce((sum, x, i) => sum + Math.min(x - times[i], 10 * 60000), 0),
    dispatch: use ? { ...use.input, ts: use.ts, cwd: use.cwd } : null,
    turns: [...turnsById.values()].map(({ id: tid, ts, model, requestedModel, effort, perTurnEffort }) => ({ id: tid, ts, model, requestedModel, effort, perTurnEffort })),
    usage, edits, commits: [...new Set(commitRows)], reads, handbacks,
    outcome: (lastText.match(/^\s*(DONE|BLOCKED[^\n]*|NEEDS_CONTEXT)/) ?? [])[1]?.slice(0, 40) ?? '',
    lastText, sends: session.sends.filter((s) => s.to === id),
  };
}

export function readSessions(dirs) {
  const runs = [], refusals = [];
  for (const dir of dirs) {
    const name = path.basename(dir);
    const sessions = ownFiles(dir, '.jsonl').map((f) => f.slice(0, -'.jsonl'.length));
    const uses = new Map(), sends = [];
    for (const s of sessions) {
      const file = `${name}/${s}.jsonl`;
      const lines = readLines(path.join(dir, `${s}.jsonl`));
      for (const o of lines) {
        if (o.type !== 'assistant') continue;
        for (const c of items(o)) {
          if (c.type !== 'tool_use' || uses.has(c.id)) continue;
          uses.set(c.id, { input: c.input ?? {}, ts: stamp(o), cwd: o.cwd ?? o.message?.cwd });
          if (c.name === 'SendMessage') sends.push({ ts: stamp(o), to: c.input?.to, summary: c.input?.summary, message: c.input?.message });
        }
      }
      refusals.push(...refusalsIn(file, lines));
    }
    for (const s of sessions) {
      const sub = path.join(dir, s, 'subagents');
      for (const f of ownFiles(sub, '.meta.json')) {
        const id = f.slice('agent-'.length, -'.meta.json'.length);
        const jsonl = path.join(sub, `agent-${id}.jsonl`);
        if (!fs.existsSync(jsonl)) continue;
        const file = `${name}/${s}/subagents/agent-${id}.jsonl`;
        const lines = readLines(jsonl);
        const meta = JSON.parse(fs.readFileSync(path.join(sub, f), 'utf8'));
        if (probeRun(meta, lines)) continue;
        refusals.push(...refusalsIn(file, lines));
        runs.push(parseRun(file, id, meta, lines, { uses, sends }));
      }
    }
  }
  const seen = new Set();
  return { runs, refusals: refusals.filter((r) => { const key = JSON.stringify([r.file, r.ticket, r.task, r.reasons]); return seen.has(key) ? false : (seen.add(key), true); }) };
}

// ---- every call, main session and subagents (ST-LN-79) ---------------------------
const userText = (o) => (typeof o.message?.content === 'string' ? o.message.content : items(o).filter((c) => c.type === 'text').map((c) => c.text).join('\n'));
const sortedNames = (dir, ext) => ownFiles(dir, ext).sort();

// A call is one assistant message that is not `<synthetic>`; a streamed message repeats its usage, so each usage field
// is the largest over the message's lines. Output is the larger of the recorded value and the 4-characters-a-token
// estimate: the transcript keeps the usage from the stream's start. Probe sessions and runs, and calls made in or for
// the bench folder, are measurement and are left out. Returns `{ calls, version, folders }`; `version` is the Claude
// Code of the newest kept call.
export function readCalls(dirs, { bench }) {
  const benchDir = slash(bench).toLowerCase();
  const underBench = (cwd) => { const c = slash(cwd ?? '').toLowerCase(); return c === benchDir || c.startsWith(`${benchDir}/`); };
  const calls = [];
  const callsOf = (file, lines, row) => {
    const byId = new Map();
    for (const o of lines) {
      if (o.type !== 'assistant' || !o.message || o.message.model === '<synthetic>') continue;
      const id = o.message.id ?? o.requestId ?? o.uuid;
      let c = byId.get(id);
      if (!c) {
        c = { row, accord: row.startsWith('accord-'), file, ts: stamp(o) ?? 0, model: o.message.model ?? '', version: o.version ?? '', cwd: o.cwd ?? '', branch: o.gitBranch ?? '', input: 0, cacheRead: 0, cacheWrite: 0, output: 0, chars: 0 };
        byId.set(id, c);
      }
      const u = o.message.usage ?? {};
      c.input = Math.max(c.input, u.input_tokens ?? 0);
      c.cacheRead = Math.max(c.cacheRead, u.cache_read_input_tokens ?? 0);
      c.cacheWrite = Math.max(c.cacheWrite, u.cache_creation_input_tokens ?? 0);
      c.output = Math.max(c.output, u.output_tokens ?? 0);
      for (const item of items(o)) c.chars += (item.text ?? item.thinking ?? (item.type === 'tool_use' ? JSON.stringify(item.input ?? '') : '')).length;
    }
    for (const { chars, ...c } of byId.values()) {
      if (underBench(c.cwd) || c.branch.startsWith('bench/')) continue;
      calls.push({ ...c, output: Math.max(c.output, Math.ceil(chars / 4)) });
    }
  };
  for (const dir of dirs) {
    const name = path.basename(dir);
    for (const s of sortedNames(dir, '.jsonl').map((f) => f.slice(0, -'.jsonl'.length))) {
      const lines = readLines(path.join(dir, `${s}.jsonl`));
      if (lines.some((o) => o.gitBranch === PROBE_BRANCH) || userText(lines.find((o) => o.type === 'user') ?? {}).startsWith(PROBE_PREFIX)) continue;
      callsOf(`${name}/${s}.jsonl`, lines, 'main');
      const sub = path.join(dir, s, 'subagents');
      for (const f of sortedNames(sub, '.meta.json')) {
        const id = f.slice('agent-'.length, -'.meta.json'.length);
        const jsonl = path.join(sub, `agent-${id}.jsonl`);
        if (!fs.existsSync(jsonl)) continue;
        let meta;
        try { meta = JSON.parse(fs.readFileSync(path.join(sub, f), 'utf8')); } catch { continue; }
        const subLines = readLines(jsonl);
        if (typeof meta.agentType !== 'string' || probeRun(meta, subLines)) continue;
        callsOf(`${name}/${s}/subagents/agent-${id}.jsonl`, subLines, meta.agentType);
      }
    }
  }
  const newest = calls.reduce((best, c) => (best === undefined || c.ts > best.ts ? c : best), undefined);
  return { calls, version: newest?.version, folders: dirs.length };
}

export function agentSettings(repo) {
  return Object.fromEntries(Object.keys(ROLES).map((a) => {
    const fm = fs.readFileSync(path.join(repo, '.claude', 'agents', `${a}.md`), 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/)[1];
    const { model, effort } = parseYaml(fm);
    return [a, { model, effort }];
  }));
}

export const benchRoot = (repo) => path.resolve(repo, '..', 'accord-bench');

const gitIn = (repo, args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });

export function commitInfo(repo, short) {
  try {
    const [sha, at, ...rest] = gitIn(repo, ['-c', 'log.showSignature=false', 'show', '--no-show-signature', '-s', '--format=%H%x00%at%x00%B', `${short}^{commit}`]).split('\0');
    return { sha: sha.trim(), at: Number(at) * 1000, message: rest.join('\0').replace(/\n+$/, '') };
  } catch { return undefined; }
}

export function testFileAt(repo, file, ms) {
  try {
    const rows = gitIn(repo, ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '--all', '--format=%H %at', '--', file]).split('\n').filter(Boolean).map((l) => l.split(' '));
    const best = rows.filter(([, at]) => Number(at) * 1000 <= ms).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
    return best ? gitIn(repo, ['-c', 'log.showSignature=false', 'show', '--no-show-signature', `${best[0]}:${file}`]) : undefined;
  } catch { return undefined; }
}

export function complianceSettings(repo) {
  const cfg = parseYaml(fs.readFileSync(path.join(repo, 'accord', 'config.yml'), 'utf8')) ?? {};
  const agent = fs.readFileSync(path.join(repo, '.claude', 'agents', 'accord-executor.md'), 'utf8');
  return {
    tierUp: Number(cfg.escalation?.fix_round_tier_up ?? 4),
    executorModel: cfg.models?.executor?.model ?? agent.match(/^model:\s*["']?([^\s"']+)/m)?.[1] ?? '',
  };
}

const resolves = (repo, ref) => { try { gitIn(repo, ['rev-parse', '--verify', '-q', ref]); return true; } catch { return false; } };

export function defaultRef(repo) {
  return ['refs/remotes/origin/HEAD', 'refs/remotes/origin/main', 'refs/heads/main', 'refs/heads/master'].find((r) => resolves(repo, r));
}

export function ticketAt(repo, id, ms) {
  const file = `accord/tickets/${id}.md`;
  const refs = [`refs/heads/t/${id}`, `refs/remotes/origin/t/${id}`, defaultRef(repo)].filter((r) => r && resolves(repo, r));
  if (!refs.length) return undefined;
  try {
    const rows = gitIn(repo, ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '--format=%H %at', ...refs, '--', file]).split('\n').filter(Boolean).map((l) => l.split(' '));
    const best = rows.filter(([, at]) => Number(at) * 1000 <= ms).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
    return best ? gitIn(repo, ['-c', 'log.showSignature=false', 'show', '--no-show-signature', `${best[0]}:${file}`]) : undefined;
  } catch { return undefined; }
}

export function branchCommits(repo) {
  const refs = gitIn(repo, ['for-each-ref', '--format=%(refname)', 'refs/heads/main', 'refs/heads/t', 'refs/remotes/origin/main', 'refs/remotes/origin/t']).split('\n').filter(Boolean);
  if (!refs.length) return [];
  const seen = new Map();
  for (const row of gitIn(repo, ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '--format=%H%x1f%at%x1f%B%x1e', ...refs, '--']).split('\x1e')) {
    const [sha, at, ...rest] = row.replace(/^\n/, '').split('\x1f');
    if (sha && !seen.has(sha)) seen.set(sha, { sha, at: Number(at) * 1000, message: rest.join('\x1f').replace(/\n+$/, '') });
  }
  return [...seen.values()];
}

export function ticketRecords(repo) {
  const dir = path.join(repo, 'accord', 'tickets');
  const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '');
  const show = (ref, file) => { try { return gitIn(repo, ['-c', 'log.showSignature=false', 'show', '--no-show-signature', `${ref}:${file}`]); } catch { return ''; } };
  const found = {};
  for (const e of fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []) {
    if (e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'review.md'))) found[e.name] = { review: read(path.join(dir, e.name, 'review.md')), ledger: read(path.join(dir, e.name, 'ledger.md')) };
  }
  const branches = gitIn(repo, ['for-each-ref', '--format=%(refname)', 'refs/heads/t', 'refs/remotes/origin/t']).split('\n').filter(Boolean);
  // A local branch comes first in the list, so its copy wins over the remote one.
  const done = new Set();
  for (const ref of branches) {
    const id = ref.replace(/^refs\/(heads|remotes\/origin)\/t\//, '');
    if (done.has(id)) continue;
    const review = show(ref, `accord/tickets/${id}/review.md`);
    if (!review) continue;
    done.add(id);
    found[id] = { review, ledger: show(ref, `accord/tickets/${id}/ledger.md`) };
  }
  return found;
}

const showAt = (repo, base, file) => { try { return gitIn(repo, ['-c', 'log.showSignature=false', 'show', '--no-show-signature', `${base}:${file}`]); } catch { return undefined; } };
const existsAt = (repo, base, file) => { try { gitIn(repo, ['cat-file', '-e', `${base}:${file}`]); return true; } catch { return false; } };
const slashed = (p) => p.replace(/\\/g, '/');
const sameFile = (a, b) => slashed(a).toLowerCase() === slashed(b).toLowerCase();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// What a run read under its root in its first assignment (before a later coordinator message and before it wrote the file), root-relative.
export function rootReads(run, root) {
  const low = slashed(root).toLowerCase() + '/';
  const end = Math.min(Infinity, ...(run.sends ?? []).map((s) => s.ts ?? Infinity));
  return run.reads
    .filter((r) => r.start != null && !r.wrote && (r.ts ?? 0) < end && slashed(r.path).toLowerCase().startsWith(low))
    .map((r) => ({ path: slashed(r.path).slice(low.length), start: r.start, total: r.total ?? null, whole: r.whole, text: r.text }));
}

// Problems for each stored read that differs from the file the replay worktree will hold: the file at base, or its overlay.
export function sampleDrift(repo, sample, reads) {
  const out = [], seen = new Set();
  const textOf = (rel) => {
    const o = (sample.overlay ?? []).find((x) => x.path === rel);
    if (!o) return showAt(repo, sample.base, rel);
    if (o.from !== 'read') return showAt(repo, o.from, rel);
    return reads.find((r) => r.path === rel && r.whole)?.text;
  };
  for (const o of sample.overlay ?? []) {
    if (o.from === 'read' && !reads.some((r) => r.path === o.path && r.whole)) out.push(`overlay ${o.path} is from the run's read, which is partial or missing`);
    else if (o.from !== 'read' && showAt(repo, o.from, o.path) === undefined) out.push(`overlay ${o.path} does not exist at ${o.from}`);
  }
  for (const r of reads) {
    const text = textOf(r.path);
    const key = r.path + '\0' + r.start + '\0' + r.text;
    if (seen.has(key)) continue;
    seen.add(key);
    if (text === undefined) out.push(`${r.path} was read by the run and does not exist in the replay worktree`);
    else { const d = readDiffers(r, text); if (d) out.push(`${r.path} differs from the file the replay worktree will hold, first at ${d}`); }
  }
  return out;
}

// The root reads sit beside sample.json, which is never rewritten; a snapshot older than this file gets it on the next --samples.
const READS = 'root-reads.json';
const storeReads = (dir, reads) => { const f = path.join(dir, READS); if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify(reads, null, 2) + '\n'); };
const storedReads = (dir) => { const f = path.join(dir, READS); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };

// A transcript is identified by its `<session>/subagents/<agent file>` tail; the project folder is only where Claude Code stored it.
export const transcriptTail = (t) => t.split('/').slice(1).join('/');

// A snapshot is never overwritten: once the transcripts expire it is the only copy of the dispatch.
export function snapshotSample(repo, sample, run, bench) {
  const name = sample.agent.slice('accord-'.length) + '-' + sample.n;
  const dir = path.join(bench, 'samples', name);
  const file = path.join(dir, 'sample.json');
  const at = `${sample.agent} ${sample.n}`;
  if (fs.existsSync(file)) {
    const have = JSON.parse(fs.readFileSync(file, 'utf8')).transcript;
    return { problems: transcriptTail(have) === transcriptTail(sample.transcript) ? [] : [`${at}: the snapshot in ${slashed(dir)} is of ${have}, not ${sample.transcript}`], kept: true };
  }
  const problems = [];
  if (!run?.dispatch) return { problems: [`${at}: no run for ${at} in ${sample.transcript}`], kept: false };
  const { prompt } = run.dispatch;
  // An effort-override probe is not past work to measure.
  if (/^\s*Probe run/.test(prompt)) return { problems: [`${at}: the dispatch is a probe run, not past work`], kept: false };
  if (sample.agent === 'accord-executor') {
    const plan = showAt(repo, sample.base, `accord/tickets/${sample.ticket}/plan.md`) ?? '';
    const section = plan.split(/^## /m).find((s) => s.startsWith(`Task ${sample.task}:`)) ?? '';
    const shows = /^verify:.*\brisk:/m.test(section) ? 'risk' : 'plain';
    if (shows !== sample.kind) problems.push(`kind ${sample.kind} does not match the verify line of task ${sample.task}, which shows ${shows}`);
  }
  const ticket = showAt(repo, sample.base, `accord/tickets/${sample.ticket}.md`);
  if (ticket === undefined) problems.push(`accord/tickets/${sample.ticket}.md does not exist at base`);
  const rel = new RegExp(`(?<![A-Za-z0-9_])${slashed(sample.root).split('/').map(esc).join('[\\\\/]')}[\\\\/]([^\\s"'\`,;)]+)`, 'gi');
  for (const m of prompt.matchAll(rel)) {
    const r = slashed(m[1]).replace(/\.$/, '').replace(/\/$/, '');
    if (r && !existsAt(repo, sample.base, r)) problems.push(`${r} does not exist at base`);
  }
  const read = (p) => run.reads.find((x) => sameFile(x.path, p));
  for (const f of sample.files) {
    if (f.from === 'copy') {
      if (!fs.existsSync(f.path)) problems.push(`${f.path} is missing`);
      else {
        if (fs.statSync(f.path).mtimeMs > run.dispatch.ts) problems.push(`${f.path} was modified after the dispatch`);
        if (read(f.path) && fs.readFileSync(f.path, 'utf8').replace(/\n+$/, '') !== read(f.path).text.replace(/\n+$/, '')) problems.push(`${f.path} differs from what the run read`);
      }
    }
    if (!read(f.path)) problems.push(`${f.path} was never read by the run`);
  }
  const seen = rootReads(run, sample.root);
  problems.push(...sampleDrift(repo, sample, seen));
  if (ticket !== undefined) {
    const mine = slashed(bench);
    const paths = [
      [sample.root, `${mine}/wt/${name}`],
      ...sample.elsewhere.map((p, i) => [p, `${mine}/absent/${i + 1}`]),
      ...sample.files.map((f) => [f.path, `${mine}/files/${name}/${path.posix.basename(slashed(f.path))}`]),
    ];
    const pairs = sample.pairs.map(([from, to]) => [from, sample[to]]);
    const check = { bench: mine, allowed: [] };
    problems.push(...rewriteBrief(prompt, { ticket, paths, pairs, check }).problems);
    for (const f of sample.files) {
      const r = read(f.path);
      if (r) problems.push(...rewriteBrief(r.text, { ticket, paths, pairs, check: { ...check, refs: false } }).problems);
    }
  }
  if (problems.length) return { problems: [...new Set(problems)].map((p) => `${at}: ${p}`), kept: false };
  fs.mkdirSync(dir, { recursive: true });
  const reads = Object.fromEntries(sample.files.map((f) => [f.path, read(f.path).text]));
  fs.writeFileSync(file, JSON.stringify({ transcript: sample.transcript, prompt, cwd: run.dispatch.cwd, ts: run.dispatch.ts, reads }, null, 2) + '\n');
  storeReads(dir, seen);
  return { problems, kept: false };
}

// A review-package file base must lie in its sample's history, else the rebuilt package diffs from a merge-base and covers other work.
export function checkFileBases(repo, list) {
  const out = [];
  for (const s of list.samples) for (const f of s.files) {
    if (f.from !== 'review-package') continue;
    let ok = true;
    try { execFileSync('git', ['merge-base', '--is-ancestor', f.base, s.base], { cwd: repo, stdio: 'ignore' }); } catch { ok = false; }
    if (!ok) out.push(`${s.agent} ${s.n}: ${f.path} base ${f.base} is not an ancestor of the sample base ${s.base}`);
  }
  return out;
}

// A recorded read that is the package itself must cover the same changed files as the rebuild; header and hashes differ by design after a history rewrite.
// A Read tool error (too large) cannot be compared.
// A read cut short by the Read tool's limit ends inside its last file's diff: files after that one are not drift.
const packageChunks = (t) => new Map(t.split(/^(?=diff --git )/m).filter((c) => c.startsWith('diff --git ')).map((c) => [c.match(/^diff --git a\/.+ b\/(.+)$/m)[1], trimEnd(c)]));
export function packageDrift(sample, f, read, built) {
  if (typeof read !== 'string' || /exceeds maximum allowed size/.test(read.slice(0, 300))) return undefined;
  const [a, b] = [packageChunks(read), packageChunks(built)];
  const [ra, rb] = [[...a.keys()], [...b.keys()]];
  const last = ra.at(-1);
  const cut = last !== undefined && b.has(last) && b.get(last) !== a.get(last) && b.get(last).startsWith(a.get(last));
  const skip = new Set(cut ? rb.slice(rb.indexOf(last) + 1) : []);
  const only = [...ra.filter((p) => !b.has(p)).map((p) => `${p} (only in the run's read)`), ...rb.filter((p) => !a.has(p) && !skip.has(p)).map((p) => `${p} (only in the rebuild)`)];
  return only.length ? `${sample.agent} ${sample.n}: the review package ${f.path} rebuilt at base changes other files than the one the run read: ${only.join(', ')}` : undefined;
}

function runSamples(repo) {
  const listFile = path.join(repo, 'scripts', 'benchmark-samples.json');
  if (!fs.existsSync(listFile)) { process.stderr.write('no sample list: scripts/benchmark-samples.json\n'); return 2; }
  const list = JSON.parse(fs.readFileSync(listFile, 'utf8'));
  const bad = [...checkSamples(list), ...checkFileBases(repo, list)];
  if (bad.length) { process.stderr.write(bad.join('\n') + '\n'); return 2; }
  const bench = benchRoot(repo);
  const folders = new Map();
  const problems = [];
  let written = 0, kept = 0;
  const dirOf = (s) => path.join(bench, 'samples', `${s.agent.slice('accord-'.length)}-${s.n}`);
  const folderRuns = (seg) => { if (!folders.has(seg)) folders.set(seg, readSessions([path.join(projectsRoot, seg)]).runs); return folders.get(seg); };
  // The listed path, else the one project folder that holds the same session tail; several is a problem.
  const located = new Map(), ambiguous = new Set();
  const runOf = (s) => {
    if (located.has(s)) return located.get(s);
    const tail = transcriptTail(s.transcript);
    let seg = s.transcript.split('/')[0];
    if (!fs.existsSync(path.join(projectsRoot, s.transcript))) {
      const where = fs.existsSync(projectsRoot) ? fs.readdirSync(projectsRoot).filter((d) => fs.existsSync(path.join(projectsRoot, d, tail))) : [];
      if (where.length > 1) { problems.push(`${s.agent} ${s.n}: ${tail} is in more than one project folder: ${where.map((d) => `${d}/${tail}`).join(', ')}`); ambiguous.add(s); }
      else if (where.length) {
        seg = where[0];
        process.stderr.write(`notice: ${s.agent} ${s.n}: ${s.transcript} is now ${seg}/${tail}\n`);
      }
      if (where.length !== 1) { located.set(s, undefined); return undefined; }
    }
    const run = folderRuns(seg).find((r) => transcriptTail(r.file) === tail);
    located.set(s, run);
    return run;
  };
  // First every sample's root reads against its replay worktree: nothing is written while one drifts.
  const reads = new Map();
  for (const s of list.samples) {
    const have = storedReads(dirOf(s));
    const run = have ? null : runOf(s);
    if (have || run?.dispatch) reads.set(s, have ?? rootReads(run, s.root));
    else if (fs.existsSync(path.join(dirOf(s), 'sample.json')) && !ambiguous.has(s)) problems.push(`${s.agent} ${s.n}: no stored root reads and no run in ${s.transcript} to read them from`);
    for (const p of sampleDrift(repo, s, reads.get(s) ?? [])) problems.push(`${s.agent} ${s.n}: ${p}`);
  }
  if (problems.length) { process.stderr.write(problems.join('\n') + '\n'); return 2; }
  for (const s of list.samples) {
    const exists = fs.existsSync(path.join(dirOf(s), 'sample.json'));
    const out = snapshotSample(repo, s, exists ? undefined : runOf(s), bench);
    problems.push(...out.problems);
    if (out.kept) { kept++; if (!out.problems.length && reads.has(s)) storeReads(dirOf(s), reads.get(s)); } else if (!out.problems.length) written++;
  }
  if (problems.length) { process.stderr.write(problems.join('\n') + '\n'); return 2; }
  process.stdout.write(`${written} written, ${kept} kept\n`);
  return 0;
}

// ---- worktrees ----------------------------------------------------------------
const MARKER = 'accord-bench';

// A worktree the benchmark declines to touch; a setup failure is a plain Error, which --plan repeats.
class Refusal extends Error {}
export const planHint = (e) => e instanceof Refusal
  ? "(the worktree holds a run's commits or uncommitted work, or something git did not remove; look at it, then run --clean or --rerun" + (/already exists/.test(e.message) ? '; a folder git no longer lists must be deleted by hand after checking it holds only links' : '') + ')'
  : '(setup is repeated on the next --plan run)';

export function addWorktree(repo, { path: dir, base, branch }) {
  if (fs.existsSync(dir)) throw new Refusal(`${dir} already exists`);
  try {
    gitIn(repo, ['worktree', 'add', '-q', ...(branch ? ['-b', branch] : ['--detach']), dir, base]);
  } catch (e) { throw new Error(String(e.stderr || e.message).trim(), { cause: e }); }
  fs.writeFileSync(path.join(gitIn(dir, ['rev-parse', '--absolute-git-dir']).trim(), MARKER), dir);
  return { path: dir, base, ...(branch ? { branch } : {}) };
}

// The worktree is saved before its setup runs (so a failed setup can still be cleaned) but is `ready` only after setup succeeded; a re-run repeats a setup that never finished.
// A recorded worktree whose base or overlay differs from the spec is rebuilt, and `preparedAt` is set only then: a run dispatched before it saw another state.
// An overlay file is written after setup, uncommitted: the original run read a working tree.
const overlayKey = (o) => JSON.stringify((o ?? []).map(({ path: p, from }) => [p, from]));

// True when nothing under `dir` is a regular file: only directories, junctions and symlinks (lstat, never followed).
const onlyLinks = (dir) => fs.readdirSync(dir, { withFileTypes: true }).every((e) => e.isSymbolicLink() || (e.isDirectory() && onlyLinks(path.join(dir, e.name))));
// On Windows `git worktree remove` exits 0 but skips directory junctions (npm ci's workspace links) and the folders above them.
// What is left is removed only when it holds nothing but links; rmSync does not follow a link into its target.
function gitRemoveWorktree(repo, dir) {
  gitIn(repo, ['worktree', 'remove', '--force', dir]);
  removeLeftover(dir);
}
export function removeLeftover(dir) {
  let left;
  try { left = fs.lstatSync(dir); } catch { return; }
  if (!left.isDirectory() || !onlyLinks(dir)) throw new Refusal(`${dir} still holds files after git removed the worktree; nothing was deleted`);
  fs.rmSync(dir, { recursive: true, force: true });
}

// `kept`: the run's commits are already under a refs/keep ref, so a branch or HEAD past the base is not a loss.
function removeWorktree(repo, rec, { kept = false } = {}) {
  let tip = null;
  if (rec.branch) { try { tip = gitIn(repo, ['rev-parse', `refs/heads/${rec.branch}`]).trim(); } catch { /* already gone */ } }
  // The branch is the run's commits: compare it with the base before anything is removed, whatever the folder holds.
  if (tip && tip !== rec.base && !kept) throw new Refusal(`${rec.path} holds commits of a run (${rec.branch} is at ${tip.slice(0, 7)}, not its base); it is not rebuilt`);
  if (fs.existsSync(rec.path)) {
    if (!fs.existsSync(path.join(gitIn(rec.path, ['rev-parse', '--absolute-git-dir']).trim(), MARKER))) throw new Refusal(`${rec.path} is not a worktree this benchmark made; it is not rebuilt`);
    if (rec.branch && !kept && gitIn(rec.path, ['rev-parse', 'HEAD']).trim() !== rec.base) throw new Refusal(`${rec.path} holds commits of a run; it is not rebuilt`);
    gitRemoveWorktree(repo, rec.path);
  } else gitIn(repo, ['worktree', 'prune']);
  // update-ref -d with the checked sha: a commit made after the check makes git refuse instead of losing it.
  if (tip) gitIn(repo, ['update-ref', '-d', `refs/heads/${rec.branch}`, tip]);
}

// Dispatching a writer row again: every commit its worktree can reach (the branch tip, and a HEAD that left the branch) is kept under refs/keep/bench/<tag>/<k>, then the worktree is removed so the next prepare rebuilds it at base.
// Nothing changes when the folder has uncommitted work or its HEAD cannot be read. Returns the refs made, joined by ", ", or null.
export function rerunWorktree(repo, state, key) {
  const rec = state.worktrees[key];
  if (!rec) return null;
  const tips = [];
  if (rec.branch) {
    try { const tip = gitIn(repo, ['rev-parse', `refs/heads/${rec.branch}`]).trim(); if (tip !== rec.base) tips.push(tip); } catch { /* no branch to keep */ }
    if (fs.existsSync(rec.path)) {
      let head;
      try { head = gitIn(rec.path, ['rev-parse', 'HEAD']).trim(); } catch { throw new Refusal(`${rec.path}: its HEAD cannot be read; it is not rebuilt`); }
      if (gitIn(rec.path, ['status', '--porcelain']).trim()) throw new Refusal(`${rec.path} has uncommitted changes of a run; it is not rebuilt`);
      if (head !== rec.base && !tips.includes(head)) tips.push(head);
    }
  }
  const refs = [];
  for (const tip of tips) {
    const used = gitIn(repo, ['for-each-ref', '--format=%(refname)', `refs/keep/${rec.branch}/`]).split(/\r?\n/).filter(Boolean).map((r) => Number(r.split('/').pop())).filter(Number.isInteger);
    const ref = `refs/keep/${rec.branch}/${Math.max(0, ...used) + 1}`;
    gitIn(repo, ['update-ref', ref, tip]);
    refs.push(ref);
  }
  removeWorktree(repo, rec, { kept: true });
  delete state.worktrees[key];
  return refs.length ? refs.join(', ') : null;
}

export function prepareWorktree(repo, state, key, spec, setup, save = () => {}) {
  let rec = state.worktrees[key];
  // `report`: the run reads the tests.report file the verify stage left, so a worktree recorded without it is rebuilt like one whose base changed.
  if (rec && (rec.base !== spec.base || overlayKey(rec.overlay) !== overlayKey(spec.overlay) || Boolean(rec.report) !== Boolean(spec.report))) {
    removeWorktree(repo, rec);
    delete state.worktrees[key];
    rec = undefined;
  }
  if (!rec) {
    const { overlay, report, ...at } = spec;
    rec = { ...addWorktree(repo, at), ...(report ? { report: true } : {}), ...(overlay?.length ? { overlay: overlay.map(({ path: p, from }) => ({ path: p, from })) } : {}), preparedAt: Date.now() };
    state.worktrees[key] = rec;
    save();
  }
  if (!rec.ready) {
    setup(rec.path);
    for (const o of spec.overlay ?? []) {
      const file = path.join(rec.path, o.path);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, o.text);
    }
    rec.ready = true;
    save();
  }
  return rec.path;
}

export const atBase = (dir, base) => { try { return gitIn(dir, ['rev-parse', 'HEAD']).trim() === base; } catch { return false; } };

// The commits a run made: named in its transcript, committed inside its own window, and not the sample's base or one under it.
export function ownCommits(repo, run, base) {
  const out = [];
  for (const short of run.commits ?? []) {
    const c = commitInfo(repo, short);
    if (!c || run.start === null || c.at < run.start - 60000 || c.at > run.end + 60000) continue;
    try { gitIn(repo, ['merge-base', '--is-ancestor', c.sha, base]); continue; } catch { /* not at or under the base */ }
    out.push(c.sha);
  }
  return out;
}

export function cleanWorktrees(repo, { force } = {}) {
  if (!force && !fs.existsSync(path.join(repo, 'docs', 'benchmark', 'round-1.md'))) return { refused: true, removed: [], failed: [] };
  const entries = gitIn(repo, ['worktree', 'list', '--porcelain']).split(/\r?\n\r?\n+/).filter(Boolean).slice(1);
  const removed = [], failed = [];
  for (const e of entries) {
    const dir = /^worktree (.+)$/m.exec(e)?.[1]?.trim();
    const branch = /^branch (.+)$/m.exec(e)?.[1]?.trim();
    if (!dir || !fs.existsSync(dir)) continue;
    try {
      if (!fs.existsSync(path.join(gitIn(dir, ['rev-parse', '--absolute-git-dir']).trim(), MARKER))) continue;
      gitRemoveWorktree(repo, dir);
      if (branch?.startsWith('refs/heads/bench/')) gitIn(repo, ['branch', '-D', branch.slice('refs/heads/'.length)]);
      removed.push(slashed(dir));
    } catch (err) { failed.push({ path: slashed(dir), message: String(err.stderr || err.message).trim() }); }
  }
  return { refused: false, removed, failed };
}

function runClean(repo, force) {
  const out = cleanWorktrees(repo, { force });
  if (out.refused) {
    process.stderr.write("the round report docs/benchmark/round-1.md does not exist yet; --clean would delete every run's worktree and branch. Pass --force to clean anyway.\n");
    return 2;
  }
  for (const p of out.removed) process.stdout.write(`removed ${p}\n`);
  for (const f of out.failed) process.stderr.write(`failed ${f.path}: ${f.message}\nUndo: stop the node processes, git worktree remove --force ${f.path}, git worktree prune, delete the folder.\n`);
  return out.failed.length ? 1 : 0;
}

const configAt = (dir, repo) => parseYaml(fs.readFileSync(path.join(fs.existsSync(path.join(dir, 'accord', 'config.yml')) ? dir : repo, 'accord', 'config.yml'), 'utf8'));
// A base older than the `setup:` key gets the repository's own.
export const setupAt = (dir, repo) => configAt(dir, repo).setup ?? configAt(repo, repo).setup ?? [];
const sh = (command, cwd) => execSync(command, { cwd, stdio: ['ignore', 2, 2] });
// A red full suite gets one re-run of just its failing files (a load-dependent timeout passes alone); red again throws that second error.
// Returns { rerun: { files, ok } } when it had to re-run, {} when green first time.
// With a base (scoring), a failing file the run itself wrote or changed is not re-run alone: it gets the full suite again, under the same load.
export function runSuite(dir, repo, base) {
  const tests = configAt(dir, repo).tests;
  const start = Date.now();
  try { sh(tests.full, dir); return {}; } catch { /* re-run below */ }
  let files = [];
  try {
    const report = path.join(dir, tests.report);
    // A report older than this run is a leftover; a classname that is no file here (`vitest unhandled errors`) is not a failing file.
    if (fs.statSync(report).mtimeMs >= start - 1000) {
      const xml = fs.readFileSync(report, 'utf8');
      files = [...new Set([...xml.matchAll(/<testcase\b[^>]*?\bclassname="([^"]+)"[^>]*?(?:\/>|>([\s\S]*?)<\/testcase>)/g)]
        .filter((m) => /<(failure|error)\b/.test(m[2] ?? '')).map((m) => m[1]))];
      if (!files.every((f) => fs.existsSync(path.join(dir, f)))) files = [];
    }
  } catch { /* no readable report */ }
  let changed = new Set();
  if (base && files.length) {
    const z = (args) => execFileSync('git', ['-c', 'log.showSignature=false', ...args], { cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).split('\0').filter(Boolean);
    // diff covers committed and uncommitted edits to tracked files; ls-files adds files the run created and did not stage.
    changed = new Set([...z(['diff', '--name-only', '-z', base]), ...z(['ls-files', '--others', '--exclude-standard', '-z'])]);
  }
  const narrow = files.length && !files.some((f) => changed.has(f)) && tests.affected?.includes('{files}');
  sh(narrow ? tests.affected.replace('{files}', () => files.map((f) => `"${f}"`).join(" ")) : tests.full, dir);
  return { rerun: { files: narrow ? files : [], ok: true } };
}
const cli = (dir, args) => execFileSync(process.execPath, ['packages/cli/dist/cli.js', ...args], { cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const trimEnd = (t) => t.replace(/\n+$/, '');

function runPlan(repo, reruns = []) {
  const err = (m) => { process.stderr.write(m + '\n'); return 2; };
  const bench = slashed(benchRoot(repo));
  if (!fs.existsSync(path.join(bench, 'compliance.md'))) return err('run --compliance first: the round adds commits');
  const listFile = path.join(repo, 'scripts', 'benchmark-samples.json');
  if (!fs.existsSync(listFile)) return err('no sample list: scripts/benchmark-samples.json');
  const list = JSON.parse(fs.readFileSync(listFile, 'utf8'));
  const bad = [...checkSamples(list), ...checkFileBases(repo, list)];
  if (bad.length) return err(bad.join('\n'));
  const rows = runMatrix(list, agentSettings(repo));
  const snaps = new Map(), drifts = new Map();
  for (const s of list.samples) {
    const name = s.agent.slice('accord-'.length) + '-' + s.n;
    const file = path.join(bench, 'samples', name, 'sample.json');
    if (!fs.existsSync(file)) return err(`run --round 1 --samples first: no snapshot for ${s.agent} ${s.n}`);
    const snap = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (transcriptTail(snap.transcript) !== transcriptTail(s.transcript)) return err(`${s.agent} ${s.n}: the snapshot in ${slashed(path.dirname(file))} is of ${snap.transcript}, not ${s.transcript}`);
    snaps.set(name, snap);
    const reads = storedReads(path.dirname(file));
    if (!reads) return err(`run --round 1 --samples first: no stored root reads for ${s.agent} ${s.n}`);
    const drift = sampleDrift(repo, s, reads);
    if (drift.length) return err(drift.map((p) => `${s.agent} ${s.n}: ${p}`).join('\n'));
    drifts.set(name, reads);
  }
  const stateFile = path.join(bench, 'round-1.json');
  const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {};
  // Named tags are checked before anything changes: only a writer row of the saved round can be dispatched again.
  const unknown = reruns.filter((tag) => !WRITERS.includes((state.rows ?? []).find((r) => r.tag === tag)?.agent));
  if (unknown.length) return err(`--rerun takes the tag of a writer row in round-1.json; not one: ${unknown.join(', ')}`);
  state.worktrees ??= {};
  state.live ??= liveState(repo);
  const save = () => { fs.mkdirSync(bench, { recursive: true }); fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n'); };
  const sampleOf = (r) => list.samples.find((s) => s.agent === r.agent && s.n === r.n);
  const specs = new Map();
  for (const r of rows) {
    const s = sampleOf(r);
    const key = WRITERS.includes(r.agent) ? r.tag : r.agent.slice('accord-'.length) + '-' + r.n;
    const dir = `${bench}/wt/${key}`;
    const reads = drifts.get(r.agent.slice('accord-'.length) + '-' + r.n);
    const overlay = (s.overlay ?? []).map((o) => ({ ...o, text: o.from === 'read' ? reads.find((x) => x.path === o.path && x.whole).text + '\n' : showAt(repo, o.from, o.path) }));
    const spec = { path: dir, base: s.base, overlay, ...(WRITERS.includes(r.agent) ? { branch: `bench/${r.tag}` } : {}), ...(r.agent === 'accord-verifier' ? { report: true } : {}) };
    // Rows share a worktree only with an equal spec.
    const sig = JSON.stringify([spec.base, overlayKey(overlay)]);
    if (specs.has(key) && specs.get(key) !== sig) return err(`${key}: two samples want different contents in one worktree`);
    specs.set(key, sig);
    try {
      if (reruns.includes(r.tag)) {
        const kept = rerunWorktree(repo, state, key);
        save();
        if (kept) process.stdout.write(`kept ${r.tag}'s earlier commits at ${kept}\n`);
      }
      r.worktree = prepareWorktree(repo, state, key, spec, (d) => { for (const c of setupAt(d, repo)) sh(c, d); }, save);
    } catch (e) { return err(`${key}: ${e.message} ${planHint(e)}`); }
    r.prepared = state.worktrees[key].preparedAt;
  }
  for (const s of list.samples.filter((x) => x.agent === 'accord-executor')) {
    const r = rows.find((x) => x.agent === s.agent && x.n === s.n && x.current);
    // After dispatch the worktree holds the run's commits: the base is no longer what it holds.
    if (!atBase(r.worktree, s.base)) continue;
    try {
      const out = runSuite(r.worktree, repo);
      if (out.rerun) { (state.reruns ??= {})[`${s.agent.slice('accord-'.length)}-${s.n}`] = out.rerun; save(); }
    } catch { return err(`suite red at base for ${s.agent} ${s.n}`); }
  }
  // A verifier's original ran after the verify stage's tests.full, and read the report it wrote (a red suite leaves one too). Run it once per sample; its effort siblings have the same base and overlay, so they get a copy.
  const reported = new Map();
  for (const r of rows.filter((x) => x.agent === 'accord-verifier')) {
    const rel = configAt(r.worktree, repo).tests?.report;
    if (typeof rel !== 'string') return err(`${r.agent} ${r.n}: the config at its base has no tests.report, which the verifier's worktree needs`);
    const file = path.join(r.worktree, rel);
    try {
      if (!fs.existsSync(file)) {
        const first = reported.get(`${r.agent}-${r.n}`);
        if (first && fs.existsSync(first)) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.copyFileSync(first, file); }
        else { try { sh(configAt(r.worktree, repo).tests.full, r.worktree); } catch { /* the original saw a red suite's report too */ } }
      }
    } catch (e) { return err(`${r.tag}: ${e.message} (repeated on the next --plan run)`); }
    if (!fs.existsSync(file)) return err(`${r.tag}: tests.full left no report at ${slashed(file)} (repeated on the next --plan run)`);
    if (!reported.has(`${r.agent}-${r.n}`)) reported.set(`${r.agent}-${r.n}`, file);
  }
  fs.mkdirSync(`${bench}/briefs`, { recursive: true });
  for (const r of rows) {
    const s = sampleOf(r);
    const snap = snaps.get(r.agent.slice('accord-'.length) + '-' + r.n);
    const ticket = gitIn(repo, ['-c', 'log.showSignature=false', 'show', '--no-show-signature', `${s.base}:accord/tickets/${s.ticket}.md`]);
    const writing = WRITERS.includes(r.agent);
    const own = `bench/${r.tag}`;
    const dest = (f) => `${bench}/files/${r.tag}/${path.posix.basename(slashed(f.path))}`;
    const paths = [[s.root, r.worktree], ...s.elsewhere.map((p, i) => [p, `${bench}/absent/${i + 1}`]), ...s.files.map((f) => [f.path, dest(f)])];
    const pairs = s.pairs.flatMap(([from, to]) => {
      if (writing && (from === `t/${s.ticket}` || from === `origin/t/${s.ticket}`)) return [[from, own]];
      if (writing && from === 'HEAD') return [];
      return [[from, s[to]]];
    });
    const allowed = writing ? ['HEAD', own] : [];
    for (const f of s.files) {
      let text = snap.reads[f.path];
      if (f.from !== 'copy') {
        const args = f.from === 'brief' ? ['brief', s.ticket, f.task] : ['review-package', s.ticket, '--base', f.base];
        let built;
        try { built = cli(r.worktree, args); } catch (e) { return err(`${r.tag}: ${args[0]} failed: ${String(e.stderr || e.message).trim()}`); }
        if (f.from === 'review-package') {
          const drift = packageDrift(s, f, text, built);
          if (drift) return err(drift);
          text = built;
        }
        else if (trimEnd(built) === trimEnd(text)) text = built;
        else process.stderr.write(`notice: ${r.tag}: ${f.path} is built differently at base; the text the run read is used\n`);
      }
      const out = rewriteBrief(text, { ticket, paths, pairs, check: { bench, allowed, refs: false } });
      if (out.problems.length) return err(`${r.tag}: ${out.problems.join('; ')}`);
      fs.mkdirSync(path.dirname(dest(f)), { recursive: true });
      fs.writeFileSync(dest(f), out.text);
    }
    const out = rewriteBrief(snap.prompt, { ticket, paths, pairs, check: { bench, allowed } });
    if (out.problems.length) return err(`${r.tag}: ${out.problems.join('; ')}`);
    r.prompt = `${bench}/briefs/${r.tag}.md`;
    fs.writeFileSync(r.prompt, out.text);
  }
  carryJudgeBriefs(rows, state.rows ?? []);
  state.rows = rows;
  save();
  process.stdout.write(dispatchTable(rows));
  process.stdout.write("Dispatch every row: description, subagent_type, model and effort as shown, and the prompt file's text as the prompt. Judges are printed by --round 1 --judge once these runs finish.\n");
  return 0;
}

function runCompliance(folders, repo) {
  if (!folders.length) { process.stderr.write('--compliance needs the transcript folders to read\n'); return 2; }
  const s = readSessions(folders);
  const result = compliance({
    runs: s.runs, refusals: s.refusals, commits: branchCommits(repo), tickets: ticketRecords(repo), settings: complianceSettings(repo),
    commitInfo: (short) => commitInfo(repo, short), testFile: (p, ts) => testFileAt(repo, p, ts), ticketAt: (id, ms) => ticketAt(repo, id, ms),
  });
  const file = path.join(benchRoot(repo), 'compliance.md');
  // A newer read never overwrites an earlier one: a transcript that has expired since keeps its lines.
  const text = renderCompliance(fs.existsSync(file) ? mergeCompliance(parseCompliance(fs.readFileSync(file, 'utf8')), result) : result);
  fs.mkdirSync(benchRoot(repo), { recursive: true });
  fs.writeFileSync(file, text);
  process.stdout.write(text);
  return 0;
}

// ---- judges and the round report ------------------------------------------------
function loadRound(repo, extra) {
  const err = (m) => { process.stderr.write(m + '\n'); return null; };
  const bench = slashed(benchRoot(repo));
  const stateFile = path.join(bench, 'round-1.json');
  if (!fs.existsSync(stateFile)) return err('run --round 1 --plan first');
  const rows = JSON.parse(fs.readFileSync(stateFile, 'utf8')).rows;
  if (!rows) return err('run --round 1 --plan first');
  const list = JSON.parse(fs.readFileSync(path.join(repo, 'scripts', 'benchmark-samples.json'), 'utf8'));
  const dirs = [...new Set([...defaultDirs(repo), ...extra])];
  return { bench, rows, list, runs: readSessions(dirs).runs };
}

const readOr = (file, dflt = '') => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : dflt);
const verificationOf = (row) => readOr(`${row.worktree}/accord/tickets/${row.ticket}/verification.md`);
const kindOf = (agent) => ({ executor: 'must', planner: 'must', fact: 'fact' }[ROLES[agent]] ?? 'match');

// Writes a judge brief and stamps the row when its text is new or changed: a judge dispatched before that time saw another brief.
export function writeJudgeBrief(file, text, row, now = Date.now()) {
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text) return;
  fs.writeFileSync(file, text);
  row.judgeBriefAt = now;
}

function runRound(repo, { judge, extra }) {
  const ctx = loadRound(repo, extra);
  if (!ctx) return 2;
  const { bench, rows, list, runs } = ctx;
  const m = matchRuns(rows, runs, { judges: !judge });
  const bad = [...m.missing, ...m.duplicate];
  if (bad.length) { for (const b of bad) process.stderr.write(`no run or more than one run for: ${b}\n`); return 2; }
  const stop = stopOnEscape(repo, rows, m, bench, list);
  if (stop) return stop;
  const sampleOf = (r) => list.samples.find((s) => s.agent === r.agent && s.n === r.n);
  const currentOf = (r) => rows.find((x) => x.agent === r.agent && x.n === r.n && x.current);
  const slurp = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : undefined);
  // A run or judge under the wrong agent or with a hand-edited prompt is not the row it was matched to.
  const invalid = new Map();
  for (const r of rows) {
    const p = runProblem(r, m.runs.get(r.tag), { read: slurp });
    if (p) invalid.set(r.tag, p);
    const jr = m.judges.get(r.tag);
    const q = jr && runProblem(r, jr, { judge: true, read: slurp });
    if (q) invalid.set(`${r.tag} judge`, q);
  }
  const referenceOf = (r) => {
    const cur = currentOf(r);
    return mustsOf(r.agent, m.runs.get(cur.tag).lastText, verificationOf(cur));
  };
  if (judge) {
    for (const [tag, why] of invalid) process.stderr.write(`notice: ${tag}: ${why}; the report will not judge it\n`);
    const out = [];
    fs.mkdirSync(`${bench}/briefs`, { recursive: true });
    for (const r of rows.filter((x) => x.judge)) {
      const s = sampleOf(r), run = m.runs.get(r.tag), kind = kindOf(r.agent);
      const ticket = `${r.worktree}/accord/tickets/${r.ticket}.md`;
      const args = { agent: r.agent, ticket, worktree: r.worktree, base: s.base };
      if (r.agent === 'accord-executor') {
        const dir = `${bench}/files/${r.tag}`;
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(`${dir}/result.md`, cli(r.worktree, ['review-package', r.ticket, '--base', s.base]));
        args.package = `${dir}/result.md`;
      } else if (r.agent === 'accord-planner') args.plan = `${r.worktree}/accord/tickets/${r.ticket}/plan.md`;
      else if (kind === 'match') {
        args.reference = referenceOf(r);
        args.report = run.lastText + (r.agent === 'accord-verifier' ? '\n' + verificationOf(r) : '');
      } else args.report = run.lastText;
      const prompt = `${bench}/briefs/${r.tag}-judge.md`;
      writeJudgeBrief(prompt, judgeBrief(kind, args), r);
      out.push({ tag: `${r.tag} judge`, ...r.judge, prompt, judge: null });
    }
    const state = JSON.parse(fs.readFileSync(path.join(bench, 'round-1.json'), 'utf8'));
    state.rows = rows;
    fs.writeFileSync(path.join(bench, 'round-1.json'), JSON.stringify(state, null, 2) + '\n');
    process.stdout.write(dispatchTable(out));
    process.stdout.write("Dispatch every row: a fresh agent each, with the brief file's text as the prompt.\n");
    return 0;
  }
  const flags = [], unjudged = [], verdicts = new Map();
  for (const r of rows) {
    const j = m.judges.get(r.tag);
    flags.push({ tag: r.tag, flags: turnFlags(m.runs.get(r.tag).turns, r) });
    if (!r.judge) continue;
    flags.push({ tag: `${r.tag} judge`, flags: turnFlags(j.turns, r.judge) });
    const ref = ROLES[r.agent] === 'finding' ? referenceOf(r) : [];
    const jBad = invalid.get(`${r.tag} judge`);
    const v = jBad || m.notFresh.includes(r.tag) ? null : parseVerdict(kindOf(r.agent), j.lastText, ref.length);
    verdicts.set(r.tag, v);
    if (!v) unjudged.push({ tag: r.tag, reason: jBad ? `judge ${jBad}` : m.notFresh.includes(r.tag) ? 'judge was not fresh' : 'judge verdict unreadable' });
  }
  const results = rows.map((r) => {
    const run = m.runs.get(r.tag);
    const cur = currentOf(r);
    let suite, gate, rerun, env = invalid.get(r.tag) ?? (invalid.has(cur.tag) ? `the current-effort run ${invalid.get(cur.tag)}` : '');
    if (!env && r.agent === 'accord-executor') {
      let st;
      try { rerun = runSuite(r.worktree, repo, sampleOf(r).base).rerun; } catch (e) { st = exitState(e, 'suite'); }
      st ??= { ok: true };
      if (st.env) env = st.env; else suite = st.ok;
    }
    if (!env && r.agent === 'accord-planner') {
      let st;
      try { cli(r.worktree, ['gate', 'plan', r.ticket]); } catch (e) { st = exitState(e, 'gate plan'); }
      st ??= { ok: true };
      if (st.env) env = st.env; else gate = st.ok;
    }
    if (env) unjudged.push({ tag: r.tag, reason: env });
    const verdict = verdicts.get(r.tag) ?? null;
    const held = env ? null : holds(r.agent, { current: r.current, suite, gate, verdict, currentVerdict: verdicts.get(cur.tag) ?? null, reference: ROLES[r.agent] === 'finding' ? referenceOf(r).length : undefined });
    const result = { tag: r.tag, agent: r.agent, n: r.n, kind: sampleOf(r).kind ?? null, effort: r.effort, current: r.current, held, ms: run.ms, usage: run.usage, verdict };
    if (rerun) result.rerun = rerun;
    if (ROLES[r.agent] === 'finding' && r.current) result.reference = referenceOf(r).length;
    return result;
  });
  const file = writeReport(repo, report(results, agentSettings(repo), { flags, unjudged, superseded: m.superseded.map((r) => `${r.desc} (agent ${r.id})`), compliance: readOr(`${bench}/compliance.md`, '## Compliance\n\nNone.\n'), notes: readOr(`${bench}/notes.md`) }));
  process.stdout.write(file + '\n');
  return 0;
}

export function main(args) {
  if (args[0] === '--compliance') return runCompliance(args.slice(1), process.cwd());
  if (args[0] === '--round' && args[1] === '1' && !['--samples', '--plan'].includes(args[2])) {
    const judge = args[2] === '--judge';
    return runRound(process.cwd(), { judge, extra: args.slice(judge ? 3 : 2).filter((a) => !a.startsWith('--')) });
  }
  if (args[0] === '--clean') return runClean(process.cwd(), args.includes('--force'));
  if (args.length === 2 && args[0] === '--fixed' && args[1] === '--probe') {
    const repo = process.cwd();
    const result = fixedProbe({ repo, home: os.homedir(), bench: benchRoot(repo) });
    (result.exit === 0 ? process.stdout : process.stderr).write(result.text);
    return result.exit;
  }
  if (args[0] === '--fixed' && !args.slice(1).some((a) => a.startsWith('--'))) {
    const repo = process.cwd();
    const mainCheckout = path.dirname(gitIn(repo, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim());
    const result = fixedReport({ repo, home: os.homedir(), bench: benchRoot(repo), dirs: args.length > 1 ? args.slice(1) : defaultDirs(mainCheckout) });
    (result.exit === 2 ? process.stderr : process.stdout).write(result.text);
    return result.exit;
  }
  if (args[0] === '--round' && args[1] === '1' && args[2] === '--samples') return runSamples(process.cwd());
  if (args[0] === '--round' && args[1] === '1' && args[2] === '--plan') {
    const at = args.indexOf('--rerun');
    if (at >= 0 && !args[at + 1]) { process.stderr.write('--rerun needs a comma-separated list of tags\n'); return 2; }
    return runPlan(process.cwd(), at >= 0 ? args[at + 1].split(',').filter(Boolean) : []);
  }
  if (args.some((a) => a.startsWith('--'))) {
    process.stderr.write('usage: node scripts/benchmark.mjs [--compliance | --round 1 [--samples | --plan [--rerun <tag>[,<tag>]] | --judge] | --clean [--force] | --fixed [--probe]] [folder ...]\n');
    return 2;
  }
  process.stdout.write(legacyReport(args.length ? args : defaultDirs(process.cwd())));
  return 0;
}


export function writeReport(root, text) {
  const rel = 'docs/benchmark/round-1.md';
  fs.mkdirSync(path.join(root, 'docs', 'benchmark'), { recursive: true });
  fs.writeFileSync(path.join(root, rel), text);
  return rel;
}

// ---- live checkouts ----
const notBench = (r) => r && !r.startsWith('refs/heads/bench/');

export function liveState(repo) {
  const refs = {};
  for (const l of gitIn(repo, ['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads', 'refs/remotes/origin']).split('\n').filter(Boolean)) {
    const [name, sha] = l.split(' ');
    if (notBench(name)) refs[name] = sha;
  }
  const worktrees = [];
  for (const e of gitIn(repo, ['worktree', 'list', '--porcelain']).split(/\r?\n\r?\n+/).filter(Boolean)) {
    const dir = /^worktree (.+)$/m.exec(e)?.[1]?.trim();
    if (!dir) continue;
    let marked = false;
    try { marked = fs.existsSync(path.join(gitIn(dir, ['rev-parse', '--absolute-git-dir']).trim(), MARKER)); } catch { /* a removed worktree is not live */ }
    if (!marked) worktrees.push({ path: slashed(dir), head: /^HEAD (\S+)/m.exec(e)?.[1] ?? '' });
  }
  return { refs, worktrees };
}

export function onLiveRefs(repo, sha) {
  try {
    return gitIn(repo, ['for-each-ref', '--contains', sha, '--format=%(refname)', 'refs/heads', 'refs/remotes/origin']).split('\n').filter(notBench);
  } catch { return []; }
}

// Returns 2 after printing the problems and the undo when a round run touched a live checkout, else 0.
function stopOnEscape(repo, rows, m, bench, list) {
  const live = JSON.parse(fs.readFileSync(path.join(bench, 'round-1.json'), 'utf8')).live;
  if (!live) { process.stderr.write('run --round 1 --plan first: no live checkouts recorded\n'); return 2; }
  const problems = escapes(rows, m, live.worktrees.map((w) => w.path));
  const baseOf = (tag) => { const r = rows.find((x) => x.tag === tag.replace(/ judge$/, '')); return list.samples.find((s) => s.agent === r.agent && s.n === r.n).base; };
  for (const [tag, run] of [...m.runs, ...[...m.judges].map(([t, r]) => [`${t} judge`, r])]) {
    for (const sha of ownCommits(repo, run, baseOf(tag))) {
      const refs = onLiveRefs(repo, sha);
      if (refs.length) problems.push(`${tag}: commit ${sha.slice(0, 7)} is on ${refs.join(', ')}`);
    }
  }
  const now = liveState(repo).refs;
  const moved = Object.keys(live.refs).filter((r) => now[r] && now[r] !== live.refs[r]);
  if (!problems.length) {
    for (const r of moved) process.stderr.write(`moved since --plan: ${r}\n`);
    return 0;
  }
  process.stderr.write(problems.join('\n') + '\n');
  for (const r of moved.filter((x) => x.startsWith('refs/heads/'))) process.stderr.write(`undo ${r}: check git reflog, then git reset --keep ${live.refs[r]} in its checkout when nobody committed since\n`);
  for (const r of Object.keys(now).filter((x) => x.startsWith('refs/heads/') && !live.refs[x])) process.stderr.write(`undo ${r}: git branch -D ${r.slice('refs/heads/'.length)} if a round run made it\n`);
  return 2;
}

// ---- fixed context: the setup on this machine (ST-LN-79) ----
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const ACCORD_MARKER = '<!-- generated by accord skills sync';
const FRONTMATTER = /^\uFEFF?---\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;

// The frontmatter of a Markdown file as data (an unreadable one gives {}) and the text after it.
function frontmatter(text) {
  const m = FRONTMATTER.exec(text);
  if (!m) return { data: {}, body: text };
  let data = {};
  try { data = parseYaml(m[1] ?? '') ?? {}; } catch { /* a file without readable frontmatter has no name */ }
  return { data: data && typeof data === 'object' ? data : {}, body: text.slice(m[0].length) };
}

// A JSON file: null when it is missing; an error naming the file (under the home folder as `~/`) when it does not parse.
function readJsonFile(file, home) {
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); } catch (e) {
    throw new Error(`${standsFor(file, { repo: '', mainCheckout: '', probeDir: '', home }).label} does not parse: ${e.message}`, { cause: e });
  }
}

// Every file below a folder that passes `keep`, with `/`, sorted; none when the folder is missing.
const filesBelow = (dir, keep) => (fs.existsSync(dir)
  ? fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => slash(path.join(e.parentPath, e.name))).filter(keep).sort()
  : []);
const byName = (key) => (a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0);

// What this machine loads into a call, grouped by owner: accord's agents and skills, the enabled plugins, the
// listable MCP servers, the owner's own skill sets, and every instruction and memory file. Reads files and runs
// git; the local-scope MCP servers and `.claude/settings.local.json` are never read, since the probe worktree
// loads neither.
export function readSetup({ repo, home }) {
  repo = slash(repo);
  home = slash(home);
  const mainCheckout = slash(path.dirname(gitIn(repo, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim()));
  const probeDir = slash(path.resolve(repo, '..', 'accord-probe'));
  const where = { repo, mainCheckout, probeDir, home };
  const text = (file) => fs.readFileSync(file, 'utf8');

  const agents = [];
  const own = [];
  const ownedIn = (root, level) => {
    for (const file of filesBelow(`${root}/.claude/agents`, (f) => f.endsWith('.md') && !f.slice(`${root}/.claude/agents/`.length).includes('/'))) {
      const raw = text(file);
      const { data, body } = frontmatter(raw);
      if (level === 'project' && raw.includes(ACCORD_MARKER)) {
        agents.push({ name: String(data.name ?? path.basename(file, '.md')), file, model: data.model === undefined ? undefined : String(data.model), tools: data.tools === undefined ? null : String(data.tools).split(',').map((t) => t.trim()).filter(Boolean), body, hash: sha256(raw) });
      } else if (!raw.includes(ACCORD_MARKER)) {
        own.push({ kind: 'agent', name: String(data.name ?? path.basename(file, '.md')), level, hash: sha256(raw) });
      }
    }
    for (const file of filesBelow(`${root}/.claude/skills`, (f) => /^[^/]+\/SKILL\.md$/.test(f.slice(`${root}/.claude/skills/`.length)))) {
      const raw = text(file);
      if (raw.includes(ACCORD_MARKER)) continue;
      own.push({ kind: 'skill', name: String(frontmatter(raw).data.name ?? path.basename(path.dirname(file))), level, hash: sha256(raw) });
    }
    const commandsDir = `${root}/.claude/commands`;
    for (const file of filesBelow(commandsDir, (f) => f.endsWith('.md'))) {
      const raw = text(file);
      if (raw.includes(ACCORD_MARKER)) continue;
      const rel = file.slice(commandsDir.length + 1, -'.md'.length).replace(/\//g, ':');
      own.push({ kind: 'command', name: String(frontmatter(raw).data.name ?? rel), level, hash: sha256(raw) });
    }
  };
  ownedIn(repo, 'project');
  ownedIn(home, 'user');

  const accordSkills = [];
  const skillsDir = `${repo}/.claude/skills`;
  for (const file of filesBelow(skillsDir, (f) => /^[^/]+\/SKILL\.md$/.test(f.slice(skillsDir.length + 1)))) {
    const raw = text(file);
    if (!raw.includes(ACCORD_MARKER)) continue;
    const { data } = frontmatter(raw);
    accordSkills.push({ name: String(data.name ?? path.basename(path.dirname(file))), description: String(data.description ?? '') });
  }

  const project = readJsonFile(`${repo}/.claude/settings.json`, home) ?? {};
  const hookCommand = (project.hooks?.SubagentStart ?? []).flatMap((g) => g?.hooks ?? []).map((h) => h?.command)
    .find((c) => typeof c === 'string' && c.includes(' hook subagent-start')) ?? '';

  const enabled = { ...(readJsonFile(`${home}/.claude/settings.json`, home)?.enabledPlugins ?? {}), ...(project.enabledPlugins ?? {}) };
  const installed = readJsonFile(`${home}/.claude/plugins/installed_plugins.json`, home)?.plugins ?? {};
  const sameDir = (a, b) => slash(a ?? '').toLowerCase() === b.toLowerCase();
  const versionOf = (id) => {
    const records = Array.isArray(installed[id]) ? installed[id] : [];
    return records.find((r) => r?.scope === 'user')?.version
      ?? records.find((r) => r?.scope === 'project' && sameDir(r.projectPath, mainCheckout))?.version ?? null;
  };
  const plugins = Object.keys(enabled).filter((id) => enabled[id] === true).sort()
    .map((id) => ({ id, version: versionOf(id), accordOwn: id === 'accord-panel@accord' }));

  const servers = new Map();
  for (const [scope, file] of [['user', `${home}/.claude.json`], ['project', `${repo}/.mcp.json`]]) {
    for (const [name, entry] of Object.entries(readJsonFile(file, home)?.mcpServers ?? {})) servers.set(name, { name, scope, hash: sha256(JSON.stringify(entry)) });
  }
  const mcp = [...servers.values()].sort(byName('name'));

  const groups = new Map();
  for (const m of own) {
    const prefix = m.name.split(/[-:]/)[0];
    if (!groups.has(prefix)) groups.set(prefix, []);
    groups.get(prefix).push(m);
  }
  const sets = [...groups.entries()].map(([prefix, members]) => ({
    prefix,
    members: members.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.level < b.level ? -1 : 1)),
  })).sort(byName('prefix'));

  const candidates = [{ file: `${home}/.claude/CLAUDE.md` }];
  for (const f of filesBelow(`${home}/.claude/rules`, (x) => x.endsWith('.md'))) candidates.push({ file: f });
  for (let dir = path.dirname(repo); ; dir = path.dirname(dir)) {
    for (const rel of ['CLAUDE.md', '.claude/CLAUDE.md']) candidates.push({ file: `${slash(dir)}/${rel}` });
    if (path.dirname(dir) === dir) break;
  }
  for (const rel of gitIn(repo, ['ls-files', '-z', '--', ':(glob)**/CLAUDE.md', ':(glob).claude/rules/**/*.md']).split('\0').filter(Boolean)) candidates.push({ file: `${repo}/${rel}` });
  const memory = `${home}/.claude/projects/${mainCheckout.replace(/[^A-Za-z0-9]/g, '-')}/memory`;
  for (const f of filesBelow(memory, (x) => x.endsWith('.md') && !x.slice(memory.length + 1).includes('/'))) candidates.push({ file: f, topic: path.basename(f) !== 'MEMORY.md' });
  const seen = new Set();
  const docs = [];
  for (const c of candidates) {
    const key = slash(c.file).toLowerCase();
    if (seen.has(key) || !fs.existsSync(c.file)) continue;
    seen.add(key);
    docs.push({ ...standsFor(c.file, where), topic: c.topic === true, hash: sha256(text(c.file)) });
  }
  docs.sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : a.file < b.file ? -1 : 1));

  return {
    ...where,
    agents: agents.sort(byName('name')),
    accordSkills: accordSkills.sort(byName('name')),
    hookCommand,
    plugins,
    mcp,
    sets,
    docs,
  };
}

// ---- fixed context: the probes the owner runs (ST-LN-79) ----
const byId = byName('id');

// True when `.claude` or a CLAUDE.md file has uncommitted changes: the probe worktree holds the commit, not the
// working files, so a probe run then would measure a setup other than the one the report sizes.
export const setupDirty = (repo) => gitIn(repo, ['status', '--porcelain', '-z', '--', ':(literal).claude', ':(glob)**/CLAUDE.md']).length > 0;

const REFUSED_DIRTY = 'Refused: .claude or a CLAUDE.md file has uncommitted changes; the probe worktree holds the commit. Commit them and run again.\n';
const safe = (id) => id.replace(/[^A-Za-z0-9._-]/g, '_');

// Writes the files of the probes under `<bench>/fixed/` and records each probe's session id, command and
// fingerprint in `<bench>/fixed/probes.json`. A probe run from the probe worktree (the all-on probe) needs no file;
// a probe run from the empty folder gets the baseline's stub agents or the text it appends. A probe keeps its
// session id unless `fresh` (a boolean, or a function of the probe id). Returns the entries written, sorted by id.
export function writeProbes({ repo, home, bench, probes, fresh, forms = PROBE_FORMS, setup = readSetup({ repo, home }) }) {
  const dir = `${slash(bench)}/fixed`;
  fs.mkdirSync(dir, { recursive: true });
  const stateFile = `${dir}/probes.json`;
  const stored = readJsonFile(stateFile, home)?.probes ?? [];
  const prompt = dispatchPrompt(setup.agents.map((a) => a.name));
  const isFresh = typeof fresh === 'function' ? fresh : () => fresh === true;
  const written = [];
  for (const probe of probes) {
    if (written.some((e) => safe(e.id) === safe(probe.id))) throw new Error(`probes ${probe.id} and another share the file name ${safe(probe.id)}`);
    const sessionId = (!isFresh(probe.id) && stored.find((e) => e.id === probe.id)?.sessionId) || randomUUID();
    if (probe.where === 'empty') {
      const cwd = `${dir}/empty`;
      const args = ['claude', '-p', probe.id === 'baseline' ? dispatchPrompt(probe.stubs.map((s) => s.name)) : PROBE_BRIEF, '--session-id', sessionId,
        ...forms.extraArgs, ...forms.noSources, '--strict-mcp-config', '--model', probe.model];
      if (probe.id === 'baseline') {
        const stubs = Object.fromEntries(probe.stubs.map((s) => [s.name, {
          description: 'probe stub', prompt: 'Reply ok.', ...(s.model === undefined ? {} : { model: s.model }), ...(s.tools === null ? {} : { tools: s.tools }),
        }]));
        const file = `${dir}/stubs.json`;
        fs.writeFileSync(file, JSON.stringify(stubs, null, 2) + '\n');
        args.push('--agents', forms.agentsArg === 'file' ? file : JSON.stringify(stubs));
      } else if (probe.text !== undefined) {
        const file = `${dir}/${safe(probe.id)}.md`;
        fs.writeFileSync(file, probe.text);
        args.push('--append-system-prompt-file', file);
      }
      written.push({ id: probe.id, sessionId, cwd, command: `cd ${shellLine([cwd])} && ${shellLine(args)}`, fingerprint: probe.depends });
      continue;
    }
    const args = ['claude', '-p', prompt, '--session-id', sessionId, ...forms.extraArgs];
    written.push({ id: probe.id, sessionId, cwd: setup.probeDir, command: `cd ${shellLine([setup.probeDir])} && ${shellLine(args)}`, fingerprint: probe.depends });
  }
  const kept = stored.filter((e) => !written.some((w) => w.id === e.id));
  written.sort(byId);
  fs.writeFileSync(stateFile, JSON.stringify({ probes: [...kept, ...written].sort(byId) }, null, 2) + '\n');
  return written;
}

// The command that puts the probe worktree on the commit the probes are written for.
function worktreeLine(repo, setup) {
  const head = gitIn(repo, ['rev-parse', 'HEAD']).trim();
  return fs.existsSync(setup.probeDir)
    ? shellLine(['git', '-C', setup.probeDir, 'checkout', '-B', PROBE_BRANCH, head])
    : shellLine(['git', '-C', repo, 'worktree', 'add', '-B', PROBE_BRANCH, setup.probeDir, head]);
}
const HEADER = '# Run in Git Bash, then run: node scripts/benchmark.mjs --fixed';

// `--fixed --probe`: writes the phase-one probe (the all-on probe) anew and returns the commands the owner runs in Git Bash.
export function fixedProbe({ repo, home, bench, forms = PROBE_FORMS }) {
  repo = slash(repo);
  if (setupDirty(repo)) return { exit: 2, text: REFUSED_DIRTY };
  const setup = readSetup({ repo, home });
  const written = writeProbes({ repo, home, bench, probes: phaseOne(setup), fresh: true, forms, setup });
  return { exit: 0, text: [HEADER, worktreeLine(repo, setup), ...written.map((e) => e.command)].join('\n') + '\n' };
}

const readTranscript = (file) => firstCall(readLines(file));

// The probe sessions named by `ids`, found in any folder under `<home>/.claude/projects/`: a Map from session id to
// `{ main, agents }`, `main` the first call of the session (null when it holds none) and `agents` the first call of
// each subagent by its agent type. An id with no transcript file is absent.
export function locateSessions(home, ids) {
  const root = `${slash(home)}/.claude/projects`;
  const folders = fs.existsSync(root) ? fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort() : [];
  const found = new Map();
  for (const id of new Set(ids)) {
    for (const folder of folders) {
      const file = `${root}/${folder}/${id}.jsonl`;
      if (!fs.existsSync(file)) continue;
      const agents = {};
      const sub = `${root}/${folder}/${id}/subagents`;
      for (const name of ownFiles(sub, '.meta.json').sort()) {
        const jsonl = `${sub}/${name.slice(0, -'.meta.json'.length)}.jsonl`;
        const type = readJsonFile(`${sub}/${name}`, home)?.agentType;
        if (typeof type !== 'string' || type in agents || !fs.existsSync(jsonl)) continue;
        const call = readTranscript(jsonl);
        if (call) agents[type] = call;
      }
      found.set(id, { main: readTranscript(file), agents });
      break;
    }
  }
  return found;
}

// The text appended to the brief by the calibration probes, whichever repository the script measures.
export const calibrationText = () => fs.readFileSync(fileURLToPath(new URL('./fixed-calibration.txt', import.meta.url)), 'utf8');

// `--fixed`, first step: the probes that are missing or stale. Writes the files and commands of the ones to
// run (and nothing else) and returns `{ exit, pending, version, text }`; `text` holds the commands, or the refusal. A
// call that is not refused also returns what it read: `probes`, `setup`, `state`, `located` and `read`.
export function fixedPending({ repo, home, bench, forms = PROBE_FORMS }) {
  repo = slash(repo);
  if (setupDirty(repo)) return { exit: 2, pending: [], version: undefined, text: REFUSED_DIRTY };
  const setup = readSetup({ repo, home });
  const state = readJsonFile(`${slash(bench)}/fixed/probes.json`, home)?.probes ?? [];
  const located = locateSessions(home, state.map((e) => e.sessionId));
  const version = probeVersion(state, located);
  const read = (file) => { try { return fs.readFileSync(file, 'utf8'); } catch { return undefined; } };
  const calibration = calibrationText();
  const { probes, pending, notes } = pendingProbes({ setup, state, located, version, calibration });
  const todo = probes.filter((p) => pending.includes(p.id));
  const emptyDir = `${slash(bench)}/fixed/empty`;
  if (todo.some((p) => p.where === 'empty')) {
    fs.mkdirSync(emptyDir, { recursive: true });
    let inside = false;
    try { inside = gitIn(emptyDir, ['rev-parse', '--is-inside-work-tree']).trim() === 'true'; } catch { /* not a repository: the folder is fit */ }
    if (inside) return { exit: 2, pending, version, text: `Refused: ${standsFor(emptyDir, { repo, mainCheckout: repo, probeDir: setup.probeDir, home: slash(home) }).label} lies inside a git repository, so the baseline would load its settings and instructions; move the bench folder out of any repository.\n` };
  }
  const fromId = new Map(state.map((e) => [e.id, e.sessionId]));
  const written = todo.length ? writeProbes({ repo, home, bench, probes: todo, fresh: (id) => located.has(fromId.get(id)), forms, setup }) : [];
  const lines = written.length
    ? [HEADER, ...(todo.some((p) => p.where === 'probe') ? [worktreeLine(repo, setup)] : []), ...written.map((e) => e.command)]
    : [];
  lines.push(...notes);
  return { exit: 0, pending, version, text: lines.length ? lines.join('\n') + '\n' : '', probes, setup, state, located, read, calibration };
}

// The lane M tickets that reached done: those on the default branch whose frontmatter has `lane: M` and a non-empty
// `verified_hash`, each with `claimAt`, the time of the earliest commit whose message starts `claim: <id>`. A ticket
// with no claim commit is left out.
export function doneTickets(repo) {
  const ref = defaultRef(repo);
  if (!ref) return [];
  const claims = new Map();
  for (const c of branchCommits(repo)) {
    const m = /^claim: (\S+)$/.exec(c.message.split('\n')[0]);
    if (m && !(claims.get(m[1]) <= c.at)) claims.set(m[1], c.at);
  }
  const found = [];
  for (const file of gitIn(repo, ['ls-tree', '-z', '--name-only', ref, 'accord/tickets/']).split('\0').filter((f) => f.endsWith('.md'))) {
    const id = file.slice('accord/tickets/'.length, -'.md'.length);
    if (!claims.has(id)) continue;
    const { data } = frontmatter(gitIn(repo, ['-c', 'log.showSignature=false', 'show', '--no-show-signature', `${ref}:${file}`]));
    if (data.lane === 'M' && typeof data.verified_hash === 'string' && data.verified_hash !== '') found.push({ id, claimAt: claims.get(id) });
  }
  return found.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// `--fixed`: the raw table of the fixed context per call by owner, written to `<repo>/docs/benchmark/fixed-context.md`.
// Exit 1 with the commands to run while probes are pending (nothing is written: the size is measured on the setup as
// it is when the report runs), exit 2 on a refusal, exit 0 with the report. The report text holds no path under the
// home folder or the repository.
export function fixedReport({ repo, home, bench, dirs, forms = PROBE_FORMS }) {
  repo = slash(repo);
  const { calls, version, folders } = readCalls(dirs, { bench });
  const p = fixedPending({ repo, home, bench, forms });
  if (p.exit !== 0) return { exit: p.exit, text: p.text };
  if (p.pending.length) return { exit: 1, text: p.text };
  const allOn = p.located.get(p.state.find((e) => e.id === 'all-on').sessionId);
  const texts = textsOf(p.setup, { main: allOn.main, agents: allOn.agents }, p.read);
  const { rows, items, ratios } = measure({ setup: p.setup, state: p.state, located: p.located, texts, calibration: p.calibration });
  const tickets = ticketShares({ calls, rows, tickets: doneTickets(repo) });
  const text = render({ calls, version, folders, probeVersion: p.version, allOnTs: allOn.main.ts, rows, items, tickets, ratios, unavailable: allOn.main.unavailable });
  fs.mkdirSync(`${repo}/docs/benchmark`, { recursive: true });
  fs.writeFileSync(`${repo}/docs/benchmark/fixed-context.md`, text);
  return { exit: 0, text };
}

// Last: the entry runs only once every top-level declaration above has been evaluated.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) process.exitCode = main(process.argv.slice(2));
