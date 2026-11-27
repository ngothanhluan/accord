// Phase 8.1 D-01, D-03: `accord pr <id>` builds the title and the body file of a ticket's pull request and prints them; the skills at the pull request sites only pass them to
// `gh pr create --title <title> --body-file <file>`. The body comes from the team's script (`pr.command`, only after `accord trust`), which replaces the template entirely; else from the
// repository's PR template with every heading kept and what the ticket knows filled in; else it is today's fixed body. It reads the repository and writes files under .git: it never calls `gh` (D-03).
import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deployOrderBlock, epicBody, fillTemplate, findTemplate, normaliseText, prFacts, prTitle, parseRepoUrl, prTitleProblem, SAFE_BRANCH, firstMainSlice, sliceBlock, sliceBudget, sliceFacts, sliceTitle, todaysBody, workOf } from '@accord-dev/accord-core';
import type { PrFacts, SliceHome, SlicePart } from '@accord-dev/accord-core';
import { gitBranchCommits, gitDefaultRef, gitFilesAt, gitTracked, UsageError, withQueued } from '../load/fs.js';
import { ghFirstLine, ghRepoOf, ghRepoOfDeclared, ghRun } from '../load/gh.js';
import { originOf } from '../load/repos.js';
import { scriptRefusal, shown } from '../load/script-trust.js';
import { gitSliceSize, sliceHomeOf } from '../load/slice-size.js';
import { runTeamCommand } from '../load/team-run.js';
import type { CommandContext } from '../run.js';
import { renderedFilesOf } from './branch-fact.js';
import { withNext } from './next-action.js';
import { defaultBranch, newestOf } from './pr-wait.js';
import { branchOf, git, ID } from './worktree.js';

/**
 * Phase 15 D-06: slice `value` of ticket `id`'s plan, or a usage error (exit 2): the value is not a whole number of 1 to 3 digits, the plan holds no `## Slice` section, or none has that number.
 * `of` is the plan's last slice number; `covers` the tokens of the slice's `covers:` line.
 */
function sliceOf(snapshot: CommandContext['snapshot'], id: string, value: string): { n: number; of: number; covers: string[] } {
  if (!/^[0-9]{1,3}$/.test(value)) throw new UsageError(`--slice needs a whole number from 1 to the plan's last slice, got "${shown(value.slice(0, 40))}"`);
  const slices = workOf(snapshot, id)?.plan?.slices;
  if (slices === undefined || slices.length === 0) throw new UsageError(`${id} has no "## Slice" section in its plan, so --slice does not apply`);
  const n = Number(value);
  const found = slices.find((s) => s.n === n);
  if (found === undefined) throw new UsageError(`--slice ${value} is not one of the plan's slices (1 to ${Math.max(...slices.map((s) => s.n))})`);
  return { n, of: Math.max(...slices.map((s) => s.n)), covers: found.covers };
}

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
 * The `Ticket:` line of the pull request of a slice built in another repository, which holds no ticket of its own: a link to the ticket file on this repository's claim branch when this repository's origin is on github.com
 * (`ghRepoOf` vets owner and repository; the branch name passes SAFE_BRANCH), else the file and branch in plain words with the host, owner and repository of the origin when it reads as one. The origin URL itself is
 * never printed, so a credential in it never reaches another repository's pull request (T-08.9.3-33).
 */
function ticketLine(ctx: CommandContext, id: string): string {
  const path = `accord/tickets/${id}.md`;
  const claim = branchOf(ctx.snapshot, id);
  const safe = SAFE_BRANCH.test(claim) && !claim.startsWith('-') && !claim.includes('..');
  const origin = originOf(ctx.root);
  const slug = origin === undefined ? undefined : ghRepoOf(origin);
  if (slug !== undefined && safe) return `Ticket: https://github.com/${slug}/blob/${claim}/${path}\n`;
  const parsed = origin === undefined ? undefined : parseRepoUrl(origin);
  const of = parsed === undefined ? '' : ` of ${shown(`${parsed.host}/${parsed.owner}/${parsed.repo}`)}`;
  return `Ticket: ${path}${safe ? ` on branch ${claim}` : ''}${of}\n`;
}

