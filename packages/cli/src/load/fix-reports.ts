// Phase 8.5 D-19, R-6: the executor fix reports `accord round` holds a review fix against. A fix executor writes `.accord-reports/<id>/fix-<k>.md` under the checkout (the path `accord brief <id> --fix`
// prints) with one `places checked: <n>: <place>, <place>…` line per finding; the fix record's `checked:` mark is copied from it, and `accord round` refuses the next round when no report lists the
// places a fixed finding's mark names. The folder is machine-local and git-ignored, so only `accord round` reads it: `accord gate done` and CI never do (the host supplies the fact, never the gate).
// Bounded and link-free: a folder or file that is a link, junction or non-file reads as no report, at most MAX_REPORTS names are read, none larger than MAX_REPORT_BYTES. Nothing here writes.
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { claimPinBefore, PRODUCT_TEXT_FROM, workOf } from '@accord-dev/accord-core';
import type { FixReport, RepoSnapshot } from '@accord-dev/accord-core';
import { assertNoLink } from '../guard.js';
import { UsageError } from './fs.js';
import { REPORT_DIR } from './report.js';

/** T-08.5-18: at most this many `fix-<n>.md` names are read. */
export const MAX_REPORTS = 200;
/** T-08.5-18: a report larger than this is not read (it reads as no report). */
export const MAX_REPORT_BYTES = 65536;

const FIX_NAME = /^fix-[0-9]{1,9}\.md$/;
const PLACES_LINE = /^places checked: ([0-9]+(?:\.[0-9]+)?): (.*)$/;

/** The `places checked:` lines of one report text, each as the finding token and its places as written (trimmed; a trailing `…` or `...` dropped). */
function placesOf(text: string): FixReport['places'][number][] {
  const out: FixReport['places'][number][] = [];
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // a byte order mark before the first line is not part of it
  for (const raw of body.split(/\r?\n/)) {
    const m = PLACES_LINE.exec(raw.trim());
    if (m === null) continue;
    const places = m[2]
      .replace(/\s*(?:…|\.\.\.)\s*$/, '')
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p !== '');
    out.push({ n: m[1], places });
  }
  return out;
}

/** The fix reports under `.accord-reports/<id>/` of the checkout `root`: regular files named `fix-<n>.md` of at most MAX_REPORT_BYTES, the first MAX_REPORTS by name; a link anywhere on the path is none. */
export function readFixReports(root: string, id: string): FixReport[] {
  try {
    assertNoLink(root, `${REPORT_DIR}/${id}/fix-0.md`);
  } catch (e) {
    if (e instanceof UsageError) return [];
    throw e;
  }
  const folder = join(root, REPORT_DIR, id);
  const found = lstatSync(folder, { throwIfNoEntry: false });
  if (found === undefined || !found.isDirectory()) return [];
  const names = readdirSync(folder, { withFileTypes: true })
    .filter((d) => d.isFile() && FIX_NAME.test(d.name))
    .map((d) => d.name)
    .sort()
    .slice(0, MAX_REPORTS);
  const reports: FixReport[] = [];
  for (const name of names) {
    const file = join(folder, name);
    const stat = lstatSync(file, { throwIfNoEntry: false });
    if (stat === undefined || !stat.isFile() || stat.size > MAX_REPORT_BYTES) continue;
    reports.push({ file: name, places: placesOf(readFileSync(file, 'utf8')) });
  }
  return reports;
}

/**
 * `snapshot` with fixReports[id] set; `snapshot` itself when the ticket has no lane, is lane S, has no version 2 review record or no finding recorded fixed with a `checked:` mark, or was claimed
 * before PRODUCT_TEXT_FROM (D-19, R-11: only this refusal reads the claim pin; the `--fix` brief has one layout for any pin). A failed claim read is not before the cut-off (claimPinBefore fails
 * closed), so the reports are read and the refusal applies. `root` is the checkout `accord round` runs in: a fix run in another worktree leaves its report there and is run again (D-19).
 */
export function withFixReports(root: string, snapshot: RepoSnapshot, id: string): RepoSnapshot {
  const lane = Object.hasOwn(snapshot.tickets, id) ? snapshot.tickets[id].frontmatter?.lane : undefined;
  const rec = workOf(snapshot, id)?.rounds;
  if (lane === undefined || lane === 'S' || rec === undefined || rec.version !== 2) return snapshot;
  if (!rec.cycles.some((c) => c.rounds.some((r) => r.findings.some((f) => f.state === 'fixed' && f.checked !== undefined)))) return snapshot;
  if (claimPinBefore(snapshot, id, PRODUCT_TEXT_FROM)) return snapshot;
  return { ...snapshot, fixReports: { ...snapshot.fixReports, [id]: readFixReports(root, id) } };
}
