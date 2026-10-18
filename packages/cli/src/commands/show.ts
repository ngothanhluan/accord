// ST-LN-6 `accord show <id> [--json]`: one lane ticket in full, as text or as the TicketDetail object.
import { approvalView, ticketDetail } from '@accord-dev/accord-core';
import type { TicketDetail } from '@accord-dev/accord-core';
import { colourApproval } from '../render/color.js';
import { isUnsafe } from '../render/dashboard.js';
import type { CommandContext } from '../run.js';
import { requireLaneTicket, requireTicket } from './lane-args.js';

// Control, bidi and line-separator code points become one space each; nothing is cut or collapsed.
const clean = (s: string): string => [...s].map((ch) => (isUnsafe(ch.codePointAt(0) ?? 0) ? ' ' : ch)).join('');

function text(d: TicketDetail): string {
  const lines = [
    d.id + ' ' + d.title,
    'Stage: ' + d.stage,
    'Lane: ' + d.lane,
    'Tasks: ' + d.tasksDone + '/' + d.tasksTotal,
    'Branch: ' + d.branch,
    'Holder: ' + (d.holder ?? 'none'),
    'Blocked by: ' + (d.blockedBy.length === 0 ? 'none' : d.blockedBy.join(' ')),
    '',
    'Intent:',
    ...(d.intent.length === 0 ? ['none'] : d.intent),
  ];
  for (const c of d.criteria) {
    lines.push(
      '',
      c.id === null ? c.title : c.id + ' ' + c.title,
      ...c.steps.map((s) => '  ' + s),
      '  State: ' + c.label,
      '  Test: ' + (c.test ?? 'none'),
      '  Test result: ' + (c.testResult ?? 'none'),
      '  Ticked: ' + (c.ticked ? 'yes' : 'no'),
      '  Verification: ' + (c.verification ?? 'none'),
    );
  }
  return lines.map(clean).join('\n') + '\n';
}

export function show(ctx: CommandContext, id: string, options: { json?: boolean; approval?: boolean }): number {
  if (options.approval === true) {
    // The checkout, as `accord approve` reads it; no lane needed.
    const ticket = requireTicket(ctx.plain ?? ctx.snapshot, id);
    // A load finding (a gherkin parse error) would print `none` and be approved: refuse instead.
    const found = (ctx.plain ?? ctx.snapshot).errors.filter((f) => f.file === ticket.file);
    if (found.length > 0) {
      for (const f of found) ctx.stderr.write(f.file + (f.line === undefined ? '' : ':' + f.line) + ': ' + f.rule + ' ' + f.reason + '\n');
      ctx.stderr.write(ticket.file + ' has load findings; run accord lint\n');
      return 1;
    }
    ctx.stdout.write(colourApproval(approvalView(ticket).split('\n').map(clean).join('\n'), ctx.stdout));
    return 0;
  }
  requireLaneTicket(ctx, id);
  const d = ticketDetail(ctx.snapshot, id, ctx.plain);
  if (d === undefined) throw new Error('no detail for ' + id); // unreachable after requireLaneTicket
  ctx.stdout.write(options.json === true ? JSON.stringify(d, null, 2) + '\n' : text(d));
  return 0;
}