/**
 * Phase 08.9.3 D-03, D-08: the pull request of a slice built in another repository. Its body is the slice block, the deploy order and the `Ticket:` line: no template and no `pr.command` of either repository is read (the
 * other repository needs nothing of accord, and this one's template describes this repository's change). Besides `title:`, `body-file:` and `template: none (another repository)` it prints what the skill gives
 * `gh pr create --repo`: `repository: <owner>/<repo>` (from the declared remote), `head: slice/<id>/<n>` and `base:`, the previous slice of that repository's branch, or for its first slice that repository's default branch read in
 * its stored clone. A remote that is not github.com, or a default branch that cannot be read, is exit 2 with nothing written.
 */
function otherRepositoryPr(
  ctx: CommandContext,
  snapshot: CommandContext['snapshot'],
  id: string,
  at: { slice: { n: number; of: number }; part: SlicePart; facts: PrFacts; home: SliceHome & { repo: string }; title: string; where: string; order: string },
): number {
  const { home, part, facts, title, where } = at;
  const problem = prTitleProblem(title);
  if (problem !== undefined) throw new UsageError(`ticket ${id}: ${problem}`);
  const slug = ghRepoOfDeclared(ctx.snapshot.config, home.repo);
  if (slug === undefined) throw new UsageError(`${home.repo}: its remote is not a github.com repository, so the pull request of slice ${part.n} cannot be made with gh pr create --repo; nothing was written`);
  let base: string;
  if (home.previous !== undefined) base = home.previous.branch;
  else {
    const def = defaultBranch(ctx, home.repo);
    if (def === undefined) {
      throw new UsageError(`the default branch of ${home.repo} is not known here: its clone is not stored or has no origin/HEAD, origin/main or origin/master - fix: accord repos set ${home.repo} <path>, then git fetch origin there; nothing was written`);
    }
    base = def;
  }
  const size = gitSliceSize(ctx.root, snapshot, id, part.n, renderedFilesOf(ctx.snapshot.config));
  writeFileSync(where, sliceBlock(part, facts.criteria, size, sliceBudget(snapshot)) + at.order + ticketLine(ctx, id));
  ctx.stdout.write(`title: ${title}\n`);
  ctx.stdout.write(`body-file: ${where.replaceAll('\\', '/')}\n`);
  ctx.stdout.write('template: none (another repository)\n');
  ctx.stdout.write(`repository: ${slug}\n`);
  ctx.stdout.write(`head: ${home.branch}\n`);
  ctx.stdout.write(`base: ${base}\n`);
  return 0;
}

/**
 * Print `title:`, `body-file:`, then `template: <path>` (or `script: pr.command`, or `template: none`) and one `remaining:` line per section of the template nobody could fill, in that
 * order, and write the body to `<git-path>/accord-pr-<id>.md` (one per worktree, never tracked, overwritten on each run). Exit 2 for an id that is no ticket here or on a backlog branch,
 * for a title the quoted `gh` argument cannot carry, and for everything `pr.command` and `pr.template` can get wrong.
 * Phase 15 D-06, SC-2: with `--slice <n>` the pull request is slice n's: the title ends `(slice <n> of <m>)`, the body opens with `Slice <n> of <m>`, the criteria that slice delivers and its measured size,
 * and a template's criteria and evidence sections list only that slice's criteria; a plan with no `## Slice` section, or a number it has no slice for, is exit 2. Without the flag nothing changes.
 * Phase 08.9.3: when the plan names another repository the block is followed by the deploy order (D-08), and a slice built in the other repository gets `otherRepositoryPr` (D-03).
 */
