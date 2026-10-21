#!/usr/bin/env node
// Benchmark of accord agent runs: reads Claude Code subagent transcripts plus git, prints Markdown.
// Not shipped; the prototype of a future `accord runs`. Numbers only, no model call.
// Usage: node scripts/benchmark.mjs [projectsDir ...] > report.md
// Default projectsDir: every ~/.claude/projects/<dir> whose name starts with this repo's encoded path.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parse as parseYaml } from 'yaml';
import { parsePlanReview } from './plan-review.mjs';
import { ROLES } from './round.mjs';
import { compliance, render as renderCompliance, parseCompliance, mergeCompliance } from './compliance.mjs';

const projectsRoot = path.join(os.homedir(), '.claude', 'projects');
const defaultDirs = (repo) => {
  const encoded = repo.replace(/[:\\/]/g, '-');
  return fs.readdirSync(projectsRoot).filter((d) => d.startsWith(encoded)).map((d) => path.join(projectsRoot, d));
};

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
        if (use.name === 'Read') {
          const body = text.split('\n');
          const cut = body.findIndex((l) => l.startsWith('<system-reminder>'));
          reads.push({ path: use.path, text: (cut < 0 ? body : body.slice(0, cut)).map((l) => l.replace(/^\s*\d+\t/, '')).join('\n').replace(/\n+$/, ''), ts: use.ts });
        } else if (use.name === 'Bash' && String(use.input?.command ?? '').includes('git commit')) {
          for (const m of text.matchAll(/(?:^|\[\S+ )([0-9a-f]{7,40})\b/gm)) commitRows.push(m[1]);
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
      if (c.type === 'text' && c.text.trim()) lastText = c.text;
      if (c.type === 'tool_use') {
        if (toolById.has(c.id)) continue;
        const input = c.input ?? {};
        const p = slash(input.file_path ?? input.notebook_path ?? '');
        toolById.set(c.id, { name: c.name, input, path: p, ts: stamp(o) });
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
        refusals.push(...refusalsIn(file, lines));
        runs.push(parseRun(file, id, JSON.parse(fs.readFileSync(path.join(sub, f), 'utf8')), lines, { uses, sends }));
      }
    }
  }
  const seen = new Set();
  return { runs, refusals: refusals.filter((r) => { const key = JSON.stringify([r.file, r.ticket, r.task, r.reasons]); return seen.has(key) ? false : (seen.add(key), true); }) };
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

export function main(args) {
  if (args[0] === '--compliance') return runCompliance(args.slice(1), process.cwd());
  if (args.some((a) => a.startsWith('--'))) {
    process.stderr.write('usage: node scripts/benchmark.mjs [--compliance | --round 1 [--samples | --plan | --judge] | --clean [--force]] [folder ...]\n');
    return 2;
  }
  process.stdout.write(legacyReport(args.length ? args : defaultDirs(process.cwd())));
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) process.exitCode = main(process.argv.slice(2));
