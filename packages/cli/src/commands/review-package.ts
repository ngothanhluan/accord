// Spec §10 `accord review-package <id> --base <ref>`: what a reviewer reads — commits, stat, and the diff
// with ten lines of context. git only, literal argument arrays, no shell (CLI-07).
import { execFileSync } from 'node:child_process';
import { UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';
import { requireLaneTicket } from './lane-args.js';

// No leading '-', so a ref can never be read as a git option; no spaces or shell metacharacters.
const REF = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

export function reviewPackage(ctx: CommandContext, id: string, options: { base: string }): number {
  requireLaneTicket(ctx, id);
  const base = options.base;
  if (!REF.test(base)) throw new UsageError('not a git ref: ' + base);
  const git = (args: string[]) =>
    execFileSync('git', args, {
      cwd: ctx.root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
  try {
    git(['rev-parse', '--verify', '--quiet', base + '^{commit}']);
  } catch {
    throw new UsageError('unknown base ref: ' + base);
  }
  const range = base + '...HEAD';
  const parts = [
    `# Review package: ${id} (${range})`,
    '## Commits',
    git(['log', '--format=%h %s', base + '..HEAD']).trimEnd() || '(none)',
    '## Stat',
    git(['diff', '--stat', range]).trimEnd() || '(no changes)',
    '## Diff',
    git(['diff', '-U10', range]).trimEnd() || '(no changes)',
  ];
  ctx.stdout.write(parts.join('\n\n') + '\n');
  return 0;
}
