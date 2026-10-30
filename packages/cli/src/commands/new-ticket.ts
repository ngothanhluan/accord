// CLI-04 `accord new ticket <id>`: the first command a BA runs, and the one place accord creates a
// document a human is supposed to own. It substitutes the id and sets `type:` — and fills in nothing
// else (D-104). Title, intent, requirements, scenarios and ticks stay the template's placeholder text,
// because accord records human intent and never synthesises it. The `@ac-1` tag scaffolding ROADMAP
// criterion 1 asks for already ships inside ticket-build.md and ticket-maintain.md, so there is
// nothing to generate — only to substitute.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { initialsHolder, initialsOf, nextTicketId, setFrontmatterKey, templates } from '@accord-dev/accord-core';
import type { Lane } from '@accord-dev/accord-core';
import { gitIsShallow, gitPeopleOnRefs, gitTicketIdsInHistory, gitUserEmail, UsageError } from '../load/fs.js';
import { cleanQuietly, fetchOrigin, guardTicketSession, newTicketWorktree } from './worktree.js';
import type { WorktreeEntry } from './worktree.js';
import type { CommandContext } from '../run.js';

// The ticket schema's own id pattern (packages/core/schemas/ticket.schema.json). Duplicated as a
// literal rather than read out of the schema so it is visible at the one call site that matters.
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const PLACEHOLDER = 'TICKET-ID';

export function newTicket(
  ctx: CommandContext,
  givenId: string | undefined,
  options: { type: 'epic' | 'story' | 'bug'; lane?: Lane; worktree?: boolean },
): number {
  guardTicketSession(ctx);
  // the worktree list clean read last, for the new worktree's own check; undefined when nothing was read or a removal followed
  let seen: WorktreeEntry[] | undefined;
  if (options.worktree === true) {
    const f = fetchOrigin(ctx);
    ctx = f.ctx;
    seen = cleanQuietly(ctx, f.fetched);
  }
  // An invalid `people` value leaves config undefined, which would read as the convention being off.
  let raw = '';
  try {
    raw = readFileSync(join(ctx.root, 'accord', 'config.yml'), 'utf8');
  } catch {
    // absent counts as empty
  }
  const bad = /^people\s*:/m.test(raw)
    ? ctx.snapshot.errors.find((f) => f.file === 'accord/config.yml' && f.rule !== 'load.config-missing')
    : undefined;
  if (bad !== undefined) {
    const where = [bad.line === undefined ? '' : ':' + bad.line, bad.pointer ? ' ' + bad.pointer : ''].join('');
    throw new UsageError('accord/config.yml' + where + ' ' + bad.reason + ' - fix accord/config.yml before creating a ticket');
  }
  const people = ctx.snapshot.config?.people;
  let id: string;
  if (people !== undefined && givenId !== undefined) {
    throw new UsageError(
      givenId + ' was typed by hand; accord assigns ids while accord/config.yml has people - run accord new ticket --type ' + options.type + ' without an id',
    );
  } else if (givenId !== undefined) id = givenId;
  else if (people === undefined) throw new UsageError('a ticket id is required: accord new ticket <id>');
  else {
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
    const seen = [
      ...Object.keys(ctx.snapshot.tickets),
      ...Object.keys(ctx.snapshot.work ?? {}),
      ...Object.keys(ctx.snapshot.claims ?? {}),
      ...gitTicketIdsInHistory(ctx.root),
    ];
    id = nextTicketId(options.type, initials, seen);
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
  if (options.type === 'epic' && (options.lane === 'M' || options.lane === 'S')) throw new UsageError('an epic is lane L or P, not M');

  // The generated record on the core public API is the only template source: packages/core/templates/
  // is not shipped into a consumer's node_modules the way the generated module is. `epic` has its own
  // template (no Acceptance criteria, Plan, or Verification notes), which is why `--type` exists at all.
  const name =
    options.lane !== undefined
      ? options.type === 'epic'
        ? ('epic-lane.md' as const)
        : options.lane === 'S'
          ? ('ticket-lane-s.md' as const)
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

  const rel = 'accord/tickets/' + id + '.md';
  const file = join(ctx.root, rel);
  // T-05-15: refusing is the behaviour, not an afterthought — a BA-authored ticket can never be
  // destroyed by a second `new ticket`. Exit 2: this is a usage error, not a gate verdict.
  if (existsSync(file)) throw new UsageError(rel + ' already exists - nothing was written');
  if (options.worktree === true) {
    newTicketWorktree(ctx, id, rel, text, seen);
    return 0;
  }
  mkdirSync(join(ctx.root, 'accord', 'tickets'), { recursive: true });
  writeFileSync(file, text);
  ctx.stdout.write(rel + '\n');
  return 0;
}
