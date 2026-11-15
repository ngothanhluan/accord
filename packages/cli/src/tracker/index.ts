// ST-LN-97 D-12: every tracker sits behind one read-only interface. Ticket keys go in; `{ title, state,
// labels }` per key and at most one warning line come out. `status` asks `adapterFor(config.tracker)`
// and has no per-tracker branch of its own. An adapter issues reads only, writes to no repository and
// to no file, and never rejects: a failure is the warning, so a tracker cannot change a verdict or an
// exit code (D-99, D-100).
import type { AccordConfig } from '@accord-dev/accord-core';
import { githubAdapter } from './github-issues.js';
import { jiraAdapter } from './jira.js';
import { linearAdapter } from './linear.js';
import { scriptAdapter } from './script.js';
import type { runTeamCommand } from '../load/team-run.js';

/** What a tracker says about one issue, already reduced to printable ASCII. */
export interface IssueFacts {
  title: string;
  state: string;
  labels: string[];
}

/** Facts by the key that was asked for, and at most one warning line for everything that failed. */
export interface TrackerResult {
  issues: Record<string, IssueFacts>;
  warning?: string;
}

/**
 * The seams an adapter may use: the fetch to call (a test injects one), the repository root, and the one runner
 * for committed team commands (the script adapter only; absent means the real `runTeamCommand`).
 */
export interface TrackerIo {
  fetchImpl: typeof fetch;
  root: string;
  run?: typeof runTeamCommand;
}

export interface TrackerAdapter {
  readonly name: 'github-issues' | 'jira' | 'linear' | 'script';
  /** How a status cell names the issue: the key itself unless the tracker writes it another way (github: `#7`). */
  label?(key: string): string;
  /** Never rejects. */
  fetch(keys: readonly string[], env: NodeJS.ProcessEnv, io: TrackerIo): Promise<TrackerResult>;
}

/**
 * The adapter the config names, or undefined for `none` (checked before anything else) and for an
 * adapter that cannot run without a setting the config lacks (github-issues with no `repo`, jira with no `url`, script with no `command`). A missing
 * environment secret is not decided here: the adapter's own warning names it.
 */
export function adapterFor(tracker: AccordConfig['tracker'] | undefined): TrackerAdapter | undefined {
  switch (tracker?.adapter) {
    case undefined:
    case 'none':
      return undefined;
    case 'github-issues':
      return tracker.repo === undefined ? undefined : githubAdapter(tracker.repo);
    case 'jira':
      return tracker.url === undefined ? undefined : jiraAdapter(tracker.url);
    case 'linear':
      return linearAdapter;
    case 'script':
      return tracker.command === undefined ? undefined : scriptAdapter(tracker.command);
  }
}

/**
 * D-05 with D-12: the issue key of a status row is the ticket id itself under `ids.mode: tracker`,
 * otherwise the ticket's `tracker.<adapter>` value; undefined when the ticket links nothing.
 */
export function issueKeyOf(
  row: { id: string; tracker?: Record<string, string> },
  adapterName: TrackerAdapter['name'],
  idsMode: 'pattern' | 'tracker' | undefined,
): string | undefined {
  return idsMode === 'tracker' ? row.id : row.tracker?.[adapterName];
}
