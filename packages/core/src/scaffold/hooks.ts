// The hooks accord adds to a Claude Code settings file. Every command is `npx --yes <pkg>@<version> hook <event>`:
// no quoting, pipe, redirect, or variable, so the same string runs under bash and PowerShell.
export type HookEntries = Record<
  'SessionStart' | 'SubagentStart',
  { matcher: string; hooks: { type: 'command'; command: string }[] }[]
>;

const cmd = (pkg: { name: string; version: string }, event: string): string =>
  `npx --yes ${pkg.name}@${pkg.version} hook ${event}`;

export const hookEntries = (pkg: { name: string; version: string }): HookEntries => ({
  SessionStart: [
    { matcher: 'startup', hooks: [{ type: 'command', command: cmd(pkg, 'session-start') }] },
    { matcher: 'resume|clear|compact', hooks: [{ type: 'command', command: cmd(pkg, 'session-resume') }] },
  ],
  SubagentStart: [{ matcher: 'accord-.*', hooks: [{ type: 'command', command: cmd(pkg, 'subagent-start') }] }],
});

export const isAccordHookCommand = (c: string): boolean =>
  /^npx --yes \S+ hook (session-start|session-resume|subagent-start)$/.test(c);

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Settings with accord's hooks replaced by `entries`. Everything the owner wrote survives: other keys, other
 * events, and every hook command that is not an accord one. Idempotent, and key order is preserved.
 */
export function mergeHooks(existing: unknown, entries: HookEntries): Record<string, unknown> {
  if (!isObject(existing)) throw new TypeError('settings is not a JSON object');
  if (existing.hooks !== undefined && !isObject(existing.hooks)) throw new TypeError('settings is not a JSON object');
  const hooks: Record<string, unknown> = { ...(existing.hooks as Record<string, unknown> | undefined) };
  for (const [event, added] of Object.entries(entries)) {
    const current = hooks[event];
    const kept: unknown[] = [];
    for (const entry of Array.isArray(current) ? current : []) {
      if (!isObject(entry) || !Array.isArray(entry.hooks)) {
        kept.push(entry); // not a shape accord wrote; leave it be
        continue;
      }
      const rest = entry.hooks.filter((h) => !(isObject(h) && typeof h.command === 'string' && isAccordHookCommand(h.command)));
      if (rest.length > 0) kept.push(rest.length === entry.hooks.length ? entry : { ...entry, hooks: rest });
    }
    hooks[event] = [...kept, ...added];
  }
  return { ...existing, hooks };
}
