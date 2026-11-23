// Phase 8.1 D-01, D-03: `accord pr <id>` builds the title and the body file of a ticket's pull request and prints them; the skills at the pull request sites only pass them to
// `gh pr create --title <title> --body-file <file>`. The body comes from the team's script (`pr.command`, only after `accord trust`), which replaces the template entirely; else from the
// repository's PR template with every heading kept and what the ticket knows filled in; else it is today's fixed body. It reads the repository and writes files under .git: it never calls `gh` (D-03).
import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { epicBody, fillTemplate, findTemplate, normaliseText, prFacts, prTitle, prTitleProblem, todaysBody } from '@accord-dev/accord-core';
import type { PrFacts } from '@accord-dev/accord-core';
import { gitBranchCommits, gitDefaultRef, gitFilesAt, gitTracked, UsageError, withQueued } from '../load/fs.js';
import { scriptRefusal, shown } from '../load/script-trust.js';
import { runTeamCommand } from '../load/team-run.js';
import type { CommandContext } from '../run.js';
import { withNext } from './next-action.js';
import { git, ID } from './worktree.js';

/** The title script may run this long and print this much (Ruling "pr.command contract"). */
const PR_TIMEOUT_MS = 60_000;
const PR_MAX_BUFFER = 1024 * 1024;

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

/** The text of a draft ticket as its backlog branch holds it (origin's copy of the branch first, as `withQueued` reads it), or undefined when neither ref has it. */
function queuedText(root: string, branch: string, id: string): string | undefined {
  const path = `accord/tickets/${id}.md`;
  for (const ref of [`refs/remotes/origin/${branch}`, `refs/heads/${branch}`]) {
    const text = gitFilesAt(root, ref, [path])[path];
    if (text !== undefined) return text;
  }
  return undefined;
}

/** The first lines of each non-merge commit of this branch since the default ref, oldest first: what `gh pr create --fill` filled the body with. */
function branchSubjects(root: string): string[] {
  if (gitDefaultRef(root) === undefined) {
    throw new UsageError('none of origin/HEAD, origin/main and origin/master exists here, so the commits of this branch cannot be listed for the pull request body - fix: run git fetch origin, or add a PR template or pr.command');
  }
  return gitBranchCommits(root)
    .filter((c) => c.merge !== true)
    .map((c) => (normaliseText(c.message).split('\n')[0] ?? '').trim())
    .reverse();
}

/**
 * Run `pr.command` with the ticket only in the environment (ACCORD_TICKET, ACCORD_TICKET_FILE, ACCORD_BASE_REF, ACCORD_ROOT) and split what it printed: the first line is the title, the rest the body, CRLF read as LF.
 * An untrusted script never runs (the refusal names `accord trust`); a non-zero exit, a timeout, too much output or an empty first line stops the step, quoting the stderr tail, with no fallback to the template.
 */
function runScript(ctx: CommandContext, command: string, id: string, ticketFile: string): { title: string; body: string } {
  const refusal = scriptRefusal(ctx.root, 'pr.command', command);
  if (refusal !== undefined) throw new UsageError(withNext('trust', `${refusal} - no pull request title or body was built`));
  const r = runTeamCommand(command, {
    cwd: ctx.root,
    env: { ...process.env, ...ctx.env, ACCORD_TICKET: id, ACCORD_TICKET_FILE: ticketFile, ACCORD_BASE_REF: gitDefaultRef(ctx.root) ?? '', ACCORD_ROOT: ctx.root },
    timeoutMs: PR_TIMEOUT_MS,
    maxBuffer: PR_MAX_BUFFER,
  });
  const lines = r.stdout.replace(/\r\n/g, '\n').split('\n');
  let why: string | undefined;
  if (r.timedOut) why = `timed out after ${PR_TIMEOUT_MS / 1000} s`;
  else if (r.oversize) why = `printed more than ${PR_MAX_BUFFER / 1024 / 1024} MiB`;
  else if (r.code !== 0) why = r.code === null ? `was killed${r.signal === null ? '' : ' by ' + r.signal}` : `exited ${r.code}`;
  else if ((lines[0] ?? '').trim() === '') why = 'printed no title: its first line of output is empty';
  if (why !== undefined) {
    const said = (r.stderr.trim() !== '' ? r.stderr : r.stdout).trim();
    const tail = said === '' ? '' : ' - ' + said.split('\n').slice(-20).map((l) => shown(l.trimEnd())).join(' / ');
    throw new UsageError(`pr.command "${shown(command)}" ${why}${tail} - no pull request title or body was built; fix the script, or remove pr.command to use the PR template`);
  }
  return { title: (lines[0] ?? '').trim(), body: lines.slice(1).join('\n').replace(/\n*$/, '\n') };
}

