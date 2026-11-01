// ST-LN-62: a lane S ticket stays within the scope its scout recorded. Pure rules over the branch diff the host
// loaded (`snapshot.branchFacts`); core reads no git. A rule is silent unless the ticket carries `lane:`.
import { configLists } from '../load/config.js';
import { normaliseText, splitFrontmatter } from '../load/frontmatter.js';
import { headingKey, scan, stripHtmlComments } from '../load/sections.js';
import type { BranchChange, BranchFact, RepoSnapshot } from '../model/snapshot.js';
import type { GateRule } from './rules.js';
import { addedResearch } from './research.js';
import { ledgerFile, laneTicket, reviewFile, workOf } from './work.js';

type BranchRead = Exclude<BranchFact, { error: string }>;

const ticketFile = (id: string) => 'accord/tickets/' + id + '.md';
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The paths a ticket's `## Scope` section lists, one per line, or undefined when it has no such section. */
export function scopeLines(text: string): string[] | undefined {
  const { body, bodyOffset } = splitFrontmatter(normaliseText(text));
  const section = scan(body, bodyOffset).sections.find((s) => headingKey(s.heading) === 'scope');
  if (section === undefined) return undefined;
  return stripHtmlComments(section.lines)
    .map((l) => l.text.trim().replace(/^[-*+]\s+/, '').trim())
    .map((t) => (t.length >= 2 && t.startsWith('`') && t.endsWith('`') ? t.slice(1, -1) : t))
    .map((t) => t.replace(/\\/g, '/'))
    .filter((t) => t !== '');
}

export const factOf = (s: RepoSnapshot, id: string): BranchFact | undefined =>
  s.branchFacts !== undefined && Object.hasOwn(s.branchFacts, id) ? s.branchFacts[id] : undefined;

/** An entry matches a path when it ends in `/` and the path starts with it, or when the two are equal. No globs. */
export const matches = (entry: string, path: string): boolean => (entry.endsWith('/') ? path.startsWith(entry) : entry === path);

/** Ledger Ruling 9: the ticket's own files, the files `accord skills sync` writes, and the merge-base config's `generated:` paths. */
export function isExempt(id: string, fact: BranchRead, path: string, own: readonly string[] = []): boolean {
  if (path === ticketFile(id) || path.startsWith('accord/tickets/' + id + '/')) return true;
  if (own.includes(path)) return true;
  if (fact.synced.includes(path)) return true;
  if (path === '.claude/settings.json') return false;
  return configLists(fact.baseConfig).generated.some((e) => matches(e, path));
}

/** A change that only moves whitespace, blank lines or line endings has `lines: 0` and is never counted (D-02). */
export const isCounted = (c: BranchChange): boolean => c.kind !== 'modified' || c.binary === true || c.lines > 0;

/** Lane S: the counted, non-exempt changed paths outside the recorded scope; `cannot` when no scope can be read. */
export function outsideScope(s: RepoSnapshot, id: string): { paths: string[] } | { cannot: string } | undefined {
  if (laneTicket(s, id)?.frontmatter?.lane !== 'S') return undefined;
  const fact = factOf(s, id);
  if (fact === undefined || 'error' in fact) return undefined;
  if (fact.scope === undefined) {
    return {
      cannot: `no commit on this branch records ac_hash in ${ticketFile(id)}, so the ## Scope that gate ready fixed cannot be read; commit the ticket after accord gate ready ${id}`,
    };
  }
  const { commit, paths } = fact.scope;
  if (paths.length === 0) {
    return {
      cannot: `## Scope held no path when ac_hash was first recorded (commit ${commit}); a lane S ticket lists the files it expects to touch before any change, so it must be lifted to lane M`,
    };
  }
  const own = addedResearch(s, id);
  return {
    paths: fact.changes
      .filter((c) => isCounted(c) && !isExempt(id, fact, c.path, own) && !paths.includes(c.path))
      .map((c) => c.path)
      .sort(cmp),
  };
}

