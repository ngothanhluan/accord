// CLI-05 status rows (D-91, D-92, D-93): document data plus the two cheap derived columns.
// A row is a trace of what is written in the files, never a verdict — a verdict comes from `gate ready`.
import type { RepoSnapshot } from '../model/snapshot.js';
import { lintSnapshot } from '../lint/index.js';
import { scoped } from '../gate/index.js';
import { acHash } from '../gate/hash.js';

export interface StatusRow {
  id: string; // file stem: 'LOGIN-1'
  type?: 'epic' | 'story' | 'bug'; // absent when the frontmatter failed the schema
  status?: 'draft' | 'open' | 'archived'; // absent when the frontmatter failed the schema; 'archived' is the D-93 filter
  parent?: string; // the D-92 grouping axis
  ui: boolean; // D-21: the loader defaults it to false
  errors: number; // ticket-scoped error findings from the one repo-wide lint
  warnings: number; // ticket-scoped warning findings from the same lint
  ready: 'none' | 'ok' | 'stale'; // frontmatter ac_hash against acHash(scenarios); no ac_hash recorded is 'none'
  ticksVerified: number; // verified.length
  ticksTagged: number; // scenarios carrying an @ac-n tag
  ticksBinding: 'none' | 'bound' | 'stale'; // frontmatter verified_hash against acHash(scenarios) (D-76)
  tracker?: Record<string, string>; // adapter-keyed ids, values always strings
}

// Code-point order, never a locale-aware compare, so the goldens are identical on every host.
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** 'none' when nothing is recorded, 'ok'/'bound' on an exact match, 'stale' otherwise. */
const compare = <T extends string>(recorded: string | undefined, current: string | undefined, match: T) =>
  recorded === undefined ? 'none' : recorded === current ? match : 'stale';

/**
 * D-91: one `lintSnapshot` for the whole repository, split per ticket by `scoped`. `gateReady` and
 * `gateDone` are deliberately not called — a real gate for N tickets is N full-repo lints, and most
 * in-flight tickets would render fail: accurate and useless.
 *
 * Every ticket is returned, archived included; the D-93 filter and the `—` glyphs are the caller's.
 * Pure: reads the snapshot only, never mutates it, and returns the same result on every call.
 */
export function statusRows(snapshot: RepoSnapshot): StatusRow[] {
  const { findings } = lintSnapshot(snapshot);
  return Object.values(snapshot.tickets)
    .map((ticket): StatusRow => {
      const fm = ticket.frontmatter;
      const mine = scoped(findings, ticket.id);
      const hash = acHash(ticket.scenarios);
      return {
        id: ticket.id,
        // D-54: optional fields are omitted, never set to undefined, so JSON.stringify is a stable golden.
        ...(fm?.type === undefined ? {} : { type: fm.type }),
        ...(fm?.status === undefined ? {} : { status: fm.status }),
        ...(fm?.parent === undefined ? {} : { parent: fm.parent }),
        ui: fm?.ui ?? false,
        errors: mine.filter((f) => f.level === 'error').length,
        warnings: mine.filter((f) => f.level === 'warning').length,
        ready: compare(fm?.ac_hash, hash, 'ok'),
        ticksVerified: fm?.verified?.length ?? 0,
        ticksTagged: ticket.scenarios.filter((s) => s.acTag !== undefined).length,
        ticksBinding: compare(fm?.verified_hash, hash, 'bound'),
        ...(fm?.tracker === undefined ? {} : { tracker: fm.tracker }),
      };
    })
    // Outline order: a parentless row keys on its own id, so a parent sorts into the same
    // group as its children instead of into a separate block of orphans above them.
    .sort((a, b) => cmp(a.parent ?? a.id, b.parent ?? b.id) || cmp(a.id, b.id));
}
