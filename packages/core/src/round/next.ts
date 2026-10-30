// ST-LN-17: the next review or plan critique round, the cap, the stop from round 3 and the fix executor's model,
// all computed from the round records. Pure: the host supplies the records and the return-from-verify facts.
import { laneTicket, workOf } from '../gate/work.js';
import { headingKey, stripHtmlComments } from '../load/sections.js';
import { AGENT_DEFAULTS } from '../skills/agents.js';
import type { RepoSnapshot, RoundCycle, RoundRecord } from '../model/snapshot.js';

export const ROUND_CAP = 5;
export type RoundKind = 'review' | 'plan';
export interface Allowance { n: number; after: number; cycle: number }
export interface RoundAnswer {
  kind: 'next' | 'stop' | 'refused';
  ticket: string;
  record: RoundKind;
  laneS: boolean;
  cycle: number; // 1-based; the last cycle of the record
  round: number; // next: the round given; stop and refused: the latest recorded round (0 when none)
  cap: number; // ROUND_CAP, or the end of the furthest allowance of this cycle
  reasons: string[]; // stop and refused; empty on next
  findings?: { round: number; lines: string[] }[]; // stop: the stop round's finding lines, then the latest round's when it differs
  approach?: string[]; // stop on a lane M ticket: the ## Approach lines
  allowAfter?: number; // stop on a round run without being allowed: the round an owner allowance must follow (else `round`)
  model?: string;
  modelFor?: number; // the round `model` is for
}

const ALLOWANCE =
  /^Ruling: the owner allows ([1-9][0-9]*) more (review|plan critique) rounds after round ([1-9][0-9]*) of cycle ([1-9][0-9]*) — ".*\S.*" — \S/;

/** The owner allowance Rulings of the ledger for one record kind; a line that does not match grants nothing. */
export function allowancesOf(snapshot: RepoSnapshot, id: string, kind: RoundKind): Allowance[] {
  const want = kind === 'review' ? 'review' : 'plan critique';
  const out: Allowance[] = [];
  for (const ruling of workOf(snapshot, id)?.ledger?.rulings ?? []) {
    const m = ALLOWANCE.exec(ruling);
    if (m === null || m[2] !== want) continue;
    const a = { n: Number(m[1]), after: Number(m[3]), cycle: Number(m[4]) };
    if (Number.isSafeInteger(a.n + a.after) && Number.isSafeInteger(a.cycle)) out.push(a);
  }
  return out;
}

/** The cap, the allowed rounds and the stop of one cycle; the caller passes only that cycle's allowances. */
export function cycleState(cycle: RoundCycle, allowances: Allowance[], kind: RoundKind): {
  cap: number;
  allowed: (p: number) => boolean;
  stopAt: (q: number) => number | undefined;
} {
  const rounds = cycle.rounds;
  const accepted = cycle.verdicts.filter((v) => v.quoted);
  const stopAt = (q: number): number | undefined => {
    const top = Math.min(q, rounds.length);
    for (let s = top; s >= 3; s--) {
      if (s < top && rounds[s].noFindings) return undefined; // round s + 1 reports no findings: it clears every stop up to s
      if (!rounds[s - 1].findings.some((f) => f.severity !== 'Nice')) continue;
      if (kind === 'plan') {
        const to = top < rounds.length ? rounds[top].line : Infinity;
        if (accepted.some((v) => v.line > rounds[s - 1].line && v.line < to)) continue;
      }
      return s;
    }
    return undefined;
  };
  const allowed = (p: number): boolean => {
    const s = p === 1 ? undefined : stopAt(p - 1);
    return (p <= ROUND_CAP && s === undefined) || allowances.some((a) => a.after < p && p <= a.after + a.n && (s === undefined || s <= a.after));
  };
  return { cap: Math.max(ROUND_CAP, ...allowances.map((a) => a.after + a.n)), allowed, stopAt };
}

