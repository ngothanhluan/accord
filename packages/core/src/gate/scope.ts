// ST-LN-62: a lane S ticket stays within the scope its scout recorded. Pure rules over the branch diff the host
// loaded (`snapshot.branchFacts`); core reads no git. A rule is silent unless the ticket carries `lane:`.
import { configLists } from '../load/config.js';
import { normaliseText, splitFrontmatter } from '../load/frontmatter.js';
import { headingKey, scan, stripHtmlComments } from '../load/sections.js';
import type { BranchChange, BranchFact, RepoSnapshot } from '../model/snapshot.js';
import type { GateRule } from './rules.js';
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
export function isExempt(id: string, fact: BranchRead, path: string): boolean {
  if (path === ticketFile(id) || path.startsWith('accord/tickets/' + id + '/')) return true;
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
  return {
    paths: fact.changes
      .filter((c) => isCounted(c) && !isExempt(id, fact, c.path) && !paths.includes(c.path))
      .map((c) => c.path)
      .sort(cmp),
  };
}

const changesTicket = (fact: BranchRead, id: string): boolean => fact.changes.some((c) => c.path === ticketFile(id));

export const branchUnknown: GateRule['check'] = (s, id) => {
  if (laneTicket(s, id) === undefined) return [];
  const file = ticketFile(id);
  const fact = factOf(s, id);
  if (fact === undefined) return [{ file, reason: 'the host loaded no branch diff for this ticket, so the files it changed cannot be checked' }];
  if ('error' in fact) return [{ file, reason: fact.error }];
  if (changesTicket(fact, id)) return [];
  return [
    {
      file,
      reason: `the branch diff from ${fact.base}, the merge base with the default branch, does not change ${file}; lane work is committed on the ticket's own branch, never on the default branch`,
    },
  ];
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
