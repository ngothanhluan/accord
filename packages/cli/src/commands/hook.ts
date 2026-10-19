// Spec §17 `accord hook <event>`: the text Claude Code's SessionStart and SubagentStart hooks inject.
// Nothing here fails a session over the anchor: a git problem is one stderr line and the session line.
import { anchorText, rulesetText, sessionLine, statusRows } from '@accord-dev/accord-core';
import pkg from '../../package.json' with { type: 'json' };
import type { CommandContext } from '../run.js';
import { activeTicket } from './anchor.js';
import { guardAllowsContinue, listWorktrees, worksMessage, worksTicket } from './worktree.js';

export const HOOK_EVENTS = ['session-start', 'session-resume', 'subagent-start', 'prompt-expansion'] as const;
export type HookEvent = (typeof HOOK_EVENTS)[number];

export function hook(ctx: CommandContext, event: HookEvent): number {
  if (event === 'prompt-expansion') return promptExpansion(ctx);
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

export function hookInput(ctx: CommandContext): { session_id?: string; command_name?: string; command_args?: string; cwd?: string } | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(ctx.stdin ?? '');
  } catch {
    return undefined;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined;
  const out: Record<string, string> = {};
  for (const k of ['session_id', 'command_name', 'command_args', 'cwd']) {
    const v = (parsed as Record<string, unknown>)[k];
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

/** D-05..D-07: block every typed "/accord <text>" in a session that works a ticket, except continue of that ticket. */
function promptExpansion(ctx: CommandContext): number {
  const allow = (why?: string) => {
    if (why !== undefined) ctx.stderr.write(`accord hook prompt-expansion: ${why.split('\n')[0]}; allowed`.replace(/\\/g, '/') + '\n');
    ctx.stdout.write('{}\n');
    return 0;
  };
  try {
    const i = hookInput(ctx);
    if (i?.session_id === undefined) return allow('no session_id on stdin');
    if (i.command_name !== 'accord') return allow();
    const args = (i.command_args ?? '').trim();
    if (args === '') return allow();
    const w = worksTicket(i.cwd ?? ctx.root, i.session_id, ctx.snapshot);
    if (w === undefined) return allow();
    const mainPath = listWorktrees(w.top)[0].path;
    const cont = /^continue\s+(\S+)$/.exec(args)?.[1];
    if (cont !== undefined && guardAllowsContinue(w, mainPath, cont)) return allow();
    ctx.stdout.write(JSON.stringify({ decision: 'block', reason: worksMessage(w, mainPath) }) + '\n');
    return 0;
  } catch (e) {
    return allow(e instanceof Error ? e.message : String(e));
  }
}
