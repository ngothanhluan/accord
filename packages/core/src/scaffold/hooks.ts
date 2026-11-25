// The hooks accord adds to a Claude Code settings file. Every hook is exec form: `command` is `node` and `args` are the launcher, the
// version and `hook <event>`. Claude Code (2.1.139 or newer) runs it with no shell and substitutes ${CLAUDE_PROJECT_DIR} into each
// argument, so a project path with a space needs no quoting and the entry means the same under bash and PowerShell.
export type HookEntries = Record<
  'SessionStart' | 'SubagentStart' | 'UserPromptExpansion' | 'PreToolUse',
  { matcher: string; hooks: { type: 'command'; command: string; args?: string[]; timeout?: number; if?: string }[] }[]
>;

// The launcher path, spelled as Claude Code substitutes it (plugin.ts LAUNCHER_PATH is the same file, relative to the project root).
const LAUNCHER = '${CLAUDE_PROJECT_DIR}/.claude/accord.mjs';

const cmd = (pkg: { version: string }, event: string): { type: 'command'; command: string; args: string[] } => ({
  type: 'command',
  command: 'node',
  args: [LAUNCHER, pkg.version, 'hook', event],
});

// ST-LN-55 D-11: a session start runs the worktree clean in the foreground. `timeout` is in seconds and is longer than the
// clean's own budget (Task 8, 300 s), so the hook is never cut short in the middle of a removal.
export const hookEntries = (pkg: { name: string; version: string }): HookEntries => ({
  SessionStart: [
    { matcher: 'startup', hooks: [{ ...cmd(pkg, 'session-start'), timeout: 600 }] },
    { matcher: 'resume|clear|compact', hooks: [{ ...cmd(pkg, 'session-resume'), timeout: 600 }] },
  ],
  SubagentStart: [{ matcher: 'accord-.*', hooks: [cmd(pkg, 'subagent-start')] }],
  UserPromptExpansion: [{ matcher: 'accord', hooks: [cmd(pkg, 'prompt-expansion')] }],
  PreToolUse: [
    { matcher: 'Agent|Task', hooks: [cmd(pkg, 'pre-tool-use')] },
    // ST-LN-39 D-08: the verification record's write guard. Plan 05-10's probe saw the `if` field honoured, so each tool's hook spawns
    // only for a path under accord/tickets/<id>/; the handler matches the path again and decides from stdin alone.
    {
      matcher: 'Write|Edit|MultiEdit',
      hooks: (['Write', 'Edit', 'MultiEdit'] as const).map((tool) => ({
        ...cmd(pkg, 'pre-tool-use'),
        if: tool + '(**/accord/tickets/*/verification.md)',
      })),
    },
  ],
});

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const EVENTS = '(session-start|session-resume|subagent-start|prompt-expansion|pre-tool-use)';
const OLD_FORM = new RegExp('^npx --yes \\S+ hook ' + EVENTS + '$');
const LAUNCHER_FORM = new RegExp('^node \\$\\{CLAUDE_PROJECT_DIR\\}/\\.claude/accord\\.mjs \\S+ hook ' + EVENTS + '$');

/**
 * D-01: the words of a hook as one line: `command`, then each `args` word, a word that holds whitespace in double quotes so
 * `runsAccordHook` reads it back as one word. A hook with no `args` is shell form, whose `command` is already the whole line.
 */
export function hookText(h: { command: string; args?: string[] }): string {
  if (h.args === undefined) return h.command;
  return [h.command, ...h.args].map((w) => (/\s/.test(w) ? '"' + w + '"' : w)).join(' ');
}

/** The text of a settings hook object, or undefined when it is not a command hook (no string `command`, or `args` that is not a list of strings). */
function textOf(h: unknown): string | undefined {
  if (!isObject(h) || typeof h.command !== 'string') return undefined;
  if (h.args === undefined) return h.command;
  if (!Array.isArray(h.args) || !h.args.every((a) => typeof a === 'string')) return undefined;
  return hookText({ command: h.command, args: h.args as string[] });
}

/** The two shapes sync has written: the old npx command line and the launcher form of `hookEntries`, nothing else. */
export const isAccordHookCommand = (c: string): boolean => OLD_FORM.test(c) || LAUNCHER_FORM.test(c);

/** The last path component, split on either slash (core never reads a file, so no node:path). */
const basename = (w: string): string => w.slice(Math.max(w.lastIndexOf('/'), w.lastIndexOf('\\')) + 1);

const SUBCOMMANDS = ['session-start', 'session-resume', 'subagent-start', 'prompt-expansion', 'pre-tool-use'] as const;

/**
 * Phase 08.8 D-10: the words of a command line as a shell reads them. Whitespace outside quotes separates words; a run in
 * double or single quotes is part of one word with its quotes removed, so `"C:\Users\A B\cli.js"` is one word; an unclosed
 * quote takes the rest of the text. No escape, variable or glob is read: this only finds word boundaries.
 */
function commandTokens(c: string): string[] {
  const tokens: string[] = [];
  let word = '';
  let inWord = false;
  let quote = '';
  for (const ch of c) {
    if (quote !== '') {
      if (ch === quote) quote = '';
      else word += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      inWord = true;
    } else if (/\s/.test(ch)) {
      if (inWord) tokens.push(word);
      word = '';
      inWord = false;
    } else {
      word += ch;
      inWord = true;
    }
  }
  if (inWord) tokens.push(word);
  return tokens;
}

/**
 * D-16: the subcommand when `c` runs `accord hook <subcommand>` in any form an owner may have edited it into: `accord`
 * itself, an npx package spec whose name is `accord` or ends with `/accord` (with or without `@<version>`), a path
 * ending `cli.js`, or the launcher `accord.mjs` (D-01: one or two words before `hook`, the launcher then optionally the
 * version), followed by `hook` and one of the five subcommands, then any arguments. `undefined` for anything else.
 * Phase 08.8 D-10: the program may be quoted and may hold a space (`node "C:\Users\A B\cli.js" hook session-start`).
 */
export function runsAccordHook(c: string): string | undefined {
  const tokens = commandTokens(c);
  for (let i = 1; i + 1 < tokens.length; i++) {
    if (tokens[i] !== 'hook') continue;
    const sub = SUBCOMMANDS.find((s) => s === tokens[i + 1]);
    if (sub === undefined) continue;
    const program = tokens[i - 1] ?? '';
    const base = basename(program);
    const name = base.replace(/@[^@]*$/, '').replace(/\.(cmd|exe|ps1)$/, '');
    const launcher = [tokens[i - 1], i >= 2 ? tokens[i - 2] : undefined].some((w) => w !== undefined && basename(w) === 'accord.mjs');
    if (name === 'accord' || base === 'cli.js' || launcher) return sub;
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
        const text = textOf(h);
        if (!isObject(h) || text === undefined) return true;
        if (isAccordHookCommand(text)) return false;
        const sub = runsAccordHook(text);
        if (sub !== undefined) {
          edited.add(sub + '|' + (typeof h.if === 'string' ? h.if : ''));
          notes.push(`kept ${event} hook "${text}": it runs accord hook ${sub} in a form sync did not write, so sync left it; edit or remove it to get accord's`);
        }
        return true;
      });
      if (rest.length > 0) kept.push(rest.length === entry.hooks.length ? entry : { ...entry, hooks: rest });
    }
    const wanted: HookEntries[keyof HookEntries] = [];
    for (const entry of added) {
      const own = entry.hooks.filter((h) => !edited.has((runsAccordHook(hookText(h)) ?? '') + '|' + (h.if ?? '')));
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
