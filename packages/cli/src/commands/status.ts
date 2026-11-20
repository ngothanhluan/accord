// CLI-05 `accord status`: the one screen a person looks at daily. The rows come from core's
// `statusRows` and from nothing else — the CLI adds no column, no verdict, and no second sort (D-91,
// D-92). Archived tickets are hidden unless `--all`, and the hidden count is named on every output
// mode so the omission is never silent (D-93): in the stdout summary line in text mode, and on stderr
// under `--json`, because D-98 reserves stdout there for the core array verbatim.
import { statusRows } from '@accord-dev/accord-core';
import type { StatusRow } from '@accord-dev/accord-core';
import { stagesOffLines } from '../render/stages-off.js';
import { EMPTY_CELL, renderRows } from '../render/table.js';
import { rowsForText } from '../render/who.js';
import { whoFor } from '../load/who.js';
import { adapterFor, issueKeyOf } from '../tracker/index.js';
import { recordWarning, scriptRefusal } from '../load/script-trust.js';
import { jiraUrlRefusal } from '../tracker/trust.js';
import type { CommandContext } from '../run.js';

const plural = (n: number, word: string): string => n + ' ' + word + (n === 1 ? '' : 's');

/**
 * INTG-01 / ST-LN-97 D-12: the `trackerCells` seam `renderRows` already accepts, filled from the tracker when one is
 * configured and reachable. A row that declares no issue keeps its own flattened tracker map; a row
 * whose issue could not be read gets the empty cell, because "not linked" and "could not fetch" must
 * not look the same — the difference is the one line this writes to stderr (D-100). Nothing here
 * changes the return value, and the adapter is never reached from a gate or from lint (D-99).
 */
async function trackerCells(ctx: CommandContext, rows: StatusRow[]): Promise<Record<string, string> | undefined> {
  const config = ctx.snapshot.config;
  const adapter = adapterFor(config?.tracker);
  if (adapter === undefined) return undefined;

  // WR-02: the branch's own tracker.url never decides where the Jira credential goes; the default branch's does.
  if (adapter.name === 'jira' && config?.tracker?.url !== undefined) {
    const refusal = jiraUrlRefusal(ctx.root, config.tracker.url);
    if (refusal !== undefined) {
      ctx.stderr.write(refusal + '\n');
      return undefined;
    }
  }

  // Repository scripts trust: the script runs with the whole environment, so it runs only after the person allowed this command and these files with `accord trust`.
  if (adapter.name === 'script' && config?.tracker?.command !== undefined) {
    // round 4 IN-01: an entry of the record accord cannot read is ignored (read as no allow), and said so
    const unread = recordWarning(ctx.root);
    if (unread !== undefined) ctx.stderr.write(unread + '\n');
    const refusal = scriptRefusal(ctx.root, 'tracker.command', config.tracker.command);
    if (refusal !== undefined) {
      ctx.stderr.write('tracker script: ' + refusal + '\n');
      return undefined;
    }
  }

  const linked = rows.flatMap((r) => {
    const key = issueKeyOf(r, adapter.name, config);
    return key === undefined ? [] : [[r.id, key] as const];
  });
  if (linked.length === 0) return undefined;

  // D-101: one request per referenced issue and none for an issue nothing references, so the archived
  // filter the caller already applied is what keeps a hidden ticket free. `fetch` is read here, at call
  // time, so a test that stubs the global reaches the adapter.
  const { issues, warning } = await adapter.fetch([...new Set(linked.map(([, key]) => key))], ctx.env, {
    fetchImpl: fetch,
    root: ctx.root,
  });
  if (warning !== undefined) ctx.stderr.write(warning + '\n');

  const cells: Record<string, string> = {};
  for (const [id, key] of linked) {
    const facts = issues[key];
    cells[id] =
      facts === undefined
        ? EMPTY_CELL
        : [adapter.label?.(key) ?? key, facts.state, facts.title, facts.labels.join(',')].filter((p) => p !== '').join(' ');
  }
  return cells;
}

export async function status(ctx: CommandContext, options: { json?: boolean; all?: boolean }): Promise<number> {
  const rows = statusRows(ctx.snapshot, Math.floor(Date.now() / 1000), ctx.plain);
  // The filter runs before both writes, so the table and the JSON can never disagree.
  const visible = options.all ? rows : rows.filter((r) => r.status !== 'archived' && r.status !== 'dropped');
  const hidden = rows.length - visible.length;
  // 0.1.0 wording stays byte-identical when every hidden row is archived.
  // Relies on dropped rows always being hidden, so `hidden` never counts a shown one.
  const onlyArchived = rows.every((r) => r.status !== 'dropped');
  const hiddenNote =
    hidden === 0 ? '' : plural(hidden, (onlyArchived ? '' : 'dropped or ') + 'archived ticket') + ' hidden (--all shows them)';

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
  // ST-LN-50 D-08: the stages a team turned off, one line per lane, after the table and before the summary line; none when nothing is off.
  const off = stagesOffLines(ctx.snapshot.config).map((l) => l + '\n').join('');
  ctx.stdout.write(
    visible.length === 0
      ? 'no tickets to show' + (hidden === 0 ? ' in accord/tickets/' : '; ' + hiddenNote) + '\n' + off
      : renderRows(rowsForText(visible, whoFor(ctx.root, ctx.snapshot.config).show), cells) +
          off +
          plural(visible.length, 'ticket') +
          ' shown, ' +
          (hiddenNote || '0 archived hidden') +
          '\n',
  );
  // D-91: a row is a trace, never a verdict, so a ticket with an error finding does not fail the
  // command. Only the pin check and other environment problems exit non-zero (STACK Decision 1).
  return 0;
}
