// CLI-05 `accord status`: the one screen a person looks at daily. The rows come from core's
// `statusRows` and from nothing else — the CLI adds no column, no verdict, and no second sort (D-91,
// D-92). Archived tickets are hidden unless `--all`, and the hidden count is named on every output
// mode so the omission is never silent (D-93): in the stdout summary line in text mode, and on stderr
// under `--json`, because D-98 reserves stdout there for the core array verbatim.
import { statusRows } from '@accord-dev/accord-core';
import type { StatusRow } from '@accord-dev/accord-core';
import { EMPTY_CELL, renderRows } from '../render/table.js';
import { fetchIssues } from '../tracker/github-issues.js';
import type { CommandContext } from '../run.js';

const plural = (n: number, word: string): string => n + ' ' + word + (n === 1 ? '' : 's');

/**
 * INTG-01: the `trackerCells` seam `renderRows` already accepts, filled from the tracker when one is
 * configured and reachable. A row that declares no issue keeps its own flattened tracker map; a row
 * whose issue could not be read gets the empty cell, because "not linked" and "could not fetch" must
 * not look the same — the difference is the one line this writes to stderr (D-100). Nothing here
 * changes the return value, and the adapter is never reached from a gate or from lint (D-99).
 */
async function trackerCells(ctx: CommandContext, rows: StatusRow[]): Promise<Record<string, string> | undefined> {
  const tracker = ctx.snapshot.config?.tracker;
  if (tracker?.adapter !== 'github-issues' || tracker.repo === undefined) return undefined;

  const linked = rows.flatMap((r) => {
    const n = r.tracker?.['github-issues'];
    return n === undefined ? [] : [[r.id, n] as const];
  });
  if (linked.length === 0) return undefined;

  // D-101: one GET per referenced issue and none for an issue nothing references, so the archived
  // filter the caller already applied is what keeps a hidden ticket free.
  const { issues, warning } = await fetchIssues(tracker.repo, [...new Set(linked.map(([, n]) => n))], ctx.env);
  if (warning !== undefined) ctx.stderr.write(warning + '\n');

  const cells: Record<string, string> = {};
  for (const [id, n] of linked) {
    const facts = issues[n];
    cells[id] =
      facts === undefined
        ? EMPTY_CELL
        : ['#' + n, facts.state, facts.title, facts.labels.join(',')].filter((p) => p !== '').join(' ');
  }
  return cells;
}

export async function status(ctx: CommandContext, options: { json?: boolean; all?: boolean }): Promise<number> {
  const rows = statusRows(ctx.snapshot);
  // The filter runs before both writes, so the table and the JSON can never disagree.
  const visible = options.all ? rows : rows.filter((r) => r.status !== 'archived');
  const hidden = rows.length - visible.length;
  const hiddenNote = hidden === 0 ? '' : plural(hidden, 'archived ticket') + ' hidden (--all shows them)';

  if (options.json) {
    // D-98: one write, the bare array, no envelope and no wrapper key, so an empty repository yields
    // exactly `[]` and `jq '.[]'` works with no unwrapping.
    ctx.stdout.write(JSON.stringify(visible, null, 2) + '\n');
    if (hidden > 0) ctx.stderr.write(hiddenNote + '\n');
    return 0;
  }

  // Enrichment is a rendering concern, so it is fetched only on this path: under --json the body
  // above is the core array verbatim (D-98) and costs no request at all.
  const cells = await trackerCells(ctx, visible);

  // An empty table is a worse answer than a sentence; the hidden count still rides along when the
  // reason there is nothing to show is that everything was archived (D-93).
  ctx.stdout.write(
    visible.length === 0
      ? 'no tickets to show' + (hidden === 0 ? ' in accord/tickets/' : '; ' + hiddenNote) + '\n'
      : renderRows(visible, cells) +
          plural(visible.length, 'ticket') +
          ' shown, ' +
          (hiddenNote || '0 archived hidden') +
          '\n',
  );
  // D-91: a row is a trace, never a verdict, so a ticket with an error finding does not fail the
  // command. Only the pin check and other environment problems exit non-zero (STACK Decision 1).
  return 0;
}
