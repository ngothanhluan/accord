// Phase 08.7 D-04: the session log of one ticket for the pane, read from git (its commits since the default branch: the claim and every stage change) and from the names and times of the
// agent report files in the checkout (`.accord-reports/<id>/task-<n>.md`, `fix-<k>.md`). Display only: no gate, lint rule or round command reads any of it, `accord show --json` alone lists it,
// and a report's own text is never read (D-02). One module, because the log merges these records, where PATTERNS.md named a separate gate-log module.
import { execFileSync } from 'node:child_process';
import { lstatSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SAFE_ID } from '@accord-dev/accord-core';
import type { TicketLogEntry } from '@accord-dev/accord-core';
import { assertNoLink } from '../guard.js';
import { MAX_REPORTS } from './fix-reports.js';
import { gitDefaultRef, UsageError } from './fs.js';
import { REPORT_DIR } from './report.js';

/** T-08.7-05: the log holds at most this many entries, newest first. */
export const LOG_CAP = 50;

const REPORT_NAME = /^(task|fix)-([1-9][0-9]{0,8})\.md$/;

/**
 * The commits since the default branch that touch the ticket's file or folder, newest first, as `{ at, kind: 'commit', text }` (`at` the committer time in epoch seconds, `text` the subject).
 * An id that is no safe id, no default ref or any git failure gives none. T-08.7-04: an argv array, no shell, literal pathspecs, the id checked first.
 */
export function ticketCommits(root: string, id: string): TicketLogEntry[] {
  if (!SAFE_ID.test(id)) return [];
  const ref = gitDefaultRef(root);
  if (ref === undefined) return [];
  let raw: string;
  try {
    raw = execFileSync(
      'git',
      [
        '--literal-pathspecs',
        '-c',
        'log.showSignature=false',
        'log',
        '--no-show-signature',
        `--max-count=${LOG_CAP}`,
        '--format=%ct%x09%s',
        'HEAD',
        `^${ref}`,
        '--',
        `accord/tickets/${id}.md`,
        `accord/tickets/${id}/`,
      ],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_NO_LAZY_FETCH: '1' } },
    );
  } catch {
    return [];
  }
  const out: TicketLogEntry[] = [];
  for (const line of raw.split('\n')) {
    const m = /^([0-9]+)\t(.*)$/.exec(line.replace(/\r$/, ''));
    if (m !== null) out.push({ at: Number(m[1]), kind: 'commit', text: m[2] });
  }
  return out;
}

/**
 * The executor and fix reports under `.accord-reports/<id>/` of the checkout `root`, as `{ at, kind: 'report', text }`: regular files named `task-<n>.md` or `fix-<k>.md`, the first MAX_REPORTS by name,
 * `at` the file's modification time in epoch seconds. The file's text is never read (T-08.7-22). A link or junction anywhere on the path, or a missing folder, is none.
 */
export function ticketReports(root: string, id: string): TicketLogEntry[] {
  if (!SAFE_ID.test(id)) return [];
  try {
    assertNoLink(root, `${REPORT_DIR}/${id}/task-0.md`);
  } catch (e) {
    if (e instanceof UsageError) return [];
    throw e;
  }
  const folder = join(root, REPORT_DIR, id);
  const found = lstatSync(folder, { throwIfNoEntry: false });
  if (found === undefined || !found.isDirectory()) return [];
  const names = readdirSync(folder, { withFileTypes: true })
    .filter((d) => d.isFile() && REPORT_NAME.test(d.name))
    .map((d) => d.name)
    .sort()
    .slice(0, MAX_REPORTS);
  const out: TicketLogEntry[] = [];
  for (const name of names) {
    const stat = lstatSync(join(folder, name), { throwIfNoEntry: false });
    if (stat === undefined || !stat.isFile()) continue;
    const m = REPORT_NAME.exec(name);
    if (m === null) continue;
    out.push({ at: Math.floor(stat.mtimeMs / 1000), kind: 'report', text: m[1] === 'task' ? `executor report task ${m[2]}` : `fix report ${m[2]}` });
  }
  return out;
}

/** The ticket's session log: its commits and its agent reports, newest first, at most LOG_CAP; on equal `at` a report comes before a commit. */
export function ticketLog(root: string, id: string): TicketLogEntry[] {
  return [...ticketReports(root, id), ...ticketCommits(root, id)].sort((a, b) => b.at - a.at).slice(0, LOG_CAP);
}
