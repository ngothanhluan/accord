// Claim branch naming (ST-LN-1). Pure: the CLI loader does the git work.
import { normaliseText, splitFrontmatter } from '../load/frontmatter.js';
import { parseYamlMap } from '../load/yaml.js';
import type { AccordConfig } from '../model/snapshot.js';
import { breaksConvention, trackerKeyOk } from '../lint/ids.js';
import { validate } from '../validate/index.js';
/** The template of a claim branch when config.yml sets none. */
export const DEFAULT_BRANCH_TEMPLATE = 't/{id}';

/** Issue #341 D-04: the words `{type}` may take when config.yml sets no `branch_types`, in the order the docs list them. */
export const DEFAULT_BRANCH_TYPES = ['feat', 'fix', 'refactor', 'perf', 'docs', 'test', 'build', 'ci', 'chore', 'revert', 'hotfix'] as const;

/** Issue #341 D-03: the longest `{slug}` when config.yml sets no `branch_slug_length`. */
const DEFAULT_SLUG_LENGTH = 40;

/** R-2: the slug of a title that has no ASCII letter or digit, so a name never ends on a separator. */
const EMPTY_SLUG = 'ticket';

/** R-13: a name longer than this is not matched by a template with `{slug}`, which bounds the scan of a crafted ref name. */
const MAX_SLUG_NAME = 255;

/** D-07: only a valid `branch` is read from a config.yml text; any problem gives undefined, never a throw. */
export function branchTemplateOf(text: string): string | undefined {
  try {
    const map = parseYamlMap('accord/config.yml', normaliseText(text), 0).map;
    const branch = map?.branch;
    if (typeof branch !== 'string') return undefined;
    return validate('config', map).some((f) => f.pointer === '/branch') ? undefined : branch;
  } catch {
    return undefined;
  }
}

/** Issue #341 D-04: the words `{type}` may take under `config`: its `branch_types`, else the default list. */
export function branchTypesOf(config?: Pick<AccordConfig, 'branch_types'>): string[] {
  return config?.branch_types ?? [...DEFAULT_BRANCH_TYPES];
}

/**
 * Issue #341 D-03: the title as an ASCII kebab-case slug. Lower case, the accent marks NFKD splits off removed, every run of
 * characters outside a-z and 0-9 (a non-ASCII letter with no mark to remove included) one hyphen, no hyphen at either end,
 * cut at `length` characters with no hyphen left at the cut. A title with nothing to keep gives the empty string.
 */
export function slugOf(title: string, length: number): string {
  const kebab = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return kebab.slice(0, Math.max(0, length)).replace(/-+$/, '');
}

/**
 * Issue #341 D-03, D-08: the claim branch name of a ticket: `{id}` is its id, `{slug}` its title through slugOf at the config's
 * `branch_slug_length` (R-2: `ticket` when nothing is left), `{type}` its `change:` word when `branch_types` lists it. R-4: with no
 * listed word the literal `{type}` stays, so the caller can tell and refuse; no type is ever guessed.
 */
export function renderBranch(template: string, fields: { id: string; title?: string; change?: string }, config?: Pick<AccordConfig, 'branch_types' | 'branch_slug_length'>): string {
  const length = Number(config?.branch_slug_length ?? DEFAULT_SLUG_LENGTH);
  return template
    .replace('{id}', () => fields.id)
    .replace('{slug}', () => slugOf(fields.title ?? '', length) || EMPTY_SLUG)
    .replace('{type}', (token) => (fields.change !== undefined && branchTypesOf(config).includes(fields.change) ? fields.change : token));
}

/**
 * Issue #341 D-11: the templates with every `{type}` written out once per listed word, so a name is found only by a word of
 * `branch_types`; a template without `{type}` stays; a template that repeats an earlier one is dropped.
 */
export function expandBranchTypes(templates: readonly string[], words: readonly string[]): string[] {
  const out: string[] = [];
  for (const template of templates) {
    for (const t of template.includes('{type}') ? words.map((w) => template.replace('{type}', () => w)) : [template]) {
      if (!out.includes(t)) out.push(t);
    }
  }
  return out;
}

