// CLI-04 `accord new ticket <id>`: the first command a BA runs, and the one place accord creates a
// document a human is supposed to own. It fills in the id, the type, the lane, the title (only when the person gives
// `--title`, ST-LN-83 D-03, and then only a title that keeps the rule of config.yml's `titles`, ST-LN-22 D-08b) and the
// related tickets (ST-LN-22 D-08), and nothing of the intent (D-104). Intent, requirements, scenarios and ticks stay
// the template's placeholder text, because accord records human intent and never synthesises it; the one exception is
// `--queue`, whose `--note` lines are the person's own words under `## Intent`. The `@ac-1` tag scaffolding ROADMAP
// criterion 1 asks for already ships inside ticket-build.md and ticket-maintain.md, so there is nothing to generate,
// only to substitute.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_PATTERN, initialsHolder, insertTeamSections, initialsOf, loadSnapshot, nextTicketId, setFrontmatterKey, similarTickets, templates, ticketFacts, titleProblem, titleRuleLine, TRACKER_KEY, trackerKeyOk } from '@accord-dev/accord-core';
import type { Lane } from '@accord-dev/accord-core';
import { doneRef, gitIsShallow, gitPeopleOnRefs, gitTicketIdsInHistory, gitUserEmail, loadRefInput, UsageError } from '../load/fs.js';
import { queueTicket, utcDate } from './queue.js';
import { cleanQuietly, fetchOrigin, guardTicketSession, newTicketWorktree } from './worktree.js';
import type { WorktreeEntry } from './worktree.js';
import type { CommandContext } from '../run.js';

type Snapshot = CommandContext['snapshot'];

// The ticket schema's own id pattern (packages/core/schemas/ticket.schema.json). Duplicated as a
// literal rather than read out of the schema so it is visible at the one call site that matters.
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const PLACEHOLDER = 'TICKET-ID';

