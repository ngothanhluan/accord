// ST-LN-6 `accord show <id> [--json|--approval]`: one lane ticket in full as text or TicketDetail; --approval needs no lane.
import { approvalShort, approvalView, openFindings, ticketDetail, workOf } from '@accord-dev/accord-core';
import type { TicketDetail } from '@accord-dev/accord-core';
import { colourApproval } from '../render/color.js';
import { UsageError } from '../load/fs.js';
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

export function show(ctx: CommandContext, id: string, options: { json?: boolean; approval?: boolean; short?: boolean }): number {
  if (options.short === true && options.approval !== true) throw new UsageError('--short goes with --approval');
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
    if (options.short === true) {
      // The risks are the Must and Should findings of the last approach cycle still open and not marked data-loss or security (D-02, D-22).
      // `ctx.plain` is the whole checkout snapshot, so it holds the work records; without it the claims snapshot is read.
      const rec = workOf(ctx.plain ?? ctx.snapshot, id)?.approachRounds;
      const cycle = rec?.cycles[rec.cycles.length - 1];
      const risks = cycle === undefined ? [] : openFindings(cycle).flatMap((r) => r.lines.map((l) => `round ${r.round}: ${l}`));
      ctx.stdout.write(colourApproval(approvalShort(ticket, risks).split('\n').map(clean).join('\n'), ctx.stdout));
      return 0;
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
