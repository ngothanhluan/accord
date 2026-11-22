// ST-LN-59 D-07: where an executor writes its report and how task-done reads it. The folder sits inside the checkout the executor works in, so every tool and permission
// mode lets it write there, and its own `.gitignore` holds `*`, so git, `accord review-package` and `git status` never see a report. The path is built from the loader's
// ticket key and the validated task number only (T-04-12), never from report or plan text.
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SAFE_ID } from '@accord-dev/accord-core';
import { assertNoLink } from '../guard.js';
import { UsageError } from './fs.js';
import { shown } from './script-trust.js';

export const REPORT_DIR = '.accord-reports';

/** The report's path under the checkout root, forward slashes: `.accord-reports/<id>/task-<n>.md`. */
export const reportRel = (id: string, n: number): string => `${REPORT_DIR}/${id}/task-${n}.md`;

/** The absolute path of the report under `root`, forward slashes on every host (the brief prints it, and no `\` may appear in printed output). */
export function reportPath(root: string, id: string, n: number): string {
  return root.replace(/\\/g, '/').replace(/\/+$/, '') + '/' + reportRel(id, n);
}

/**
 * A new dispatch starts with no report: the folder and its `.gitignore` (`*`, when absent) are made, and this task's old report is removed. Neither the folder nor the
 * report may be a link, a junction or a non-file (`assertNoLink`: exit 2, nothing written).
 */
export function prepareReport(root: string, id: string, n: number): void {
  const rel = reportRel(id, n);
  const ignore = `${REPORT_DIR}/.gitignore`;
  assertNoLink(root, ignore);
  assertNoLink(root, rel);
  mkdirSync(join(root, REPORT_DIR, id), { recursive: true });
  if (!existsSync(join(root, ...ignore.split('/')))) writeFileSync(join(root, ...ignore.split('/')), '*\n');
  rmSync(join(root, ...rel.split('/')), { force: true });
}

/** D-02: the fix report's path under the checkout root, forward slashes: `.accord-reports/<id>/fix-<k>.md`; a fix has no task number. */
export const fixReportRel = (id: string, k: number): string => `${REPORT_DIR}/${id}/fix-${k}.md`;

/** The absolute path of fix report `k` under `root`, forward slashes on every host. */
export function fixReportPath(root: string, id: string, k: number): string {
  return root.replace(/\\/g, '/').replace(/\/+$/, '') + '/' + fixReportRel(id, k);
}

const FIX_NAME = /^fix-([1-9][0-9]{0,8})\.md$/;

/**
 * D-02: where a new fix report goes: the folder and its `.gitignore` (`*`, when absent) are made as `prepareReport` makes them, and `k` is one more than the largest `fix-<n>.md` among the
 * folder's regular files, so an earlier fix report is kept and a second fix gets its own. Nothing is removed. The folder and the report may not be a link, a junction or a non-file
 * (`assertNoLink`: exit 2, nothing written); a folder named like a report is no report and is refused when its number is taken.
 */
export function prepareFixReport(root: string, id: string): number {
  const ignore = `${REPORT_DIR}/.gitignore`;
  assertNoLink(root, ignore);
  // a path that does not exist ends the walk: this checks the folders above it are real folders
  assertNoLink(root, `${REPORT_DIR}/${id}/fix-0.md`);
  const folder = join(root, REPORT_DIR, id);
  let k = 1;
  if (lstatSync(folder, { throwIfNoEntry: false }) !== undefined) {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const m = entry.isFile() ? FIX_NAME.exec(entry.name) : null;
      if (m !== null) k = Math.max(k, Number(m[1]) + 1);
    }
  }
  assertNoLink(root, fixReportRel(id, k));
  mkdirSync(folder, { recursive: true });
  if (!existsSync(join(root, ...ignore.split('/')))) writeFileSync(join(root, ...ignore.split('/')), '*\n');
  return k;
}

/** D-23: the name `--out` takes: a bare file name, never a path, that starts with a letter or digit (so never `-x`, `.gitignore` or `..`). */
export const AGENT_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
/** The folder of a file no ticket owns (`accord diff-package --out`, 08.5-06): no ticket id can be it, since an id starts with a letter or digit. */
export const DIFF_FOLDER = '_diff';
/** The names of the reports an executor writes and `accord task-done` and `accord round` read; `--out` never writes one, so no brief can forge a report. */
const REPORT_NAME = /^(?:task|fix)-[0-9]+\.md$/i;

/** The refusals of `writeAgentFile` that need no disk: a UsageError ending `nothing was written`, thrown before any file or folder is made. */
export function assertAgentFile(folder: string, name: string): void {
  const nothing = '; nothing was written';
  const said = shown(name.replace(/\\/g, '/'));
  if (folder !== DIFF_FOLDER && !SAFE_ID.test(folder)) throw new UsageError(`not a valid report folder: ${shown(folder.replace(/\\/g, '/'))}${nothing}`);
  if (!AGENT_FILE.test(name)) throw new UsageError(`--out takes a bare file name of letters, digits, . _ and -, at most 100 characters, starting with a letter or digit, never a path: ${said}${nothing}`);
  if (REPORT_NAME.test(name)) throw new UsageError(`--out never takes a report name (task-<n>.md or fix-<k>.md): ${said}${nothing}`);
}

/** Review 08.5 IN-03: everything `writeAgentFile` would refuse, found before anything is written: the name, and a link or non-file at the report's `.gitignore` or at the file. Writes nothing. */
export function checkAgentFile(root: string, folder: string, name: string): void {
  assertAgentFile(folder, name);
  assertNoLink(root, `${REPORT_DIR}/.gitignore`);
  assertNoLink(root, `${REPORT_DIR}/${folder}/${name}`);
}

/**
 * D-23, R-5: one writer for every file accord writes for an agent to read (`accord brief --out`, and the package commands of 08.5-06): `.accord-reports/<folder>/<name>` under the checkout
 * root, written as UTF-8 with no byte order mark (the text is LF already), so no shell redirect can change its encoding. The folder is a validated ticket id or `DIFF_FOLDER`; the name passes
 * `assertAgentFile`; the `.gitignore` of `*` is made as `prepareReport` makes it, and neither it, the folders nor the file may be a link, a junction or a non-file (`assertNoLink`: exit 2).
 * Returns the file's absolute path with forward slashes.
 */
export function writeAgentFile(root: string, folder: string, name: string, text: string): string {
  assertAgentFile(folder, name);
  const rel = `${REPORT_DIR}/${folder}/${name}`;
  const ignore = `${REPORT_DIR}/.gitignore`;
  assertNoLink(root, ignore);
  assertNoLink(root, rel);
  mkdirSync(join(root, REPORT_DIR, folder), { recursive: true });
  if (!existsSync(join(root, ...ignore.split('/')))) writeFileSync(join(root, ...ignore.split('/')), '*\n');
  writeFileSync(join(root, ...rel.split('/')), text, 'utf8');
  return root.replace(/\\/g, '/').replace(/\/+$/, '') + '/' + rel;
}

/** The report's text and modification time; undefined when there is none, or when it or a folder above it is not a plain file or folder (a link reads as missing). */
export function readReport(root: string, id: string, n: number): { text: string; mtimeMs: number } | undefined {
  const rel = reportRel(id, n);
  try {
    assertNoLink(root, rel);
  } catch (e) {
    if (e instanceof UsageError) return undefined;
    throw e;
  }
  const file = join(root, ...rel.split('/'));
  if (lstatSync(file, { throwIfNoEntry: false }) === undefined) return undefined;
  return { text: readFileSync(file, 'utf8'), mtimeMs: statSync(file).mtimeMs };
}