/** Issue #341 D-07: the `git for-each-ref` glob of an expanded template: `{id}` and `{slug}` become `*`. */
export function branchGlob(template: string): string {
  return template.replace('{id}', '*').replace('{slug}', '*');
}

/** Issue #341 D-08: the title and `change:` of a ticket's frontmatter text, read even when it fails its schema; a field that is missing or not a string is left out; never throws. */
export function branchFieldsOf(ticketText: string): { title?: string; change?: string } {
  try {
    const yaml = splitFrontmatter(normaliseText(ticketText)).yaml;
    if (yaml === null) return {};
    const map = parseYamlMap('accord/tickets', yaml, 0).map;
    return {
      ...(typeof map?.title === 'string' ? { title: map.title } : {}),
      ...(typeof map?.change === 'string' ? { change: map.change } : {}),
    };
  } catch {
    return {};
  }
}

const escapeLiteral = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** An anchored matcher for the literal text of a template side; `{slug}` is one or more characters of one path segment. */
const sideRegex = (side: string): RegExp => new RegExp('^' + side.split('{slug}').map(escapeLiteral).join('[^/]+') + '$');

/**
 * Issue #341 D-07, D-11: every id a branch `name` can carry under one (already expanded) `template`, shortest first, or none.
 * `{id}` must be in the template exactly once and `{type}` gone (D-11: never a wildcard). A `t/` name is read only through
 * `t/{id}`. Without `{slug}` the id is the one slice between the fixed prefix and suffix, as before. With `{slug}` (one or more
 * characters of one path segment) ids hold hyphens, so every slice whose left and right sides fit is a candidate, and
 * pickBranchId chooses. No id holds a `/`. R-13: a name over 255 characters has no candidate under a `{slug}` template.
 */
export function branchIdCandidates(name: string, template: string): string[] {
  if (name.startsWith('t/') && template !== DEFAULT_BRANCH_TEMPLATE) return [];
  if (template.includes('{type}')) return [];
  const parts = template.split('{id}');
  if (parts.length !== 2) return [];
  const [pre, suf] = parts as [string, string];
  if (!template.includes('{slug}')) {
    if (!name.startsWith(pre) || !name.endsWith(suf) || name.length <= pre.length + suf.length) return [];
    const id = name.slice(pre.length, name.length - suf.length);
    return id.includes('/') ? [] : [id];
  }
  if (name.length > MAX_SLUG_NAME) return [];
  const left = sideRegex(pre);
  const right = sideRegex(suf);
  const starts: number[] = [];
  const ends: number[] = [];
  for (let i = 1; i < name.length; i++) {
    if (left.test(name.slice(0, i))) starts.push(i);
    if (right.test(name.slice(i))) ends.push(i);
  }
  const found: string[] = [];
  for (const s of starts) {
    for (const e of ends) {
      if (e <= s) continue;
      const id = name.slice(s, e);
      if (!id.includes('/') && !found.includes(id)) found.push(id);
    }
  }
  return found.sort((a, b) => a.length - b.length);
}

/** The part of a config that says what a ticket id looks like. */
type IdShapeConfig = Pick<AccordConfig, 'people' | 'ids' | 'legacy_ids'>;

/** Whether `id` has the shape this repository's ids have: a `legacy_ids` entry, a tracker key in tracker mode, else a fit of the id convention while it is on (`people` or `ids` set). */
function idShaped(id: string, config: IdShapeConfig | undefined): boolean {
  if (config === undefined) return false;
  if (config.legacy_ids?.includes(id) === true) return true;
  if (config.ids?.mode === 'tracker') return trackerKeyOk(id, config.ids);
  if (config.people === undefined && config.ids === undefined) return false;
  return !breaksConvention(id, undefined, config as AccordConfig);
}

/**
 * Issue #341 D-07a, R-12: the id of a branch among its `candidates` (shortest first): the first the repository `known`s, else the
 * first of this repository's id shape, else the first. Pure, no git process.
 */
export function pickBranchId(candidates: readonly string[], known: (id: string) => boolean, config?: IdShapeConfig): string | undefined {
  return candidates.find(known) ?? candidates.find((id) => idShaped(id, config)) ?? candidates[0];
}
