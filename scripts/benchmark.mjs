#!/usr/bin/env node
// Benchmark of accord agent runs: reads Claude Code subagent transcripts plus git, prints Markdown.
// Not shipped; the prototype of a future `accord runs`. Numbers only, no model call.
// Usage: node scripts/benchmark.mjs [projectsDir ...] > report.md
// Default projectsDir: every ~/.claude/projects/<dir> whose name starts with this repo's encoded path.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { parsePlanReview } from './plan-review.mjs';

const repo = process.cwd();
const projectsRoot = path.join(os.homedir(), '.claude', 'projects');
const encoded = repo.replace(/[:\\/]/g, '-');
const dirs = process.argv.length > 2
  ? process.argv.slice(2)
  : fs.readdirSync(projectsRoot).filter((d) => d.startsWith(encoded)).map((d) => path.join(projectsRoot, d));

const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const ID = /\b([A-Z]+(?:-[A-Z]+)?-\d+)\b/;
const median = (xs) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const min = (ms) => (ms / 60000).toFixed(1);
const k = (n) => (n / 1000).toFixed(0) + 'k';

// ---- transcripts -------------------------------------------------------------
function readRun(jsonl, meta) {
  const lines = fs.readFileSync(jsonl, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const seen = new Set();
  let input = 0, output = 0, tools = 0, model = '', effort = '', branch = '', lastText = '';
  for (const o of lines) {
    if (o.effort && !effort) effort = o.effort;
    if (o.gitBranch && !branch) branch = o.gitBranch;
    if (o.type !== 'assistant' || !o.message) continue;
    const m = o.message;
    if (m.model && m.model !== '<synthetic>') model = m.model;
    for (const c of Array.isArray(m.content) ? m.content : []) {
      if (c.type === 'tool_use') tools++;
      if (c.type === 'text' && c.text.trim()) lastText = c.text;
      if (c.type === 'tool_use' && c.name === 'SubagentHandback') lastText = String(c.input?.message ?? '');
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

const runs = [];
for (const dir of dirs) {
  for (const session of fs.readdirSync(dir)) {
    const sub = path.join(dir, session, 'subagents');
    if (!fs.existsSync(sub)) continue;
    for (const f of fs.readdirSync(sub).filter((f) => f.endsWith('.meta.json'))) {
      const jsonl = path.join(sub, f.slice(0, -'.meta.json'.length) + '.jsonl');
      if (fs.existsSync(jsonl)) runs.push(readRun(jsonl, JSON.parse(fs.readFileSync(path.join(sub, f), 'utf8'))));
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

process.stdout.write(out.join('\n') + '\n');
