// Spec §8 `accord brief <id> <n>`: the whole brief an executor receives — the ticket verbatim, then task n
// of the plan. Never chat history, never a summary.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normaliseText, planFile, workOf } from '@accord-dev/accord-core';
import { UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';
import { requireLaneTicket, taskNumber } from './lane-args.js';

export function brief(ctx: CommandContext, id: string, task: string): number {
  const n = taskNumber(task);
  const ticket = requireLaneTicket(ctx, id);
  const plan = workOf(ctx.snapshot, id)?.plan;
  if (plan === undefined) throw new UsageError('no plan at ' + planFile(id));
  const t = plan.tasks.find((x) => x.n === n);
  if (t === undefined) throw new UsageError(`${planFile(id)} has no "## Task ${n}"`);
  const text = normaliseText(readFileSync(join(ctx.root, ticket.file), 'utf8'));
  const section = [`## Task ${t.n}: ${t.title}`, ...t.lines.map((l) => l.text)].join('\n');
  ctx.stdout.write(text.replace(/\n*$/, '\n') + '\n---\n\n' + section.replace(/\n*$/, '\n'));
  return 0;
}
