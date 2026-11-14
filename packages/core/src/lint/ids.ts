import type { Rule } from './rules.js';
import type { AccordConfig } from '../model/snapshot.js';
import { normaliseText } from '../load/frontmatter.js';
import { parseYamlMap } from '../load/yaml.js';
// IDS-1: the ticket id convention `<ST|BUG|EP>-<initials>-<n>`; pure, no I/O.
export const ID_PREFIX = { story: 'ST', bug: 'BUG', epic: 'EP' } as const;

export function initialsOf(people: Record<string, string>, email: string): string | undefined {
  const want = email.toLowerCase();
  const key = Object.keys(people).find((k) => k.toLowerCase() === want);
  return key === undefined ? undefined : people[key];
}

export type IdsConfig = NonNullable<AccordConfig['ids']>;
type TicketType = keyof typeof ID_PREFIX;

/** ST-LN-50 D-05: today's pattern, used when `ids.pattern` is absent. */
export const DEFAULT_PATTERN = '{type}-{initials}-{n}';

/** ST-LN-50 D-05: the prefix `{type}` renders for a ticket type; the three defaults unless `ids.types` sets one. */
export function prefixOf(type: TicketType, ids?: IdsConfig): string {
  return ids?.types?.[type] ?? ID_PREFIX[type];
}

export interface CompiledPattern {
  head: string; // the id up to the number, rendered (`<initials>` stands in when none were given)
  tail: string; // the id after the number
  regex: RegExp; // anchored; group 1 is the number, 1 to 9 digits with no leading zero
}

const escapeLiteral = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * ST-LN-50 D-05: a team pattern (tokens {type}, {initials}, {n}; {n} exactly once) compiled into a bounded matcher.
 * Literal characters are escaped, {n} is at most nine digits and {initials} is the given initials or 2 to 4 capitals,
 * so a raw regular expression is never taken from config and no input can make the match backtrack.
 */
export function compilePattern(pattern: string, prefix: string, initials?: string): CompiledPattern {
  const parts = pattern.split(/(\{type\}|\{initials\}|\{n\})/);
  if (parts.filter((p) => p === '{n}').length !== 1) throw new Error('an id pattern holds {n} exactly once: ' + pattern);
  let head = '';
  let tail = '';
  let source = '';
  let afterN = false;
  for (const part of parts) {
    if (part === '{n}') {
      afterN = true;
      source += '([1-9][0-9]{0,8})';
      continue;
    }
    const text = part === '{type}' ? prefix : part === '{initials}' ? (initials ?? '<initials>') : part;
    source += part === '{initials}' && initials === undefined ? '[A-Z]{2,4}' : escapeLiteral(text);
    if (afterN) tail += text;
    else head += text;
  }
  return { head, tail, regex: new RegExp('^' + source + '$') };
}

/** D-11: the highest number among `seen` that fits the pattern, plus one; a number is never reused, and FEAT-12 is not FEAT-120. */
export function nextTicketId(type: TicketType, initials: string | undefined, seen: readonly string[], ids?: IdsConfig): string {
  const pattern = ids?.pattern ?? DEFAULT_PATTERN;
  if (pattern.includes('{initials}') && initials === undefined) throw new Error('the id pattern ' + pattern + " needs the creator's initials");
  const { head, tail, regex } = compilePattern(pattern, prefixOf(type, ids), initials);
  let max = 0;
  for (const id of seen) {
    const n = regex.exec(id)?.[1];
    if (n !== undefined) max = Math.max(max, Number(n));
  }
  return head + (max + 1) + tail;
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
  const config = snapshot.config;
  if (config === undefined || (config.people === undefined && config.ids === undefined)) return []; // D-08: the convention is on when people or ids exists
  const legacy = config.legacy_ids ?? [];
  const pattern = config.ids?.pattern ?? DEFAULT_PATTERN;
  return Object.values(snapshot.tickets).flatMap((t) => {
    const type = t.frontmatter?.type;
    if (t.frontmatter === undefined || (type !== 'story' && type !== 'bug' && type !== 'epic') || legacy.includes(t.id)) return [];
    const prefix = prefixOf(type, config.ids);
    if (compilePattern(pattern, prefix).regex.test(t.id)) return [];
    // today's wording while no pattern is set; a team's own pattern is quoted as written, with only {type} rendered
    const shown = config.ids?.pattern === undefined ? `${prefix}-<initials>-<n>` : pattern.replace('{type}', prefix);
    return [
      {
        file: t.file,
        pointer: '/id',
        reason: `id "${t.id}" does not follow ${shown} for a ${type}; if it predates the convention, add it to legacy_ids in accord/config.yml`,
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