export function pr(ctx: CommandContext, id: string, options: { slice?: string } = {}): number {
  if (!ID.test(id)) throw new UsageError('not a valid ticket id: ' + id);
  // an epic opens its pull request from a backlog branch, so its ticket is only on that branch: read it as the dashboard does
  const snapshot = Object.hasOwn(ctx.snapshot.tickets, id) ? ctx.snapshot : withQueued(ctx.root, ctx.snapshot);
  if (!Object.hasOwn(snapshot.tickets, id)) throw new UsageError(`no ticket ${id} in accord/tickets/ or on a backlog branch - give the id of a ticket of this checkout or one queued with accord new ticket --queue`);
  const ticket = snapshot.tickets[id];
  // Phase 08.8 D-16 item 8: with no parsed frontmatter the title is unknown, and the pull request would be titled with the id and carry no Intent
  if (ticket.frontmatter === undefined) {
    throw new UsageError(`ticket ${id}: the frontmatter of ${ticket.file} does not parse, so its title is unknown - fix it (accord lint names the problem), then run accord pr again`);
  }
  const whole: PrFacts = prFacts(ticket, snapshot.verifications[id]);
  const slice = options.slice === undefined ? undefined : sliceOf(snapshot, id, options.slice);
  const facts: PrFacts = slice === undefined ? whole : sliceFacts(whole, slice.covers);
  const part: SlicePart | undefined = slice === undefined ? undefined : { n: slice.n, of: slice.of };
  const config = ctx.snapshot.config;
  const where = resolve(ctx.root, git(ctx.root, ['rev-parse', '--git-path', `accord-pr-${id}.md`]).trim());

  // Phase 08.9.3 D-08: a plan that names another repository has every slice pull request state the deploy order; a slice built in another repository is its own kind of pull request (D-03)
  const order = slice === undefined ? '' : deployOrderBlock(workOf(snapshot, id)?.plan?.slices ?? []);
  const home = slice === undefined ? undefined : sliceHomeOf(snapshot, id, slice.n);
  let title = prTitle(id, facts.title, part);
  if (slice !== undefined && part !== undefined && home?.repo !== undefined) {
    return otherRepositoryPr(ctx, snapshot, id, { slice, part, facts, home: { ...home, repo: home.repo }, title, where, order });
  }
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
    title = part === undefined ? built.title : sliceTitle(built.title, part);
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
  // the slice block opens the body whatever made it (template, script or today's list): it is what says which slice this pull request is (D-06)
  if (slice !== undefined && part !== undefined) {
    const size = gitSliceSize(ctx.root, snapshot, id, slice.n, renderedFilesOf(config));
    body = sliceBlock(part, facts.criteria, size, sliceBudget(snapshot)) + order + body;
  }
  writeFileSync(where, body);
  ctx.stdout.write(`title: ${title}\n`);
  ctx.stdout.write(`body-file: ${where.replaceAll('\\', '/')}\n`);
  ctx.stdout.write(source + '\n');
  for (const heading of remaining) ctx.stdout.write(`remaining: ${shown(heading)}\n`);
  return 0;
}

/**
 * Phase 08.9.3 D-08, Ruling R19: `accord pr ready <id> [--slice <n>]` marks slice n's pull request ready for review (`gh pr ready`, aimed at the other repository by `GH_REPO` for a slice built there) only when every EARLIER slice
 * built in another repository than slice n has a merged pull request: the later pull request stays a draft until `gh` shows the earlier one merged, so the tool server merges and deploys before the service that calls it.
 * Prints `ready: #<n>`, `ready: #<n> (already)` (exit 0), or `held: slice <n> waits for <repository> slice <k> (#<pr> | no pull request yet)` (exit 1, nothing changed). Exit 2 for a slice the plan lacks, a slice with no pull
 * request, a pull request that is merged or closed, a remote that is not github.com, or a `gh` that cannot answer. Without `--slice` the pull request is the claim branch's (the first slice of this repository when the plan has
 * slices). The slices of one repository keep the Phase 15 stack and its base move (`accord pr wait`): they hold nothing here. It never merges, closes or comments (Phase 15 D-21); marking ready is its one write.
 */
