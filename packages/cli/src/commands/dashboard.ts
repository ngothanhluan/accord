// ST-LN-2 `accord dashboard`: the ranked sections for the viewer (git user.email), as text or JSON.
import { dashboard, loadSnapshot } from '@accord-dev/accord-core';
import { gitUserEmail, loadClaimView, remoteRefs, UsageError, withDefaultRef, withQueued } from '../load/fs.js';
import { dashboardFetchLimitMs } from './fetch-limit.js';
import { upgradeNotice } from './notice.js';
import { fetchOrigin } from './worktree.js';
import { renderDashboard } from '../render/dashboard.js';
import { stagesOffLines } from '../render/stages-off.js';
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
  const loaded = loadSnapshot(parts.view);
  const plain = parts.checkout === parts.view ? loaded : loadSnapshot(parts.checkout);
  return { ...ctx, snapshot: withDefaultRef(ctx.root, loaded, parts.refs), plain, branch: parts.branch };
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
  }
  const d = dashboard(ctx.snapshot, viewer, Math.floor(Date.now() / 1000), ctx.plain);
  ctx.stdout.write(options.json ? JSON.stringify(f.why === undefined ? d : { ...d, offline: f.why }, null, 2) + '\n' : withStagesOff(ctx, renderDashboard(d)));
  return 0;
}
