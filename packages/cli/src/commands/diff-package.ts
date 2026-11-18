// ST-LN-83 07-07 (D-05) `accord diff-package <base> <head> [--security]`: the review package of any two commits, for a review of code or a pull request accord
// did not build. It has no ticket, plan or round, so it is not `review-package <id>`; it prints what a reviewer reads, a deterministic changed-line count the size
// rule reads, and with `--security` the security sections review-package builds. git only, literal argument arrays, no shell, and nothing here writes.
import { execFileSync } from 'node:child_process';
import { UsageError } from '../load/fs.js';
import { packageDiff, why } from '../load/package-diff.js';
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

export function diffPackage(ctx: CommandContext, base: string, head: string, options: { security?: boolean }): number {
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
  if (options.security === true) {
    ctx.stdout.write(securityText(title, securitySections(ctx.snapshot, pkg.diff, pkg.changed, true, pkg.unread)));
    return 0;
  }
  ctx.stdout.write([title, '## Stat', pkg.stat || '(no changes)', '## Diff', pkg.diff || '(no changes)'].join('\n\n') + '\n');
  return 0;
}
