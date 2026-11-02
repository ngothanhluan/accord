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
// Agents accord no longer renders (ST-LN-80); their round-1 samples stay in the list, and the matrix leaves them out once their file is gone.
export const RETIRED = ['accord-architect'];
export const WRITERS =['accord-executor', 'accord-planner', 'accord-verifier'];
export const JUDGE = { model: 'opus', effort: 'high' };

export function steps(effort) {
  const i = EFFORTS.indexOf(effort);
  return EFFORTS.slice(Math.max(0, i - 1), i + 2);
}

export const tagOf = (agent, n, effort) => agent.slice('accord-'.length) + '-' + n + '-' + effort;
export const describe = (tag, name = 'r1') => 'bench ' + name + ' ' + tag;
export const judgeDescribe = (tag, name = 'r1') => describe(tag, name) + ' judge';

// ---- named arm rounds (ST-LN-46): a round definition is data, one dispatch row per sample, arm and run ----
const MODEL = /^[A-Za-z0-9._-]+$/;
const whole = (v, least) => Number.isInteger(v) && v >= least;
const isDate = (v) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const at = new Date(v + 'T00:00:00Z');
  return !Number.isNaN(at.getTime()) && at.toISOString().slice(0, 10) === v;
};

// The problems of a round definition; none when it can be planned. `<i>` counts arms from 1.
export function checkRound(name, def) {
  const out = [];
  if (!/^r[a-z0-9-]+$/.test(String(name)) || name === 'r1') out.push(`round name ${name} must match r[a-z0-9-]+ and not be r1`);
  def = def && typeof def === 'object' ? def : {};
  if (typeof def.agent !== 'string' || !Object.hasOwn(ROLES, def.agent) || RETIRED.includes(def.agent)) out.push(`agent ${def.agent} is not a benchmark agent`);
  const arms = Array.isArray(def.arms) ? def.arms : [];
  const seen = new Set(), twice = new Set(), models = [];
  arms.forEach((arm, i) => {
    let ok = true;
    if (!EFFORTS.includes(arm?.effort)) { out.push(`arm ${i + 1}: effort ${arm?.effort} is not one of ${EFFORTS.join(', ')}`); ok = false; }
    if (typeof arm?.model !== 'string' || !MODEL.test(arm.model)) { out.push(`arm ${i + 1}: model ${arm?.model} is not a model name`); ok = false; }
    else if (!models.includes(arm.model)) models.push(arm.model);
    if (!ok) return;
    const key = `${arm.model} ${arm.effort}`;
    if (seen.has(key) && !twice.has(key)) { twice.add(key); out.push(`arm ${key} is listed twice`); }
    seen.add(key);
  });
  const prices = def.prices && typeof def.prices === 'object' ? def.prices : {};
  for (const m of models) {
    const p = Object.hasOwn(prices, m) ? prices[m] : undefined;
    if (typeof p !== 'number' || !Number.isFinite(p) || p <= 0) out.push(`model ${m} has no positive price in prices`);
  }
  if (!isDate(def.pricesAt)) out.push('pricesAt must be a date YYYY-MM-DD');
  if (!whole(def.runs, 1)) out.push('runs must be a whole number of at least 1');
  if (!whole(def.judges, 0)) out.push('judges must be a whole number of at least 0');
  if (!Array.isArray(def.samples) || !def.samples.every((n) => whole(n, 1)) || new Set(def.samples).size !== def.samples.length) out.push('samples must be a list of distinct whole numbers of at least 1');
  return out;
}

export const armTag = (agent, n, model, effort, k) => `${agent.slice('accord-'.length)}-${n}-${model}-${effort}-${k}`;

