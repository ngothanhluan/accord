// IDS-1: the ticket id convention `<ST|BUG|EP>-<initials>-<n>`; pure, no I/O.
export const ID_PREFIX = { story: 'ST', bug: 'BUG', epic: 'EP' } as const;

export function initialsOf(people: Record<string, string>, email: string): string | undefined {
  const want = email.toLowerCase();
  const key = Object.keys(people).find((k) => k.toLowerCase() === want);
  return key === undefined ? undefined : people[key];
}

/** D-11: the creator's highest number for this type among `seen`, plus one; a number is never reused. */
export function nextTicketId(type: keyof typeof ID_PREFIX, initials: string, seen: readonly string[]): string {
  const head = `${ID_PREFIX[type]}-${initials}-`;
  let max = 0;
  for (const id of seen) {
    if (id.startsWith(head) && /^[1-9][0-9]*$/.test(id.slice(head.length))) max = Math.max(max, Number(id.slice(head.length)));
  }
  return head + (max + 1);
}
