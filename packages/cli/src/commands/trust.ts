// Owner decision (2026-11-15), repository scripts trust: `accord trust` shows the scripts this checkout's accord/config.yml declares (`tracker.command`, `git.sync`) and
// allows only the ones named on its command line; `accord trust --revoke` withdraws the allows. The allow is a local record inside .git, bound to the command text and to
// the files the command can reach (see load/script-trust.ts); nothing is written under accord/ and nothing is committed. A person runs this, after reading what it printed:
// an agent never runs it on its own.
//
// Round 3 WR-02 (Ruling): with no script named it only shows each script (the command, what an allow covers, the files that changed since the last allow) and writes
// nothing; `accord trust git.sync` allows git.sync alone and prints the same block for what it allowed. No prompt, so it is safe where nothing can answer one (CI, an agent
// shell): a changed tracker script is never allowed by a person who ran `accord trust git.sync` after reading the sync diff.
import { allowScripts, coverText, inspect, listed, revokeScripts, SCRIPT_KINDS, shown } from '../load/script-trust.js';
import type { Inspection, ScriptKind } from '../load/script-trust.js';
import { UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';

/** The scripts this checkout declares: `tracker.command` only under `tracker.adapter: script` (the one adapter that runs it), and `git.sync`. */
function declared(ctx: CommandContext): Array<{ kind: ScriptKind; command: string }> {
  const config = ctx.snapshot.config;
  const found: Array<{ kind: ScriptKind; command: string }> = [];
  if (config?.tracker?.adapter === 'script' && config.tracker.command !== undefined) found.push({ kind: 'tracker.command', command: config.tracker.command });
  if (config?.git?.sync !== undefined) found.push({ kind: 'git.sync', command: config.git.sync });
  return found;
}

const STATE: Record<Inspection['state'], string> = {
  allowed: 'allowed here',
  never: 'not allowed here yet',
  changed: 'changed since it was allowed',
  'other-command': 'not the command that was allowed',
};

/** The lines under a script's head line: what an allow covers, the files themselves when they are few, and the ones that changed since the last allow. */
function details(i: Inspection): string {
  const files = i.files.length > 0 && i.files.length <= 20 ? `  files: ${listed(i.files, 20)}\n` : '';
  const changed = i.changed.length > 0 ? `  changed since it was allowed: ${listed(i.changed, 50)}\n` : '';
  return `  covers: ${coverText(i)}\n${files}${changed}`;
}

/** Names on the command line as script kinds; a name that is no kind is a usage error. */
function kindsOf(names: readonly string[]): ScriptKind[] {
  for (const n of names) {
    if (!(SCRIPT_KINDS as readonly string[]).includes(n)) throw new UsageError(`accord trust takes tracker.command or git.sync, not "${shown(n)}" - nothing was changed`);
  }
  return [...new Set(names)] as ScriptKind[];
}

export function trust(ctx: CommandContext, names: readonly string[], options: { revoke?: boolean }): number {
  const kinds = kindsOf(names);
  if (options.revoke === true) {
    const gone = revokeScripts(ctx.root, kinds);
    ctx.stdout.write(gone.length === 0 ? 'nothing was allowed in this repository - nothing to revoke\n' : `revoked: ${gone.join(', ')}\n`);
    return 0;
  }
  const scripts = declared(ctx);
  for (const k of kinds) {
    if (!scripts.some((s) => s.kind === k)) {
      throw new UsageError(`accord/config.yml declares no ${k}${k === 'tracker.command' ? ' (it counts only under tracker.adapter: script)' : ''} - nothing was allowed`);
    }
  }
  if (scripts.length === 0) {
    ctx.stdout.write('accord/config.yml declares no repository script (tracker.command under tracker.adapter: script, or git.sync) - nothing to allow\n');
    return 0;
  }
  if (kinds.length === 0) {
    const seen = scripts.map((s) => inspect(ctx.root, s.kind, s.command));
    for (const i of seen) ctx.stdout.write(`${i.kind} "${shown(i.command)}" - ${STATE[i.state]}\n${details(i)}`);
    const open = seen.filter((i) => i.state !== 'allowed').map((i) => i.kind);
    ctx.stdout.write(
      open.length === 0
        ? 'every declared script is allowed here - nothing to do\n'
        : `nothing was allowed; read the files above, then run accord trust ${open.join(' ')} to allow ${open.length === 1 ? 'it' : 'them'} here (in ${shown(ctx.root.replaceAll('\\', '/'))})\n`,
    );
    return 0;
  }
  for (const i of allowScripts(ctx.root, scripts.filter((s) => kinds.includes(s.kind)))) {
    ctx.stdout.write(`allowed: ${i.kind} "${shown(i.command)}" (${i.digest.slice(0, 19)})\n${details(i)}`);
  }
  ctx.stdout.write('the allow is local to this repository (inside .git); it holds until the command or those files change, and accord trust --revoke withdraws it\n');
  return 0;
}
