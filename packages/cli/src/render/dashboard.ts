// ST-LN-2 text view of `Dashboard`: a heading per section, a header line, one line per row, `+N more`,
// one summary line. ASCII cells go through `sanitise`; the title keeps Unicode but loses control and bidi code points.
import { waitingAge } from '@accord-dev/accord-core';
import type { Dashboard, DashboardSection, StatusRow } from '@accord-dev/accord-core';
import { EMPTY_CELL, fit, sanitise } from './table.js';

const TITLE_MAX = 60;

// Control, bidi and line-separator code points become a space (T-05-11 for non-ASCII text). Scanned, not a regexp (no-control-regex).
export const isUnsafe = (cp: number): boolean =>
  cp < 0x20 || (cp >= 0x7f && cp <= 0x9f) || cp === 0x61c || cp === 0x200e || cp === 0x200f || cp === 0x2028 || cp === 0x2029 ||
  (cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2066 && cp <= 0x2069);

function titleCell(title: string | undefined): string {
  const cps = [...(title ?? '')].map((ch) => (isUnsafe(ch.codePointAt(0) ?? 0) ? ' ' : ch));
  const t = [...cps.join('').replace(/ +/g, ' ').trim()];
  return t.length > TITLE_MAX ? t.slice(0, TITLE_MAX - 3).join('') + '...' : t.join('');
}

const HEADS = ['id', 'lane', 'title', 'stage', 'who', 'blocked by'];
// Phase 15 D-22: a row verified on its claim branch and not yet merged says so with its age; an unreadable time leaves the age out.
const waitingNote = (r: StatusRow, now: number): string => {
  if (r.waitingSince === undefined) return '';
  const age = waitingAge(r.waitingSince, now);
  return age === undefined ? ' (waiting for merge)' : ` (waiting for merge, ${age})`;
};
const cells = (r: StatusRow, now: number): string[] => [
  sanitise(r.id),
  sanitise(r.lane ?? EMPTY_CELL),
  titleCell(r.title),
  sanitise(
    (r.stage === undefined ? EMPTY_CELL : r.stage === 'build' && r.lane !== 'S' ? `build ${r.tasksDone ?? 0}/${r.tasksTotal ?? 0}` : r.stage) +
      (r.next === undefined ? '' : `, next: ${r.next}`) +
      (r.idleDays === undefined ? '' : ` idle ${r.idleDays}d`) +
      waitingNote(r, now),
  ),
  fit(sanitise(r.claimedBy ?? EMPTY_CELL), 28),
  fit(sanitise((r.blockedBy ?? []).join(' ') || EMPTY_CELL), 28),
];

function epicBlock(e: Dashboard['epics']): string[] {
  const table = [['id', 'lane', 'title', 'progress'], ...e.rows.map((r) => [sanitise(r.id), sanitise(r.lane ?? EMPTY_CELL), titleCell(r.title), `${r.done}/${r.total} done`])];
  const widths = [0, 1, 2, 3].map((i) => Math.max(...table.map((row) => [...row[i]].length)));
  const out = ['EPICS', ...table.map((row) => '  ' + row.map((v, i) => v + ' '.repeat(widths[i] - [...v].length)).join('  ').trimEnd())];
  if (e.more > 0) out.push(`  +${e.more} more`);
  return out;
}

function block(name: string, s: DashboardSection, now: number): string[] {
  const out = [name];
  if (s.rows.length === 0) out.push('  none');
  else {
    const table = [HEADS, ...s.rows.map((r) => cells(r, now))];
    const widths = HEADS.map((_, i) => Math.max(...table.map((row) => [...row[i]].length)));
    for (const row of table) {
      out.push('  ' + row.map((v, i) => v + ' '.repeat(widths[i] - [...v].length)).join('  ').trimEnd());
    }
  }
  if (s.more > 0) out.push(`  +${s.more} more`);
  return out;
}

export function renderDashboard(d: Dashboard, now: number = Date.now()): string {
  const m = d.summary;
  const summary =
    `${m.inProgress} in progress, ${m.ready} ready, ${m.blocked} blocked, ${m.backlog} backlog, ${m.done} done` +
    (m.withoutLane > 0 ? `, ${m.withoutLane} without lane` : '') +
    (m.withSchemaErrors > 0 ? `, ${m.withSchemaErrors} with schema errors, run accord lint` : '');
  const sections = [block('YOURS', d.yours, now), block('TEAM', d.team, now), block('READY', d.ready, now), block('UP NEXT', d.upNext, now), ...(d.mergedWaiting.rows.length ? [block('MERGED, WAITING FOR VERIFY', d.mergedWaiting, now)] : []), ...(d.epics.rows.length ? [epicBlock(d.epics)] : [])];
  const pick = d.ready.rows[0]?.id ?? d.upNext.suggest?.id;
  // D-29: a merged ticket's next step is verify, reached through continue; it never gets a pick-up (core keeps it out of `suggest`).
  const resume = d.yours.rows[0] ?? d.mergedWaiting.rows[0];
  const actions = [resume ? `[/accord continue ${resume.id}]` : '', pick ? `[/accord pick-up ${pick}]` : '', '[/accord <request>]'].filter(Boolean);
  return [...sections.map((s) => s.join('\n')), summary + '\n-> ' + actions.join('  ')].join('\n\n') + '\n';
}