export function newTicket(
  ctx: CommandContext,
  givenId: string | undefined,
  options: { type: 'epic' | 'story' | 'bug'; lane?: Lane; worktree?: boolean; title?: string; queue?: boolean; note?: string[]; related?: string; dupCheck?: boolean },
): number {
  // ST-LN-83 D-03: every bad flag is refused before anything is read, written or pushed
  const notes = (options.note ?? []).map((n) => n.trim());
  if (options.queue === true && options.worktree === true) {
    throw new UsageError('--queue and --worktree cannot go together: --queue writes the draft on a backlog branch, --worktree claims the ticket in its own worktree - nothing was written');
  }
  if (options.queue === true && options.title === undefined) throw new UsageError('--queue needs --title: the draft is written on its own branch, so its title is given here - nothing was written');
  if (notes.length > 0 && options.queue !== true) throw new UsageError('--note goes with --queue, which puts the lines under ## Intent of the queued draft - nothing was written');
  if (notes.length > 4) throw new UsageError('--note is given at most four times: the five-line Intent holds the opening line and four notes - nothing was written');
  if (notes.some((n) => n === '' || /[\r\n]/.test(n))) {
    throw new UsageError('--note must be one line of text - nothing was written');
  }
  const title = options.title?.trim();
  if (title !== undefined && (title === '' || /[\r\n]/.test(title))) {
    throw new UsageError('--title must be one line of text - nothing was written');
  }
  // ST-LN-22 D-08b: a title that breaks the rule in config.yml is refused here, with the rule, before anything is read or written
  if (title !== undefined) {
    const problem = titleProblem(title, ctx.snapshot.config);
    if (problem !== undefined) throw new UsageError(problem + '\n' + titleRuleLine(ctx.snapshot.config) + ' - nothing was written');
  }
  // ST-LN-22 D-08: --no-dup-check skips the check that --related records the judgment of, so the two never go together
  const dupCheck = options.dupCheck !== false;
  if (!dupCheck && options.related !== undefined) {
    throw new UsageError('--no-dup-check skips the similar check that --related records the judgment of - use one of them - nothing was written');
  }
  const related = parseRelated(options.related);
  // ST-LN-83 D-06: the queue path writes on another branch in a temporary worktree and touches nothing of this session's ticket, so it runs no session guard
  if (options.queue !== true) guardTicketSession(ctx, undefined, '/accord-new <request>');
  // ST-LN-22 D-08 (7-ac-5): the similar check reads the title, so a lane S or M story or bug cannot skip it by leaving the title out;
  // the session refusal above runs first, and this runs before the --worktree fetch, so nothing is fetched, written or pushed
  if (options.type !== 'epic' && (options.lane === 'S' || options.lane === 'M') && title === undefined && dupCheck) {
    throw new UsageError(
      '--title is required for a lane S or M ticket, so the similar tickets can be checked before it is created: give --title "<short English title>", or --no-dup-check for a scripted run - nothing was written',
    );
  }
  // the worktree list clean read last, for the new worktree's own check; undefined when nothing was read or a removal followed
  let seen: WorktreeEntry[] | undefined;
  if (options.worktree === true || options.queue === true) {
    const f = fetchOrigin(ctx);
    ctx = f.ctx;
    if (options.worktree === true) seen = cleanQuietly(ctx, f.fetched);
  }
  // An invalid `people` value leaves config undefined, which would read as the convention being off.
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
  // ST-LN-22 D-08: before any id is chosen or any file written, the tickets most like the request are printed, and nothing is created until the session has judged them
  if (!dupCheck) ctx.stdout.write('similar: skipped (--no-dup-check)\n');
  else if (title !== undefined || related !== undefined) {
    const view = withDefaultBranch(ctx);
    if (related !== undefined) refuseUnknown(related, view);
    if (title !== undefined) checkSimilar(view, [title, ...notes].join('\n'), ctx.stdout, related !== undefined, titleRuleLine(ctx.snapshot.config));
  }
  const people = ctx.snapshot.config?.people;
  const ids = ctx.snapshot.config?.ids;
  // ST-LN-50 D-05: accord assigns ids while the convention is on, that is while `people` or `ids` exists
  const assigns = people !== undefined || ids !== undefined;
  // every id the clone knows: tickets, records, claims, and the history of every ref already fetched
  const usedIds = (): string[] => [
    ...Object.keys(ctx.snapshot.tickets),
    ...Object.keys(ctx.snapshot.work ?? {}),
    ...Object.keys(ctx.snapshot.claims ?? {}),
    ...gitTicketIdsInHistory(ctx.root),
  ];
  let id: string;
  if (ids?.mode === 'tracker') {
    // ST-LN-50 D-05: the creator gives the Jira or Linear key; accord checks its form, its project and that it is unused, and assigns nothing
    if (givenId === undefined) {
      throw new UsageError('ids.mode is tracker: give the Jira or Linear key, e.g. accord new ticket ENG-123 - nothing was written');
    }
    if (!TRACKER_KEY.test(givenId)) {
      throw new UsageError(givenId + ' is not a tracker key: a project key in capital letters, a hyphen and the issue number, e.g. ENG-123 - nothing was written');
    }
    if (!trackerKeyOk(givenId, ids)) {
      throw new UsageError(givenId + ' is not in ids.projects (' + (ids.projects ?? []).join(', ') + ') of accord/config.yml - nothing was written');
    }
    if (usedIds().includes(givenId)) {
      throw new UsageError(givenId + ' is already used by a ticket, a record, a claim or the history of a branch in this clone - nothing was written');
    }
    id = givenId;
  } else if (assigns && givenId !== undefined) {
    throw new UsageError(
      givenId +
        ' was typed by hand; accord assigns ids while accord/config.yml has ' +
        (people !== undefined ? 'people' : 'ids') +
        ' - run accord new ticket --type ' +
        options.type +
        ' without an id',
    );
  } else if (givenId !== undefined) id = givenId;
  else if (!assigns) throw new UsageError('a ticket id is required: accord new ticket <id>');
  else {
    // a pattern holding {initials} keeps the people flow; one without it needs no people table and no email
    let initials: string | undefined;
    if ((ids?.pattern ?? DEFAULT_PATTERN).includes('{initials}')) {
      if (people === undefined) {
        throw new UsageError('ids.pattern has {initials} but accord/config.yml has no people - add people, or drop {initials} from ids.pattern');
      }
      const email = gitUserEmail(ctx.root);
      if (email === '') {
        throw new UsageError('git user.email is not set - set it with git config user.email <you@example.com>, then register it under people in accord/config.yml');
      }
      initials = initialsOf(people, email);
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
    } else if (gitIsShallow(ctx.root)) {
      throw new UsageError('this clone is shallow, so ticket numbers already used cannot be seen - run git fetch --unshallow, then try again');
    }
    id = nextTicketId(options.type, initials, usedIds(), ids);
  }

  // T-05-14: this is the only guard between an argv string and a filesystem write, so it runs before
  // anything else touches a path. The pattern admits no slash, no backslash, no leading dot and no
  // space, so no traversal sequence survives it.
  if (!ID.test(id)) {
    throw new UsageError(
      'not a valid ticket id: ' +
        id +
        ' - a letter or digit, then letters, digits, dots, hyphens, or underscores',
    );
  }

  // R14a: an epic groups stories, so lane M (one feature) is meaningless for it; refuse before any write.
  // ST-LN-94 D-10: nor lane R, a research question. The M and S message stays as it was.
  if (options.type === 'epic' && (options.lane === 'M' || options.lane === 'S' || options.lane === 'R')) {
    throw new UsageError('an epic is lane L or P, not ' + (options.lane === 'R' ? 'R' : 'M'));
  }

  // The generated record on the core public API is the only template source: packages/core/templates/
  // is not shipped into a consumer's node_modules the way the generated module is. `epic` has its own
  // template (no Acceptance criteria, Plan, or Verification notes), which is why `--type` exists at all.
  const name =
    options.lane !== undefined
      ? options.type === 'epic'
        ? ('epic-lane.md' as const)
        : options.lane === 'S'
          ? ('ticket-lane-s.md' as const)
          : options.lane === 'R'
            ? ('ticket-lane-r.md' as const) // ST-LN-94 D-10, D-13: a question, a timebox and a token budget the owner sets
            : ('ticket-lane.md' as const)
      : options.type === 'epic'
        ? ('epic.md' as const)
        : (`ticket-${ctx.snapshot.config?.profile ?? 'build'}.md` as const);
  // Two steps and no more. One global replacement covers both places the placeholder appears — the
  // frontmatter `id` value and the Gherkin `Feature:` line — and `setFrontmatterKey` preserves the
  // trailing guidance comment on the `type:` line, which is exactly what D-43 and D-45 bought.
  let text = setFrontmatterKey(templates[name].replaceAll(PLACEHOLDER, id), 'type', options.type);
  // Spec §3: the lane the caller chose; the template's own value is only a default for reading.
  if (options.lane !== undefined) text = setFrontmatterKey(text, 'lane', options.lane);
  // ST-LN-83 D-03: the title the person gave, written as a double-quoted string on every path
  if (title !== undefined) text = setFrontmatterKey(text, 'title', title);
  // ST-LN-22 D-08: the tickets the session judged this request to continue, a block list; none writes no key
  if (related !== undefined && related.length > 0) text = setFrontmatterKey(text, 'related', related);
  // ST-LN-50 D-10: the team's own sections go into every story and bug ticket, in the plain and the --worktree path alike; an epic holds none
  if (options.type !== 'epic') text = insertTeamSections(text, ctx.snapshot.config?.template?.sections);

  const rel = 'accord/tickets/' + id + '.md';
  const file = join(ctx.root, rel);
  // T-05-15: refusing is the behaviour, not an afterthought — a BA-authored ticket can never be
  // destroyed by a second `new ticket`. Exit 2: this is a usage error, not a gate verdict.
  if (existsSync(file)) throw new UsageError(rel + ' already exists - nothing was written');
  // ST-LN-22 D-08b: a run given --title prints the rule its title was checked against, once, before the path or the queue lines; a run without one prints none
  if (title !== undefined) ctx.stdout.write(titleRuleLine(ctx.snapshot.config) + '\n');
  if (options.queue === true) {
    // ST-LN-83 D-06: the draft goes to a backlog branch off origin's default branch, not to this checkout
    const date = utcDate();
    return queueTicket(ctx, id, rel, queuedIntent(text, date, notes), date);
  }
  if (options.worktree === true) {
    newTicketWorktree(ctx, id, rel, text, seen);
    return 0;
  }
  mkdirSync(join(ctx.root, 'accord', 'tickets'), { recursive: true });
  writeFileSync(file, text);
  ctx.stdout.write(rel + '\n');
  return 0;
}

