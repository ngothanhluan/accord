// ST-LN-83 D-03, D-06 `accord new ticket --queue`: put the draft ticket on a new branch backlog/<id>-<date> made from origin's
// default branch, in a temporary worktree, and push it. G-07-2 (A-1): when origin's default branch has a people mapping that does not list the
// creator, the same commit holds one added people line in accord/config.yml. Nothing of the checkout the command runs in is written: HEAD's
// config.yml is only read, to tell the session whether an uncommitted entry is left to remove, so it works from inside a ticket session:
// that ticket's branch, HEAD, working tree and worktrees stay as they were.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { addPersonEntry, lintSnapshot, loadSnapshot, peopleOf, renderSubject } from '@accord-dev/accord-core';
import { gitDefaultRef, gitFilesAt, loadRefInput, UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';
import type { Creator } from './ticket-shared.js';
import { git, gitNoPrompt, gitOk } from './worktree.js';

const NOTHING = ' - nothing was created';

/** The UTC date, `YYYY-MM-DD`, that names the branch and opens the queued draft's Intent. */
export const utcDate = (): string => new Date().toISOString().slice(0, 10);

const firstLine = (err: unknown): string => String((err as { stderr?: string }).stderr ?? err).trim().split('\n')[0];

/** Delete the registration git keeps for `wt` and for no other worktree: the folder under `<common dir>/worktrees` whose `gitdir` file names `<wt>/.git`. A failure leaves the entry for `accord worktree clean`, which prunes it with the ST-LN-55 check. */
export function forgetRegistration(root: string, wt: string): void {
  try {
    const slashed = (x: string): string => x.trim().replaceAll('\\', '/').toLowerCase();
    const same = (x: string): boolean => slashed(x) === slashed(wt + '/.git');
    const dir = git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim() + '/worktrees';
    for (const name of readdirSync(dir)) {
      if (same(readFileSync(join(dir, name, 'gitdir'), 'utf8'))) rmSync(join(dir, name), { recursive: true, force: true });
    }
  } catch {
    // no registration to find
  }
}

/**
 * The refusal text for a branch that already exists in this clone, or undefined when it does not. Phase 08.8 D-17: the delete hint is the repository's own
 * (accord/product/conventions.md line 9), `git update-ref -d refs/heads/<branch> <sha>` with the sha read here, so a commit made after this check is never
 * lost; a value that is not a 40 or 64 digit hash gets no command (as the audit's NO_COMMAND_TIP does). `nothing` is the command's closing phrase.
 */
export function existingBranchRefusal(root: string, branch: string, nothing: string): string | undefined {
  let tip: string;
  try {
    tip = git(root, ['rev-parse', '--verify', '-q', 'refs/heads/' + branch]).trim();
  } catch {
    return undefined;
  }
  const how = /^([0-9a-f]{40}|[0-9a-f]{64})$/.test(tip) ? `delete it with git update-ref -d refs/heads/${branch} ${tip}` : 'delete it by hand (its tip could not be read as a hash, so no command is printed)';
  return `${branch} already exists in this clone - ${how}, then try again${nothing}`;
}

const listsKey = (people: Record<string, string> | undefined, key: string): boolean =>
  people !== undefined && Object.keys(people).some((k) => k.toLowerCase() === key.toLowerCase());

/**
 * Write each text of `files` (a path under accord/tickets/ and its text) on `backlog/<id in lower case>-<date>`, one commit over origin's default
 * branch, and push that commit. A single ticket passes one file; an epic and its stories (ST-LN-28 D-14) pass them all, `id` being the epic's.
 * The commit also holds the `creator`'s people entry, added to the default branch's accord/config.yml, when that file has a people mapping
 * that does not list the creator (G-07-2 A-1); a default branch with no people mapping gets none, so the queue never switches the id convention on.
 * Prints the branch, the base, the subject and the `queue.merge` setting, which the queue route of `/accord` (`/accord queue <idea>`) acts on (D-02, D-03), then a `people:` line
 * about the creator's entry.
 */
export function queueTicket(ctx: CommandContext, id: string, files: Record<string, string>, date: string = utcDate(), creator?: Creator): number {
  const rels = Object.keys(files);
  const root = ctx.root;
  if (!gitOk(root, ['remote', 'get-url', 'origin'])) throw new UsageError('no origin remote - accord new ticket --queue pushes the draft there' + NOTHING);
  try {
    gitNoPrompt(root, ['fetch', '--no-prune', 'origin'], undefined, ctx.ssh);
  } catch (err) {
    throw new UsageError('fetch from origin failed: ' + firstLine(err) + NOTHING);
  }
  const ref = gitDefaultRef(root);
  if (ref === undefined) throw new UsageError('no origin/main in this clone - run git fetch origin, then try again' + NOTHING);
  const short = ref.replace('refs/remotes/origin/', '');
  const base = git(root, ['rev-parse', ref]).trim();
  const branch = 'backlog/' + id.toLowerCase() + '-' + date;

  // T-07-05, T-07-08: the branch name is valid and free everywhere, and the default branch does not hold the ticket, before the temporary worktree is made
  if (!gitOk(root, ['check-ref-format', '--branch', branch])) throw new UsageError(`${branch} is not a valid branch name` + NOTHING);
  let onOrigin: string;
  try {
    onOrigin = gitNoPrompt(root, ['ls-remote', 'origin', 'refs/heads/' + branch], undefined, ctx.ssh).trim();
  } catch (err) {
    throw new UsageError('could not read the branches of origin: ' + firstLine(err) + NOTHING);
  }
  if (onOrigin !== '') {
    throw new UsageError(`${branch} already exists on origin - pick another id, or delete it with git push origin --delete ${branch}, then try again` + NOTHING);
  }
  const here = existingBranchRefusal(root, branch, NOTHING);
  if (here !== undefined) throw new UsageError(here);
  for (const rel of rels) {
    if (gitOk(root, ['cat-file', '-e', `${ref}:${rel}`])) throw new UsageError(`${rel} already exists on ${short}` + NOTHING);
  }

  // The draft is read back with the default branch's tickets before anything is written, as `accord drop` does.
  const input = loadRefInput(root, ref);
  for (const rel of rels) {
    input.files[rel] = files[rel];
    if (!input.tree.includes(rel)) input.tree.push(rel);
  }
  // G-07-2 A-1: the creator's entry joins the commit when the default branch has a people mapping that lacks it; the lint below reads the edited file
  let config: string | undefined;
  let noMapping = false;
  let removeHere = false;
  if (creator !== undefined) {
    const text = input.files['accord/config.yml'];
    const old = text === undefined ? undefined : peopleOf(text);
    if (text === undefined || old === undefined) noMapping = true;
    else if (!listsKey(old, creator.key)) {
      config = addPersonEntry(text, creator.key, creator.initials);
      if (config === undefined) {
        throw new UsageError(
          `could not add ${JSON.stringify(creator.key)}: ${creator.initials} under people in accord/config.yml of ${short} - add it there, then try again` + NOTHING,
        );
      }
      input.files['accord/config.yml'] = config;
      let committed = false;
      try {
        const head = gitFilesAt(root, 'HEAD', ['accord/config.yml'])['accord/config.yml'];
        committed = head !== undefined && listsKey(peopleOf(head), creator.key);
      } catch {
        // no readable HEAD config counts as not committed
      }
      removeHere = listsKey(ctx.snapshot.config?.people, creator.key) && !committed;
    }
  }
  const errors = lintSnapshot(loadSnapshot(input)).findings.filter((f) => f.level === 'error');
  if (errors.length > 0) {
    throw new UsageError(
      `the draft would fail lint on ${short}:\n` + errors.map((f) => `${f.file}: ${f.rule}: ${f.reason}`).join('\n') + `\nfix these on ${short} first` + NOTHING,
    );
  }

  const subject = renderSubject(ctx.snapshot.config, 'queue', id);
  // the real path: git records the long form of a Windows short path, and forgetRegistration compares paths
  const folder = realpathSync.native(mkdtempSync(join(tmpdir(), 'accord-queue-')));
  const wt = join(folder, 'wt');
  let sha: string;
  try {
    git(root, ['worktree', 'add', '--detach', wt, base]);
    for (const rel of rels) {
      const file = join(wt, ...rel.split('/'));
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, files[rel]);
    }
    const written = [...rels];
    if (config !== undefined) {
      writeFileSync(join(wt, 'accord', 'config.yml'), config);
      written.push('accord/config.yml');
    }
    git(wt, ['add', '--', ...written]);
    // no hook: the repository's own commit hook has no installed dependencies in a throwaway folder, and accord linted the draft above
    git(wt, ['commit', '-q', '--no-verify', '-m', subject]);
    sha = git(wt, ['rev-parse', 'HEAD']).trim();
  } finally {
    let removed = true;
    try {
      git(root, ['worktree', 'remove', '--force', wt]);
    } catch {
      removed = false;
    }
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
    // 07-review WR-02: never `git worktree prune`; it drops every entry whose folder is missing, and for one whose detached HEAD is on no branch (ST-LN-55) that is the only ref to its commit
    if (!removed) forgetRegistration(root, wt);
  }
  try {
    gitNoPrompt(root, ['push', 'origin', sha + ':refs/heads/' + branch], undefined, ctx.ssh);
  } catch (err) {
    throw new UsageError(`the draft is committed as ${sha} but the push failed: ${firstLine(err)} - push it with git push origin ${sha}:refs/heads/${branch}`);
  }
  ctx.stdout.write(`branch: ${branch}\nbase: ${short}\ntitle: ${subject}\nmerge: ${ctx.snapshot.config?.queue?.merge ?? 'owner'}\n`);
  if (config !== undefined && creator !== undefined) {
    const clause = removeHere ? '; remove this entry, and only it, from accord/config.yml here, leaving every other line as it is' : '';
    ctx.stdout.write(`people: ${JSON.stringify(creator.key)}: ${creator.initials} - committed with the draft${clause}\n`);
  } else if (noMapping) {
    ctx.stdout.write("people: no entry committed - origin's default branch has no people mapping, and the queue never creates one\n");
  }
  return 0;
}
