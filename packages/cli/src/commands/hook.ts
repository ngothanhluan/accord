// Spec §17 `accord hook <event>`: the text Claude Code's SessionStart and SubagentStart hooks inject.
// Nothing here fails a session over the anchor: a git problem is one stderr line and the session line.
import { anchorText, rulesetText, sessionLine, statusRows } from '@accord-dev/accord-core';
import pkg from '../../package.json' with { type: 'json' };
import type { CommandContext } from '../run.js';
import { activeTicket } from './anchor.js';

export const HOOK_EVENTS = ['session-start', 'session-resume', 'subagent-start'] as const;
export type HookEvent = (typeof HOOK_EVENTS)[number];

export function hook(ctx: CommandContext, event: HookEvent): number {
  const rules = rulesetText(`npx --yes ${pkg.name}@${pkg.version}`);
  if (event === 'subagent-start') {
    const out = { hookSpecificOutput: { hookEventName: 'SubagentStart', additionalContext: rules } };
    ctx.stdout.write(JSON.stringify(out) + '\n');
    return 0;
  }
  const line = sessionLine(statusRows(ctx.snapshot));
  let body = line + '\n';
  if (event === 'session-resume') {
    try {
      const id = activeTicket(ctx.root, ctx.snapshot);
      body = (id === undefined ? undefined : anchorText(ctx.snapshot, id)) ?? body;
    } catch (e) {
      ctx.stderr.write((e as Error).message + '\n');
    }
  }
  ctx.stdout.write(rules + '\n' + body);
  return 0;
}
