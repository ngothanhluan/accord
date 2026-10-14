import type { Rule } from './rules.js';
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

export const idConvention: Rule['check'] = (snapshot) => {
  if (snapshot.config?.people === undefined) return []; // D-08
  const legacy = snapshot.config.legacy_ids ?? [];
  return Object.values(snapshot.tickets).flatMap((t) => {
    const type = t.frontmatter?.type;
    if (t.frontmatter === undefined || (type !== 'story' && type !== 'bug' && type !== 'epic') || legacy.includes(t.id)) return [];
    const prefix = ID_PREFIX[type];
    if (new RegExp(`^${prefix}-[A-Z]{2,4}-[1-9][0-9]*$`).test(t.id)) return [];
    return [
      {
        file: t.file,
        pointer: '/id',
        reason: `id "${t.id}" does not follow ${prefix}-<initials>-<n> for a ${type}; if it predates the convention, add it to legacy_ids in accord/config.yml`,
      },
    ];
  });
};

export const initialsDuplicate: Rule['check'] = (snapshot) => {
  const people = snapshot.config?.people;
  if (people === undefined) return [];
  const group = (key: (email: string) => string): string[][] => {
    const by = new Map<string, string[]>();
    for (const email of Object.keys(people)) by.set(key(email), [...(by.get(key(email)) ?? []), email]);
    return [...by.entries()].filter(([, v]) => v.length > 1).map(([k, v]) => [k, ...v]);
  };
  const at = { file: 'accord/config.yml', pointer: '/people' };
  return [
    ...group((e) => people[e] ?? '').map(([ini, ...emails]) => ({
      ...at,
      reason: `initials "${ini}" belong to ${emails.join(', ')}; each person needs their own`,
    })),
    ...group((e) => e.toLowerCase()).map(([, ...emails]) => ({
      ...at,
      reason: `${emails.join(' and ')} differ only in case and count as one person; keep one`,
    })),
  ];
};
