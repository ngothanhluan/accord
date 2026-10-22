// Pure logic of the benchmark round: effort scale, run matrix, sample-list check, per-turn flags.
// Imports nothing, reads no file, spawns nothing (the house pattern of plan-review.mjs).
import { quoteProblem } from './compliance.mjs';

export const EFFORTS =['low', 'medium', 'high', 'xhigh', 'max'];
export const ROLES = {
  'accord-executor': 'executor',
  'accord-planner': 'planner',
  'accord-critic': 'finding',
  'accord-reviewer': 'finding',
  'accord-final-reviewer': 'finding',
  'accord-auditor': 'finding',
  'accord-verifier': 'finding',
  'accord-architect': 'fact',
  'accord-scout': 'fact',
};
export const WRITERS = ['accord-executor', 'accord-planner', 'accord-verifier'];
export const JUDGE = { model: 'opus', effort: 'high' };

export function steps(effort) {
  const i = EFFORTS.indexOf(effort);
  return EFFORTS.slice(Math.max(0, i - 1), i + 2);
}

export const tagOf = (agent, n, effort) => agent.slice('accord-'.length) + '-' + n + '-' + effort;
export const describe = (tag) => 'bench r1 ' + tag;
export const judgeDescribe = (tag) => describe(tag) + ' judge';

const SHA = /^[0-9a-f]{40}$/;
const absOk = (p) => typeof p === 'string' && /^([A-Za-z]:)?\//.test(p) && !p.includes('\\');

export function checkSamples(list) {
  const out = [];
  if (list?.round !== 1) out.push('round must be 1');
  const samples = Array.isArray(list?.samples) ? list.samples : [];
  for (const a of new Set(samples.map((s) => s.agent))) if (!(a in ROLES)) out.push(`agent outside the nine: ${a}`);
  for (const a of Object.keys(ROLES)) {
    const ns = samples.filter((s) => s.agent === a).map((s) => s.n).sort();
    if (ns.join() !== '1,2,3,4,5') out.push(`${a} needs samples n 1 to 5 exactly once each, has [${ns.join(',')}]`);
  }
  samples.forEach((s, i) => {
    const at = `sample ${i + 1} (${s.agent} ${s.n})`;
    if (typeof s.transcript !== 'string' || !s.transcript.endsWith('.jsonl') || !s.transcript.includes('/subagents/agent-')) out.push(`${at}: transcript`);
    if (!/^[A-Z]+(?:-[A-Z]+)?-\d+$/.test(s.ticket ?? '')) out.push(`${at}: ticket`);
    if (!SHA.test(s.base ?? '')) out.push(`${at}: base`);
    if (!SHA.test(s.main ?? '')) out.push(`${at}: main`);
    if (!absOk(s.root)) out.push(`${at}: root`);
    if (!Array.isArray(s.elsewhere) || !s.elsewhere.every(absOk)) out.push(`${at}: elsewhere`);
    if (!Array.isArray(s.files)) out.push(`${at}: files`);
    else for (const f of s.files) {
      if (!f || typeof f.path !== 'string') out.push(`${at}: file path`);
      else if (f.from === 'brief') { if (!f.task) out.push(`${at}: file ${f.path} from brief needs task`); }
      else if (f.from === 'review-package') { if (!SHA.test(f.base ?? '')) out.push(`${at}: file ${f.path} from review-package needs base`); }
      else if (f.from !== 'copy') out.push(`${at}: file ${f.path} from`);
    }
    if (!Array.isArray(s.pairs)) out.push(`${at}: pairs`);
    else for (const p of s.pairs) if (!Array.isArray(p) || p.length !== 2 || !['main', 'base'].includes(p[1])) out.push(`${at}: pair to`);
    if (s.agent === 'accord-executor') {
      if (!/^\d+$/.test(s.task ?? '')) out.push(`${at}: task`);
      if (!['plain', 'risk'].includes(s.kind)) out.push(`${at}: kind`);
    }
  });
  const ex = samples.filter((s) => s.agent === 'accord-executor');
  for (const kind of ['plain', 'risk']) if (ex.filter((s) => s.kind === kind).length < 2) out.push(`executor needs at least two ${kind} samples`);
  return out;
}

export function runMatrix(list, settings) {
  return list.samples.flatMap((s) => {
    const { model, effort: cur } = settings[s.agent];
    return steps(cur).map((effort) => ({
      tag: tagOf(s.agent, s.n, effort), agent: s.agent, n: s.n, ticket: s.ticket, model, effort,
      current: effort === cur,
      judge: ROLES[s.agent] === 'finding' && effort === cur ? null : { agent: s.agent === 'accord-executor' ? 'accord-reviewer' : 'accord-critic', ...JUDGE },
    }));
  });
}

const modelOk = (v, want) => typeof v === 'string' && (v === want || v.split('-').includes(want));

export function turnFlags(turns, { model, effort }) {
  const out = [];
  turns.forEach((t, i) => {
    const turn = i + 1;
    if (!modelOk(t.model, model)) out.push({ turn, field: 'message.model', got: t.model || 'absent', want: model });
    if (!modelOk(t.requestedModel, model)) out.push({ turn, field: 'requestedModel', got: t.requestedModel || 'absent', want: model });
    if (t.perTurnEffort !== effort) out.push({ turn, field: 'perTurnEffort', got: t.perTurnEffort || 'absent', want: effort });
  });
  return out;
}

