// ST-LN-91 D-14: the planner's fix of plan.md is held to the tasks its open findings name; the owner's Ruling is the only way out.
// Pure: the host supplies the hunks of `git diff -U0` and both texts of plan.md as snapshot.planFix (accord round --plan); no diff
// algorithm lives here, core only places each hunk in the frontmatter, the preamble or a task. No code runs at load but constants.
import { laneTicket, workOf } from '../gate/work.js';
import { splitFrontmatter } from '../load/frontmatter.js';
import { parsePlan } from '../load/work.js';
import type { PlanHunk, RepoSnapshot } from '../model/snapshot.js';
import { groundsV2 } from './grounds.js';

const FRONTMATTER = 'frontmatter';
const PREAMBLE = 'the preamble';
const WHOLE = 'the whole plan';

// The owner's Ruling, modelled on next.ts's ALLOWANCE: the latest round and cycle, a place list, the owner's quoted sentence, a cost.
const RULING = /^Ruling: the owner allows the plan fix after round ([1-9][0-9]*) of cycle ([1-9][0-9]*) to change (.+?) — ".*\S.*" — \S/;
// `Task 3`, `Tasks 2 and 3`, `Task 2, Task 3`, `Tasks 2, 3 and 4`: anchored on the word, no nested quantifier.
const TASKS = /\bTasks?\s+([1-9][0-9]*(?:(?:\s*,\s*and\s*|\s*,\s*|\s+and\s+|\s*&\s*)(?:Tasks?\s+)?[1-9][0-9]*)*)/gi;

interface Seg { from: number; to: number; place: string }

/** The lines of a plan.md text by place: frontmatter, the preamble above the first task heading, and each task to the next task heading. */
function segmentsOf(text: string): Seg[] {
  const { bodyOffset } = splitFrontmatter(text);
  const { tasks } = parsePlan('plan.md', text).plan;
  const out: Seg[] = [];
  if (bodyOffset > 0) out.push({ from: 1, to: bodyOffset, place: FRONTMATTER });
  const first = tasks[0]?.line ?? Infinity;
  if (first > bodyOffset + 1) out.push({ from: bodyOffset + 1, to: first - 1, place: PREAMBLE });
  tasks.forEach((t, i) => out.push({ from: t.line, to: (tasks[i + 1]?.line ?? Infinity) - 1, place: `Task ${t.n}` }));
  return out;
}

/** The places the lines `start .. start + count - 1` of one side fall in, the frontmatter left out; a side whose text is missing falls in the whole plan. */
function placesOf(segs: Seg[] | undefined, start: number, count: number): string[] {
  if (count <= 0) return [];
  if (segs === undefined) return [WHOLE];
  const end = start + count - 1;
  return segs.filter((s) => s.place !== FRONTMATTER && s.from <= end && s.to >= start).map((s) => s.place);
}

const order = (place: string): number => (place === PREAMBLE ? 0 : place === WHOLE ? Infinity : Number(place.slice(5)));
const byPlace = (a: string, b: string): number => order(a) - order(b);

/** The task numbers a finding names (`Task 3`, `Tasks 2 and 3`) and whether it names the preamble; a quoted mark names nothing. */
function namedBy(text: string): string[] {
  const bare = text.replace(/"[^"]*"/g, ' ');
  const out: string[] = [];
  for (const m of bare.matchAll(TASKS)) for (const n of m[1].match(/[1-9][0-9]*/g) ?? []) out.push(`Task ${Number(n)}`);
  if (/\bthe preamble\b/i.test(bare)) out.push(PREAMBLE);
  return out;
}

/** git's own header form: a count of 1 is left out. */
const header = (h: PlanHunk): string => {
  const c = (n: number): string => (n === 1 ? '' : `,${n}`);
  return `@@ -${h.oldStart}${c(h.oldCount)} +${h.newStart}${c(h.newCount)} @@`;
};

/**
 * ST-LN-91 D-14: the hunks of the planner's fix that fall outside the places the open findings of the cycle name, one problem listing
 * them in file order. It applies only from the cut-off pin (the same round-1 pin as D-11, from the host's recordPins), for the latest round
 * of the last cycle, and fails closed when git could not give the hunks. An owner Ruling for that round and cycle names more places.
 */
export function fixScopeProblems(snapshot: RepoSnapshot, id: string): { line?: number; reason: string }[] {
  const lane = laneTicket(snapshot, id);
  const work = workOf(snapshot, id);
  const rec = work?.planRounds;
  const fix = snapshot.planFix !== undefined && Object.hasOwn(snapshot.planFix, id) ? snapshot.planFix[id] : undefined;
  if (lane === undefined || lane.frontmatter?.lane === 'S' || rec === undefined || fix === undefined) return [];
  if (!groundsV2(snapshot, id, 'plan')) return [];
  const k = rec.cycles.length;
  const cycle = rec.cycles[k - 1];
  const L = cycle?.rounds.length ?? 0;
  if (L === 0) return [];
  if ('error' in fix) return [{ reason: fix.error }];

  const allowed = new Set<string>();
  for (const round of cycle.rounds) {
    for (const f of round.findings) if (f.state === 'open') for (const place of namedBy(f.text)) allowed.add(place);
  }
  for (const ruling of work?.ledger?.rulings ?? []) {
    const m = RULING.exec(ruling);
    if (m === null || Number(m[1]) !== L || Number(m[2]) !== k) continue;
    if (m[3].includes(WHOLE)) allowed.add(WHOLE);
    for (const place of namedBy(m[3])) allowed.add(place);
  }
  if (allowed.has(WHOLE)) return [];

  const oldSegs = fix.old === undefined ? undefined : segmentsOf(fix.old);
  const newSegs = fix.new === undefined ? undefined : segmentsOf(fix.new);
  const listed: string[] = [];
  const wanted = new Set<string>();
  for (const h of fix.hunks) {
    const outside = [...new Set([...placesOf(oldSegs, h.oldStart, h.oldCount), ...placesOf(newSegs, h.newStart, h.newCount)])]
      .filter((p) => !allowed.has(p))
      .sort(byPlace);
    if (outside.length === 0) continue;
    listed.push(`${header(h)} (${outside.join(', ')})`);
    for (const p of outside) wanted.add(p);
  }
  if (listed.length === 0) return [];
  const ours = [...allowed].sort(byPlace);
  const where = `the plan fix after round ${L} of cycle ${k}`;
  return [
    {
      reason:
        `${where} changes plan.md outside the tasks its open findings name (${ours.length === 0 ? 'none' : ours.join(', ')}): ${listed.join('; ')}; ` +
        'keep the fix to the lines those findings need, or add under ## Rulings in the ledger: ' +
        `Ruling: the owner allows the plan fix after round ${L} of cycle ${k} to change ${[...wanted].sort(byPlace).join(', ')} — "<the owner's sentence>" — <cost if wrong>`,
    },
  ];
}