/** The round a plan critique cycle stops at: the stop from round 3, else a last round with findings at the cap. */
export function planStopOf(cycle: RoundCycle, allowances: Allowance[]): number | undefined {
  const st = cycleState(cycle, allowances, 'plan');
  const L = cycle.rounds.length;
  const stop = st.stopAt(L);
  if (stop !== undefined || L === 0 || L < st.cap) return stop;
  const last = cycle.rounds[L - 1];
  const acceptedAfter = cycle.verdicts.some((v) => v.quoted && v.line > last.line);
  return last.findings.length > 0 && !acceptedAfter ? L : undefined;
}

const ofCycle = (all: Allowance[], index: number): Allowance[] => all.filter((a) => a.cycle === index + 1);

/** Every reason the record cannot be read as it stands, in line order. */
export function recordProblems(snapshot: RepoSnapshot, id: string, kind: RoundKind): { line: number; reason: string }[] {
  const work = workOf(snapshot, id);
  const rec: RoundRecord | undefined = kind === 'review' ? work?.rounds : work?.planRounds;
  if (rec === undefined) return [];
  const out = [...rec.unreadable];
  const all = allowancesOf(snapshot, id, kind);
  const add = (line: number, reason: string) => out.push({ line, reason: `line ${line}: ${reason}` });
  rec.cycles.forEach((cycle, i) => {
    if (kind === 'review' && i >= 1) {
      const before = rec.cycles[i - 1];
      if (cycle.marker !== undefined && snapshot.returnFacts?.[id]?.[cycle.marker] !== true) {
        add(cycle.line, `## Return from verify ${cycle.marker} names a commit accord cannot confirm: it must be an ancestor of HEAD at which review.md ended with its verdict`);
      }
      if (before.rounds.length === 0) {
        add(cycle.line, 'a return from verify with no round before it');
      } else if (before.verdicts.length === 0) {
        add(cycle.line, `cycle ${i} has no verdict: line before ## Return from verify`);
      } else {
        const stop = cycleState(before, ofCycle(all, i - 1), kind).stopAt(before.rounds.length);
        const last = before.verdicts[before.verdicts.length - 1];
        if (stop !== undefined && !(last.value === 'accepted-by-owner' && last.quoted)) {
          add(cycle.line, `## Return from verify follows the stop at round ${stop} of cycle ${i}, which the owner did not accept with verdict: accepted-by-owner "<sentence>"`);
        }
      }
    }
    if (kind === 'plan' && cycle.closed !== undefined) {
      const stop = planStopOf(cycle, ofCycle(all, i));
      if (stop !== undefined) {
        add(cycle.closed, `## Closed while the stop at round ${stop} holds; the owner accepts with verdict: accepted-by-owner "<sentence>" after that round, or a round that reports no findings clears it`);
      }
    }
  });
  return out.sort((a, b) => a.line - b.line);
}

const FAMILY = /^claude-(?:[a-z0-9.]+-)*?(haiku|sonnet|opus)(?:-|$)/i;
const TIERS = ['haiku', 'sonnet', 'opus'] as const;

/** The model family of an executor model name, or undefined when it names none. */
export function modelFamily(model: string): 'haiku' | 'sonnet' | 'opus' | undefined {
  const lower = model.toLowerCase();
  if ((TIERS as readonly string[]).includes(lower)) return lower as 'haiku' | 'sonnet' | 'opus';
  const m = FAMILY.exec(model);
  return m === null ? undefined : (m[1].toLowerCase() as 'haiku' | 'sonnet' | 'opus');
}

const isLaneM = (snapshot: RepoSnapshot, id: string): boolean => {
  const t = laneTicket(snapshot, id);
  return t !== undefined && t.frontmatter?.lane !== 'S';
};