export function flagSection(entries) {
  const total = entries.reduce((n, e) => n + e.flags.length, 0);
  const lines = entries.flatMap((e) => e.flags.map((f) => `- ${e.tag} turn ${f.turn}: ${f.field} is ${f.got} where the round dispatched ${f.want}`));
  return ['## Model and effort per turn', '', `Turns that differ from the dispatched setting: ${total}`, ...lines].join('\n') + '\n';
}

// ---- brief rewrite ----
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const byLength = (list) => [...list].sort((a, b) => b[0].length - a[0].length);
const ABS = /(?<![A-Za-z0-9_])[A-Za-z]:[\\/][^\s`'"<>|,;)]*/g;
const fold = (s) => s.replace(/\\/g, '/').toLowerCase();

// true at each character in a ref position: backticked spans, the word after --base / branch, t/<id>, origin/<name>.
function refMask(text, id) {
  const mask = new Array(text.length).fill(false);
  const mark = (re, group) => {
    for (const m of text.matchAll(re)) {
      const start = group ? m.index + m[0].length - m[1].length : m.index;
      const end = m.index + m[0].length;
      for (let i = start; i < end; i++) mask[i] = true;
    }
  };
  mark(/`[^`\n]+`/g);
  mark(/(?:--base |branch )([\w./-]+)/g, true);
  if (id) mark(new RegExp(`(?<![\\w/-])t/${esc(id)}(?![\\w/-])`, 'g'));
  mark(/(?<![\w/-])origin\/[\w/-]+/g);
  return mask;
}

function rewritePart(part, paths, pairs, id) {
  let out = part;
  if (paths.length) {
    const sorted = byLength(paths);
    const alt = sorted.map(([from]) => from.split(/[\\/]/).map(esc).join('[\\\\/]')).join('|');
    const re = new RegExp(`(?<![A-Za-z0-9_.-])(?:${alt})(?![A-Za-z0-9_-])(?!\\.[A-Za-z0-9_])`, 'gi');
    out = out.replace(re, (m) => {
      const to = sorted.find(([from]) => fold(from) === fold(m))[1];
      return m.includes('\\') ? to.replace(/\//g, '\\') : to;
    });
  }
  if (pairs.length) {
    const sorted = byLength(pairs);
    const mask = refMask(out, id);
    const re = new RegExp(`(?<![\\w/-])(?:${sorted.map(([from]) => esc(from)).join('|')})(?![\\w/-])(?!\\.\\w)`, 'g');
    out = out.replace(re, (m, off) => (mask[off] ? sorted.find(([from]) => from === m)[1] : m));
  }
  return out;
}

export function rewriteBrief(text, { ticket, paths, pairs, check }) {
  const id = /^id:\s*"?([^"\s#]+)/m.exec(ticket)?.[1];
  const at = text.indexOf(ticket);
  if (at < 0 && id && quoteProblem(text, id, ticket)) {
    return { text, problems: ['the brief does not hold the ticket at base byte for byte'] };
  }
  const [before, after] = (at < 0 ? [text, ''] : [text.slice(0, at), text.slice(at + ticket.length)]).map((p) => rewritePart(p, paths, pairs, id));
  const problems = [];
  if (check) {
    if (check.refs !== false) {
      const word = new RegExp(`(?<![\\w/-])(main|master|HEAD|${id ? `t/${esc(id)}|` : ''}origin/[\\w/-]+)(?![\\w/-])(?!\\.\\w)`, 'g');
      const seen = new Set();
      for (const p of [before, after]) {
        const mask = refMask(p, id);
        for (const m of p.matchAll(word)) {
          if (mask[m.index] && !check.allowed.includes(m[1]) && !seen.has(m[1])) {
            seen.add(m[1]);
            problems.push(`ref ${m[1]} is not pinned to a sha`);
          }
        }
      }
    }
    const bench = fold(check.bench);
    const seenPaths = new Set();
    for (const p of [before, after]) {
      for (const m of p.matchAll(ABS)) {
        const path = m[0].replace(/\.$/, '').replace(/\\/g, '/');
        // A bench root holding a space (C:/Users/Luan Ngo/...) is cut at the space by the path match: that prefix is still the bench.
        if (!fold(path).startsWith(bench) && !bench.startsWith(fold(path) + ' ') && !seenPaths.has(path)) {
          seenPaths.add(path);
          problems.push(`absolute path ${path} outside the bench root is left in the brief`);
        }
      }
    }
  }
  return { text: at < 0 ? before : before + ticket + after, problems };
}

export function stripReadPrefixes(text) {
  const lines = text.split('\n');
  const cut = lines.findIndex((l) => l.startsWith('<system-reminder>'));
  return (cut < 0 ? lines : lines.slice(0, cut)).map((l) => l.replace(/^\s*\d+\t/, '')).join('\n').replace(/\n+$/, '');
}

export function dispatchTable(rows) {
  return [
    '| description | subagent_type | model | effort | prompt file | judge |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows.map((r) => `| ${describe(r.tag)} | ${r.agent} | ${r.model} | ${r.effort} | ${r.prompt} | ${r.judge ? `${r.judge.agent} ${r.judge.model} ${r.judge.effort}` : '-'} |`),
  ].join('\n') + '\n';
}