const changesTicket = (fact: BranchRead, id: string): boolean => fact.changes.some((c) => c.path === ticketFile(id));
const hasChanges = (fact: BranchRead): boolean => fact.changes.length > 0;

export const branchUnknown: GateRule['check'] = (s, id) => {
  if (laneTicket(s, id) === undefined) return [];
  const file = ticketFile(id);
  const fact = factOf(s, id);
  if (fact === undefined) return [{ file, reason: 'the host loaded no branch diff for this ticket, so the files it changed cannot be checked' }];
  if ('error' in fact) return [{ file, reason: fact.error }];
  if (!hasChanges(fact)) {
    return [
      {
        file,
        reason: `the branch diff from ${fact.base}, the merge base with the default branch, to HEAD is empty: HEAD adds no change over the merge base; lane work is committed on the ticket's own branch, never on the default branch`,
      },
    ];
  }
  if (laneTicket(s, id)?.frontmatter?.lane === 'S' && !changesTicket(fact, id)) {
    return [
      {
        file,
        reason: `the branch diff from ${fact.base}, the merge base with the default branch, does not change ${file}; lane work is committed on the ticket's own branch, never on the default branch`,
      },
    ];
  }
  return [];
};

export const outOfScope: GateRule['check'] = (s, id) => {
  const fact = factOf(s, id);
  if (fact === undefined || 'error' in fact || !changesTicket(fact, id)) return [];
  const out = outsideScope(s, id);
  if (out === undefined) return [];
  const file = ticketFile(id);
  if ('cannot' in out) return [{ file, reason: out.cannot }];
  const commit = fact.scope?.commit ?? '';
  const work = workOf(s, id);
  const declared = new Set((work?.ledger?.wordingOnly ?? []).map((w) => w.path));
  const confirmed = work?.review?.confirmed ?? [];
  return out.paths.flatMap((p) => {
    if (!declared.has(p)) {
      return [{ file, reason: `${p} is changed on this branch but not listed in ## Scope as recorded at commit ${commit}; the ticket must be lifted to lane M` }];
    }
    const why = wordingOnlyFault(fact.changes.find((c) => c.path === p), p, confirmed, id);
    return why === undefined ? [] : [{ file, reason: `${p} is declared wording-only in ${ledgerFile(id)} but ${why}; the ticket must be lifted to lane M` }];
  });
};

