// Spec §17 `accord hook <event>`: the text Claude Code's SessionStart and SubagentStart hooks inject.
// Nothing here fails a session over the anchor: a git problem is one stderr line and the session line.
import { readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { checkFixDispatch, DEFAULT_BRANCH_TEMPLATE, debugOpen, EPIC_ROLES, epicBlock, EXECUTOR_AGENTS, loadSnapshot, sessionLine, skillDirs, stageFile, statusRows, subagentContext, UI_EXECUTOR } from '@accord-dev/accord-core';
import type { AccordConfig } from '@accord-dev/accord-core';
import pkg from '../../package.json' with { type: 'json' };
import { currentBranch, loadFromFs, ticketOfBranch } from '../load/fs.js';
import { checkoutOf, isOff, wakeFilePath, writeWakeFile } from '../load/gitdir.js';
import { cliRuleset } from '../load/product.js';
import { claudeEnv, processTable, sessionIn } from '../load/proc.js';
import { pinMessage, versionOnDisk } from '../pin.js';
import { repoRoot } from '../root.js';
import type { CommandContext } from '../run.js';
import { DEBUG_EPISODE_DAYS, readDebugFile } from '../load/debug-folder.js';
import { debugStatePath } from './debug.js';
import { cleanBudgetMs } from './fetch-limit.js';
import { activeTicket, anchorOf, epicSnapshot } from './anchor.js';
import { withNext } from './next-action.js';
import { OFF_LINE } from './off.js';
import { branchOf, cleanQuietly, fetchOrigin, guardAllowsContinue, ID, inClaude, isLinked, listWorktrees, readHoldsFile, recordWorked, releaseHolds, sessionNext, takeHold, worksMessage, worksTicket } from './worktree.js';

export const HOOK_EVENTS = ['session-start', 'session-resume', 'subagent-start', 'prompt-expansion', 'pre-tool-use'] as const;
export type HookEvent = (typeof HOOK_EVENTS)[number];

export function hook(ctx: CommandContext, event: HookEvent): number {
  if (event === 'prompt-expansion') return promptExpansion(ctx);
  if (event === 'pre-tool-use') return preToolUse(ctx);
  // Phase 8.5 D-18: the same ruleset text the CLI-written files carry (cliRuleset), and the SubagentStart text built by core's subagentContext, so the hook and the files cannot drift; its bytes are unchanged.
  const rules = cliRuleset();
  if (event === 'subagent-start') {
    const out = { hookSpecificOutput: { hookEventName: 'SubagentStart', additionalContext: subagentContext(rules, subagentEpic(ctx)) } };
    ctx.stdout.write(JSON.stringify(out) + '\n');
    return 0;
  }
  const rows = statusRows(ctx.snapshot);
  const line = sessionLine(rows);
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
        const id = activeTicket(root, ctx.snapshot, branchFor(root, ctx));
        const anchored = id === undefined ? undefined : anchorOf(ctx, id, NO_SEARCH);
        body = anchored === undefined ? body : anchored + stageLine(rows.find((r) => r.id === id), root, ctx.snapshot.config);
        if (id === undefined) body += unfinishedLine(root);
      }
    } catch (e) {
      ctx.stderr.write((e as Error).message + '\n');
    }
  }
  ctx.stdout.write(rules + '\n' + note + body);
  // Phase 08.9.2 D-04: a session start (not a resume) tells the person how to switch accord off for themselves; the rules stay first, the fetch and the clean stay in the foreground (D-07)
  if (event === 'session-start') ctx.stdout.write(OFF_LINE + '\n');
  if (event === 'session-start') startHold(ctx);
  sessionClean(ctx, event);
  return 0;
}

/** T-08.9.3-06: a hook never searches the parent folder for another repository's clone and never writes the stored paths (Decision 9). */
const NO_SEARCH = { scan: false, store: false };

