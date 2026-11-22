// ST-LN-22 D-09 `accord related <id>`: the Vetoes and Decisions of the tickets related to <id>, then the Rejected lines of
// accord/product/conventions.md (ST-LN-84 D-10), for the scout at intent and the critic at approach. The skills paste what this prints into the dispatch, so no agent is told to open other tickets' files.
// Phase 8.5 D-15, D-20, D-30, R-2: `--for <scout|planner|critic|judge>` writes the file that agent is given, built by core's `productBlocks` from what this command reads: the ruleset, the
// related tickets, the Rejected lines, the epic block of a story and, by role, the conventions (the planner's: the working copy; the judge's: the default branch's, D-05) and, for the judge, the
// branch's own change to them (`productChange`, the one git diff the review package uses too). `--out <file>` writes it into the report folder. This command spawns nothing itself.
import { epicBlock, productBlocks, relatedParts, relatedText } from '@accord-dev/accord-core';
import { defaultRefOf, UsageError } from '../load/fs.js';
import { cliRuleset, productChange, readProductText } from '../load/product.js';
import { writeAgentFile } from '../load/report.js';
import type { CommandContext } from '../run.js';
import { epicSnapshot } from './anchor.js';
import { requireTicket } from './lane-args.js';
import { withDefaultBranch } from './ticket-shared.js';

/** The agents `--for` writes a file for (D-20, R-2). */
export const RELATED_ROLES = ['scout', 'planner', 'critic', 'judge'] as const;
export type RelatedRole = (typeof RELATED_ROLES)[number];

export function related(ctx: CommandContext, id: string, options: { for?: string; out?: string } = {}): number {
  const role = RELATED_ROLES.find((r) => r === options.for);
  if (options.for !== undefined && role === undefined) throw new UsageError(`--for takes one of ${RELATED_ROLES.join(', ')}`);
  if (role === undefined && options.out !== undefined) throw new UsageError(`--out goes with --for <${RELATED_ROLES.join('|')}>: it writes the file that agent is given`);
  requireTicket(ctx.snapshot, id);
  // The default branch's tickets count as well as the working tree's (a finished ticket may not be in a clone's checkout yet); the
  // whole ref is read, not only the ids the working tree holds, so a similar ticket that exists only there is found.
  const view = ctx.snapshot.defaultRef === undefined ? withDefaultBranch(ctx) : ctx.snapshot;
  if (role === undefined) {
    // ST-LN-84 D-10: the team's recorded refusals, read as `accord brief` reads them (a BOM or CRLF reaches core as written); Phase 8.5 D-08: a link is no longer followed, and each line is checked.
    ctx.stdout.write(relatedText(view, id, readProductText(ctx.root, { from: 'working' })) ?? '');
    return 0;
  }
  // D-05, D-06 and Discretion (b): the planner writes against its own working copy; the scout, critic and judge read the default branch's, so a refusal or rule a branch added is not theirs yet.
  // The default ref is read once and shared by the conventions read and the judge's change.
  const def = role === 'planner' ? undefined : defaultRefOf(ctx.root);
  const blocks = productBlocks(role, {
    ruleset: cliRuleset(),
    // R-12 (D-32): the related tickets and the epic block are ticket text, delivered as the ticket gates leave them; no line check is added to them.
    related: role === 'judge' ? undefined : relatedParts(view, id),
    epic: epicBlock(epicSnapshot(ctx, id), id),
    conventions: role === 'planner' ? readProductText(ctx.root, { from: 'working' }) : readProductText(ctx.root, { from: 'default', ref: def }),
    // D-30: the judge's `## Product files changed` is the same loader call, with the same arguments, as the review package's
    changed: role === 'judge' ? productChange(ctx.root, def, 'HEAD') : undefined,
  });
  const text = blocks.join('\n\n') + '\n';
  ctx.stdout.write(options.out === undefined ? text : 'file: ' + writeAgentFile(ctx.root, id, options.out, text) + '\n');
  return 0;
}