/** The model of the executor that fixes round `round`'s findings (default: the latest recorded round). */
export function fixModel(snapshot: RepoSnapshot, id: string, round?: number): { model: string } | { refused: string } | undefined {
  if (!isLaneM(snapshot, id)) return undefined;
  const rec = workOf(snapshot, id)?.rounds;
  const r = round ?? rec?.cycles[rec.cycles.length - 1].rounds.length ?? 0;
  if (r === 0) return undefined;
  const configured = Number(snapshot.config?.escalation?.fix_round_tier_up ?? '4');
  const tier = Number.isInteger(configured) && configured > 0 ? configured : 4;
  const raised = r >= tier || (rec?.cycles ?? []).some((c) => c.rounds.length >= tier);
  const base = snapshot.config?.models?.executor?.model ?? AGENT_DEFAULTS.executor.model;
  const family = modelFamily(base);
  if (!raised) return { model: family ?? base };
  if (family === undefined) {
    return { refused: `the executor model "${base}" in accord/config.yml (models.executor.model) cannot be tiered up; set it to haiku, sonnet or opus` };
  }
  return { model: TIERS[Math.min(TIERS.indexOf(family) + 1, TIERS.length - 1)] };
}

function approachOf(snapshot: RepoSnapshot, id: string): string[] {
  const section = snapshot.tickets[id]?.sections.find((s) => headingKey(s.heading) === 'approach');
  if (section === undefined) return [];
  const lines = stripHtmlComments(section.lines).map((l) => l.text);
  while (lines.length > 0 && lines[0].trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
  return lines;
}

/** The decision for the next round of review.md or plan-review.md. */
export function nextRound(snapshot: RepoSnapshot, id: string, kind: RoundKind): RoundAnswer {
  const laneS = laneTicket(snapshot, id)?.frontmatter?.lane === 'S';
  const base: RoundAnswer = { kind: 'refused', ticket: id, record: kind, laneS, cycle: 1, round: 0, cap: ROUND_CAP, reasons: [] };
  const refuse = (...reasons: string[]): RoundAnswer => ({ ...base, reasons });
  if (laneTicket(snapshot, id) === undefined) return refuse(`${id} is not a lane ticket`);
  if (kind === 'plan' && laneS) return refuse('lane S has no plan critique');
  const lane = isLaneM(snapshot, id);
  const file = kind === 'review' ? 'review.md' : 'plan-review.md';
  const rec = kind === 'review' ? workOf(snapshot, id)?.rounds : workOf(snapshot, id)?.planRounds;

  const next = (round: number, cycle: number, cap: number): RoundAnswer => {
    const answer: RoundAnswer = { ...base, kind: 'next', cycle, round, cap };
    if (kind === 'review' && lane) {
      const m = fixModel(snapshot, id, round);
      if (m !== undefined && 'refused' in m) return refuse(m.refused);
      if (m !== undefined) {
        answer.model = m.model;
        answer.modelFor = round;
      }
    }
    return answer;
  };

  if (rec === undefined || (!rec.versioned && rec.cycles.every((c) => c.rounds.length === 0))) return next(1, 1, ROUND_CAP);
  if (!rec.versioned) {
    return refuse(`${file} has no record version line; add the line "Round record: 1" above its first ## heading and ask again: its rounds count as cycle 1`);
  }
  const problems = recordProblems(snapshot, id, kind);
  if (problems.length > 0) return refuse(...problems.map((p) => p.reason));

  const k = rec.cycles.length;
  const cyc = rec.cycles[k - 1];
  const L = cyc.rounds.length;
  const all = allowancesOf(snapshot, id, kind);
  const st = cycleState(cyc, ofCycle(all, k - 1), kind);
  const stopOf = (q: number) => (kind === 'plan' ? planStopOf(cyc, ofCycle(all, k - 1)) : st.stopAt(q));
  const textsOf = (n: number) => ({ round: n, lines: cyc.rounds[n - 1].findings.map((f) => f.text) });
  const findingsFor = (s: number) => (L === s ? [textsOf(s)] : [textsOf(s), textsOf(L)]);
  const stop = (reasons: string[], s: number, extra: Partial<RoundAnswer> = {}): RoundAnswer => ({
    ...base,
    kind: 'stop',
    cycle: k,
    round: L,
    cap: st.cap,
    reasons,
    findings: findingsFor(s),
    ...(lane ? { approach: approachOf(snapshot, id) } : {}),
    ...extra,
  });

  // A round run without being allowed: whatever verdict follows, a skipped stop stays visible.
  for (let p = 2; p <= L; p++) {
    if (st.allowed(p)) continue;
    const past = p > st.cap;
    const s = past ? p - 1 : (st.stopAt(p - 1) ?? p - 1);
    const why = past ? `past the cap of ${st.cap} rounds` : `after the stop at round ${s}`;
    return stop([`round ${p} of cycle ${k} ran without an owner Ruling allowing it: ${why}`], s, { allowAfter: p - 1 });
  }

  const verdict = cyc.verdicts[cyc.verdicts.length - 1];
  if (verdict !== undefined && (L === 0 || verdict.line > cyc.rounds[L - 1].line)) {
    const accepted = verdict.value === 'accepted-by-owner' && verdict.quoted;
    if (accepted || stopOf(L) === undefined) {
      const tail =
        kind === 'review'
          ? '; a new cycle starts with a ## Return from verify <sha> line'
          : '; the loop has ended: the plan skill goes on to its baseline tests and appends ## Closed when it finishes, which starts the next cycle';
      return { ...refuse(`${file} ends cycle ${k} with verdict: ${verdict.value} at line ${verdict.line}${tail}`), cycle: k, round: L, cap: st.cap };
    }
  }

  const p = L + 1;
  if (st.allowed(p)) return next(p, k, st.cap);
  if (L > 0 && cyc.rounds[L - 1].noFindings) {
    return { ...refuse(`round ${L} of cycle ${k} reported no findings and the cap of ${st.cap} rounds is reached; the loop has ended: write the verdict`), cycle: k, round: L, cap: st.cap };
  }
  const s = st.stopAt(L);
  if (s !== undefined) {
    const reasons = [`round ${s} of cycle ${k} still reports a Should or a Must, and from round 3 such a round stops the loop`];
    if (L >= st.cap) reasons.push(`the cap of ${st.cap} rounds in cycle ${k} is reached`);
    const m = kind === 'review' && lane && L < st.cap ? fixModel(snapshot, id, L) : undefined;
    return stop(reasons, s, m !== undefined && 'model' in m ? { model: m.model, modelFor: L } : {});
  }
  return stop([`the cap of ${st.cap} rounds in cycle ${k} is reached and no owner Ruling in the ledger allows more`], L);
}

/** The text `accord round` prints. */
export function roundText(answer: RoundAnswer): string {
  if (answer.kind === 'next') {
    return `Round: ${answer.round} of ${answer.cap}\nCycle: ${answer.cycle}\n` + (answer.model === undefined ? '' : `Fix executor model: ${answer.model}\n`);
  }
  if (answer.kind === 'refused') return answer.reasons.map((r) => `refused: ${r}\n`).join('');
  const file = answer.record === 'review' ? 'review.md' : 'plan-review.md';
  const noun = answer.record === 'review' ? 'review' : 'plan critique';
  const out = ['stop: report to owner'];
  for (const r of answer.reasons) out.push(`Reason: ${r}`);
  for (const f of answer.findings ?? []) out.push(`Findings of round ${f.round}:`, ...f.lines);
  if (answer.approach !== undefined) out.push('Approach:', ...answer.approach);
  out.push(
    answer.laneS
      ? 'Ask the owner whether to change course: in lane S the change of course is the lift to lane M (lane-s.md).'
      : 'Ask the owner whether to change course: weigh the options the Approach above rejected or held in reserve against going on.',
    `To accept the open findings: end ${file} with the line verdict: accepted-by-owner "<the owner's sentence>"`,
    `To allow more rounds: add under ## Rulings in the ledger: Ruling: the owner allows <n> more ${noun} rounds after round ${answer.allowAfter ?? answer.round} of cycle ${answer.cycle} — "<the owner's sentence>" — <cost if wrong>`,
  );
  if (!answer.laneS) {
    out.push(`To change course: write that Ruling with <n> the rounds the owner gives the reworked ${answer.record === 'review' ? 'code' : 'plan'}, then re-plan through accord-plan`);
  }
  if (answer.model !== undefined) {
    out.push(`Fix executor model for round ${answer.modelFor}'s findings, if the owner allows more rounds: ${answer.model}`);
  }
  return out.join('\n') + '\n';
}
