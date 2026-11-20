// Phase 8.2 D-07, D-08: how a person is shown. One display function, called by every view that prints a person: `accord audit` here, and the dashboard, the status table and the panel
// in the next plan. The identity stays the email everywhere (`claimedBy`, `holder`); only the text a person reads changes, and a machine format never carries the shown form in place of it.
// Pure: no spawn, no filesystem; `load/who.ts` reads the setting from git config.

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
