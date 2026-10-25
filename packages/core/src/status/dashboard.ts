// ST-LN-2 `accord dashboard`: the sections and the rank, computed once so every runtime and the
// panel show the same thing (D-02, D-06). Pure: reads the snapshot, returns data, no display text.
import type { Lane, RepoSnapshot } from '../model/snapshot.js';
import { nextRows, statusRows } from './rows.js';
import type { StatusRow } from './rows.js';
import { isDone } from './stage.js';

export interface DashboardSection {
  rows: StatusRow[];
  more: number; // always 0 since ST-LN-61 lifted the caps; kept so the JSON shape and the panel stay as they were
}
export interface DashboardSummary {
  inProgress: number;
  ready: number;
  blocked: number;
  backlog: number;
  done: number;
  withoutLane: number;
  withSchemaErrors: number;
}
export interface EpicRow {
  id: string;
  lane?: Lane;
  title: string;
  done: number;
  total: number;
}
export interface Dashboard {
  yours: DashboardSection;
  team: DashboardSection;
  ready: DashboardSection;
  upNext: DashboardSection & { suggest?: { action: 'pick-up'; id: string } };
  epics: { rows: EpicRow[]; more: number };
  summary: DashboardSummary;
}

const closed = (r: StatusRow) => r.status === 'archived' || r.status === 'dropped';
const isWork = (r: StatusRow) => r.lane !== undefined && r.type !== 'epic';
const isOpen = (r: StatusRow) => isWork(r) && !closed(r) && r.stage !== 'done';
const blocked = (r: StatusRow) => (r.blockedBy ?? []).length > 0;

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
// Digit runs by value (leading zeros stripped, shorter is smaller), anything else in code-point order.
function cmpRun(a: string, b: string): number {
  if (/^\d/.test(a) && /^\d/.test(b)) {
    const x = a.replace(/^0+/, '');
    const y = b.replace(/^0+/, '');
    return x.length - y.length || cmp(x, y);
  }
  return cmp(a, b);
}
function cmpId(a: string, b: string): number {
  const ra = a.match(/\d+|\D+/g) ?? [];
  const rb = b.match(/\d+|\D+/g) ?? [];
  for (let i = 0; i < Math.min(ra.length, rb.length); i++) {
    const c = cmpRun(ra[i], rb[i]);
    if (c !== 0) return c;
  }
  return ra.length - rb.length || cmp(a, b);
}

const WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1 };

// Highest own priority among a ticket and everything that depends on it, directly or not. A closed or done
// dependent adds no weight of its own but the walk passes through it. Visited set ends cycles.
function effectivePriorities(snapshot: RepoSnapshot, plain: RepoSnapshot): Map<string, number> {
  const own = (id: string) => WEIGHT[snapshot.tickets[id]?.frontmatter?.priority ?? 'medium'] ?? 2;
  const dependents = new Map<string, string[]>();
  for (const [id, t] of Object.entries(snapshot.tickets))
    for (const dep of t.frontmatter?.depends_on ?? []) dependents.set(dep, [...(dependents.get(dep) ?? []), id]);
  const lifts = (id: string) => {
    const fm = snapshot.tickets[id]?.frontmatter;
    return fm?.status !== 'archived' && fm?.status !== 'dropped' && !isDone(plain, id);
  };
  const out = new Map<string, number>();
  for (const id of Object.keys(snapshot.tickets)) {
    let best = own(id);
    const seen = new Set([id]);
    const stack = [id];
    while (stack.length) {
      for (const d of dependents.get(stack.pop() as string) ?? []) {
        if (seen.has(d)) continue;
        seen.add(d);
        if (lifts(d)) best = Math.max(best, own(d));
        stack.push(d);
      }
    }
    out.set(id, best);
  }
  return out;
}

function section(rows: StatusRow[], prio: Map<string, number>): DashboardSection {
  const p = (r: StatusRow) => prio.get(r.id) ?? 2;
  const rank = (a: StatusRow, b: StatusRow): number =>
    p(b) - p(a) || Number(blocked(a)) - Number(blocked(b)) || cmpId(a.id, b.id);
  return { rows: [...rows].sort(rank), more: 0 };
}

// D-03: children by frontmatter `parent`, dropped children left out of both counts; unfinished epics first.
function epicsSection(snapshot: RepoSnapshot, plain: RepoSnapshot): Dashboard['epics'] {
  const tickets = Object.entries(snapshot.tickets);
  const rows: EpicRow[] = tickets
    .filter(([, t]) => t.frontmatter?.type === 'epic' && t.frontmatter.status !== 'archived' && t.frontmatter.status !== 'dropped')
    .map(([id, t]) => {
      const kids = tickets.filter(([, k]) => k.frontmatter?.parent === id && k.frontmatter.status !== 'dropped');
      return { id, ...(t.frontmatter?.lane === undefined ? {} : { lane: t.frontmatter.lane }), title: t.frontmatter?.title ?? '', done: kids.filter(([k]) => isDone(plain, k)).length, total: kids.length };
    })
    .sort((a, b) => Number(a.total > 0 && a.done === a.total) - Number(b.total > 0 && b.done === b.total) || cmpId(a.id, b.id));
  return { rows, more: 0 };
}

export function dashboard(snapshot: RepoSnapshot, viewer: string, now?: number, plainSnapshot?: RepoSnapshot): Dashboard {
  const plain = plainSnapshot ?? snapshot;
  const all = statusRows(snapshot, now, plain);
  const prio = effectivePriorities(snapshot, plain);
  const open = all.filter(isOpen);
  const mine = (r: StatusRow) => r.claimedBy !== undefined && r.claimedBy.toLowerCase() === viewer.toLowerCase();
  const claimed = open.filter((r) => r.claimedBy !== undefined);
  const readyAll = nextRows(open);
  const unclaimed = open.filter((r) => r.claimedBy === undefined);
  const yours = section(claimed.filter(mine), prio);
  const ready = section(readyAll, prio);
  // D-03, D-04: always present; every ready ticket is READY's, so UP NEXT is the backlog and the blocked.
  const rest = section(unclaimed.filter((r) => !readyAll.includes(r)), prio).rows;
  const first = rest.find((r) => !blocked(r));
  return {
    yours,
    team: section(claimed.filter((r) => !mine(r)), prio),
    ready,
    upNext: { rows: rest, more: 0, ...(first ? { suggest: { action: 'pick-up' as const, id: first.id } } : {}) },
    epics: epicsSection(snapshot, plain),
    summary: {
      inProgress: claimed.length,
      ready: readyAll.length,
      blocked: unclaimed.filter(blocked).length,
      backlog: unclaimed.filter((r) => !blocked(r) && !readyAll.includes(r)).length,
      done: all.filter((r) => isWork(r) && !closed(r) && r.stage === 'done').length,
      withoutLane: all.filter((r) => r.type !== undefined && r.type !== 'epic' && r.lane === undefined && !closed(r) && !isDone(plain, r.id)).length,
      withSchemaErrors: all.filter((r) => r.type === undefined).length,
    },
  };
}
