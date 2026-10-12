// Spec §10 `accord review-package <id> [--base <ref>]`: what a reviewer reads — commits, stat, and the diff
// with ten lines of context. git only, literal argument arrays, no shell (CLI-07).
import { execFileSync } from 'node:child_process';
import { undeclaredFiles, workOf } from '@accord-dev/accord-core';
import { UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';
import { requireLaneTicket } from './lane-args.js';

// No leading '-', so a ref can never be read as a git option; no spaces or shell metacharacters.
// `~` and `^` after the first character admit HEAD~3 and main^.
const REF = /^[A-Za-z0-9][A-Za-z0-9._/~^-]*$/;

export function reviewPackage(ctx: CommandContext, id: string, options: { base?: string }): number {
  requireLaneTicket(ctx, id);
  const base = options.base ?? workOf(ctx.snapshot, id)?.plan?.baseline;
  if (base === undefined) throw new UsageError('no --base given and plan.md records no baseline:');
  if (!REF.test(base)) throw new UsageError('not a git ref: ' + base);
  const git = (args: string[]) =>
    execFileSync('git', args, {
      cwd: ctx.root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
  const range = base + '...HEAD';
  // A short reason for the one failure that explains itself, else git's own first stderr line.
  const why = (e: unknown): string => {
    const err = e as { code?: string; stderr?: string };
    if (err.code === 'ENOBUFS') return 'the diff is larger than 64 MiB';
    const line = (err.stderr ?? '').split('\n').find((l) => l.trim() !== '');
    return line === undefined ? 'git failed' : line.replace(/^fatal: /, '').trim();
  };
  try {
    git(['rev-parse', '--verify', '--quiet', base + '^{commit}']);
  } catch {
    let headless = false;
    try {
      git(['rev-parse', '--verify', '--quiet', 'HEAD^{commit}']);
    } catch {
      headless = true;
    }
    throw new UsageError(headless ? 'the repository has no commit to review' : 'unknown base ref: ' + base);
  }
  let parts: string[];
  try {
    parts = [
      `# Review package: ${id} (${range})`,
      '## Commits',
      git(['log', '--no-color', '--format=%h %s', base + '..HEAD', '--']).trimEnd() || '(none)',
      '## Stat',
      git(['diff', '--no-color', '--no-ext-diff', '--stat', range, '--']).trimEnd() || '(no changes)',
      '## Diff',
      git(['diff', '--no-color', '--no-ext-diff', '-U10', range, '--']).trimEnd() || '(no changes)',
    ];
    const changed = git(['diff', '--name-only', '-z', '--no-renames', range, '--']).split('\0').filter((p) => p !== '');
    const undeclared = undeclaredFiles(ctx.snapshot, id, changed);
    parts.splice(
      parts.indexOf('## Diff'),
      0,
      '## Undeclared files',
      undeclared === undefined ? '(no plan)' : undeclared.join('\n') || '(none)',
    );
  } catch (e) {
    throw new UsageError(`cannot diff ${range}: ${why(e)}`);
  }
  ctx.stdout.write(parts.join('\n\n') + '\n');
  return 0;
}