/**
 * Print `title:`, `body-file:`, then `template: <path>` (or `script: pr.command`, or `template: none`) and one `remaining:` line per section of the template nobody could fill, in that
 * order, and write the body to `<git-path>/accord-pr-<id>.md` (one per worktree, never tracked, overwritten on each run). Exit 2 for an id that is no ticket here or on a backlog branch,
 * for a title the quoted `gh` argument cannot carry, and for everything `pr.command` and `pr.template` can get wrong.
 */
export function pr(ctx: CommandContext, id: string): number {
  if (!ID.test(id)) throw new UsageError('not a valid ticket id: ' + id);
  // an epic opens its pull request from a backlog branch, so its ticket is only on that branch: read it as the dashboard does
  const snapshot = Object.hasOwn(ctx.snapshot.tickets, id) ? ctx.snapshot : withQueued(ctx.root, ctx.snapshot);
  if (!Object.hasOwn(snapshot.tickets, id)) throw new UsageError(`no ticket ${id} in accord/tickets/ or on a backlog branch - give the id of a ticket of this checkout or one queued with accord new ticket --queue`);
  const ticket = snapshot.tickets[id];
  // Phase 08.8 D-16 item 8: with no parsed frontmatter the title is unknown, and the pull request would be titled with the id and carry no Intent
  if (ticket.frontmatter === undefined) {
    throw new UsageError(`ticket ${id}: the frontmatter of ${ticket.file} does not parse, so its title is unknown - fix it (accord lint names the problem), then run accord pr again`);
  }
  const facts: PrFacts = prFacts(ticket, snapshot.verifications[id]);
  const config = ctx.snapshot.config;
  const where = resolve(ctx.root, git(ctx.root, ['rev-parse', '--git-path', `accord-pr-${id}.md`]).trim());

  let title = prTitle(id, facts.title);
  let body: string;
  let source: string;
  let remaining: string[] = [];
  if (config?.pr?.command !== undefined) {
    // the script replaces the template entirely; it reads the ticket from an absolute file, which for a draft on a backlog branch is a copy written next to the body file
    let ticketFile = resolve(ctx.root, ticket.file);
    const branch = snapshot.queued?.[id]?.branch;
    if (branch !== undefined) {
      const text = queuedText(ctx.root, branch, id);
      if (text !== undefined) {
        ticketFile = resolve(ctx.root, git(ctx.root, ['rev-parse', '--git-path', `accord-pr-${id}-ticket.md`]).trim());
        writeFileSync(ticketFile, text);
      }
    }
    const built = runScript(ctx, config.pr.command, id, ticketFile.replaceAll('\\', '/'));
    title = built.title;
    body = built.body;
    source = 'script: pr.command';
  } else {
    const configured = config?.pr?.template;
    const tracked = gitTracked(ctx.root);
    if (configured !== undefined && !tracked.includes(configured)) {
      throw new UsageError(`pr.template ${shown(configured)} is not a file git tracks in this repository - fix: name a tracked file (git ls-files lists them), or remove the key with accord config unset pr.template`);
    }
    const found = findTemplate(tracked, configured);
    if (found !== undefined) {
      const filled = fillTemplate(readTemplate(ctx.root, found.path), facts);
      body = filled.body;
      remaining = filled.remaining;
      source = `template: ${shown(found.path)}${found.count !== undefined && found.count > 1 ? ` (first of ${found.count}; set pr.template to choose)` : ''}`;
    } else {
      body = ticket.frontmatter?.type === 'epic' ? epicBody(facts.intent) : todaysBody(branchSubjects(ctx.root));
      source = 'template: none';
    }
  }
  const problem = prTitleProblem(title);
  if (problem !== undefined) throw new UsageError(`ticket ${id}: ${problem}`);
  writeFileSync(where, body);
  ctx.stdout.write(`title: ${title}\n`);
  ctx.stdout.write(`body-file: ${where.replaceAll('\\', '/')}\n`);
  ctx.stdout.write(source + '\n');
  for (const heading of remaining) ctx.stdout.write(`remaining: ${shown(heading)}\n`);
  return 0;
}
