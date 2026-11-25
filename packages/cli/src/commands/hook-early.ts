// Phase 08.9.2 Ruling-structural: every answer a hook can give from stdin alone, made before any repository load. The `hook <event>` action in run.ts
// calls `hookEarly` first; a case it answers starts no git process (RESEARCH F-6 measured 2.4 to 3.3 s of preflight for answers like these).
// Like `preToolUseWrite` (ST-LN-39 D-08) these answers read no repository and so take no pin check. D-07: session-start and session-resume have no early path
// except Phase 08.9.2 D-02's: in a repository whose config says `hook_mode: quiet` they print one line, unless the session opens on a ticket's branch.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { branchTypesOf, DEFAULT_BRANCH_TEMPLATE, EPIC_ROLES, expandBranchTypes, loadConfig, subagentContext } from '@accord-dev/accord-core';
import { ticketOfBranch } from '../load/fs.js';
import { checkoutOf, gitDirsOf, headBranchOf, isOff } from '../load/gitdir.js';
import { cliRuleset } from '../load/product.js';
import type { RunOptions } from '../run.js';
import { hookInput, preToolUseWrite, promptExpansionStdin } from './hook.js';
import type { HookEvent } from './hook.js';
import { OFF_LINE } from './off.js';

/** Phase 08.9.2 L-03: the one line a quiet repository prints at a session start (and on a resume); on a start `OFF_LINE` follows it (D-04). */
export const QUIET_LINE = 'accord: quiet in this repository (hook_mode: quiet): no rules, fetch or clean at session start; type /accord to wake accord for this session';

/**
 * Phase 08.9.2 D-02: the one anchored test of `hook_mode: quiet` on the raw text of a checkout's accord/config.yml; the launcher makes the same test, so the two decide alike.
 * A top-level key only, a space after the colon, the word alone or in matching quotes, a comment only after a space; anything else (another case, a longer word, a misspelling) is full.
 */
const QUIET_MODE = /^hook_mode:[ \t]+(?:"quiet"|'quiet'|quiet)(?:[ \t]+#.*)?[ \t]*$/m;

/**
 * The exit code of an answer `event` can give from stdin alone (already printed), or undefined when the case needs the repository: an accord-executor dispatch
 * (the model guard reads the ticket), an agent in EPIC_ROLES (the epic block reads the story's parent), a typed `continue <id>` or `pick-up <id>`, and both session events.
 * Unparseable stdin takes the fail-open answers the full path gives it today.
 */
export function hookEarly(opts: RunOptions, event: HookEvent): number | undefined {
  // Phase 08.9.2 D-03: while the person's off marker exists in this clone every event prints nothing, whatever it would have decided; read from files, so no git process.
  if (isOff(hookInput(opts)?.cwd ?? opts.cwd)) return 0;
  switch (event) {
    case 'pre-tool-use':
      return preToolUseEarly(opts);
    case 'subagent-start':
      return subagentStartEarly(opts);
    case 'prompt-expansion':
      return promptExpansionStdin(opts);
    case 'session-start':
    case 'session-resume':
      return quietStart(opts, event);
    default:
      return undefined;
  }
}

function preToolUseEarly(opts: RunOptions): number | undefined {
  // ST-LN-39 D-08: a Write, Edit or MultiEdit is decided from stdin alone
  const written = preToolUseWrite(opts);
  if (written !== undefined) return written;
  let parsed: unknown;
  try {
    parsed = JSON.parse(opts.stdin ?? '');
  } catch {
    opts.stderr.write('accord hook pre-tool-use: no hook input on stdin; allowed\n');
    opts.stdout.write('{}\n');
    return 0;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    opts.stderr.write('accord hook pre-tool-use: no hook input on stdin; allowed\n');
    opts.stdout.write('{}\n');
    return 0;
  }
  const input = parsed as Record<string, unknown>;
  const toolInput = input.tool_input;
  const agent = typeof toolInput === 'object' && toolInput !== null && !Array.isArray(toolInput) ? (toolInput as Record<string, unknown>).subagent_type : undefined;
  // ST-LN-17 D-03: only an accord-executor dispatch is judged against the ticket; every other call is allowed
  if ((input.tool_name === 'Agent' || input.tool_name === 'Task') && agent === 'accord-executor') return undefined;
  opts.stdout.write('{}\n');
  return 0;
}

function subagentStartEarly(opts: RunOptions): number | undefined {
  const type = hookInput(opts)?.agent_type;
  if (type !== undefined && EPIC_ROLES.includes(type)) return undefined; // the epic block reads the story's parent
  const out = { hookSpecificOutput: { hookEventName: 'SubagentStart', additionalContext: subagentContext(cliRuleset(), undefined) } };
  opts.stdout.write(JSON.stringify(out) + '\n');
  return 0;
}

/**
 * Phase 08.9.2 D-02, L-02, L-03: the quiet answer of a session start or resume, or undefined when the full path runs. Quiet needs the checkout's config to say so (an unreadable
 * config, a missing key or any other value is full) and the session not to open on a ticket's branch: a branch the checkout's templates map to one of its ticket files wakes
 * accord, and so does a HEAD that cannot be read. A detached HEAD names no branch and stays quiet. Reads files only, so a quiet start runs no git process.
 */
function quietStart(opts: RunOptions, event: HookEvent): number | undefined {
  try {
    const root = checkoutOf(hookInput(opts)?.cwd ?? opts.cwd);
    if (root === undefined) return undefined;
    const text = readFileSync(join(root, 'accord', 'config.yml'), 'utf8');
    if (!QUIET_MODE.test(text)) return undefined;
    const dirs = gitDirsOf(root);
    const branch = dirs === undefined ? undefined : headBranchOf(dirs.gitDir);
    if (branch === undefined || (branch !== '' && opensOnTicket(root, branch, text))) return undefined;
    opts.stdout.write(QUIET_LINE + '\n');
    if (event === 'session-start') opts.stdout.write(OFF_LINE + '\n');
    return 0;
  } catch {
    return undefined;
  }
}

/** True when `branch` is a claim branch of a ticket that has a file in `<root>/accord/tickets/`, under the checkout's own `branch` and `branch_types` (RESEARCH Open Question 4). */
function opensOnTicket(root: string, branch: string, configText: string): boolean {
  const ids = new Set(readdirSync(join(root, 'accord', 'tickets')).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -'.md'.length)));
  const config = loadConfig('accord/config.yml', configText).config;
  const templates = expandBranchTypes([...new Set([DEFAULT_BRANCH_TEMPLATE, config?.branch].filter((t): t is string => t !== undefined))], branchTypesOf(config));
  const id = ticketOfBranch(branch, templates, (i) => ids.has(i), config);
  return id !== undefined && ids.has(id);
}
