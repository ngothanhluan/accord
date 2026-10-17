// CLI-05 status rows (D-91, D-92, D-93): document data plus the two cheap derived columns.
// A row is a trace of what is written in the files, never a verdict — a verdict comes from `gate ready`.
import type { RepoSnapshot } from '../model/snapshot.js';
import { lintSnapshot } from '../lint/index.js';
import { scoped } from '../gate/index.js';
import { acHash } from '../gate/hash.js';
import { DEFAULT_BRANCH_TEMPLATE } from './branch.js';
import { isDone, progressOf } from './stage.js';
import type { Stage } from './stage.js';

export interface StatusRow {
  id: string; // file stem: 'LOGIN-1'
  type?: 'epic' | 'story' | 'bug'; // absent when the frontmatter failed the schema
  status?: 'draft' | 'open' | 'archived' | 'dropped'; // absent when the frontmatter failed the schema; 'archived' and 'dropped' are the D-93 filter
  parent?: string; // the D-92 grouping axis
  ui: boolean; // D-21: the loader defaults it to false
  errors: number; // ticket-scoped error findings from the one repo-wide lint
  warnings: number; // ticket-scoped warning findings from the same lint
  ready: 'none' | 'ok' | 'stale'; // frontmatter ac_hash against acHash(scenarios); no ac_hash recorded is 'none'
  ticksVerified: number; // verified.length
  ticksTagged: number; // scenarios carrying an @ac-n tag
  ticksBinding: 'none' | 'bound' | 'stale'; // frontmatter verified_hash against acHash(scenarios) (D-76)
  tracker?: Record<string, string>; // adapter-keyed ids, values always strings
  // Spec §3-§6: set on lane tickets only, so a 0.1.0 ticket's row is byte-identical to 0.1.0.
  title?: string; // ST-LN-2 D-07: lane rows only, so a 0.1.0 row stays byte-identical
  lane?: 'M' | 'L' | 'P';
  stage?: Stage;
  tasksDone?: number;
  tasksTotal?: number;
  dependsOn?: string[]; // spec §5, as written
  blockedBy?: string[]; // dependsOn entries whose ticket is not done; an unknown id blocks
  claimedBy?: string; // host-supplied author of the claim branch
  branch?: string; // the claim branch, or the name a new claim would use
  idleDays?: number; // whole days since the newest activity, present only when greater than stale_days
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
 * `plain` is the checkout-only snapshot: a dependency counts as done only there (spec §5, BUG-LN-2 D-04).
 * Pure: reads the snapshot only, never mutates it, and returns the same result on every call.
 */
export function statusRows(snapshot: RepoSnapshot, now?: number, plain?: RepoSnapshot): StatusRow[] {
  const { findings } = lintSnapshot(snapshot);
  return Object.values(snapshot.tickets)
    .map((ticket): StatusRow => {
      const fm = ticket.frontmatter;
      const mine = scoped(findings, ticket.id);
      const hash = acHash(ticket.scenarios);
      const progress = progressOf(snapshot, ticket);
      const deps = fm?.depends_on;
      const claims = snapshot.claims;
      const last = snapshot.lastActivity?.[ticket.id];
      const idle = now === undefined || last === undefined ? undefined : Math.floor((now - last) / 86400);
      const open = fm?.status !== 'dropped' && fm?.status !== 'archived' && progress?.stage !== 'done';
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
        // Lane rows only, so a 0.1.0 row never moves; progress is undefined exactly when lane is, the two
        // checks are for type narrowing.
        ...(fm?.lane === undefined || progress === undefined
          ? {}
          : {
              title: fm.title,
              lane: fm.lane,
              stage: progress.stage,
              tasksDone: progress.tasksDone,
              tasksTotal: progress.tasksTotal,
              ...(deps === undefined ? {} : { dependsOn: deps, blockedBy: deps.filter((d) => !isDone(plain ?? snapshot, d)) }),
              ...(claims !== undefined && Object.hasOwn(claims, ticket.id) ? { claimedBy: claims[ticket.id] } : {}),
              branch:
                snapshot.claimBranches !== undefined && Object.hasOwn(snapshot.claimBranches, ticket.id)
                  ? snapshot.claimBranches[ticket.id]
                  : (snapshot.claimTemplate ?? DEFAULT_BRANCH_TEMPLATE).replace('{id}', ticket.id),
              ...(open && idle !== undefined && idle > Number(snapshot.config?.stale_days ?? '14') ? { idleDays: idle } : {}),
            }),
      };
    })
    // Outline order: a parentless row keys on its own id, so a parent sorts into the same
    // group as its children instead of into a separate block of orphans above them.
    .sort((a, b) => cmp(a.parent ?? a.id, b.parent ?? b.id) || cmp(a.id, b.id));
}

/**
 * Spec §6 `accord next`: lane tickets that passed Ready (approved at the current hash, and `ac_hash`,
 * which only a passing `gate ready` writes, matching the current criteria), have no task recorded yet, are not archived, wait on no dependency, and are unclaimed.
 */
export function nextRows(rows: StatusRow[]): StatusRow[] {
  return rows.filter(
    (r) =>
      (r.stage === 'plan' || r.stage === 'build') &&
      r.tasksDone === 0 &&
      r.ready === 'ok' &&
      (r.blockedBy ?? []).length === 0 &&
      r.claimedBy === undefined &&
      r.status !== 'archived' &&
      r.status !== 'dropped',
  );
}
