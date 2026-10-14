import { normaliseText } from '../load/frontmatter.js';
import { parseYamlMap } from '../load/yaml.js';
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

/** D-17: only `people` is read from a config.yml text; any problem gives undefined, never a throw. */
export function peopleOf(text: string): Record<string, string> | undefined {
  try {
    const people = parseYamlMap('accord/config.yml', normaliseText(text), 0).map?.people;
    if (typeof people !== 'object' || people === null || Array.isArray(people)) return undefined;
    return Object.values(people).every((v) => typeof v === 'string') ? (people as Record<string, string>) : undefined;
  } catch {
    return undefined;
  }
}

/** D-17/D-18: the other email holding `initials`; the default ref alone decides when it holds them. */
export function initialsHolder(
  initials: string,
  email: string,
  byRef: Record<string, Record<string, string>>,
  defaultRef: string | undefined,
): string | undefined {
  const want = email.toLowerCase();
  const holder = (map: Record<string, string> | undefined): string | undefined =>
    Object.keys(map ?? {}).find((k) => map?.[k] === initials && k.toLowerCase() !== want);
  const def = defaultRef === undefined ? undefined : byRef[defaultRef];
  if (def !== undefined && Object.values(def).includes(initials)) return holder(def);
  for (const ref of Object.keys(byRef).sort()) {
    const h = holder(byRef[ref]);
    if (h !== undefined) return h;
  }
  return undefined;
}