// One row per sample (ascending n), arm (definition order) and run k. No `current`: a named round has no current-effort run.
export function armMatrix(def, samples) {
  return [...samples].sort((a, b) => a.n - b.n).flatMap((s) => def.arms.flatMap(({ model, effort }) =>
    Array.from({ length: def.runs }, (_, i) => ({ tag: armTag(def.agent, s.n, model, effort, i + 1), agent: def.agent, n: s.n, ticket: s.ticket, model, effort, k: i + 1, judge: null }))));
}

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
    if (s.overlay !== undefined) {
      if (!Array.isArray(s.overlay)) out.push(`${at}: overlay`);
      else for (const o of s.overlay) {
        if (typeof o?.path !== 'string' || !o.path || /^([A-Za-z]:)?[\\/]|\\|(^|\/)\.\.(\/|$)/.test(o.path)) out.push(`${at}: overlay path ${o?.path}`);
        else if (o.from !== 'read' && !SHA.test(o.from ?? '')) out.push(`${at}: overlay ${o.path} from`);
      }
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

// The first line where a file read by a run differs from the text the replay worktree will hold, or null. A cut read is compared by its line numbers.
export function readDiffers(read, text) {
  const want = text.replace(/\r/g, '').split('\n');
  if (want.at(-1) === '') want.pop();
  const got = read.text.replace(/\r/g, '').split('\n');
  if (read.whole) while (got.length > want.length && got.at(-1) === '') got.pop();
  const off = (read.start ?? 1) - 1;
  for (let i = 0; i < Math.max(got.length, read.whole ? want.length - off : 0); i++) {
    if (got[i] !== want[i + off] && !(got[i] === '' && want[i + off] === undefined)) return `line ${i + off + 1}`;
  }
  if (read.total != null && read.total !== want.length && read.total !== want.length + 1) return `totalLines ${read.total} against ${want.length}`;
  return null;
}

export function runMatrix(list, settings) {
  return list.samples.filter((s) => Object.hasOwn(settings, s.agent)).flatMap((s) => {
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

export function dispatchTable(rows, name = 'r1') {
  return [
    '| description | subagent_type | model | effort | prompt file | judge |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows.map((r) => `| ${describe(r.tag, name)} | ${r.agent} | ${r.model} | ${r.effort} | ${r.prompt} | ${r.judge ? `${r.judge.agent} ${r.judge.model} ${r.judge.effort}` : '-'} |`),
  ].join('\n') + '\n';
}

// ---- hold rules and judge briefs ----
export function mustsOf(agent, report, verification) {
  const lines = String(report ?? '').split(/\r?\n/).map((l) => l.trim());
  if (agent === 'accord-auditor') return lines.filter((l) => /^@ac-\d+:/.test(l) && !l.includes('one reading'));
  if (agent === 'accord-verifier') {
    return String(verification ?? '').split(/^(?=## @ac-\d+)/m).flatMap((b) => {
      const id = /^## (@ac-\d+)/.exec(b)?.[1];
      const res = /^\s*Result:\s*(fail|blocked)\b/m.exec(b)?.[1];
      return id && res ? [`${id} ${res}`] : [];
    });
  }
  return lines.filter((l) => /^\d+\.\s*\**\s*Must\b/.test(l));
}

export function parseVerdict(kind, text, expected) {
  const lines = String(text ?? '').split(/\r?\n/);
  const num = (re) => { const v = lines.map((l) => re.exec(l)?.[1]).filter((x) => x !== undefined); return v.length ? Number(v[v.length - 1]) : null; };
  if (kind === 'must') { const must = num(/^Must findings:\s*(\d+)\s*$/); return must === null ? null : { must }; }
  if (kind === 'fact') { const wrongFacts = num(/^wrong facts:\s*(\d+)\s*$/); return wrongFacts === null ? null : { wrongFacts }; }
  const newMusts = num(/^new Musts:\s*(\d+)\s*$/);
  const same = [];
  for (let k = 1; k <= expected; k++) {
    const v = lines.map((l) => new RegExp(`^M${k}:\\s*(same|missed)\\s*$`).exec(l)?.[1]).find(Boolean);
    if (!v) return null;
    same.push(v === 'same');
  }
  // With no reference item the only thing to read is the new Musts line; with items, the M lines suffice.
  return !expected && newMusts === null ? null : { same, newMusts };
}

export function holds(agent, { current, suite, gate, verdict, currentVerdict, reference }) {
  const role = ROLES[agent];
  if (role === 'executor' || role === 'planner') {
    const ok = (role === 'executor' ? suite : gate) === true;
    if (current) return ok;
    if (!verdict || !currentVerdict) return null;
    return ok && verdict.must <= currentVerdict.must;
  }
  // A reference that holds nothing leaves nothing to miss (D-08): no verdict is read.
  if (role === 'finding') return current || reference === 0 ? true : verdict ? verdict.same.every(Boolean) : null;
  return verdict ? verdict.wrongFacts === 0 : null;
}

// The check's contract: exit 1 is FAIL; anything else (exit 2, a missing command, a spawn failure) is the environment, not the run's quality.
export function exitState(err, what) {
  if (!err) return { ok: true };
  if (err.status === 1) return { ok: false };
  const text = String(err.stderr ?? '').trim();
  return { env: typeof err.status === 'number' ? `${what} exited ${err.status}: ${text}` : `${what} could not run: ${err.message ?? err.code}` };
}

// A run or judge counts for its row only when it ran under the printed agent with the printed brief (named by path, or its text pasted).
export function runProblem(row, run, { judge, read }) {
  const want = judge ? row.judge.agent : row.agent;
  if (run.agent !== want) return `dispatched as ${run.agent ?? 'no agent'} where the row names ${want}`;
  const file = judge ? row.prompt.replace(/\.md$/, '-judge.md') : row.prompt;
  const prompt = String(run.dispatch?.prompt ?? '');
  const text = read(file);
  const ok = prompt.length > 0 && (fold(prompt).includes(fold(file)) || (text !== undefined && prompt.replace(/\n+$/, '') === text.replace(/\n+$/, '')));
  return ok ? null : `dispatch prompt is not the brief file ${file}`;
}

const MATCH = {
  'accord-auditor': ['The reference run read these criteria two ways:', 'The reference run read no criterion two ways.', 'For each M<k>, decide whether the run read that criterion two ways too, whatever its wording.'],
  'accord-verifier': ['The reference run marked these criteria fail or blocked:', 'The reference run marked no criterion fail or blocked.', 'For each M<k>, decide whether the run marked that criterion fail or blocked in its verification.md.'],
};
const MATCH_FINDINGS = ['The reference run reported these Must findings:', 'The reference run reported no Must finding.', 'For each M<k>, decide whether the run reported the same issue, whatever its wording; read the ticket and the code to decide.'];

export function judgeBrief(kind, { agent, ticket, worktree, base, package: pkg, plan, report, reference }) {
  const id = ticket.replace(/^.*[\\/]/, '').replace(/\.md$/, '');
  if (kind === 'must') {
    const last = 'Report your findings in your usual numbered format, then end with one line, exactly `Must findings: <n>`, the number of Must findings you reported.';
    return (pkg
      ? ['You judge one benchmark run. Review its work as you review any ticket, lens both.', `Ticket: ${ticket}`, `Review package: ${pkg}`, `Ledger: ${worktree}/accord/tickets/${id}/ledger.md`, `Repository root: ${worktree}`, last]
      : ['You judge one benchmark run in plan mode: critique the plan as you critique any plan.', `Ticket: ${ticket}`, `Plan: ${plan}`, `Repository root: ${worktree}`, last]).join('\n');
  }
  if (kind === 'fact') {
    return [`You judge one benchmark run of ${agent}: check every fact its report states against the ticket and the code under Repository root, which is at commit ${base}.`, `Ticket: ${ticket}`, `Repository root: ${worktree}`, 'Answer with one line, exactly `wrong facts: <n>`, then each wrong fact with the file and line that contradicts it.', '=== report ===', report, '=== end ==='].join('\n');
  }
  const [head, empty, question] = MATCH[agent] ?? MATCH_FINDINGS;
  return [
    `You judge one benchmark run of ${agent} against the reference run on the same input.`, `Ticket: ${ticket}`, `Repository root: ${worktree}`,
    ...(reference.length ? [head, ...reference.map((x, i) => `M${i + 1}: ${x}`)] : [empty]), question,
    'Answer one line per item, exactly `M<k>: same` or `M<k>: missed`, then one line `new Musts: <n>`: the items of the same kind the run reported that match none of the reference ones.',
    '=== report ===', report, '=== end ===',
  ].join('\n');
}

// ---- matching finished runs to rows ----
export function matchRuns(rows, runs, { judges }) {
  const out = { runs: new Map(), judges: new Map(), missing: [], duplicate: [], notFresh: [], extra: [], superseded: [] };
  // A run dispatched before its worktree was last prepared (created or rebuilt) saw another state; a row with no preparation time counts every run.
  const find = (desc, since) => {
    const all = runs.filter((r) => r.desc === desc);
    const hit = all.filter((r) => since == null || (r.dispatch?.ts ?? r.start ?? 0) >= since);
    out.superseded.push(...all.filter((r) => !hit.includes(r)));
    if (!hit.length) out.missing.push(desc);
    else if (hit.length > 1) out.duplicate.push(`${desc} (${hit.length} runs)`);
    return hit[0];
  };
  for (const row of rows) {
    const run = find(describe(row.tag), row.prepared);
    if (run) out.runs.set(row.tag, run);
    if (!judges) continue;
    if (!row.judge) {
      out.extra.push(...runs.filter((r) => r.desc === judgeDescribe(row.tag)));
      continue;
    }
    const j = find(judgeDescribe(row.tag), row.prepared == null && row.judgeBriefAt == null ? undefined : Math.max(row.prepared ?? 0, row.judgeBriefAt ?? 0));
    if (!j) continue;
    out.judges.set(row.tag, j);
    if (j.sends?.length) out.notFresh.push(row.tag);
  }
  return out;
}

// ---- suggestion and report ----
export const median = (xs) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

const agentsOf = (results) => Object.keys(ROLES).filter((a) => results.some((r) => r.agent === a));
const triedOf = (results, agent) => EFFORTS.filter((e) => results.some((r) => r.agent === agent && r.effort === e));
const currentOf = (results, agent) => results.filter((r) => r.agent === agent && r.current);

export function suggest(results, settings) {
  const out = {};
  for (const agent of agentsOf(results)) {
    const cur = settings[agent].effort;
    const heldAll = triedOf(results, agent).filter((e) => {
      const rs = results.filter((r) => r.agent === agent && r.effort === e);
      return rs.length === 5 && rs.every((r) => r.held === true);
    });
    const lower = steps(cur)[0];
    out[agent] = { current: cur, suggested: lower !== cur && heldAll.includes(lower) ? lower : cur, heldAll };
  }
  return out;
}

export function better(results) {
  const out = [];
  for (const agent of agentsOf(results)) {
    const role = ROLES[agent];
    for (const cur of currentOf(results, agent).sort((a, b) => a.n - b.n)) {
      const up = EFFORTS[EFFORTS.indexOf(cur.effort) + 1];
      const hi = results.find((r) => r.agent === agent && r.n === cur.n && r.effort === up);
      if (!hi?.verdict) continue;
      if (role === 'finding' && hi.verdict.newMusts > 0) out.push(`- ${agent} sample ${cur.n} (${up}): reported ${hi.verdict.newMusts} Must the current run missed`);
      if ((role === 'executor' || role === 'planner') && cur.verdict && hi.verdict.must < cur.verdict.must) {
        out.push(`- ${agent} sample ${cur.n} (${up}): the judge found ${hi.verdict.must} Must findings where the current run had ${cur.verdict.must}`);
      }
    }
  }
  return out;
}

const NONE = { 'accord-auditor': 'read no criterion two ways', 'accord-verifier': 'marked no criterion fail or blocked' };
export function byDefault(results) {
  return agentsOf(results).filter((a) => ROLES[a] === 'finding').flatMap((agent) =>
    currentOf(results, agent).filter((r) => r.reference === 0).sort((a, b) => a.n - b.n)
      .map((r) => `- ${agent} sample ${r.n}: the current-effort run ${NONE[agent] ?? 'reported no Must'}, so every effort held there by default.`));
}

export function notHeld(results) {
  return agentsOf(results).flatMap((agent) => triedOf(results, agent).flatMap((effort) => {
    const bad = results.filter((r) => r.agent === agent && r.effort === effort && r.held === false).sort((a, b) => a.n - b.n);
    return bad.length ? [`- ${agent} ${effort}: ${bad.map((r) => `sample ${r.n}${r.kind ? ` (${r.kind})` : ''}`).join(', ')}`] : [];
  }));
}

// --plan rebuilds the rows; a judge brief time stamped earlier stays unless the rebuilt row already has one.
export function carryJudgeBriefs(rows, old) {
  for (const r of rows) r.judgeBriefAt ??= old.find((o) => o.tag === r.tag)?.judgeBriefAt;
  for (const r of rows) if (r.judgeBriefAt === undefined) delete r.judgeBriefAt;
}

export function report(results, settings, { flags, unjudged, compliance, superseded = [], notes }) {
  const rows = [];
  for (const agent of agentsOf(results)) {
    for (const effort of triedOf(results, agent)) {
      const rs = results.filter((r) => r.agent === agent && r.effort === effort);
      const med = (f) => Math.round(median(rs.map((r) => f(r.usage))));
      rows.push(`| ${agent} | ${effort} | ${rs.length} | ${rs.filter((r) => r.held === true).length} | ${(median(rs.map((r) => r.ms)) / 60000).toFixed(1)} | ${med((u) => u.input)} | ${med((u) => u.cacheRead)} | ${med((u) => u.cacheWrite)} | ${rs.some((r) => r.usage.estimated) ? '~' : ''}${med((u) => u.output)} |`);
    }
  }
  const sug = suggest(results, settings);
  const sentences = Object.entries(sug).flatMap(([agent, s]) => {
    const tried = triedOf(results, agent);
    if (s.heldAll.length === tried.length) return [`${agent}: every effort tried held on all 5 samples; nothing below ${s.heldAll[0]} was measured.`];
    if (!s.heldAll.length) return [`${agent}: no effort tried held on all 5 samples.`];
    return s.heldAll.includes(s.suggested) ? [] : [`${agent}: held on all 5 samples only at ${s.heldAll.join(' and ')}.`];
  });
  const list = (lines) => (lines.length ? lines : ['None.']);
  return [
    '# Round 1 benchmark', '',
    "Each sample ran on the agent's current model at its current effort and one step either side. Suggestions only: this report changes no agent definition.", '',
    '## Runs by agent and effort', '',
    '| agent | effort | runs | runs held | median min | median input | median cache read | median cache write | median output |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |', ...rows, '',
    '## Suggested effort', '', '| agent | model | current | suggested |', '| --- | --- | --- | --- |',
    ...Object.entries(sug).map(([agent, s]) => `| ${agent} | ${settings[agent].model} | ${s.current} | ${s.suggested} |`), '', ...sentences, '',
    '## Higher effort did better', '', ...list(better(results)), '',
    '## Samples that held at every effort by default', '', ...list(byDefault(results)), '',
    '## Samples not held', '', ...list(notHeld(results)), '',
    '## Holds that rest on a re-run', '', ...list(results.filter((r) => r.held && r.rerun).map((r) => `- ${r.tag}: re-ran ${r.rerun.files.length ? r.rerun.files.join(', ') : 'the full suite'}`)), '',
    flagSection(flags),
    '## Runs not judged', '', ...list(unjudged.map((u) => `- ${u.tag}: ${u.reason}`)), '',
    ...(superseded.length ? ['## Superseded runs', '', 'Dispatched before their worktree was rebuilt; not counted.', '', ...superseded.map((s) => `- ${s}`), ''] : []),
    compliance, '',
    '## Measurement notes', '', notes?.trim() ? notes.trimEnd() + '\n' : 'None.', '',
  ].join('\n');
}

// ---- a run that escaped its worktree ----
export function escapes(rows, { runs, judges }, live) {
  const out = [];
  for (const row of rows) {
    for (const [run, label] of [[runs.get(row.tag), row.tag], [judges.get(row.tag), `${row.tag} judge`]]) {
      for (const e of run?.edits ?? []) {
        const p = fold(e.path);
        const home = live.find((l) => p === fold(l) || p.startsWith(fold(l) + '/'));
        if (home) out.push(`${label}: edited ${e.path.replace(/\\/g, '/')} in the live checkout ${home}`);
      }
    }
  }
  return out;
}

// ---- scoring a scout run by script (ST-LN-46): scout check, contradicted Absent rows, wiring recall ----
const CONTRADICTED = /^absent claim ".*" \(row (\d+)\): .* matches its pattern outside its allowed hits$/;
const BEFORE = /[\p{L}\p{N}_.@+\-/]$/u;
const AFTER = /^(?:[\p{L}\p{N}_@+\-/]|\.[\p{L}\p{N}_])/u;

// Whether the text names `path` in full: not as the tail of a longer path or the head of a longer name; `./` may precede it.
export function namesPath(text, path) {
  const t = text.replace(/\\/g, '/');
  for (let i = t.indexOf(path); i >= 0; i = t.indexOf(path, i + 1)) {
    const from = i >= 2 && t.slice(i - 2, i) === './' ? i - 2 : i;
    if (!BEFORE.test(t.slice(0, from)) && !AFTER.test(t.slice(i + path.length))) return true;
  }
  return false;
}

// `scoutCheck` is core's; the facts are the tree the sample is scored on. `ticket` is passed as `accord scout check --ticket`
// passes it, or left out for a report with no ticket. `check` is 1 when the check reports no failure; `falseClaims` counts
// the distinct Absent rows whose search hits outside their allowed hits; `recall` is the share of `truth` the reply names in full.
export function scoreScout(reply, { tracked, read, ticket, truth }, { scoutCheck }) {
  const result = scoutCheck({ text: reply, tracked, read, ...(ticket ? { ticket } : {}) });
  const rows = new Set();
  for (const f of result.failures) { const m = CONTRADICTED.exec(f); if (m) rows.add(m[1]); }
  const named = truth.filter((p) => namesPath(reply, p)).length;
  return { check: result.failures.length === 0 ? 1 : 0, falseClaims: rows.size, recall: truth.length === 0 ? 1 : named / truth.length };
}

// ---- matching the runs of a named round (ST-LN-46) ----
// Each saved row takes the run described `bench <name> <tag>`. Every such run is checked first: under the row's agent with the
// row's brief (`runProblem`), dispatched after the row's worktree was prepared, and every turn on the row's model and effort.
// Of the runs left the earliest dispatched counts, whatever the order of the transcript files. `read` reads a brief file.
// Returns `counted` (tag to run) and `notCounted` ({ tag, reason } per run that does not count, and per row with no run).
export function matchNamed(rows, runs, name, read) {
  const counted = new Map(), notCounted = [];
  const sent = (r) => r.dispatch?.ts ?? r.start ?? 0;
  for (const row of rows) {
    const all = runs.filter((r) => r.desc === describe(row.tag, name));
    if (!all.length) { notCounted.push({ tag: row.tag, reason: `no run described ${describe(row.tag, name)}` }); continue; }
    const fine = [];
    for (const run of all) {
      const flag = turnFlags(run.turns, row)[0];
      const problem = runProblem(row, run, { read })
        ?? (row.prepared != null && sent(run) < row.prepared ? 'dispatched before its worktree was prepared' : null)
        ?? (flag ? `turn ${flag.turn}: ${flag.field} is ${flag.got} where the round dispatched ${flag.want}` : null)
        ?? (run.turns.length ? null : 'no turn in the transcript');
      if (problem) notCounted.push({ tag: row.tag, reason: `run ${run.id}: ${problem}` });
      else fine.push(run);
    }
    fine.sort((a, b) => sent(a) - sent(b) || (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
    if (fine.length) counted.set(row.tag, fine[0]);
    for (const run of fine.slice(1)) notCounted.push({ tag: row.tag, reason: `run ${run.id}: run ${fine[0].id}, dispatched earlier, counts` });
  }
  return { counted, notCounted };
}

// ---- the arm report of a named round (ST-LN-46): means, pass-mean ranges, cost, and the cheapest arm that ties the best ----
export const SCOUT_MEASURES = [
  { key: 'check', label: 'scout check passes', higher: true },
  { key: 'falseClaims', label: 'contradicted Absent rows', higher: false },
  { key: 'recall', label: 'wiring recall', higher: true },
];
const EPS = 1e-9;
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
// Tokens weighted fresh input 1, cache read 0.1, cache write 1.25 and output 5 (D-08 multiplies this by the model's price factor).
export const weighted = (u) => u.input + 0.1 * u.cacheRead + 1.25 * u.cacheWrite + 5 * u.output;

// `records`: { tag, n, model, effort, k, usage, values }. `leftOut`: { <n>: reason }. A pass is run k over every sample not left
// out and counts only when it has a run on every sample (D-06); an arm with no complete pass is never best or winner.
export function armStats(def, measures, records, leftOut = {}) {
  const samples = def.samples.filter((n) => !Object.hasOwn(leftOut, n));
  const arms = def.arms.map(({ model, effort }) => {
    const own = records.filter((r) => r.model === model && r.effort === effort && samples.includes(r.n));
    const passes = [];
    for (let k = 1; k <= def.runs; k++) {
      const run = samples.map((n) => own.find((r) => r.k === k && r.n === n));
      if (samples.length && run.every(Boolean)) passes.push(run);
    }
    const by = Object.fromEntries(measures.map((m) => {
      const means = passes.map((p) => avg(p.map((r) => r.values[m.key])));
      return [m.key, { mean: own.length ? avg(own.map((r) => r.values[m.key])) : null, range: means.length ? [Math.min(...means), Math.max(...means)] : null }];
    }));
    const cost = own.length ? avg(own.map((r) => weighted(r.usage))) * def.prices[model] : null;
    return { model, effort, runs: own.length, passes: passes.length, by, cost };
  });
  const eligible = arms.filter((a) => a.passes > 0);
  const cheaper = (a, b) => !b || a.cost < b.cost;
  const best = {};
  for (const m of measures) {
    const sign = m.higher ? 1 : -1;
    const top = eligible.reduce((t, a) => (t === null || sign * (a.by[m.key].mean - t) > 0 ? a.by[m.key].mean : t), null);
    best[m.key] = eligible.filter((a) => Math.abs(a.by[m.key].mean - top) <= EPS).reduce((c, a) => (cheaper(a, c) ? a : c), null);
  }
  const ties = (a) => measures.every((m) => {
    const b = best[m.key];
    const [lo, hi] = b.by[m.key].range;
    return a === b || (a.by[m.key].mean >= lo - EPS && a.by[m.key].mean <= hi + EPS);
  });
  const winner = eligible.length ? eligible.filter(ties).reduce((c, a) => (cheaper(a, c) ? a : c), null) : null;
  return { samples, arms, best, winner };
}

export function armReport({ name, def, measures, records, leftOut = {}, notCounted = [] }) {
  const { samples, arms, best, winner } = armStats(def, measures, records, leftOut);
  const num = (v) => String(+v.toFixed(3));
  const cell = (s) => (s.mean === null ? '-' : `${num(s.mean)} (${s.range ? `${num(s.range[0])} to ${num(s.range[1])}` : 'no complete pass'})`);
  const label = (a) => `${a.model} ${a.effort}`;
  const winLines = [];
  if (winner) {
    const all = measures.every((m) => best[m.key] === winner);
    winLines.push(all ? `Winner: ${label(winner)}, the best arm on all three measures; no cheaper arm ties it.`
      : `Winner: ${label(winner)}, the cheapest arm whose mean on every measure lies within the pass-mean range of the best arm on that measure.`);
  } else winLines.push('No winner: the measures have different best arms and no arm ties on all three. The best arm of each measure follows.');
  return [
    `# Round ${name} benchmark: ${def.agent}`, '',
    `Samples ${samples.join(', ') || 'none'}; ${def.runs} runs per arm and sample. Cost per run is weighted tokens (fresh input 1, cache read 0.1, cache write 1.25, output 5) times the model's price factor from ${def.pricesAt || 'no date'}. Suggestions only: this report changes no agent definition.`, '',
    '## Arms', '',
    `| model | effort | runs | ${measures.map((m) => `${m.label}: mean (range of pass means)`).join(' | ')} | mean cost per run |`,
    `| --- | --- | ---: | ${measures.map(() => '---').join(' | ')} | ---: |`,
    ...arms.map((a) => `| ${a.model} | ${a.effort} | ${a.runs} | ${measures.map((m) => cell(a.by[m.key])).join(' | ')} | ${a.cost === null ? '-' : Math.round(a.cost)} |`), '',
    '## Best arm per measure', '',
    ...measures.map((m) => `- ${m.label} (${m.higher ? 'highest' : 'lowest'} is best): ${best[m.key] ? label(best[m.key]) : 'none, no arm has a complete pass'}`), '',
    '## Winner', '', ...winLines, '',
    '## Samples left out', '', ...(Object.keys(leftOut).length ? Object.entries(leftOut).map(([n, why]) => `- sample ${n}: ${why}`) : ['None.']), '',
    '## Rows with no counted run', '', ...(notCounted.length ? notCounted.map((r) => `- ${r.tag}: ${r.reason}`) : ['None.']), '',
  ].join('\n');
}
