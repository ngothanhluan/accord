// ST-LN-97 D-12: every tracker sits behind one read-only interface. Ticket keys go in; `{ title, state,
// labels }` per key and at most one warning line come out. `status` asks `adapterFor(config.tracker)`
// and has no per-tracker branch of its own. An adapter issues reads only, writes to no repository and
// to no file, and never rejects: a failure is the warning, so a tracker cannot change a verdict or an
// exit code (D-99, D-100).
import type { AccordConfig } from '@accord-dev/accord-core';
import { fetchIssues } from './github-issues.js';
import { linearAdapter } from './linear.js';

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

/** The seams an adapter may use: the fetch to call (a test injects one) and the repository root. */
export interface TrackerIo {
  fetchImpl: typeof fetch;
  root: string;
}

export interface TrackerAdapter {
  readonly name: 'github-issues' | 'jira' | 'linear' | 'script';
  /** How a status cell names the issue: the key itself unless the tracker writes it another way (github: `#7`). */
  label?(key: string): string;
  /** Never rejects. */
  fetch(keys: readonly string[], env: NodeJS.ProcessEnv, io: TrackerIo): Promise<TrackerResult>;
}

/** github-issues on the interface: its requests, token lookup and warning wording stay exactly as `fetchIssues` has them (D-12 "moved onto it"). */
function githubAdapter(repo: string): TrackerAdapter {
  return {
    name: 'github-issues',
    label: (key) => '#' + key,
    fetch: (keys, env, io) => fetchIssues(repo, keys, env, io.fetchImpl),
  };
}

/**
 * The adapter the config names, or undefined for `none` (checked before anything else) and for an
 * adapter that cannot run without a setting the config lacks (github-issues with no `repo`). A missing
 * environment secret is not decided here: the adapter's own warning names it.
 */
export function adapterFor(tracker: AccordConfig['tracker'] | undefined): TrackerAdapter | undefined {
  switch (tracker?.adapter) {
    case undefined:
    case 'none':
      return undefined;
    case 'github-issues':
      return tracker.repo === undefined ? undefined : githubAdapter(tracker.repo);
    case 'linear':
      return linearAdapter;
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