/** The base entries of `sensitive:` then the HEAD entries, in key order, each (area, path) pair once. */
export function sensitiveEntries(s: RepoSnapshot, fact: BranchRead): { area: string; path: string }[] {
  const head = Object.entries(s.config?.sensitive ?? {}).flatMap(([area, paths]) => paths.map((path) => ({ area, path })));
  const seen = new Set<string>();
  return [...configLists(fact.baseConfig).sensitive, ...head].filter((e) => {
    const key = e.area + '\0' + e.path;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Lane S: a counted change under a listed sensitive entry fails, whatever its scope, declaration or exemption (D-04, Ruling 29). */
export const sensitiveTouched: GateRule['check'] = (s, id) => {
  if (laneTicket(s, id)?.frontmatter?.lane !== 'S') return [];
  const fact = factOf(s, id);
  if (fact === undefined || 'error' in fact) return [];
  const entries = sensitiveEntries(s, fact);
  const file = ticketFile(id);
  return fact.changes
    .filter(isCounted)
    .flatMap((c) => {
      const hit = entries.find((e) => matches(e.path, c.path));
      return hit === undefined
        ? []
        : [{ file, reason: `${c.path} is in the sensitive area ${hit.area} (accord/config.yml lists ${hit.path} under sensitive); the ticket must be lifted to lane M` }];
    });
};

/** Ledger Ruling 13: an added line that calls a commander-style `command` or `option`. */
export const CALL_SIGN = /\.(command|option)\(/;

/** The keys of the `exports` or `bin` map of a package.json text; a string value counts as the key `.`. */
function keysOf(text: string | undefined, map: 'exports' | 'bin'): string[] {
  if (text === undefined) return [];
  try {
    const value: unknown = (JSON.parse(text) as Record<string, unknown> | null)?.[map];
    if (typeof value === 'string') return ['.'];
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.keys(value) : [];
  } catch {
    return [];
  }
}

const isPackageJson = (path: string): boolean => path === 'package.json' || path.endsWith('/package.json');

/** Ledger Ruling 20: a call sign is read only in a non-Markdown file the ticket's own exemptions do not cover. */
const callsOf = (c: BranchChange, id: string, fact: BranchRead): string[] =>
  c.calls === undefined || /\.(md|markdown)$/i.test(c.path) || isExempt(id, fact, c.path)
    ? []
    : [...new Set(c.calls.flatMap((l) => [...l.matchAll(new RegExp(CALL_SIGN.source, 'g'))].map((m) => m[1])))];

/** D-04: signs of a new interface in paths no sensitive entry matches; undefined without a lane ticket or a readable diff. */
export function interfaceSigns(s: RepoSnapshot, id: string): { path: string; sign: string }[] | undefined {
  if (laneTicket(s, id) === undefined) return undefined;
  const fact = factOf(s, id);
  if (fact === undefined || 'error' in fact) return undefined;
  const entries = sensitiveEntries(s, fact);
  const out: { path: string; sign: string }[] = [];
  for (const c of fact.changes) {
    if (entries.some((e) => matches(e.path, c.path))) continue;
    const add = (sign: string) => out.push({ path: c.path, sign });
    if (c.kind === 'added' && (c.path.split('/').slice(0, -1).includes('schemas') || c.path.endsWith('.schema.json'))) add('a new schema file');
    if (isPackageJson(c.path)) {
      for (const map of ['exports', 'bin'] as const) {
        const before = keysOf(c.pkg?.base, map);
        keysOf(c.pkg?.head, map)
          .filter((k) => !before.includes(k))
          .forEach((k) => add(`a new key "${k}" in the ${map} map of package.json`));
      }
    }
    callsOf(c, id, fact).forEach((name) => add(`an added line that calls .${name}(`));
  }
  return out.sort((a, b) => cmp(a.path, b.path) || cmp(a.sign, b.sign));
}

export const interfaceSign: GateRule['check'] = (s, id) => {
  const signs = interfaceSigns(s, id);
  if (signs === undefined) return [];
  const file = ticketFile(id);
  if (laneTicket(s, id)?.frontmatter?.lane === 'S') {
    return signs.map(({ path, sign }) => ({ file, reason: `${path} adds ${sign}, a sign of a new interface; the ticket must be lifted to lane M` }));
  }
  const excused = workOf(s, id)?.review?.notInterface ?? [];
  return signs
    .filter(({ path }) => !excused.includes(path))
    .map(({ path, sign }) => ({
      file,
      reason: `${path} adds ${sign}, a sign of a new interface no sensitive entry matches; add an entry matching it under sensitive: in accord/config.yml, or have the reviewer record "Not an interface: ${path} — <reason>" in the last ## Round of ${reviewFile(id)}`,
    }));
};

/** D-02, D-07: why a declared wording-only file does not qualify, or undefined when it does. */
function wordingOnlyFault(c: BranchChange | undefined, path: string, confirmed: string[], id: string): string | undefined {
  if (c?.kind === 'added') return 'is new';
  if (c?.kind === 'deleted') return 'is deleted';
  if (c?.kind === 'type' || c?.kind === 'mode') return 'changes its file type or mode';
  if (c?.binary === true) return 'is binary';
  if (c !== undefined && c.lines > 3) return `changes ${c.lines} lines, more than 3`;
  if (!confirmed.includes(path)) return `has no "Confirmed wording-only: ${path}" line in the last ## Round of ${reviewFile(id)}`;
  return undefined;
}
