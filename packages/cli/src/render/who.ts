// Phase 8.2 D-07, D-08: how a person is shown. One display function, called by every view that prints a person: `accord audit` here, and the dashboard, the status table and the panel
// in the next plan. The identity stays the email everywhere (`claimedBy`, `holder`); only the text a person reads changes, and a machine format never carries the shown form in place of it.
// Pure: no spawn, no filesystem; `load/who.ts` reads the setting from git config.
import type { Dashboard } from '@accord-dev/accord-core';

/** `email` (the default and today's output) or `initials`, from the `people` map of accord/config.yml. */
export type WhoMode = 'email' | 'initials';

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The person's email in `email` mode; in `initials` mode the initials `people` holds for that email, else the email. Keys are compared with the email without regard to case, as the
 * queue's `people` lookup and the dashboard's `mine` are; the first match in sorted key order wins. A person the map lacks keeps the email, never a guess.
 * The result is still text from a file: a caller prints it through `shown()`, `sanitise`/`fit` or the panel's `clean`.
 */
export function whoShown(email: string, mode: WhoMode, people: Readonly<Record<string, string>> | undefined): string {
  if (mode !== 'initials' || people === undefined) return email;
  const want = email.toLowerCase();
  const key = Object.keys(people)
    .sort(cmp)
    .find((k) => k.toLowerCase() === want);
  return key === undefined ? email : (people[key] as string);
}

/** The rows with `claimedBy` replaced by `show(claimedBy)`; for the text views only, and only after the data is computed, because a shown value is no longer the identity the dashboard compares with the viewer. */
export function rowsForText<T extends { claimedBy?: string }>(rows: readonly T[], show: (email: string) => string): T[] {
  return rows.map((r) => (r.claimedBy === undefined ? r : { ...r, claimedBy: show(r.claimedBy) }));
}

type Rows = Dashboard['yours']['rows'];

/** `d` with `f` applied to the rows of yours, team, ready and upNext (an absent upNext stays absent; its `suggest` and every `more` are kept); the epics hold no person and stay as they are. */
function mapRows(d: Dashboard, f: (rows: Rows) => object[]): Record<string, unknown> {
  const { yours, team, ready, upNext } = d;
  return {
    ...d,
    yours: { ...yours, rows: f(yours.rows) },
    team: { ...team, rows: f(team.rows) },
    ready: { ...ready, rows: f(ready.rows) },
    ...(upNext === undefined ? {} : { upNext: { ...upNext, rows: f(upNext.rows) } }),
  };
}

/** The dashboard as the text view prints it: every row of yours, team, ready and upNext shows the person through `show`. */
export function dashboardForText(d: Dashboard, show: (email: string) => string): Dashboard {
  return mapRows(d, (rows) => rowsForText(rows, show)) as unknown as Dashboard;
}

/** The dashboard as the JSON prints it in initials mode: `claimedByShown` beside `claimedBy` on every row that holds `claimedBy`, the identity field untouched. Called only in initials mode. */
export function dashboardForJson(d: Dashboard, show: (email: string) => string): Record<string, unknown> {
  return mapRows(d, (rows) => rows.map((r) => (r.claimedBy === undefined ? r : { ...r, claimedByShown: show(r.claimedBy) })));
}
