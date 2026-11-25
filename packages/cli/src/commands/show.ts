// ST-LN-6 `accord show <id> [--json|--approval]`: one lane ticket in full as text or TicketDetail; --approval needs no lane.
import { approvalShort, approvalView, ticketDetail } from '@accord-dev/accord-core';
import type { TicketDetail } from '@accord-dev/accord-core';
import { colourApproval } from '../render/color.js';
import { UsageError } from '../load/fs.js';
import { ticketLog } from '../load/ticket-log.js';
import { whoFor } from '../load/who.js';
import { isUnsafe } from '../render/dashboard.js';
import { stagesOffLines } from '../render/stages-off.js';
import type { CommandContext } from '../run.js';
import { approachFacts, claimNote } from './approval-blockers.js';
import { requireLaneTicket, requireTicket } from './lane-args.js';

// Control, bidi and line-separator code points become one space each; nothing is cut or collapsed.
const clean = (s: string): string => [...s].map((ch) => (isUnsafe(ch.codePointAt(0) ?? 0) ? ' ' : ch)).join('');

function text(d: TicketDetail, off: string[], holder: string): string {
  const lines = [
    d.id + ' ' + d.title,
    'Stage: ' + d.stage,
    'Lane: ' + d.lane,
    ...off,
    'Tasks: ' + d.tasksDone + '/' + d.tasksTotal,
    'Branch: ' + d.branch,
    'Holder: ' + holder,
    'Blocked by: ' + (d.blockedBy.length === 0 ? 'none' : d.blockedBy.join(' ')),
    '',
    // ST-LN-94 94-ac-5: a lane R ticket shows its question where a lane M ticket shows its Intent.
    ...(d.question === undefined
      ? ['Intent:', ...(d.intent.length === 0 ? ['none'] : d.intent)]
      : ['Question:', ...(d.question.length === 0 ? ['none'] : d.question)]),
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

/**
 * ST-LN-50 D-08: the `stages off for lane <L>: ...` line closing an approval view, as its own paragraph; empty when nothing is off for the lane.
 * `short` views end in a newline, the full view does not.
 */
function offLines(ctx: CommandContext, lane: string | undefined, short: boolean): string {
  const off = stagesOffLines(ctx.snapshot.config, lane);
  return off.length === 0 ? '' : (short ? '\n' : '\n\n') + off.join('\n') + '\n';
}

/** The detail of the lane ticket `id` as the claim view and the checkout read it; refuses a ticket with no lane (UsageError), as `show` does. */
function laneDetail(ctx: CommandContext, id: string): TicketDetail {
  requireLaneTicket(ctx, id);
  const d = ticketDetail(ctx.snapshot, id, ctx.plain);
  if (d === undefined) throw new Error('no detail for ' + id); // unreachable after requireLaneTicket
  return d;
}

/**
 * Phase 08.9.2 D-05: the JSON `show <id> --json` prints, built here so `dashboard --json` carries the very same object as `currentDetail`; one builder, so the cleaning of warnings, the now title, the
 * task titles and the log text applies to both (T-08.8.1-08). It reads the session log (git), which the text output never does (Phase 08.7 D-09), and throws what `show` throws for a ticket with no lane.
 */
export function detailJson(ctx: CommandContext, id: string): Record<string, unknown> {
  const d = laneDetail(ctx, id);
  // Phase 8.2 D-07, D-08: the person through the one display function; the JSON keeps `holder` the email and adds `holderShown` beside it in initials mode only.
  const who = whoFor(ctx.root, ctx.snapshot.config);
  // Phase 08.7 D-04: the session log (commits, agent reports, gate runs); each text is cleaned as the text output cleans a line.
  const log = ticketLog(ctx.root, id, ctx.snapshot.defaultRef?.ref).map((e) => ({ ...e, text: clean(e.text) }));
  // Phase 08.8.1 D-05, D-02: a warning text carries a ticket key and a record path, cleaned as every other string the JSON holds.
  // Phase 08.8.1 L-06, L-07: so do the plan's task titles, which a teammate or an agent wrote (T-08.8.1-08); each key keeps its place.
  const warned: TicketDetail = {
    ...d,
    ...(d.warnings === undefined ? {} : { warnings: d.warnings.map((w) => ({ ...w, text: clean(w.text) })) }),
    ...(d.now === undefined ? {} : { now: { ...d.now, title: clean(d.now.title) } }),
    ...(d.tasks === undefined ? {} : { tasks: d.tasks.map((t) => ({ ...t, title: clean(t.title) })) }),
  };
  const detail = log.length === 0 ? warned : { ...warned, log };
  return who.mode === 'initials' && d.holder !== null ? { ...detail, holderShown: who.show(d.holder) } : { ...detail };
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
      // The risks are the Must and Should findings of the last approach cycle still open and not marked data-loss or security, the risk findings the owner
      // dropped, and on a ticket claimed under an older accord the open risk findings too, which block nothing there (D-02, D-22, RR-WR-01).
      // An open data-loss or security finding on the capped rules is listed apart: it blocks the approval, so it is no risk to accept.
      // `ctx.plain` is the whole checkout snapshot, so it holds the work records; without it the claims snapshot is read.
      const facts = approachFacts(ctx, id);
      const show = (rounds: { round: number; lines: string[] }[]): string[] => rounds.flatMap((r) => r.lines.map((l) => `round ${r.round}: ${l}`));
      // CR-01: a record accord cannot read is listed there too, as `record problem:` lines: the approval waits for it.
      const note = facts.error !== undefined && (facts.blocking.length > 0 || facts.problems.length > 0) ? claimNote(facts.error) : undefined;
      // ST-LN-50 D-08: the owner's report names the stages off for the ticket's lane, in plain text after the view (the colour map reads headings only).
      ctx.stdout.write(colourApproval(approvalShort(ticket, show(facts.risks), show(facts.blocking), note, facts.problems).split('\n').map(clean).join('\n'), ctx.stdout) + offLines(ctx, ticket.frontmatter?.lane, true));
      return 0;
    }
    ctx.stdout.write(colourApproval(approvalView(ticket).split('\n').map(clean).join('\n'), ctx.stdout) + offLines(ctx, ticket.frontmatter?.lane, false));
    return 0;
  }
  if (options.json === true) {
    ctx.stdout.write(JSON.stringify(detailJson(ctx, id), null, 2) + '\n');
    return 0;
  }
  const d = laneDetail(ctx, id);
  const who = whoFor(ctx.root, ctx.snapshot.config);
  ctx.stdout.write(text(d, stagesOffLines(ctx.snapshot.config, d.lane), d.holder === null ? 'none' : who.show(d.holder)));
  return 0;
}
