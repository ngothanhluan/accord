// What `accord new ticket` and its one-step form `--split` (ST-LN-28 D-14) both do before a file is written: the id convention,
// the used ids, the creator's initials, the config check, the related ids and the similar-ticket check (ST-LN-22 D-08). Moved
// out of new-ticket.ts unchanged so split.ts can use them without importing new-ticket.ts, which imports split.ts.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_PATTERN, initialsHolder, initialsOf, loadSnapshot, similarTickets, ticketFacts } from '@accord-dev/accord-core';
import { doneRef, gitIsShallow, gitPeopleOnRefs, gitTicketIdsInHistory, gitUserEmail, loadRefInput, UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';

export type Snapshot = CommandContext['snapshot'];

// The ticket schema's own id pattern (packages/core/schemas/ticket.schema.json). Duplicated as a
// literal rather than read out of the schema so it is visible at the one call site that matters.
export const ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
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

/**
 * ST-LN-50 D-05: the creator's initials for an id pattern that holds {initials}, after the checks that keep them unique and the
 * ticket numbers visible; undefined (after the shallow-clone check) for a pattern without them.
 */
export function creatorInitials(ctx: CommandContext): string | undefined {
  const people = ctx.snapshot.config?.people;
  const ids = ctx.snapshot.config?.ids;
  // a pattern holding {initials} keeps the people flow; one without it needs no people table and no email
  if ((ids?.pattern ?? DEFAULT_PATTERN).includes('{initials}')) {
    if (people === undefined) {
      throw new UsageError('ids.pattern has {initials} but accord/config.yml has no people - add people, or drop {initials} from ids.pattern');
    }
    const email = gitUserEmail(ctx.root);
    if (email === '') {
      throw new UsageError('git user.email is not set - set it with git config user.email <you@example.com>, then register it under people in accord/config.yml');
    }
    const initials = initialsOf(people, email);
    if (initials === undefined) {
      throw new UsageError(
        email + ' is not registered - add "' + email + '": <INITIALS> (2 to 4 capital letters) under people in accord/config.yml, or ask /accord to register you',
      );
    }
    if (gitIsShallow(ctx.root)) {
      throw new UsageError('this clone is shallow, so ticket numbers already used cannot be seen - run git fetch --unshallow, then try again');
    }
    const { byRef, defaultRef } = gitPeopleOnRefs(ctx.root);
    const holder = initialsHolder(initials, email, byRef, defaultRef);
    if (holder !== undefined) {
      throw new UsageError(
        'initials ' + initials + ' already belong to ' + holder + ' on another branch - choose other initials for ' + email + ' in accord/config.yml',
      );
    }
    return initials;
  }
  if (gitIsShallow(ctx.root)) {
    throw new UsageError('this clone is shallow, so ticket numbers already used cannot be seen - run git fetch --unshallow, then try again');
  }
  return undefined;
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
