// ST-LN-13 D-08, D-09: a research record the ticket lists and the branch adds counts as one of the ticket's own files.
import { isResearchRecord } from '../load/research.js';
import type { RepoSnapshot } from '../model/snapshot.js';

/**
 * The entries of the ticket's `research:` key that are Markdown records under accord/research/ and that the branch
 * adds (relative to the merge base). Empty when the ticket, the branch fact or its changes are missing.
 */
export function addedResearch(snapshot: RepoSnapshot, id: string): string[] {
  const ticket = Object.hasOwn(snapshot.tickets, id) ? snapshot.tickets[id] : undefined;
  const listed = ticket?.frontmatter?.research;
  const facts = snapshot.branchFacts;
  const fact = facts !== undefined && Object.hasOwn(facts, id) ? facts[id] : undefined;
  if (listed === undefined || fact === undefined || 'error' in fact || !Array.isArray(fact.changes)) return [];
  const added = new Set(fact.changes.filter((c) => c.kind === 'added').map((c) => c.path));
  return listed.filter((p) => isResearchRecord(p) && added.has(p));
}