/**
 * Phase 8.3 D-04: after the anchor of an active lane ticket, the one line that names the file of the /accord skill for the ticket's lane and stage, so a session cleared or compacted
 * reads it without recalling the stage. The name comes from core's fixed map (`stageFile`), never from repository text.
 * Phase 08.8 D-15: the line names the file's real path, `<repository root>/<Claude Code's skill directory>/accord/<file>`, forward slashes, and says it sits next to the /accord skill's
 * SKILL.md; the live check printed `./<file>` and the session searched `~/.claude` for it twice. The directory is the one core's targets give for Claude Code (`skillDirs` of a
 * claude-only roster), `.claude/skills` when the repository's config is not readable; the root is the git top-level the hook already resolved.
 * '' for a ticket with no lane and for a lane M stage the map has no entry for yet.
 */
function stageLine(row: { lane?: string; stage?: string } | undefined, root: string, config: AccordConfig | undefined): string {
  const file = stageFile(row?.lane, row?.stage);
  if (file === undefined) return '';
  const dir = (config === undefined ? undefined : skillDirs({ ...config, runtimes: ['claude'] })[0]) ?? '.claude/skills';
  return `stage file: ${root}/${dir}/accord/${file}, next to the /accord skill's SKILL.md; read it and go on at the step the anchor names\n`;
}

/**
 * Phase 8.3 D-06 (Ruling 10): in a checkout with no active ticket, the one line that names an open outside-ticket investigation, so a session cleared in the middle of one
 * finds its state file. Read-only: the path comes from `debugStatePath`, the file is read through `readDebugFile` (Phase 08.8 D-14: the folder is checked first, with the check
 * `accord debug path` makes; a refused folder, a link or a non-file reads as absent) and judged by core's `debugOpen`; nothing is created and the file's text is never printed
 * (it is data). '' when there is no file, no open episode, or any error (a git failure included).
 */
function unfinishedLine(root: string): string {
  try {
    const file = debugStatePath(root);
    const read = readDebugFile(file);
    // D-14 IN-05: a file untouched for more than DEBUG_EPISODE_DAYS days is an investigation nobody is coming back to; `accord debug path` still reports it and /accord-debug resumes it
    if (read === undefined || Date.now() - read.mtimeMs > DEBUG_EPISODE_DAYS * 86_400_000) return '';
    return debugOpen(read.text) ? `Unfinished: ${file}: resume the debugger with /accord-debug\n` : '';
  } catch {
    return '';
  }
}

/**
 * ST-LN-28 D-13: for a scout, planner, critic, reviewer, final reviewer or judge (EPIC_ROLES, never the foreign reviewer, which has no ticket) dispatched in a story's worktree (`agent_type` and `cwd` on stdin), a blank line and the epic block of the story's
 * `parent:`, built by the CLI from the default branch's copy of the epic and added after the ruleset (core's `subagentContext` joins them); the agent is never told to go and read the epic. undefined for any other
 * agent, for a ticket without `parent:`, for a folder on no ticket branch and for input this hook cannot read. Fails open: any error is one stderr line and the ruleset alone.
 */
