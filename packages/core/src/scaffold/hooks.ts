// The hooks accord adds to a Claude Code settings file. Every command is `npx --yes <pkg>@<version> hook <event>`:
// no quoting, pipe, redirect, or variable, so the same string runs under bash and PowerShell.
export type HookEntries = Record<
  'SessionStart' | 'SubagentStart' | 'UserPromptExpansion' | 'PreToolUse',
  { matcher: string; hooks: { type: 'command'; command: string; timeout?: number; if?: string }[] }[]
>;

const cmd = (pkg: { name: string; version: string }, event: string): string =>
  `npx --yes ${pkg.name}@${pkg.version} hook ${event}`;

// ST-LN-55 D-11: a session start runs the worktree clean in the foreground. `timeout` is in seconds and is longer than the
// clean's own budget (Task 8, 300 s), so the hook is never cut short in the middle of a removal.
export const hookEntries = (pkg: { name: string; version: string }): HookEntries => ({
  SessionStart: [
    { matcher: 'startup', hooks: [{ type: 'command', command: cmd(pkg, 'session-start'), timeout: 600 }] },
    { matcher: 'resume|clear|compact', hooks: [{ type: 'command', command: cmd(pkg, 'session-resume'), timeout: 600 }] },
  ],
  SubagentStart: [{ matcher: 'accord-.*', hooks: [{ type: 'command', command: cmd(pkg, 'subagent-start') }] }],
  UserPromptExpansion: [{ matcher: 'accord|accord-new|accord-continue|accord-pickup', hooks: [{ type: 'command', command: cmd(pkg, 'prompt-expansion') }] }],
  PreToolUse: [
    { matcher: 'Agent|Task', hooks: [{ type: 'command', command: cmd(pkg, 'pre-tool-use') }] },
    // ST-LN-39 D-08: the verification record's write guard. Plan 05-10's probe saw the `if` field honoured, so each tool's hook spawns
    // only for a path under accord/tickets/<id>/; the handler matches the path again and decides from stdin alone.
    {
      matcher: 'Write|Edit|MultiEdit',
      hooks: (['Write', 'Edit', 'MultiEdit'] as const).map((tool) => ({
        type: 'command' as const,
        command: cmd(pkg, 'pre-tool-use'),
        if: tool + '(**/accord/tickets/*/verification.md)',
      })),
    },
  ],
});

export const isAccordHookCommand = (c: string): boolean =>
  /^npx --yes \S+ hook (session-start|session-resume|subagent-start|prompt-expansion|pre-tool-use)$/.test(c);

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const SUBCOMMANDS = ['session-start', 'session-resume', 'subagent-start', 'prompt-expansion', 'pre-tool-use'] as const;

/**
 * D-16: the subcommand when `c` runs `accord hook <subcommand>` in any form an owner may have edited it into: `accord`
 * itself, an npx package spec whose name is `accord` or ends with `/accord` (with or without `@<version>`), or a path
 * ending `cli.js`, followed by `hook` and one of the five subcommands, then any arguments. `undefined` for anything else.
 */
export function runsAccordHook(c: string): string | undefined {
  const tokens = c.trim().split(/\s+/);
  for (let i = 1; i + 1 < tokens.length; i++) {
    if (tokens[i] !== 'hook') continue;
    const sub = SUBCOMMANDS.find((s) => s === tokens[i + 1]);
    if (sub === undefined) continue;
    const program = (tokens[i - 1] ?? '').replace(/^(["'])(.*)\1$/, '$2');
    const base = program.slice(Math.max(program.lastIndexOf('/'), program.lastIndexOf('\\')) + 1);
    const name = base.replace(/@[^@]*$/, '').replace(/\.(cmd|exe|ps1)$/, '');
    if (name === 'accord' || base === 'cli.js') return sub;
  }
  return undefined;
}

/**
 * Settings with accord's hooks replaced by `entries`, and a note for each accord hook the owner edited. Everything the
 * owner wrote survives: other keys, other events, and every hook command that is not an accord one. A hook in the exact
 * shape sync writes is replaced. A hook in any other form of `accord hook <event>` is kept, the hook sync would add for
 * the same identity (event, subcommand, `if` or none) is not added, and one note names it, so sync never adds a duplicate.
 * Idempotent, and key order is preserved.
 */
export function mergeHooksWithNotes(existing: unknown, entries: HookEntries): { settings: Record<string, unknown>; notes: string[] } {
  if (!isObject(existing)) throw new TypeError('settings is not a JSON object');
  if (existing.hooks !== undefined && !isObject(existing.hooks)) throw new TypeError('settings is not a JSON object');
  const hooks: Record<string, unknown> = { ...(existing.hooks as Record<string, unknown> | undefined) };
  const notes: string[] = [];
  for (const [event, added] of Object.entries(entries)) {
    const current = hooks[event];
    if (current !== undefined && !Array.isArray(current)) throw new TypeError('settings is not a JSON object');
    const kept: unknown[] = [];
    const edited = new Set<string>();
    for (const entry of current ?? []) {
      if (!isObject(entry) || !Array.isArray(entry.hooks)) {
        kept.push(entry); // not a shape accord wrote; leave it be
        continue;
      }
      const rest = entry.hooks.filter((h) => {
        if (!isObject(h) || typeof h.command !== 'string') return true;
        if (isAccordHookCommand(h.command)) return false;
        const sub = runsAccordHook(h.command);
        if (sub !== undefined) {
          edited.add(sub + '|' + (typeof h.if === 'string' ? h.if : ''));
          notes.push(`kept ${event} hook "${h.command}": it runs accord hook ${sub} in a form sync did not write, so sync left it; edit or remove it to get accord's`);
        }
        return true;
      });
      if (rest.length > 0) kept.push(rest.length === entry.hooks.length ? entry : { ...entry, hooks: rest });
    }
    const wanted: HookEntries[keyof HookEntries] = [];
    for (const entry of added) {
      const own = entry.hooks.filter((h) => !edited.has((runsAccordHook(h.command) ?? '') + '|' + (h.if ?? '')));
      if (own.length > 0) wanted.push(own.length === entry.hooks.length ? entry : { ...entry, hooks: own });
    }
    hooks[event] = [...kept, ...wanted];
  }
  return { settings: { ...existing, hooks }, notes };
}

/** `mergeHooksWithNotes` without the notes, for a caller that only needs the settings. */
export function mergeHooks(existing: unknown, entries: HookEntries): Record<string, unknown> {
  return mergeHooksWithNotes(existing, entries).settings;
}
