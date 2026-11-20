// Phase 8.1 D-01, D-03: `accord pr <id>` builds the title and the body file of a ticket's pull request from the repository's PR template and what the ticket knows, and prints them; the skills at
// the pull request sites only pass them to `gh pr create --title <title> --body-file <file>`. It reads the repository and writes one file under .git: it never calls `gh` (D-03).
import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fillTemplate, prFacts, prTitle } from '@accord-dev/accord-core';
import { gitTracked, UsageError } from '../load/fs.js';
import { shown } from '../load/script-trust.js';
import type { CommandContext } from '../run.js';
import { git, ID } from './worktree.js';

/** The one template path this step knows; the rest of GitHub's locations come with the next step. */
const TEMPLATE = '.github/pull_request_template.md';

/** The template file as the working tree holds it; a tracked path that is not a regular file (a link out of the repository) is refused, never followed. */
function readTemplate(root: string, path: string): string {
  const abs = resolve(root, path);
  let regular = false;
  try {
    const st = lstatSync(abs);
    regular = st.isFile() && !st.isSymbolicLink();
  } catch {
    // unreadable: reported below
  }
  if (!regular) throw new UsageError(`the PR template ${shown(path)} is tracked but is not a regular file in this checkout - fix: restore it with git checkout -- ${shown(path)}, or name another tracked file in pr.template`);
  return readFileSync(abs, 'utf8');
}

/**
 * Print `title:`, `body-file:`, `template:` and one `remaining:` line per section of the template nobody could fill, in that order, and write the body to
 * `<git-path>/accord-pr-<id>.md` (one per worktree, never tracked, overwritten on each run). Exit 2 for an id that is no ticket here.
 */
export function pr(ctx: CommandContext, id: string): number {
  if (!ID.test(id)) throw new UsageError('not a valid ticket id: ' + id);
  if (!Object.hasOwn(ctx.snapshot.tickets, id)) throw new UsageError(`no ticket ${id} in accord/tickets/ - give the id of a ticket of this checkout`);
  const ticket = ctx.snapshot.tickets[id];
  const facts = prFacts(ticket, ctx.snapshot.verifications[id]);
  const path = gitTracked(ctx.root).includes(TEMPLATE) ? TEMPLATE : undefined;
  const filled = fillTemplate(path === undefined ? '' : readTemplate(ctx.root, path), facts);
  const file = resolve(ctx.root, git(ctx.root, ['rev-parse', '--git-path', `accord-pr-${id}.md`]).trim());
  writeFileSync(file, filled.body);
  ctx.stdout.write(`title: ${shown(prTitle(id, facts.title))}\n`);
  ctx.stdout.write(`body-file: ${file.replaceAll('\\', '/')}\n`);
  ctx.stdout.write(`template: ${path === undefined ? 'none' : shown(path)}\n`);
  for (const heading of filled.remaining) ctx.stdout.write(`remaining: ${shown(heading)}\n`);
  return 0;
}
