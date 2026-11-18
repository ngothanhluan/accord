// ST-LN-28 D-14 `accord new ticket --type epic --lane L --split <file>`: an approved split becomes the epic and every story in
// one step, each story carrying `parent:` and its `depends_on:`. Every check runs before the first file is written, so a bad
// split writes nothing. The command creates no worktree and claims no story: each story is picked up later in its own worktree.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { insertTeamSections, nextTicketId, parseSplit, setFrontmatterKey, similarTickets, templates, ticketFacts, titleProblem, titleRuleLine, TRACKER_KEY, trackerKeyOk } from '@accord-dev/accord-core';
import type { Lane, Split } from '@accord-dev/accord-core';
import { UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';
import { creatorInitials, ID, parseRelated, PLACEHOLDER, printable, refuseBadConfig, refuseUnknown, usedIds, withDefaultBranch } from './ticket-shared.js';
import { guardTicketSession } from './worktree.js';

const NOTHING = ' - nothing was written';

/** The flags `accord new ticket` was given, as far as `--split` looks at them. */
interface SplitOptions {
  type: 'epic' | 'story' | 'bug';
  lane?: Lane;
  split: string;
  worktree?: boolean;
  title?: string;
  queue?: boolean;
  note?: string[];
  related?: string;
  dupCheck?: boolean;
}

/**
 * `new ticket --split <file>`: refuse the flags that do not go with a split, read and check the file, then write it. The split file's titles
 * stand in for `--title`, so the refusal of `--queue` without `--title` never meets it.
 */
export function newSplit(ctx: CommandContext, givenId: string | undefined, options: SplitOptions, cwd: string): number {
  if (options.type !== 'epic' || options.lane !== 'L') {
    throw new UsageError('--split writes an epic and its stories: give --type epic --lane L' + NOTHING);
  }
  if (options.worktree === true) throw new UsageError('--split and --worktree cannot go together: a split creates no worktree, each story is picked up later in its own' + NOTHING);
  if (options.title !== undefined) throw new UsageError('--split and --title cannot go together: the split file holds the epic title and every story title' + NOTHING);
  if ((options.note ?? []).length > 0) throw new UsageError('--split and --note cannot go together: the split file holds the intent lines of the epic and of every story' + NOTHING);
  if (options.dupCheck === false) throw new UsageError('--split and --no-dup-check cannot go together: a split always runs the similar check, so the flag would be ignored unseen' + NOTHING);
  if (givenId !== undefined) throw new UsageError('--split takes no ticket id: accord assigns them, or the split file gives them (an id line on the epic and on every story)' + NOTHING);
  if (options.queue === true) throw new UsageError('--split with --queue is not available yet' + NOTHING);
  guardTicketSession(ctx, undefined, '/accord-new <request>');
  const path = resolve(cwd, options.split);
  let source: string;
  try {
    source = readFileSync(path, 'utf8');
  } catch (err) {
    throw new UsageError('cannot read the split file ' + options.split + ': ' + String((err as { code?: string }).code ?? err) + NOTHING);
  }
  const parsed = parseSplit(source);
  if (parsed.split === undefined) throw new UsageError('the split file ' + options.split + ' has ' + parsed.problems.length + ' problem(s):\n' + parsed.problems.map((p) => '- ' + p).join('\n') + '\n' + NOTHING.trim());
  return writeSplit(ctx, parsed.split, { related: options.related });
}

/** `text` with the lines under `## <heading>` replaced by `lines`; the template's own guidance comment stays. */
function fillSection(text: string, heading: string, lines: readonly string[]): string {
  const marker = '\n## ' + heading + '\n';
  const at = text.indexOf(marker);
  if (at < 0) throw new UsageError('the ' + heading + ' section is missing from the ticket template' + NOTHING);
  const from = at + marker.length;
  const next = text.indexOf('\n## ', from);
  const section = text.slice(from, next < 0 ? text.length : next + 1);
  const close = section.startsWith('<!--') ? section.indexOf('-->') : -1;
  const comment = close < 0 ? '' : section.slice(0, section.indexOf('\n', close) + 1);
  return text.slice(0, from) + comment + lines.join('\n') + '\n' + (next < 0 ? '' : '\n' + text.slice(next + 1));
}

/**
 * Write an epic and its stories: check every title, the similar tickets and the ids, then build every text, and only then write.
 * Prints the title rule once and each path in file order (the epic, then the stories), ids ascending in that order.
 */
export function writeSplit(ctx: CommandContext, split: Split, options: { queue?: boolean; related?: string }): number {
  const config = ctx.snapshot.config;
  // ST-LN-22 D-08b: every title of the split keeps the rule of config.yml
  const titles = [{ what: 'the epic title', title: split.title }, ...split.stories.map((s, i) => ({ what: 'story ' + (i + 1) + ' title', title: s.title }))];
  const bad = titles.flatMap((t) => {
    const problem = titleProblem(t.title, config);
    return problem === undefined ? [] : [t.what + ': ' + problem];
  });
  if (bad.length > 0) throw new UsageError(bad.join('\n') + '\n' + titleRuleLine(config) + NOTHING);
  const related = parseRelated(options.related);
  refuseBadConfig(ctx);

  // ST-LN-22 D-08: the tickets most like the epic and each story are printed, and nothing is created until the session has judged them
  const view = withDefaultBranch(ctx);
  if (related !== undefined) refuseUnknown(related, view);
  const facts = ticketFacts(view);
  const shown: string[] = [];
  for (const item of [{ title: split.title, intent: split.intent }, ...split.stories]) {
    for (const t of similarTickets([item.title, ...item.intent].join('\n'), facts)) {
      const line = 'similar: ' + t.id + ' "' + printable(t.title) + '" (' + t.status + ')';
      if (!shown.includes(line)) shown.push(line);
    }
  }
  ctx.stdout.write(shown.length === 0 ? 'similar: none\n' : shown.join('\n') + '\n');
  if (shown.length > 0 && related === undefined) {
    ctx.stdout.write(titleRuleLine(config) + '\n');
    throw new UsageError(
      'judge the similar tickets above, then run this command again with --related <id>[,<id>] for the ones this split continues or builds on, or --related none' + NOTHING,
    );
  }

  // ids: in file order, each new id counted as used for the next; or the file's own when accord assigns none
  const people = config?.people;
  const idsConfig = config?.ids;
  const tracker = idsConfig?.mode === 'tracker';
  const assigns = (people !== undefined || idsConfig !== undefined) && !tracker;
  const given = [split.id, ...split.stories.map((s) => s.id)];
  const used = usedIds(ctx);
  const epicStory: string[] = [];
  if (assigns) {
    if (given.some((g) => g !== undefined)) {
      throw new UsageError('the split file gives an id, but accord assigns ids while accord/config.yml has ' + (people !== undefined ? 'people' : 'ids') + ' - remove the id lines' + NOTHING);
    }
    const initials = creatorInitials(ctx);
    for (const type of ['epic', ...split.stories.map(() => 'story' as const)] as const) {
      const id = nextTicketId(type, initials, used, idsConfig);
      used.push(id);
      epicStory.push(id);
    }
  } else {
    given.forEach((g, i) => {
      const what = i === 0 ? 'the epic' : 'story ' + i;
      if (g === undefined) {
        throw new UsageError('accord assigns no ids here, so the split file gives ' + what + ' an id line' + (tracker ? ' (the Jira or Linear key)' : '') + NOTHING);
      }
      if (tracker) {
        if (!TRACKER_KEY.test(g)) throw new UsageError(g + ' is not a tracker key: a project key in capital letters, a hyphen and the issue number, e.g. ENG-123' + NOTHING);
        if (!trackerKeyOk(g, idsConfig)) throw new UsageError(g + ' is not in ids.projects (' + (idsConfig?.projects ?? []).join(', ') + ') of accord/config.yml' + NOTHING);
      }
      // T-05-14, T-07-34: the id pattern admits no slash, no backslash, no leading dot and no space, so no traversal sequence survives it
      if (!ID.test(g)) throw new UsageError('not a valid ticket id: ' + g + ' - a letter or digit, then letters, digits, dots, hyphens, or underscores' + NOTHING);
      if (used.includes(g) || epicStory.includes(g)) {
        throw new UsageError(g + ' is already used by a ticket, a record, a claim or the history of a branch in this clone, or twice in the split' + NOTHING);
      }
      epicStory.push(g);
    });
  }
  const epicId = epicStory[0];
  const storyIds = epicStory.slice(1);

  // every text is built before the first file is written
  const files: Record<string, string> = {};
  let epic = setFrontmatterKey(templates['epic-lane.md'].replaceAll(PLACEHOLDER, epicId), 'type', 'epic');
  epic = setFrontmatterKey(epic, 'lane', 'L');
  epic = setFrontmatterKey(epic, 'title', split.title);
  if (related !== undefined && related.length > 0) epic = setFrontmatterKey(epic, 'related', related);
  epic = fillSection(fillSection(epic, 'Intent', split.intent), 'Vetoes', split.vetoes.map((v) => '- ' + v));
  files['accord/tickets/' + epicId + '.md'] = epic;
  split.stories.forEach((s, i) => {
    let text = setFrontmatterKey(templates['ticket-lane.md'].replaceAll(PLACEHOLDER, storyIds[i]), 'type', 'story');
    text = setFrontmatterKey(text, 'lane', 'M');
    text = setFrontmatterKey(text, 'title', s.title);
    text = setFrontmatterKey(text, 'parent', epicId);
    if (s.after.length > 0) text = setFrontmatterKey(text, 'depends_on', s.after.map((n) => storyIds[n - 1]));
    text = fillSection(text, 'Intent', s.intent);
    files['accord/tickets/' + storyIds[i] + '.md'] = insertTeamSections(text, config?.template?.sections);
  });
  for (const rel of Object.keys(files)) {
    // T-05-15: a ticket a person wrote is never destroyed by a second run
    if (existsSync(join(ctx.root, rel))) throw new UsageError(rel + ' already exists' + NOTHING);
  }

  ctx.stdout.write(titleRuleLine(config) + '\n');
  mkdirSync(join(ctx.root, 'accord', 'tickets'), { recursive: true });
  for (const [rel, text] of Object.entries(files)) {
    writeFileSync(join(ctx.root, rel), text);
    ctx.stdout.write(rel + '\n');
  }
  return 0;
}
