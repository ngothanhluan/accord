// Pure logic of the benchmark round: effort scale, run matrix, sample-list check, per-turn flags.
// Imports nothing, reads no file, spawns nothing (the house pattern of plan-review.mjs).
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
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