function subagentEpic(ctx: CommandContext): string | undefined {
  try {
    const input = hookInput(ctx);
    if (input?.agent_type === undefined || !EPIC_ROLES.includes(input.agent_type)) return undefined;
    const root = input.cwd !== undefined ? repoRoot(input.cwd) : ctx.root;
    const c: CommandContext = { ...ctx, root };
    if (root !== ctx.root) {
      // another checkout than the one the launch loaded: its own tickets and branch decide
      c.snapshot = loadSnapshot(loadFromFs(root));
      delete c.branch;
      delete c.plain;
      delete c.light;
      delete c.ids; // Phase 08.9.2: the narrow load's listing is of the first checkout, and this reload is whole
    }
    const id = activeTicket(root, c.snapshot, branchFor(root, ctx));
    return id === undefined ? undefined : epicBlock(epicSnapshot(c, id), id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    ctx.stderr.write(`accord hook subagent-start: ${msg.split('\n')[0]}; the ruleset alone`.replace(/\\/g, '/') + '\n');
    return undefined;
  }
}

/**
 * ST-LN-55 D-11: a session start, resume or clear runs the worktree clean in the foreground, after the rules and the anchor,
 * and prints what it did for the session to tell the owner. Compaction is not a session start. Nothing here fails a session:
 * a failure is one line, and the hook still exits 0.
 */
function sessionClean(ctx: CommandContext, event: 'session-start' | 'session-resume'): void {
  const input = hookInput(ctx);
  if (event === 'session-resume' && input?.source !== 'resume' && input?.source !== 'clear') return;
  // Every write is kept: a PassThrough read once returns only its buffer, and output past 64 KiB would be lost.
  let text = '';
  const out = {
    write(chunk: string | Uint8Array): boolean {
      text += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
      return true;
    },
  } as unknown as NodeJS.WritableStream;
  try {
    const root = input?.cwd !== undefined ? repoRoot(input.cwd) : ctx.root;
    const c: CommandContext = { ...ctx, root, stdout: out };
    if (root !== ctx.root) {
      // another repository than the one the launch loaded: its own config and tickets judge it, whether or not the fetch succeeds; a failed load removes nothing
      c.snapshot = loadSnapshot(loadFromFs(root));
      delete c.branch;
      delete c.plain;
      delete c.light;
    }
    // D-94: the pin check every repository-reading command makes (run.ts preflight) holds for another repository too; a mismatch removes nothing
    const pinned = root === ctx.root || c.snapshot.config === undefined ? undefined : pinMessage(c.snapshot.config.accord, pkg.version, versionOnDisk());
    if (pinned !== undefined) {
      out.write(withNext('clean-skipped', `clean skipped: ${pinned.split('\n')[0]}`).replace(/\\/g, '/') + '\n');
    } else {
      // fix 5: the budget starts before the fetch
      const until = Date.now() + cleanBudgetMs();
      const f = fetchOrigin(c);
      // a clone with no origin has nothing to judge done against
      if (f.fetched !== 'none') cleanQuietly(f.ctx, f.fetched, undefined, { hook: true, until });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    out.write(withNext('clean-failed', `clean failed, nothing more was removed: ${msg.split('\n')[0]}`).replace(/\\/g, '/') + '\n');
  }
  if (text !== '') ctx.stdout.write(text + 'tell the owner the lines above\n');
}

/** Phase 08.9.2 Ruling-off-accord: the sentence a woken session of a switched-off person carries, so the model offers `accord on` and runs it only on their yes; the marker is never removed by the wake. */
const OFF_NOTE = 'accord is switched off for you in this clone; offer node .claude/accord.mjs on and run it only on their yes';

/**
 * Phase 08.9.2 L-02, Ruling-wake-session, Ruling-off-accord: a typed `/accord` in a quiet (or switched-off) session that is not woken yet. The answer is the UserPromptExpansion
 * `additionalContext`: the ruleset, a blank line, the anchor of the active ticket and its stage line (else the session line), the off note when accord is off for the person, and
 * what the worktree clean did, run once in the foreground by the unchanged `sessionClean` and collected instead of printed. The wake file `<common git dir>/accord-wake/<session_id>` is written
 * after the text is built, so a failure before it leaves the session to try again; every later hook of the session sees the file and takes the full path. A waking prompt never gets
 * a Continue or Pick up block (the guard of `promptExpansion` is not run: a session not yet woken works no ticket). Fails open: any error is one stderr line and `{}`.
 */
export function wake(ctx: CommandContext): number {
  const allow = (why: string) => {
    ctx.stderr.write(`accord hook prompt-expansion: ${why.split('\n')[0]}; allowed`.replace(/\\/g, '/') + '\n');
    ctx.stdout.write('{}\n');
    return 0;
  };
  try {
    const input = hookInput(ctx);
    const where = input?.cwd ?? ctx.root;
    const root = repoRoot(where);
    // the same checkout the launcher and hookEarly look in: the nearest folder holding a .git
    const checkout = checkoutOf(where);
    const file = checkout === undefined ? undefined : wakeFilePath(checkout, input?.session_id);
    if (file === undefined) return allow('no plain session_id to wake');
    let text = cliRuleset().trimEnd() + '\n\n';
    const rows = statusRows(ctx.snapshot);
    let body = sessionLine(rows) + '\n';
    try {
      const id = activeTicket(root, ctx.snapshot, branchFor(root, ctx));
      const anchored = id === undefined ? undefined : anchorOf(ctx, id, NO_SEARCH);
      if (anchored !== undefined) body = anchored + stageLine(rows.find((r) => r.id === id), root, ctx.snapshot.config);
    } catch (e) {
      // the session line stands in for an anchor that cannot be read
      ctx.stderr.write(`accord: no anchor: ${(e as Error).message.split('\n')[0]}`.replace(/\\/g, '/') + '\n');
    }
    text += body;
    if (isOff(where)) text += OFF_NOTE + '\n';
    let report = '';
    const collect = {
      write(chunk: string | Uint8Array): boolean {
        report += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
        return true;
      },
    } as unknown as NodeJS.WritableStream;
    sessionClean({ ...ctx, stdout: collect }, 'session-start');
    text += report;
    writeWakeFile(file, true);
    ctx.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptExpansion', additionalContext: text } }) + '\n');
    return 0;
  } catch (e) {
    return allow(e instanceof Error ? e.message : String(e));
  }
}

/** The first held id (code-point order) of this marker whose worktree exists here, with that worktree's path. */
function heldEntry(root: string, marker: string, ctx: CommandContext): { id: string; path: string } | undefined {
  const holds = readHoldsFile(root);
  const id = Object.keys(holds).sort().find((k) => holds[k]?.marker === marker);
  if (id === undefined) return undefined;
  const path = listWorktrees(root).slice(1).find((w) => w.branch === branchOf(ctx.snapshot, id))?.path;
  return path === undefined ? undefined : { id, path };
}

/** ST-LN-63: the branch the load read, when `root` is the checkout the load read it in; a hook run for another folder reads its own. */
function branchFor(root: string, ctx: CommandContext): { name: string | undefined } | undefined {
  return root === ctx.root ? ctx.branch : undefined;
}

/** The ticket whose worktree `root` is (a linked worktree on a ticket branch), else undefined. */
function ticketOfWorktree(root: string, ctx: CommandContext): string | undefined {
  if (!isLinked(root)) return undefined;
  const branch = (branchFor(root, ctx) ?? { name: currentBranch(root) }).name;
  return branch === undefined ? undefined : ticketOfBranch(branch, ctx.snapshot.branchTemplates ?? [DEFAULT_BRANCH_TEMPLATE], (i) => Object.hasOwn(ctx.snapshot.tickets, i), ctx.snapshot.config);
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
    takeHold({ ...ctx, root }, id, root);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    ctx.stderr.write(`accord: no hold taken${id === undefined ? '' : ' on ' + id}: ${msg.split('\n')[0]}`.replace(/\\/g, '/') + '\n');
  }
}

export function hookInput(ctx: { stdin?: string }): { session_id?: string; command_name?: string; command_args?: string; cwd?: string; source?: string; agent_type?: string } | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(ctx.stdin ?? '');
  } catch {
    return undefined;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined;
  const out: Record<string, string> = {};
  for (const k of ['session_id', 'command_name', 'command_args', 'cwd', 'source', 'agent_type']) {
    const v = (parsed as Record<string, unknown>)[k];
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

// The two typed forms that name another ticket (the only prompt-expansion cases that read the repository).
const CONTINUE_FORM = /^continue\s+(\S+)$/;
const PICK_UP_FORM = /^pick-up\s+(\S+)$/;

/**
 * Phase 08.9.2 Ruling-structural: the stdin-only part of `promptExpansion`, run before any load. No session_id, any command but accord, and any text but
 * `continue <id>` or `pick-up <id>` print `{}` (the first with its stderr line, as `promptExpansion` does) and return 0; the two typed forms return
 * undefined, so the caller loads the repository and `promptExpansion` judges them.
 */
export function promptExpansionStdin(io: { stdin?: string; stdout: NodeJS.WritableStream; stderr: NodeJS.WritableStream }): number | undefined {
  const allow = (why?: string) => {
    if (why !== undefined) io.stderr.write(`accord hook prompt-expansion: ${why.split('\n')[0]}; allowed`.replace(/\\/g, '/') + '\n');
    io.stdout.write('{}\n');
    return 0;
  };
  const i = hookInput(io);
  if (i?.session_id === undefined) return allow('no session_id on stdin');
  if (i.command_name !== 'accord') return allow();
  const args = (i.command_args ?? '').trim();
  return CONTINUE_FORM.test(args) || PICK_UP_FORM.test(args) ? undefined : allow();
}

/**
 * ST-LN-83 D-06, 08.3 D-02, D-03: the one command this hook sees is accord (the UserPromptExpansion matcher). In a session that works
 * a ticket it blocks only what would touch another ticket: a typed Continue of any ticket but this one ("/accord continue <id>") and a typed
 * Pick up of any ticket ("/accord pick-up <id>"). The dashboard and any other "/accord <text>", "/accord queue <idea>" included, go through: the skill routes the text (a question
 * is answered there) and the CLI guard behind this hook (`accord worktree check`, `accord new ticket`) refuses a change and names "/accord <request>" as the line to type in the
 * main checkout, because a hook sees the typed command and not the intent, and accord never calls a model. Any other command name (a stale 0.10.0 matcher in a team's
 * settings can still send one) has no branch here and is allowed. A block reason is the CLI guard's own text and ends with the line that opens the right session; this hook never
 * switches a session to another ticket (D-07). Any error of its own allows, with one stderr line.
 */
function promptExpansion(ctx: CommandContext): number {
  const allow = (why?: string) => {
    if (why !== undefined) ctx.stderr.write(`accord hook prompt-expansion: ${why.split('\n')[0]}; allowed`.replace(/\\/g, '/') + '\n');
    ctx.stdout.write('{}\n');
    return 0;
  };
  try {
    const i = hookInput(ctx);
    if (i?.session_id === undefined) return allow('no session_id on stdin');
    const name = i.command_name;
    const args = (i.command_args ?? '').trim();
    const word = (re: RegExp) => re.exec(args)?.[1];
    // every other command, accord-upgrade included, never touches the ticket's branch
    if (name !== 'accord') return allow();
    // empty, `queue <idea>` and free text are for the skill to route; only the typed forms name another ticket
    const cont = word(CONTINUE_FORM); // the ticket a Continue asks for
    const pick = word(PICK_UP_FORM);
    if (cont === undefined && pick === undefined) return allow();
    const typed = cont !== undefined ? undefined : `/accord pick-up ${ID.test(pick as string) ? pick : '<id>'}`; // the command to type in the session that opens
    const w = worksTicket(i.cwd ?? ctx.root, i.session_id, ctx.snapshot);
    if (w === undefined) return allow();
    const mainPath = listWorktrees(w.top)[0].path;
    if (cont !== undefined && guardAllowsContinue(w, mainPath, cont)) return allow();
    const command = cont !== undefined ? `/accord continue ${ID.test(cont) ? cont : '<id>'}` : (typed as string);
    ctx.stdout.write(JSON.stringify({ decision: 'block', reason: worksMessage(w, mainPath, sessionNext(w.top, ctx.snapshot, mainPath, command, cont)) }) + '\n');
    return 0;
  } catch (e) {
    return allow(e instanceof Error ? e.message : String(e));
  }
}

/** True when `accord/tickets/<id>/debug.md` has an open episode: no `## Resolved` heading follows its last `## Episode` heading (core's debugOpen, the one definition). */
function debugOpenIn(root: string, id: string): boolean {
  let text: string;
  try {
    text = readFileSync(join(root, 'accord', 'tickets', id, 'debug.md'), 'utf8');
  } catch {
    return false;
  }
  return debugOpen(text);
}

// ST-LN-39 D-08: `accord/tickets/<id>/verification.md` at any root, matched after `\` became `/` and path.posix collapsed
// `.`, `..` and repeated slashes. Anchored, no nested quantifier, letter case ignored on every OS.
const VERIFICATION_RECORD = /(?:^|\/)accord\/tickets\/[^/]+\/verification\.md$/i;

/**
 * ST-LN-39 D-08: in Claude Code only an `accord-verifier` subagent writes `accord/tickets/<id>/verification.md`. Decides from stdin alone,
 * before any repository load. Returns undefined when the input is not a Write, Edit or MultiEdit (the caller goes on to the dispatch
 * check); otherwise it has printed its answer and returns 0. Fails open: any unreadable shape or throw is one stderr line and `{}`.
 */
export function preToolUseWrite(io: { stdin?: string; stdout: NodeJS.WritableStream; stderr: NodeJS.WritableStream }): number | undefined {
  const allow = (why?: string) => {
    if (why !== undefined) io.stderr.write(`accord hook pre-tool-use: ${why.split('\n')[0]}; allowed`.replace(/\\/g, '/') + '\n');
    io.stdout.write('{}\n');
    return 0;
  };
  try {
    let parsed: unknown;
    try {
      parsed = JSON.parse(io.stdin ?? '');
    } catch {
      return undefined;
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined;
    const input = parsed as Record<string, unknown>;
    const tool = input.tool_name;
    if (tool !== 'Write' && tool !== 'Edit' && tool !== 'MultiEdit') return undefined;
    const toolInput = input.tool_input;
    if (typeof toolInput !== 'object' || toolInput === null || Array.isArray(toolInput)) return allow('no tool_input on a ' + tool);
    const file = (toolInput as Record<string, unknown>).file_path;
    if (typeof file !== 'string') return allow('no file_path on a ' + tool);
    if (!VERIFICATION_RECORD.test(posix.normalize(file.replace(/\\/g, '/')))) return allow();
    const type = input.agent_type;
    if (type === 'accord-verifier') return allow();
    const from = typeof type === 'string' && type !== '' ? `agent "${type}"` : 'the main session';
    const reason =
      'accord: only the accord-verifier subagent writes accord/tickets/<id>/verification.md (verify.md step 3 of /accord): ' +
      "dispatch accord-verifier in a fresh context with the ticket file's path. " +
      `This ${tool} came from ${from}. If it did come from accord-verifier, this Claude Code does not name subagents to hooks: update Claude Code.`;
    io.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }) + '\n');
    return 0;
  } catch (e) {
    return allow(e instanceof Error ? e.message : String(e));
  }
}

