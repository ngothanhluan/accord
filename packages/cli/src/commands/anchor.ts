// Spec §6 `accord anchor [id]`: the active ticket's intent, vetoes, decisions, corrections, and position,
// for the SessionStart hook after compaction and for the first step of every stage skill. Without an id
// the active ticket is the current branch t/<id>; on any other branch there is nothing to anchor.
import { execFileSync } from 'node:child_process';
import { anchorText } from '@accord-dev/accord-core';
import type { CommandContext } from '../run.js';
import { requireLaneTicket } from './lane-args.js';

/** The branch name; '' for a detached HEAD; undefined when git could not say. */
function currentBranch(root: string): string | undefined {
  try {
    // symbolic-ref answers on an unborn branch too, where rev-parse fails.
    return execFileSync('git', ['symbolic-ref', '--short', '-q', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (e) {
    const { status, stdout } = e as { status?: number | null; stdout?: string };
    return status === 1 && (stdout ?? '').trim() === '' ? '' : undefined;
  }
}

export function anchor(ctx: CommandContext, id: string | undefined): number {
  if (id !== undefined) {
    requireLaneTicket(ctx, id);
    ctx.stdout.write(anchorText(ctx.snapshot, id) ?? '');
    return 0;
  }
  const branch = currentBranch(ctx.root);
  // A hook must not fail a session start, but an empty anchor must not be silent: so every failure here
  // exits 0 and says why on stderr, and only a detached HEAD (nothing to anchor) says nothing.
  if (branch === undefined) {
    ctx.stderr.write('could not read the current branch; nothing to anchor\n');
    return 0;
  }
  const m = /^t\/([^/]+)$/.exec(branch);
  if (m === null) return 0;
  const text = anchorText(ctx.snapshot, m[1]);
  if (text === undefined) ctx.stderr.write(m[1] + ' is not a lane ticket in accord/tickets/; nothing to anchor\n');
  else ctx.stdout.write(text);
  return 0;
}
