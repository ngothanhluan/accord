// Phase 08.7 D-04: the session log of one ticket for the pane, read from git (its commits since the default branch: the claim and every stage change) and from the names and times of the
// agent report files in the checkout (`.accord-reports/<id>/task-<n>.md`, `fix-<k>.md`). Display only: no gate, lint rule or round command reads any of it, `accord show --json` alone lists it,
// and a report's own text is never read (D-02). The third record is the gate run record the owner approved (A-03): `accord gate` appends one line per run to the git-ignored
// `.accord-reports/<id>/gate.log`, and only this file reads it back, for display; no gate, lint rule or round command does. One module, because the log merges these records.
import { execFileSync } from 'node:child_process';
import { appendFileSync, closeSync, existsSync, fstatSync, lstatSync, mkdirSync, openSync, readdirSync, readSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SAFE_ID } from '@accord-dev/accord-core';
import type { GateResult, TicketLogEntry } from '@accord-dev/accord-core';
import { assertNoLink } from '../guard.js';
import { MAX_REPORTS } from './fix-reports.js';
import { gitDefaultRef, UsageError } from './fs.js';
import { REPORT_DIR } from './report.js';

/** T-08.7-05: the log holds at most this many entries, newest first. */
export const LOG_CAP = 50;

/** A-03: the file under `.accord-reports/<id>/` that holds one line per gate run. */
export const GATE_LOG = 'gate.log';
/** T-08.7-05: at most the last this many bytes of the gate log are read. */
const GATE_LOG_BYTES = 65536;
/** T-08.7-02: a gate log line counts only in this strict format: `<epoch seconds>\t<ready|plan|done>\t<pass|fail>\t<reason>`. */
const GATE_LINE = /^([0-9]{1,12})\t(ready|plan|done)\t(pass|fail)\t([^\t]*)$/;
const REASON_CAP = 200;

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
      // the two flags that keep log.showSignature out of the output sit next to `log` as spawn-surface.test.ts reads them
      ['--literal-pathspecs', '-c', 'log.showSignature=false', 'log', '--no-show-signature', `--max-count=${LOG_CAP}`, '--format=%ct%x09%s', 'HEAD', `^${ref}`, '--', `accord/tickets/${id}.md`, `accord/tickets/${id}/`],
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

/**
 * A-03: the gate runs recorded in `.accord-reports/<id>/gate.log`, newest first (a later line before an earlier one), as `{ at, kind: 'gate', text }` with `fail: true` on a FAIL. Only the last
 * 64 KiB are read, a line outside the strict format is dropped, and a link on the path, a non-file or a missing file gives none. Display only: nothing that decides a verdict calls this.
 */
export function readGateRuns(root: string, id: string): TicketLogEntry[] {
  if (!SAFE_ID.test(id)) return [];
  try {
    assertNoLink(root, `${REPORT_DIR}/${id}/${GATE_LOG}`);
  } catch (e) {
    if (e instanceof UsageError) return [];
    throw e;
  }
  const file = join(root, REPORT_DIR, id, GATE_LOG);
  if (lstatSync(file, { throwIfNoEntry: false }) === undefined) return [];
  let text: string;
  const fd = openSync(file, 'r');
  try {
    const size = fstatSync(fd).size;
    const start = Math.max(0, size - GATE_LOG_BYTES);
    const buf = Buffer.alloc(size - start);
    let got = 0;
    while (got < buf.length) {
      const n = readSync(fd, buf, got, buf.length - got, start + got);
      if (n === 0) break;
      got += n;
    }
    text = buf.toString('utf8', 0, got);
  } finally {
    closeSync(fd);
  }
  const out: TicketLogEntry[] = [];
  for (const line of text.split('\n').reverse()) {
    const m = GATE_LINE.exec(line.replace(/\r$/, ''));
    if (m === null) continue;
    const at = Number(m[1]);
    out.push(m[3] === 'pass' ? { at, kind: 'gate', text: `gate ${m[2]} PASS` } : { at, kind: 'gate', text: `gate ${m[2]} FAIL${m[4] === '' ? '' : ': ' + m[4]}`, fail: true });
    if (out.length === LOG_CAP) break;
  }
  return out;
}

/** The reason a failing run is recorded with: the first error finding (else the first finding) as `<rule> <reason>`, control, tab and line-break code points turned into spaces, cut to 200 code points; empty on a pass. */
function gateReason(result: GateResult): string {
  if (result.verdict === 'pass') return '';
  const first = result.findings.find((f) => f.level === 'error') ?? result.findings[0];
  if (first === undefined) return '';
  return [...(first.rule + ' ' + first.reason).replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, ' ')].slice(0, REASON_CAP).join('');
}

/**
 * A-03: append one line for a gate run to `.accord-reports/<id>/gate.log`. The guard sequence of `writeAgentFile` (report.ts), without calling it: neither the report folder, its `.gitignore` nor the
 * file may be a link, a junction or a non-file (`assertNoLink`: UsageError, nothing written); the folder and its `.gitignore` of `*` are made when absent. An id that is no safe id writes nothing.
 * The caller reports a failure on stderr and keeps the verdict and the exit code (T-08.7-07).
 */
export function appendGateRun(root: string, id: string, result: GateResult, at: number): void {
  if (!SAFE_ID.test(id)) return;
  const rel = `${REPORT_DIR}/${id}/${GATE_LOG}`;
  const ignore = `${REPORT_DIR}/.gitignore`;
  assertNoLink(root, ignore);
  assertNoLink(root, rel);
  mkdirSync(join(root, REPORT_DIR, id), { recursive: true });
  if (!existsSync(join(root, ...ignore.split('/')))) writeFileSync(join(root, ...ignore.split('/')), '*\n');
  appendFileSync(join(root, ...rel.split('/')), `${at}\t${result.gate}\t${result.verdict}\t${gateReason(result)}\n`, 'utf8');
}

/** The ticket's session log: its gate runs, agent reports and commits, newest first, at most LOG_CAP; on equal `at` a gate run comes first, then a report, then a commit. */
export function ticketLog(root: string, id: string): TicketLogEntry[] {
  return [...readGateRuns(root, id), ...ticketReports(root, id), ...ticketCommits(root, id)].sort((a, b) => b.at - a.at).slice(0, LOG_CAP);
}
