// ST-LN-83 07-07 (D-05) `accord diff-package <base> <head> [--security]`: the review package of any two commits, for a review of code or a pull request accord
// did not build. It has no ticket, plan or round, so it is not `review-package <id>`; it prints what a reviewer reads, a deterministic changed-line count the size
// rule reads, and with `--security` the security sections review-package builds. git only, literal argument arrays, no shell, and nothing here writes to the repository.
// Phase 8.5 D-14, D-23, R-9: after the title the package carries the default branch's `## Conventions` and the range's own `## Product files changed` (the foreign reviewer's
// blocks), unless `--pr <url>` names another repository's pull request, which gets one line saying none; the CLI tells this repository's pull request from another's by comparing the
// link with origin's URL, and runs no network command: `--pr` alone prints where to fetch from. `--out <file>` writes only into the git-ignored report folder (`.accord-reports/_diff/`).
import { execFileSync } from 'node:child_process';
import { fetchLine, otherRepositoryLine, productBlocks, pullRequestOf, repositoryOf, unknownRepositoryLine } from '@accord-dev/accord-core';
import { defaultRefOf, UsageError } from '../load/fs.js';
import { packageDiff, why } from '../load/package-diff.js';
import { originUrl, productChange, readProductText } from '../load/product.js';
import { assertAgentFile, DIFF_FOLDER, writeAgentFile } from '../load/report.js';
import type { CommandContext } from '../run.js';
import { securitySections, securityText } from './review-package.js';

/** The commit a ref names, as its full sha. A ref that starts with `-` is refused before any git call could read it as an option. */
function commitOf(root: string, ref: string): string {
  if (ref.startsWith('-')) throw new UsageError('not a git ref: ' + ref);
  try {
    return execFileSync('git', ['rev-parse', '--verify', '--end-of-options', ref + '^{commit}'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    throw new UsageError('unknown ref: ' + ref);
  }
}

/** Lines added plus lines removed over `range`; a binary file's `-` counts 0. Renames are not followed, so a moved file counts as removed and added: the total never reads low. */
function changedLines(root: string, range: string): number {
  const out = execFileSync('git', ['diff', '--numstat', '--no-color', '--no-ext-diff', '--no-renames', range, '--'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
  let total = 0;
  for (const line of out.split('\n')) {
    if (line === '') continue;
    const [added, removed] = line.split('\t');
    total += (/^[0-9]+$/.test(added) ? Number(added) : 0) + (/^[0-9]+$/.test(removed) ? Number(removed) : 0);
  }
  return total;
}

/**
 * R-9: `accord diff-package --pr <url>` with no base and head: where the pull request's commits come from, for the skill to fetch (the CLI fetches nothing): `repository: this` and
 * `fetch: origin pull/<n>/head`, `repository: other <owner>/<repo>` and `fetch: https://github.com/<owner>/<repo>.git pull/<n>/head`, or `repository: unknown - <why>` and no fetch line.
 */
function decision(ctx: CommandContext, link: string): number {
  const pull = pullRequestOf(link);
  const where = repositoryOf(pull, originUrl(ctx.root));
  const fetch = fetchLine(where, pull);
  const said = where.kind === 'this' ? 'this' : where.kind === 'other' ? `other ${where.owner}/${where.repo}` : `unknown - ${where.why}`;
  ctx.stdout.write(`repository: ${said}\n` + (fetch === undefined ? '' : `fetch: ${fetch}\n`));
  return 0;
}

export function diffPackage(ctx: CommandContext, base: string | undefined, head: string | undefined, options: { security?: boolean; pr?: string; out?: string }): number {
  if (base === undefined && head === undefined) {
    if (options.pr === undefined) throw new UsageError('give <base> and <head>, or --pr <url> alone to see where its commits are fetched from');
    if (options.security === true || options.out !== undefined) throw new UsageError('--pr with no <base> and <head> only says where to fetch from; give --security or --out with <base> and <head>');
    return decision(ctx, options.pr);
  }
  if (base === undefined || head === undefined) throw new UsageError('give both <base> and <head>, or neither with --pr <url>');
  if (options.out !== undefined) assertAgentFile(DIFF_FOLDER, options.out);
  const baseSha = commitOf(ctx.root, base);
  const headSha = commitOf(ctx.root, head);
  const range = `${baseSha}...${headSha}`;
  let pkg;
  let lines: number;
  try {
    // def undefined: no merge from a default branch is left out, since these two commits are the whole question
    pkg = packageDiff(ctx.root, { base: baseSha, head: headSha, def: undefined, allowPlainLog: false, parts: true });
    lines = changedLines(ctx.root, range);
  } catch (e) {
    if (e instanceof UsageError) throw e;
    throw new UsageError(`cannot diff ${base}...${head}: ${why(e)}`);
  }
  const title = `# Diff package ${base}...${head}\nBase: ${baseSha}\nHead: ${headSha}\nChanged lines: ${lines}`;
  // D-23, R-5: with `--out` the text is written through the one writer of agent files and stdout says what a skill reads: the changed-line count, then the path.
  const emit = (text: string): number => {
    ctx.stdout.write(options.out === undefined ? text : `Changed lines: ${lines}\nfile: ${writeAgentFile(ctx.root, DIFF_FOLDER, options.out, text)}\n`);
    return 0;
  };
  // 8.5-ac-19: the security package holds the checklist and what it matches, and no product text.
  if (options.security === true) return emit(securityText(title, securitySections(ctx.snapshot, pkg.diff, pkg.changed, true, { root: ctx.root, head: headSha }, pkg.unread)));
  // D-14: this repository's review (no link, or a link of this repository's own pull request) gets the default branch's conventions and the range's change; another repository's gets one line.
  const where = options.pr === undefined ? ({ kind: 'this' } as const) : repositoryOf(pullRequestOf(options.pr), originUrl(ctx.root));
  const product =
    where.kind === 'this'
      ? productBlocks('foreign-reviewer', {
          conventions: readProductText(ctx.root, { from: 'default', ref: defaultRefOf(ctx.root) }),
          changed: productChange(ctx.root, baseSha, headSha),
        })
      : [where.kind === 'other' ? otherRepositoryLine(where.owner, where.repo) : unknownRepositoryLine(where.why)];
  return emit([title, ...product, '## Stat', pkg.stat || '(no changes)', '## Diff', pkg.diff || '(no changes)'].join('\n\n') + '\n');
}