/**
 * ST-LN-17 D-03: refuse an executor dispatched on a model other than the one accord computes while the ticket is at review. Phase 11 D-07: refuse the plain executor for a `ui: true` ticket while `ui.build` is set,
 * and the UI executor for any other ticket, while a ticket is active. Fails open on any error.
 */
function preToolUse(ctx: CommandContext): number {
  const allow = (why?: string) => {
    if (why !== undefined) ctx.stderr.write(`accord hook pre-tool-use: ${why.split('\n')[0]}; allowed`.replace(/\\/g, '/') + '\n');
    ctx.stdout.write('{}\n');
    return 0;
  };
  const deny = (reason: string) => {
    ctx.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }) + '\n');
    return 0;
  };
  try {
    let parsed: unknown;
    try {
      parsed = JSON.parse(ctx.stdin ?? '');
    } catch {
      return allow('no hook input on stdin');
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return allow('no hook input on stdin');
    const input = parsed as Record<string, unknown>;
    if (input.tool_name !== 'Agent' && input.tool_name !== 'Task') return allow();
    const toolInput = input.tool_input;
    if (typeof toolInput !== 'object' || toolInput === null || Array.isArray(toolInput)) return allow();
    const { subagent_type: agent, model } = toolInput as Record<string, unknown>;
    if (typeof agent !== 'string' || !EXECUTOR_AGENTS.includes(agent)) return allow();
    const id = activeTicket(ctx.root, ctx.snapshot);
    if (id === undefined) return allow();
    // Phase 11 D-07 (11-ac-8): the session builds with the executor `accord brief` names (brief.ts `agentOf`: a `ui: true` ticket while `ui.build` is set gets accord-executor-ui, every other ticket accord-executor)
    const wantsUi = ctx.snapshot.tickets[id]?.frontmatter?.ui === true && ctx.snapshot.config?.ui?.build !== undefined;
    if (wantsUi && agent !== UI_EXECUTOR) return deny(`accord: ${id} is ui: true and ui.build is set: dispatch ${UI_EXECUTOR}, the agent accord brief names`);
    if (!wantsUi && agent === UI_EXECUTOR) return deny(`accord: ${id} is not a ui ticket with ui.build set: dispatch accord-executor`);
    const reason = checkFixDispatch(ctx.snapshot, id, typeof model === 'string' ? model : undefined, debugOpenIn(ctx.root, id));
    return reason === undefined ? allow() : deny(reason);
  } catch (e) {
    return allow(e instanceof Error ? e.message : String(e));
  }
}
