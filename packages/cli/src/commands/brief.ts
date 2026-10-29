// Spec §8 `accord brief <id> <n>`: the whole brief an executor receives — the ticket verbatim, the plan's
// preamble, task n of the plan, the task's one test command, then the conventions. Never chat history,
// never a summary.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normaliseText, planFile, workOf } from '@accord-dev/accord-core';
import type { PlanTask } from '@accord-dev/accord-core';
import { UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';
import { requireLaneTicket, taskNumber } from './lane-args.js';

const ONLY = 'This is the only test command the executor runs for this task.';
const FULL_WHY = 'tests.full is printed because accord/config.yml has no tests.affected.';
const NO_COMMAND = 'No test command is configured: accord/config.yml has no tests.affected and no tests.full.';

// ST-LN-64: the one test command the executor runs, from config.yml. The CLI prints it and runs nothing.
function testBlock(ctx: CommandContext, t: PlanTask): string {
  const tests = ctx.snapshot.config?.tests;
  if (tests?.affected !== undefined) {
    const paths = [...t.files];
    for (const v of t.verify) {
      const i = v.indexOf('#');
      const prefix = i < 0 ? v : v.slice(0, i);
      if ((ctx.snapshot.tree.includes(prefix) || t.files.includes(prefix)) && !paths.includes(prefix)) paths.push(prefix);
    }
    // split/join, never String.replace, so a `$` in a path is not read as a replacement pattern.
    return 'Test command: ' + tests.affected.split('{files}').join(paths.join(' ')) + '\n' + ONLY + '\n';
  }
  if (tests?.full !== undefined) return 'Test command: ' + tests.full + '\n' + ONLY + '\n' + FULL_WHY + '\n';
  return NO_COMMAND + '\n';
}

export function brief(ctx: CommandContext, id: string, task: string): number {
  const n = taskNumber(task);
  const ticket = requireLaneTicket(ctx, id);
  const plan = workOf(ctx.snapshot, id)?.plan;
  if (plan === undefined) throw new UsageError('no plan at ' + planFile(id));
  const t = plan.tasks.find((x) => x.n === n);
  if (t === undefined) throw new UsageError(`${planFile(id)} has no "## Task ${n}"`);
  const text = normaliseText(readFileSync(join(ctx.root, ticket.file), 'utf8'));
  const section = [`## Task ${t.n}: ${t.title}`, ...t.lines.map((l) => l.text)].join('\n');
  // Blank edge lines go, so a plan with no preamble gives the brief it always did.
  const pre = plan.preamble.split('\n');
  while (pre.length > 0 && pre[0].trim() === '') pre.shift();
  while (pre.length > 0 && pre[pre.length - 1].trim() === '') pre.pop();
  const rules = pre.length > 0 ? pre.join('\n') + '\n\n' : '';
  // From disk, not the snapshot copy, so a BOM or CRLF reaches the brief as written (ST-LN-8 D-04).
  const convPath = join(ctx.root, 'accord', 'product', 'conventions.md');
  const conv = existsSync(convPath) ? readFileSync(convPath, 'utf8') : '';
  // trim() strips whitespace and the byte order mark alike.
  const tail = conv.trim() === '' ? '' : '\n---\n\n' + conv;
  ctx.stdout.write(text.replace(/\n*$/, '\n') + '\n---\n\n' + rules + section.replace(/\n*$/, '\n') + '\n---\n\n' + testBlock(ctx, t) + tail);
  return 0;
}