/** `text` with the placeholder lines of `## Intent` replaced by the queued-draft opening line and one `- <note>` per note; the template's own guidance comment stays. */
function queuedIntent(text: string, date: string, notes: string[]): string {
  const heading = '\n## Intent\n';
  const at = text.indexOf(heading);
  if (at < 0) throw new UsageError('a queued draft needs a template with an ## Intent section (lane M, L or P, or a story) - nothing was written');
  const from = at + heading.length;
  const next = text.indexOf('\n## ', from);
  const section = text.slice(from, next < 0 ? text.length : next + 1);
  const close = section.startsWith('<!--') ? section.indexOf('-->') : -1;
  const comment = close < 0 ? '' : section.slice(0, section.indexOf('\n', close) + 1);
  const lines = ['Queued ' + date + ', not approved; the intent interview replaces this:', ...notes.map((n) => '- ' + n)];
  return text.slice(0, from) + comment + lines.join('\n') + '\n' + (next < 0 ? '' : '\n' + text.slice(next + 1));
}

/** The default branch as the clone holds it, read from git with no checkout, for the tickets a working tree may not have yet (`accord related` reads it too). */
export function withDefaultBranch(ctx: CommandContext): Snapshot {
  const ref = doneRef(ctx.root);
  return ref === undefined ? ctx.snapshot : { ...ctx.snapshot, defaultRef: { ref, snapshot: loadSnapshot(loadRefInput(ctx.root, ref)) } };
}

/** ST-LN-22 D-08: `--related` as a list of ticket ids: undefined when absent, empty for `none`; an entry that is no ticket id is refused, a repeated one is kept once. */
function parseRelated(value: string | undefined): string[] | undefined {
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
function refuseUnknown(ids: readonly string[], view: Snapshot): void {
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
function checkSimilar(view: Snapshot, request: string, out: CommandContext['stdout'], judged: boolean, ruleLine: string): void {
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
const printable = (text: string): string => text.replace(/\p{Cc}/gu, ' ');
