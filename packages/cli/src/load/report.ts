// ST-LN-59 D-07: where an executor writes its report and how task-done reads it. The folder sits inside the checkout the executor works in, so every tool and permission
// mode lets it write there, and its own `.gitignore` holds `*`, so git, `accord review-package` and `git status` never see a report. The path is built from the loader's
// ticket key and the validated task number only (T-04-12), never from report or plan text.
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertNoLink } from '../guard.js';
import { UsageError } from './fs.js';

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
