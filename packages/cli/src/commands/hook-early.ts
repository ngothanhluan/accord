// Phase 08.9.2 Ruling-structural: every answer a hook can give from stdin alone, made before any repository load. The `hook <event>` action in run.ts
// calls `hookEarly` first; a case it answers starts no git process (RESEARCH F-6 measured 2.4 to 3.3 s of preflight for answers like these).
// Like `preToolUseWrite` (ST-LN-39 D-08) these answers read no repository and so take no pin check. D-07: session-start and session-resume have no early path.
import { EPIC_ROLES, subagentContext } from '@accord-dev/accord-core';
import { cliRuleset } from '../load/product.js';
import type { RunOptions } from '../run.js';
import { hookInput, preToolUseWrite, promptExpansionStdin } from './hook.js';
import type { HookEvent } from './hook.js';

/**
 * The exit code of an answer `event` can give from stdin alone (already printed), or undefined when the case needs the repository: an accord-executor dispatch
 * (the model guard reads the ticket), an agent in EPIC_ROLES (the epic block reads the story's parent), a typed `continue <id>` or `pick-up <id>`, and both session events.
 * Unparseable stdin takes the fail-open answers the full path gives it today.
 */
export function hookEarly(opts: RunOptions, event: HookEvent): number | undefined {
  switch (event) {
    case 'pre-tool-use':
      return preToolUseEarly(opts);
    case 'subagent-start':
      return subagentStartEarly(opts);
    case 'prompt-expansion':
      return promptExpansionStdin(opts);
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