export function prReady(ctx: CommandContext, id: string, options: { slice?: string } = {}): number {
  if (!ID.test(id)) throw new UsageError('not a valid ticket id: ' + id);
  if (!Object.hasOwn(ctx.snapshot.tickets, id)) throw new UsageError(`no ticket ${id} in accord/tickets/ - give the id of a ticket of this checkout`);
  const planned = workOf(ctx.snapshot, id)?.plan?.slices ?? [];
  let n: number | undefined;
  if (options.slice !== undefined) n = sliceOf(ctx.snapshot, id, options.slice).n;
  else if (planned.length > 0) {
    n = firstMainSlice(planned);
    if (n === undefined) throw new UsageError(`every slice of ${id} is built in another repository, so there is no claim branch pull request - give --slice <n>`);
  }
  const home = n === undefined ? undefined : sliceHomeOf(ctx.snapshot, id, n);
  if (n !== undefined && home === undefined) throw new UsageError(`${id}: slice ${n} names no branch this command passes to gh`);
  const branch = home?.branch ?? branchOf(ctx.snapshot, id);
  if (!SAFE_BRANCH.test(branch) || branch.startsWith('-')) throw new UsageError(`ticket ${id}: the branch ${branch} is not a name this command passes to gh`);
  const where = (repo: string | undefined): string | undefined => {
    if (repo === undefined) return undefined;
    const slug = ghRepoOfDeclared(ctx.snapshot.config, repo);
    if (slug === undefined) throw new UsageError(`${repo}: its remote is not a github.com repository, so its pull requests cannot be read or marked ready with gh`);
    return slug;
  };
  const say = (line: string): void => void ctx.stdout.write(line + '\n');
  try {
    const slug = where(home?.repo);
    // D-08: the earlier slices built in another repository than this slice, lowest first; the first one whose pull request is not merged holds this one
    for (const earlier of [...new Map(planned.filter((s) => n !== undefined && s.n < n && s.repo !== home?.repo).map((s) => [s.n, s])).values()].sort((a, b) => a.n - b.n)) {
      const at = sliceHomeOf(ctx.snapshot, id, earlier.n);
      if (at === undefined) throw new UsageError(`${id}: slice ${earlier.n} names no branch this command passes to gh`);
      const there = newestOf(ctx, { branch: at.branch, ...(at.repo === undefined ? {} : { ghRepo: where(at.repo) as string }) });
      if (there === undefined || there.state !== 'MERGED') {
        say(`held: slice ${n} waits for ${earlier.repo ?? 'this repository'} slice ${earlier.n} (${there === undefined ? 'no pull request yet' : '#' + there.number})`);
        return 1;
      }
    }
    const mine = newestOf(ctx, { branch, ...(slug === undefined ? {} : { ghRepo: slug }) });
    if (mine === undefined) throw new UsageError(`${n === undefined ? id : `${id} slice ${n}`} has no pull request for ${branch} yet - open it first`);
    if (mine.state === 'MERGED' || mine.state === 'CLOSED') throw new UsageError(`pull request #${mine.number} of ${branch} is ${mine.state === 'MERGED' ? 'merged' : 'closed'}, so it cannot be marked ready`);
    if (mine.isDraft !== true) {
      say(`ready: #${mine.number} (already)`);
      return 0;
    }
    ghRun(ctx.root, ['pr', 'ready', String(mine.number)], ctx.env, slug);
    say(`ready: #${mine.number}`);
    return 0;
  } catch (err) {
    if (err instanceof UsageError) throw err;
    say(`pr-ready: unavailable: ${ghFirstLine(err)}`);
    return 2;
  }
}
