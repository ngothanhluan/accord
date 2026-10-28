// Spec §17 `accord hook <event>`: the text Claude Code's SessionStart and SubagentStart hooks inject.
// Nothing here fails a session over the anchor: a git problem is one stderr line and the session line.
import { anchorText, DEFAULT_BRANCH_TEMPLATE, rulesetText, sessionLine, statusRows } from '@accord-dev/accord-core';
import pkg from '../../package.json' with { type: 'json' };
import { currentBranch, ticketOfBranch } from '../load/fs.js';
import { claudeEnv, processTable, sessionIn } from '../load/proc.js';
import { repoRoot } from '../root.js';
import type { CommandContext } from '../run.js';
import { activeTicket } from './anchor.js';
import { branchOf, guardAllowsContinue, inClaude, isLinked, listWorktrees, readHoldsFile, recordWorked, releaseHolds, takeHold, worksMessage, worksTicket } from './worktree.js';

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
  let note = '';
  if (event === 'session-resume') {
    recordResume(ctx);
    note = releaseOnNewConversation(ctx);
    try {
      const input = hookInput(ctx);
      const root = input?.cwd !== undefined ? repoRoot(input.cwd) : ctx.root;
      const marker = input?.session_id ?? ctx.env.CLAUDE_CODE_SESSION_ID;
      const held = marker && !isLinked(root) ? heldEntry(root, marker, ctx) : undefined;
      if (held !== undefined) {
        // No anchor here: main's copy of the ticket can lag its branch; the worktree's `accord anchor` is the one to read.
        body = `this session works ${held.id}: call EnterWorktree with the path on the next line, then run accord anchor there and go on at the stage it prints\nenter: ${held.path}\n`;
      } else {
        const id = activeTicket(root, ctx.snapshot);
        body = (id === undefined ? undefined : anchorText(ctx.snapshot, id)) ?? body;
      }
    } catch (e) {
      ctx.stderr.write((e as Error).message + '\n');
    }
  }
  ctx.stdout.write(rules + '\n' + note + body);
  if (event === 'session-start') startHold(ctx);
  return 0;
}

/** The first held id (code-point order) of this marker whose worktree exists here, with that worktree's path. */
function heldEntry(root: string, marker: string, ctx: CommandContext): { id: string; path: string } | undefined {
  const holds = readHoldsFile(root);
  const id = Object.keys(holds).sort().find((k) => holds[k]?.marker === marker);
  if (id === undefined) return undefined;
  const path = listWorktrees(root).slice(1).find((w) => w.branch === branchOf(ctx.snapshot, id))?.path;
  return path === undefined ? undefined : { id, path };
}

/** The ticket whose worktree `root` is (a linked worktree on a ticket branch), else undefined. */
function ticketOfWorktree(root: string, ctx: CommandContext): string | undefined {
  if (!isLinked(root)) return undefined;
  const branch = currentBranch(root);
  return branch === undefined ? undefined : ticketOfBranch(branch, ctx.snapshot.branchTemplates ?? [DEFAULT_BRANCH_TEMPLATE], (i) => Object.hasOwn(ctx.snapshot.tickets, i));
}

/** BUG-LN-14: a /clear or a /resume to another conversation frees the holds this window's claude process took, except the resumed conversation's own and the ticket whose worktree the window stands in (D-06); returns '' or one line saying why nothing was released. */
function releaseOnNewConversation(ctx: CommandContext): string {
  try {
    const input = hookInput(ctx);
    if (input?.source !== 'clear' && input?.source !== 'resume') return '';
    const claude = claudeEnv(ctx.env);
    if (claude === undefined) return '';
    const root = input.cwd !== undefined ? repoRoot(input.cwd) : ctx.root;
    const session = sessionIn(claude, processTable(), process.pid);
    releaseHolds(root, session, input.session_id || claude.marker, ticketOfWorktree(root, ctx));
    return '';
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return `accord: no hold released: ${msg.split('\n')[0]}`.replace(/\\/g, '/') + '\n';
  }
}

/** Record that a Claude Code session works `id`; a failure is one stderr line. */
function record(ctx: CommandContext, root: string, id: string, sessionId: string | undefined): void {
  try {
    const s = inClaude(ctx.env);
    const marker = sessionId || s?.marker;
    if (s !== undefined && marker) recordWorked(root, id, marker);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    ctx.stderr.write(`accord: no record of ${id}: ${msg.split('\n')[0]}`.replace(/\\/g, '/') + '\n');
  }
}

/** A resumed session in a ticket worktree is recorded too; no hold is taken and nothing is thrown. */
function recordResume(ctx: CommandContext): void {
  try {
    const input = hookInput(ctx);
    const root = input?.cwd !== undefined ? repoRoot(input.cwd) : ctx.root;
    const id = ticketOfWorktree(root, ctx);
    if (id !== undefined) record(ctx, root, id, input?.session_id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    ctx.stderr.write(`accord: no record: ${msg.split('\n')[0]}`.replace(/\\/g, '/') + '\n');
  }
}

/** A session that starts in a ticket worktree takes a free hold; any failure is one stderr line, never a failed start. */
function startHold(ctx: CommandContext): void {
  let id: string | undefined;
  try {
    const input = hookInput(ctx);
    const root = input?.cwd !== undefined ? repoRoot(input.cwd) : ctx.root;
    id = ticketOfWorktree(root, ctx);
    if (id === undefined) return;
    record(ctx, root, id, input?.session_id);
    if (claudeEnv(ctx.env) === undefined) return;
    takeHold({ ...ctx, root }, id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    ctx.stderr.write(`accord: no hold taken${id === undefined ? '' : ' on ' + id}: ${msg.split('\n')[0]}`.replace(/\\/g, '/') + '\n');
  }
}

export function hookInput(ctx: CommandContext): { session_id?: string; command_name?: string; command_args?: string; cwd?: string; source?: string } | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(ctx.stdin ?? '');
  } catch {
    return undefined;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined;
  const out: Record<string, string> = {};
  for (const k of ['session_id', 'command_name', 'command_args', 'cwd', 'source']) {
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
    if (args === 'upgrade') return allow(); // the upgrade never touches a checkout
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
