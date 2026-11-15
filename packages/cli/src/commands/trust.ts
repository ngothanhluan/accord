// Owner decision (2026-11-15), repository scripts trust: `accord trust` allows the scripts this checkout's accord/config.yml declares (`tracker.command`, `git.sync`), and
// `accord trust --revoke` withdraws every allow of the repository. The allow is a local record inside .git, bound to the command text and to the files the command
// can reach (see load/script-trust.ts); nothing is written under accord/ and nothing is committed. A person runs this, after reading what it printed: an agent never
// runs it on its own.
import { allowScripts, coverText, revokeScripts, shown } from '../load/script-trust.js';
import type { ScriptKind } from '../load/script-trust.js';
import type { CommandContext } from '../run.js';

/** The scripts this checkout declares: `tracker.command` only under `tracker.adapter: script` (the one adapter that runs it), and `git.sync`. */
function declared(ctx: CommandContext): Array<{ kind: ScriptKind; command: string }> {
  const config = ctx.snapshot.config;
  const found: Array<{ kind: ScriptKind; command: string }> = [];
  if (config?.tracker?.adapter === 'script' && config.tracker.command !== undefined) found.push({ kind: 'tracker.command', command: config.tracker.command });
  if (config?.git?.sync !== undefined) found.push({ kind: 'git.sync', command: config.git.sync });
  return found;
}

export function trust(ctx: CommandContext, options: { revoke?: boolean }): number {
  if (options.revoke === true) {
    const kinds = revokeScripts(ctx.root);
    ctx.stdout.write(kinds.length === 0 ? 'nothing was allowed in this repository - nothing to revoke\n' : `revoked: ${kinds.join(', ')}\n`);
    return 0;
  }
  const scripts = declared(ctx);
  if (scripts.length === 0) {
    ctx.stdout.write('accord/config.yml declares no repository script (tracker.command under tracker.adapter: script, or git.sync) - nothing to allow\n');
    return 0;
  }
  for (const b of allowScripts(ctx.root, scripts)) {
    ctx.stdout.write(`allowed: ${b.kind} "${shown(b.command)}" (${b.digest.slice(0, 19)})\n  covers: ${coverText(b)}\n`);
  }
  ctx.stdout.write('the allow is local to this repository (inside .git); it holds until the command or those files change, and accord trust --revoke withdraws it\n');
  return 0;
}
