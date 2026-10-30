// ST-LN-17 D-03: the check behind the Claude Code PreToolUse hook. Pure: the host supplies the snapshot.
import { laneTicket, workOf } from '../gate/work.js';
import { AGENT_DEFAULTS } from '../skills/agents.js';
import { progressOf } from '../status/stage.js';
import type { RepoSnapshot } from '../model/snapshot.js';
import { fixModel, modelFamily } from './next.js';
import { cycleOpen } from './record.js';

/** ST-LN-17 D-03: the reason to refuse an accord-executor dispatched with `model` (undefined when none) while `id` is at review; undefined to allow. */
export function checkFixDispatch(snapshot: RepoSnapshot, id: string, model: string | undefined, debugOpen = false): string | undefined {
  const ticket = laneTicket(snapshot, id);
  if (ticket === undefined || ticket.frontmatter?.lane === 'S') return undefined;
  if (progressOf(snapshot, ticket)?.stage !== 'review') return undefined;
  const cycles = workOf(snapshot, id)?.rounds?.cycles ?? [];
  const current = cycles[cycles.length - 1];
  // An open debug record exempts accord-debug's own fix dispatches, but only until the current cycle holds an open round (ledger Ruling 28, amended).
  if (debugOpen && (current === undefined || !cycleOpen(current))) return undefined;
  const f = fixModel(snapshot, id);
  if (f === undefined) return undefined;
  const r = current?.rounds.length ?? 0;
  if ('refused' in f) return `accord: review round ${r} of ${id} cannot dispatch a fix executor: ${f.refused}`;
  const m = f.model;
  const family = (name: string): string => modelFamily(name) ?? name;
  if (model === undefined || model === '') {
    // The agent file carries the configured model (ledger Ruling 31).
    const configured = snapshot.config?.models?.executor?.model ?? AGENT_DEFAULTS.executor.model;
    if (family(m) === family(configured)) return undefined;
  } else {
    const dispatched = modelFamily(model);
    // Nothing to compare: the computed model names no family, or the dispatch names none (for example `inherit`).
    if (modelFamily(m) === undefined || dispatched === undefined || dispatched === modelFamily(m)) return undefined;
  }
  return (
    `accord: review round ${r} of ${id} is the latest round in review.md and needs the fix executor on ${m}; ` +
    `if this dispatch fixes the findings of a newer round, write that round to review.md and commit it first, then run accord round ${id} and dispatch again with the model it prints; ` +
    `for round ${r}'s findings, dispatch accord-executor again with model "${m}"`
  );
}
