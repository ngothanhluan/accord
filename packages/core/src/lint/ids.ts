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

// the schema's own patterns for a people entry (packages/core/schemas/config.schema.json): a hostile branch cannot hand out other initials
const PEOPLE_KEY = /^[^@\s]+@[^@\s]+$/;
const PEOPLE_INITIALS = /^[A-Z]{2,4}$/;

/**
 * G-07-2 (A-2): the creator's people entry as the refs list it, when this checkout does not. The default ref wins whenever it
 * lists the email; otherwise every other ref that lists it must give the same initials (the first in sorted order is returned),
 * else the refs and initials in conflict, sorted by ref. An entry whose key or initials break the schema patterns counts as
 * not listing. Keys compare without case; the key returned is spelled as the ref spells it.
 */
export function initialsOnRefs(
  email: string,
  byRef: Record<string, Record<string, string>>,
  defaultRef: string | undefined,
): { key: string; initials: string; ref: string } | { conflict: { ref: string; initials: string }[] } | undefined {
  const want = email.toLowerCase();
  const entryOf = (map: Record<string, string> | undefined): { key: string; initials: string } | undefined => {
    for (const key of Object.keys(map ?? {})) {
      const initials = map?.[key];
      if (initials !== undefined && PEOPLE_KEY.test(key) && key.toLowerCase() === want && PEOPLE_INITIALS.test(initials)) return { key, initials };
    }
    return undefined;
  };
  const def = defaultRef === undefined ? undefined : entryOf(byRef[defaultRef]);
  if (defaultRef !== undefined && def !== undefined) return { ...def, ref: defaultRef };
  const hits: { ref: string; key: string; initials: string }[] = [];
  for (const ref of Object.keys(byRef).sort()) {
    if (ref === defaultRef) continue;
    const hit = entryOf(byRef[ref]);
    if (hit !== undefined) hits.push({ ref, ...hit });
  }
  if (hits.length === 0) return undefined;
  if (hits.every((h) => h.initials === hits[0].initials)) return { key: hits[0].key, initials: hits[0].initials, ref: hits[0].ref };
  return { conflict: hits.map((h) => ({ ref: h.ref, initials: h.initials })) };
}

/** ST-LN-50 D-05 tracker mode: a Jira project key or Linear team key, a hyphen, then the issue number (bounded, no leading zero). */
export const TRACKER_KEY = /^[A-Z][A-Z0-9_]{0,19}-[1-9][0-9]{0,8}$/;

/** ST-LN-50 D-05: the key has the tracker form and, when `ids.projects` is set, its project is on the list. */
export function trackerKeyOk(key: string, ids?: IdsConfig): boolean {
  if (!TRACKER_KEY.test(key)) return false;
  return ids?.projects === undefined || ids.projects.includes(key.slice(0, key.lastIndexOf('-')));
}

/** ST-LN-50 D-05: what a legacy_ids entry may be, the ticket schema's own id form. */
export const LEGACY_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const TYPES = ['story', 'bug', 'epic'] as const;

/**
 * ST-LN-50 D-05: whether `id` breaks the convention `config` sets (legacy_ids is not looked at here). One predicate for
 * lint and for the legacy_ids `accord config` fills in. An id whose type is not known (seen only in history) breaks a
 * pattern only when it fits it for none of the three types.
 */
export function breaksConvention(id: string, type: TicketType | undefined, config: AccordConfig): boolean {
  if (config.ids?.mode === 'tracker') return !trackerKeyOk(id, config.ids);
  const pattern = config.ids?.pattern ?? DEFAULT_PATTERN;
  return !(type === undefined ? TYPES : [type]).some((t) => compilePattern(pattern, prefixOf(t, config.ids)).regex.test(id));
}

/** ST-LN-50 D-05: the convention a config sets as a comparable string, or undefined while it is off (neither `people` nor `ids`). */
export function conventionKey(config: AccordConfig | undefined): string | undefined {
  if (config === undefined || (config.people === undefined && config.ids === undefined)) return undefined;
  if (config.ids?.mode === 'tracker') return JSON.stringify(['tracker', config.ids.projects ?? null]);
  return JSON.stringify(['pattern', config.ids?.pattern ?? DEFAULT_PATTERN, TYPES.map((t) => prefixOf(t, config.ids))]);
}

export const idConvention: Rule['check'] = (snapshot) => {
  const config = snapshot.config;
  if (config === undefined || (config.people === undefined && config.ids === undefined)) return []; // D-08: the convention is on when people or ids exists
  const legacy = config.legacy_ids ?? [];
  if (config.ids?.mode === 'tracker') {
    // the id is the tracker's key: only its form and project are checked, whatever the ticket's type
    const projects = config.ids.projects;
    return Object.values(snapshot.tickets).flatMap((t) =>
      t.frontmatter === undefined || legacy.includes(t.id) || trackerKeyOk(t.id, config.ids)
        ? []
        : [
            {
              file: t.file,
              pointer: '/id',
              reason: `id "${t.id}" is not a tracker key (<PROJECT>-<number>)${projects === undefined ? '' : ' of ' + projects.join(', ')}; if it predates tracker mode, add it to legacy_ids in accord/config.yml`,
            },
          ],
    );
  }
  const pattern = config.ids?.pattern ?? DEFAULT_PATTERN;
  return Object.values(snapshot.tickets).flatMap((t) => {
    const type = t.frontmatter?.type;
    if (t.frontmatter === undefined || (type !== 'story' && type !== 'bug' && type !== 'epic') || legacy.includes(t.id)) return [];
    if (!breaksConvention(t.id, type, config)) return [];
    const prefix = prefixOf(type, config.ids);
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
