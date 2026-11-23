// What `accord new ticket` and its one-step form `--split` (ST-LN-28 D-14) both do before a file is written: the id convention,
// the used ids, the creator's initials, the config check, the related ids and the similar-ticket check (ST-LN-22 D-08). Moved
// out of new-ticket.ts unchanged so split.ts can use them without importing new-ticket.ts, which imports split.ts.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_PATTERN, initialsHolder, initialsOnRefs, loadSnapshot, SAFE_ID, similarTickets, ticketFacts } from '@accord-dev/accord-core';
import { doneRef, gitIsShallow, gitPeopleOnRefs, gitTicketIdsInHistory, gitUserEmail, loadRefInput, UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';

export type Snapshot = CommandContext['snapshot'];

// The ticket schema's own id pattern (packages/core/schemas/ticket.schema.json), written once in core (`LEGACY_ID`, exported as `SAFE_ID`; Phase 08.8 D-17 IN-04).
export const ID = SAFE_ID;
export const PLACEHOLDER = 'TICKET-ID';

/** The default branch as the clone holds it, read from git with no checkout, for the tickets a working tree may not have yet (`accord related` reads it too). */
export function withDefaultBranch(ctx: CommandContext): Snapshot {
  const ref = doneRef(ctx.root);
  return ref === undefined ? ctx.snapshot : { ...ctx.snapshot, defaultRef: { ref, snapshot: loadSnapshot(loadRefInput(ctx.root, ref)) } };
}

/** An invalid `people` value leaves config undefined, which would read as the convention being off: refuse it, naming the file and line. */
export function refuseBadConfig(ctx: CommandContext): void {
  let raw = '';
  try {
    raw = readFileSync(join(ctx.root, 'accord', 'config.yml'), 'utf8');
  } catch {
    // absent counts as empty
  }
  const bad = /^(?:people|ids|template|titles)\s*:/m.test(raw)
    ? ctx.snapshot.errors.find((f) => f.file === 'accord/config.yml' && f.rule !== 'load.config-missing')
    : undefined;
  if (bad !== undefined) {
    const where = [bad.line === undefined ? '' : ':' + bad.line, bad.pointer ? ' ' + bad.pointer : ''].join('');
    throw new UsageError('accord/config.yml' + where + ' ' + bad.reason + ' - fix accord/config.yml before creating a ticket');
  }
}

/** Every id the clone knows: tickets, records, claims, and the history of every ref already fetched. */
export const usedIds = (ctx: CommandContext): string[] => [
  ...Object.keys(ctx.snapshot.tickets),
  ...Object.keys(ctx.snapshot.work ?? {}),
  ...Object.keys(ctx.snapshot.claims ?? {}),
  ...gitTicketIdsInHistory(ctx.root),
];

/** The creator's people entry: the key as it is spelled where it was found, and the initials. */
export interface Creator {
  key: string;
  initials: string;
}

const shortRef = (ref: string): string => ref.replace(/^refs\/(?:remotes|heads)\//, '');

/**
 * ST-LN-50 D-05, G-07-2 A-2: the creator's people entry for an id pattern that holds {initials}, after the checks that keep initials unique and the
 * ticket numbers visible; undefined (after the shallow-clone check) for a pattern without them. When this checkout's people does not list the git
 * email, or has no people at all, the entry comes from origin's default branch, else from the local and fetched branches when every one that lists
 * the email agrees; branches that disagree refuse. Initials another email holds on any branch are refused whichever way the entry was found.
 */
export function creatorEntry(ctx: CommandContext): Creator | undefined {
  const people = ctx.snapshot.config?.people;
  const ids = ctx.snapshot.config?.ids;
  // a pattern holding {initials} keeps the people flow; one without it needs no people table and no email
  if (!(ids?.pattern ?? DEFAULT_PATTERN).includes('{initials}')) {
    if (gitIsShallow(ctx.root)) {
      throw new UsageError('this clone is shallow, so ticket numbers already used cannot be seen - run git fetch --unshallow, then try again');
    }
    return undefined;
  }
  const email = gitUserEmail(ctx.root);
  const noPeople = new UsageError('ids.pattern has {initials} but accord/config.yml has no people - add people, or drop {initials} from ids.pattern');
  if (people === undefined && email === '') throw noPeople;
  if (email === '') {
    throw new UsageError('git user.email is not set - set it with git config user.email <you@example.com>, then register it under people in accord/config.yml');
  }
  // one read of every ref's people per run: the lookup below and the holder check share it
  let read: ReturnType<typeof gitPeopleOnRefs> | undefined;
  const onRefs = (): ReturnType<typeof gitPeopleOnRefs> => (read ??= gitPeopleOnRefs(ctx.root));
  const own = people === undefined ? undefined : Object.keys(people).find((k) => k.toLowerCase() === email.toLowerCase());
  let creator: Creator;
  if (people !== undefined && own !== undefined) {
    creator = { key: own, initials: people[own] };
  } else {
    const { byRef, defaultRef } = onRefs();
    const hit = initialsOnRefs(email, byRef, defaultRef);
    if (hit !== undefined && 'conflict' in hit) {
      throw new UsageError(
        email +
          ' has different initials on other branches (' +
          hit.conflict.map((c) => shortRef(c.ref) + ': ' + c.initials).join(', ') +
          ') and none here or on the default branch - add the initials to keep under people in accord/config.yml - nothing was written',
      );
    }
    if (hit === undefined) {
      if (people === undefined) throw noPeople;
      throw new UsageError(
        email +
          ' is not registered in accord/config.yml here, on the default branch or on any fetched branch - add "' +
          email +
          '": <INITIALS> (2 to 4 capital letters) under people in accord/config.yml, or ask /accord to register you',
      );
    }
    creator = { key: hit.key, initials: hit.initials };
  }
  if (gitIsShallow(ctx.root)) {
    throw new UsageError('this clone is shallow, so ticket numbers already used cannot be seen - run git fetch --unshallow, then try again');
  }
  const { byRef, defaultRef } = onRefs();
  const holder = initialsHolder(creator.initials, email, byRef, defaultRef);
  if (holder !== undefined) {
    throw new UsageError(
      'initials ' + creator.initials + ' already belong to ' + holder + ' on another branch - choose other initials for ' + email + ' in accord/config.yml',
    );
  }
  return creator;
}

/** ST-LN-22 D-08: `--related` as a list of ticket ids: undefined when absent, empty for `none`; an entry that is no ticket id is refused, a repeated one is kept once. */
export function parseRelated(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  if (value.trim() === 'none') return [];
  const ids: string[] = [];
  for (const entry of value.split(',').map((e) => e.trim())) {
    if (!ID.test(entry)) {
      throw new UsageError('--related takes ticket ids separated by commas, or none: "' + entry + '" is not a ticket id - nothing was written');
    }
    if (!ids.includes(entry)) ids.push(entry);
  }
  return ids;
}

/** ST-LN-22 T-07-16: every linked id names a ticket of the working tree or of the default branch. */
export function refuseUnknown(ids: readonly string[], view: Snapshot): void {
  const known = (id: string): boolean => Object.hasOwn(view.tickets, id) || Object.hasOwn(view.defaultRef?.snapshot.tickets ?? {}, id);
  const unknown = ids.filter((id) => !known(id));
  if (unknown.length > 0) {
    throw new UsageError('--related names ' + unknown.join(', ') + ', which is no ticket in this clone or on its default branch - nothing was written');
  }
}

/**
 * ST-LN-22 D-08: prints up to five `similar:` lines, or `similar: none`. With candidates and no `--related` it then refuses, so the
 * session judges them and runs the command again; with `--related` the lines stay in the output as the record of what was judged.
 * The refusal also prints the title rule line (ST-LN-22 D-08b), so the model reads the rule before it writes the title the second run is given.
 */
export function checkSimilar(view: Snapshot, request: string, out: CommandContext['stdout'], judged: boolean, ruleLine: string): void {
  const found = similarTickets(request, ticketFacts(view));
  if (found.length === 0) {
    out.write('similar: none\n');
    return;
  }
  for (const t of found) out.write('similar: ' + t.id + ' "' + printable(t.title) + '" (' + t.status + ')\n');
  if (judged) return;
  out.write(ruleLine + '\n');
  throw new UsageError(
    'judge the similar tickets above, then run this command again with --related <id>[,<id>] for the ones this request continues or builds on, or --related none - nothing was written',
  );
}

/** A title from a file anyone on the team wrote, on one line: every control character becomes a space. */
export const printable = (text: string): string => text.replace(/\p{Cc}/gu, ' ');
