// ST-LN-2 `accord dashboard`: the ranked sections for the viewer (git user.email), as text or JSON.
import { dashboard, loadSnapshot } from '@accord-dev/accord-core';
import { gitUserEmail, loadClaimView, remoteRefs, UsageError, withDefaultRef, withQueued } from '../load/fs.js';
import { whoFor } from '../load/who.js';
import { activeTicket } from './anchor.js';
import { conventionsNotice } from './audit.js';
import { dashboardFetchLimitMs } from './fetch-limit.js';
import { upgradeNotice } from './notice.js';
import { fetchOrigin } from './worktree.js';
import { renderDashboard } from '../render/dashboard.js';
import { stagesOffLines } from '../render/stages-off.js';
import { dashboardForJson, dashboardForText } from '../render/who.js';
import type { CommandContext } from '../run.js';

/** ST-LN-50 D-08: one `stages off for lane <L>: ...` line per lane with a stage off, on top of the summary line that closes the text; nothing when none is off. */
function withStagesOff(ctx: CommandContext, text: string): string {
  const off = stagesOffLines(ctx.snapshot.config);
  const at = text.lastIndexOf('\n\n') + 2; // the summary and the actions are the last block
  return off.length === 0 || at < 2 ? text : text.slice(0, at) + off.join('\n') + '\n' + text.slice(at);
}

/** ST-LN-16: the claim view `preflight` builds, read again after a fetch moved origin's refs; the pin was checked on the first read and the fetch changes no file of the checkout. */
function reloaded(ctx: CommandContext): CommandContext {
  const parts = loadClaimView(ctx.root);
  // Phase 08.9.2 D-08: the command's own parse memo, so a reload re-parses only the files the fetch changed.
  // Phase 08.9.2 D-08: a reload reads the dropped and archived bodies the way the first load did.
  const options = { ...(ctx.memo === undefined ? {} : { memo: ctx.memo }), ...(ctx.frontmatterOnly === undefined ? {} : { frontmatterOnly: ctx.frontmatterOnly }) };
  const loaded = loadSnapshot(parts.view, options);
  const plain = parts.checkout === parts.view ? loaded : loadSnapshot(parts.checkout, options);
  return { ...ctx, snapshot: withDefaultRef(ctx.root, loaded, parts.refs, ctx.memo, ctx.frontmatterOnly), plain, branch: parts.branch };
}

/**
 * Phase 08.7 D-10: the lane ticket this checkout's branch claims, for the flightdeck pane's ticket tab, read by the anchor's own reader (`activeTicket`: the branch the load already read and the
 * templates in force) so the pane never parses a branch. Undefined on the default branch, a detached HEAD, a branch naming no ticket, a ticket with no `lane:` (`show` refuses it) and when git could
 * not say the branch; a throw never fails the dashboard.
 */
function currentTicket(ctx: CommandContext): string | undefined {
  try {
    const id = activeTicket(ctx.root, ctx.snapshot, ctx.branch);
    if (id === undefined || !Object.hasOwn(ctx.snapshot.tickets, id)) return undefined;
    return ctx.snapshot.tickets[id]?.frontmatter?.lane === undefined ? undefined : id;
  } catch {
    return undefined;
  }
}

export async function dashboardCommand(first: CommandContext, options: { json?: boolean }): Promise<number> {
  const viewer = gitUserEmail(first.root);
  if (viewer === '') throw new UsageError('git user.email is not set - set it with git config user.email <you@example.com>');
  // ST-LN-16 D-19: one bounded fetch before anything is read, so a teammate's pushed claim and a draft queued on a backlog branch show without a manual one. A failure goes on with the refs
  // already here: text says so in one line before the sections, JSON in the field `offline`; with no origin nothing is fetched and nothing is said.
  const before = remoteRefs(first.root);
  const f = fetchOrigin(first, undefined, { ms: dashboardFetchLimitMs(), quiet: options.json === true, keep: true });
  // the claim view is read again only when the fetch moved a ref: a fetch that found nothing new leaves the first read as it was
  const read = f.fetched === 'ok' && (before === undefined || remoteRefs(first.root) !== before) ? reloaded(first) : first;
  const ctx: CommandContext = { ...read, snapshot: withQueued(read.root, read.snapshot) };
  if (!options.json) {
    const line = await upgradeNotice(ctx.snapshot.config?.accord);
    if (line !== undefined) ctx.stdout.write(line + '\n');
    // Phase 8.1 D-11: one line while the conventions file exists and holds no convention line; text only, never a refusal, and the audit is not run
    const conventions = conventionsNotice(ctx.root);
    if (conventions !== undefined) ctx.stdout.write(conventions + '\n');
  }
  const d = dashboard(ctx.snapshot, viewer, Math.floor(Date.now() / 1000), ctx.plain);
  // Phase 8.2 D-07, D-08: how a person is shown runs after the data is computed, so the viewer's own tickets are still matched by email; the JSON keeps `claimedBy` and adds `claimedByShown` in initials mode only.
  const who = whoFor(ctx.root, ctx.snapshot.config);
  const json = who.mode === 'initials' ? dashboardForJson(d, who.show) : d;
  // Phase 08.7 D-10: `current` sits after the dashboard's own keys and before `offline`; JSON only, the text is unchanged (D-09)
  const current = options.json ? currentTicket(ctx) : undefined;
  ctx.stdout.write(
    options.json
      ? JSON.stringify({ ...json, ...(current === undefined ? {} : { current }), ...(f.why === undefined ? {} : { offline: f.why }) }, null, 2) + '\n'
      : withStagesOff(ctx, renderDashboard(dashboardForText(d, who.show))),
  );
  return 0;
}
