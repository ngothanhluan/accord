// Owner decision (2026-11-15), repository scripts trust: `accord trust` shows the scripts this checkout's accord/config.yml declares (`tracker.command`, `git.sync`, `build.regenerate`) and
// allows only the ones named on its command line; `accord trust --revoke` withdraws the allows. The allow is a local record inside .git, bound to the command text and to
// the files the command can reach (see load/script-trust.ts); nothing is written under accord/ and nothing is committed. A person runs this, after reading what it printed:
// an agent never runs it on its own.
//
// Round 3 WR-02 (Ruling): with no script named it only shows each script (the command, what an allow covers, the files that changed since the last allow) and writes
// nothing; `accord trust git.sync` allows git.sync alone and prints the same block for what it allowed. No prompt, so it is safe where nothing can answer one (CI, an agent
// shell): a changed tracker script is never allowed by a person who ran `accord trust git.sync` after reading the sync diff.
import { allowScripts, coverText, inspect, listed, NOT_CHECKED, recordWarning, revokeScripts, SCRIPT_KINDS, shortDigest, shown } from '../load/script-trust.js';
import type { Inspection, ScriptKind } from '../load/script-trust.js';
import { UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';

/**
 * The scripts this checkout declares: `tracker.command` only under `tracker.adapter: script` (the one adapter that runs it), `git.sync`, and `build.regenerate`
 * (ST-LN-92 review round 1 finding 7: the build stage runs it only when accord worktree task merge prints it, which it does once it is allowed here).
 */
export function declared(ctx: CommandContext): Array<{ kind: ScriptKind; command: string }> {
  const config = ctx.snapshot.config;
  const found: Array<{ kind: ScriptKind; command: string }> = [];
  if (config?.tracker?.adapter === 'script' && config.tracker.command !== undefined) found.push({ kind: 'tracker.command', command: config.tracker.command });
  if (config?.git?.sync !== undefined) found.push({ kind: 'git.sync', command: config.git.sync });
  if (config?.build?.regenerate !== undefined) found.push({ kind: 'build.regenerate', command: config.build.regenerate });
  if (config?.commits?.message?.command !== undefined) found.push({ kind: 'commits.message.command', command: config.commits.message.command });
  if (config?.pr?.command !== undefined) found.push({ kind: 'pr.command', command: config.pr.command });
  return found;
}

/** The script kinds as one phrase for a message, so a kind added to SCRIPT_KINDS is named without editing the text. */
const kindList = (last: string): string => `${SCRIPT_KINDS.slice(0, -1).join(', ')}${last}${SCRIPT_KINDS[SCRIPT_KINDS.length - 1]}`;

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
  // round 4 (documented gaps): a form the command uses that accord does not follow is named, so the cover does not read as complete
  const unfollowed = i.unfollowed.length > 0 ? `  not followed: ${i.unfollowed.join(', ')} - the files ${i.unfollowed.length === 1 ? 'it runs are' : 'they run are'} not checked\n` : '';
  return `  covers: ${coverText(i)}\n${unfollowed}${files}${changed}`;
}

/**
 * Names on the command line as script kinds, each with the digest the person copied from the preview (`git.sync@1a2b3c4d5e6f7a8b`); a name that is no kind, or
 * a digest that is not hex, is a usage error.
 */
function namesOf(names: readonly string[]): Array<{ kind: ScriptKind; digest?: string }> {
  const out: Array<{ kind: ScriptKind; digest?: string }> = [];
  for (const n of names) {
    const at = n.indexOf('@');
    const kind = at === -1 ? n : n.slice(0, at);
    if (!(SCRIPT_KINDS as readonly string[]).includes(kind)) throw new UsageError(`accord trust takes ${kindList(' or ')}, not "${shown(kind)}" - nothing was changed`);
    const digest = at === -1 ? undefined : n.slice(at + 1).replace(/^sha256:/i, '').toLowerCase();
    if (digest !== undefined && !/^[0-9a-f]{16,64}$/.test(digest)) throw new UsageError(`"${shown(n)}" carries no digest accord trust shows (16 hex characters) - nothing was changed`);
    if (!out.some((o) => o.kind === kind)) out.push({ kind: kind as ScriptKind, ...(digest === undefined ? {} : { digest }) });
  }
  return out;
}

export function trust(ctx: CommandContext, names: readonly string[], options: { revoke?: boolean }): number {
  const named = namesOf(names);
  const kinds = named.map((n) => n.kind);
  const warning = recordWarning(ctx.root);
  if (warning !== undefined) ctx.stderr.write(warning + '\n');
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
    ctx.stdout.write(`accord/config.yml declares no repository script (${SCRIPT_KINDS.map((k) => k + (k === 'tracker.command' ? ' under tracker.adapter: script' : '')).join(', ')}) - nothing to allow\n`);
    return 0;
  }
  if (kinds.length === 0) {
    const seen = scripts.map((s) => inspect(ctx.root, s.kind, s.command));
    for (const i of seen) ctx.stdout.write(`${i.kind} "${shown(i.command)}" - ${STATE[i.state]} (digest ${shortDigest(i.digest)})\n${details(i)}`);
    ctx.stdout.write(NOT_CHECKED + '\n');
    const open = seen.filter((i) => i.state !== 'allowed');
    ctx.stdout.write(
      open.length === 0
        ? 'every declared script is allowed here - nothing to do\n'
        : `nothing was allowed; read the files above, then run accord trust ${open.map((i) => `${i.kind}@${shortDigest(i.digest)}`).join(' ')} to allow ${open.length === 1 ? 'it' : 'them'} here (in ${shown(ctx.root.replaceAll('\\', '/'))}), with the digest exactly as shown, so the allow binds only what you read\n`,
    );
    return 0;
  }
  // round 4 WR-04 (Ruling R11): an allow names the digest the preview showed, and binds only that content
  const bare = named.filter((n) => n.digest === undefined).map((n) => n.kind);
  if (bare.length > 0) {
    throw new UsageError(
      `accord trust allows only what it showed you: run accord trust here to see ${bare.join(' and ')} with the digest of what ${bare.length === 1 ? 'it covers' : 'they cover'}, then ${bare.map((k) => `accord trust ${k}@<digest>`).join(' ')} with the digest it shows - nothing was allowed`,
    );
  }
  const wanted = scripts.filter((s) => kinds.includes(s.kind)).map((s) => ({ ...s, digest: named.find((n) => n.kind === s.kind)?.digest }));
  for (const i of allowScripts(ctx.root, wanted)) {
    ctx.stdout.write(`allowed: ${i.kind} "${shown(i.command)}" (digest ${shortDigest(i.digest)})\n${details(i)}`);
  }
  ctx.stdout.write(NOT_CHECKED + '\n');
  ctx.stdout.write('the allow is local to this repository (inside .git); it holds until the command or those files change, and accord trust --revoke withdraws it\n');
  return 0;
}
