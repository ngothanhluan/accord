// ST-LN-83 D-03, D-06 `accord new ticket --queue`: put the draft ticket on a new branch backlog/<id>-<date> made from origin's
// default branch, in a temporary worktree, and push it. Nothing of the checkout the command runs in is read or written
// after the load, so it works from inside a ticket session: that ticket's branch, HEAD, working tree and worktrees stay as they were.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { lintSnapshot, loadSnapshot, renderSubject } from '@accord-dev/accord-core';
import { gitDefaultRef, loadRefInput, UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';
import { git, gitNoPrompt, gitOk } from './worktree.js';

const NOTHING = ' - nothing was created';

/** The UTC date, `YYYY-MM-DD`, that names the branch and opens the queued draft's Intent. */
export const utcDate = (): string => new Date().toISOString().slice(0, 10);

const firstLine = (err: unknown): string => String((err as { stderr?: string }).stderr ?? err).trim().split('\n')[0];

/**
 * Write `text` as `rel` on `backlog/<id in lower case>-<date>`, one commit over origin's default branch, and push that commit.
 * Prints the branch, the base, the subject and the `queue.merge` setting, which the `/accord-queue` command acts on (D-02, D-03).
 */
export function queueTicket(ctx: CommandContext, id: string, rel: string, text: string, date: string = utcDate()): number {
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

  // The draft is read back with the default branch's tickets before anything is written, as `accord drop` does.
  const input = loadRefInput(root, ref);
  input.files[rel] = text;
  if (!input.tree.includes(rel)) input.tree.push(rel);
  const errors = lintSnapshot(loadSnapshot(input)).findings.filter((f) => f.level === 'error');
  if (errors.length > 0) {
    throw new UsageError(
      `the draft would fail lint on ${short}:\n` + errors.map((f) => `${f.file}: ${f.rule}: ${f.reason}`).join('\n') + `\nfix these on ${short} first` + NOTHING,
    );
  }

  const subject = renderSubject(ctx.snapshot.config, 'queue', id);
  const folder = mkdtempSync(join(tmpdir(), 'accord-queue-'));
  const wt = join(folder, 'wt');
  let sha: string;
  try {
    git(root, ['worktree', 'add', '--detach', wt, base]);
    const file = join(wt, ...rel.split('/'));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
    git(wt, ['add', '--', rel]);
    // no hook: the repository's own commit hook has no installed dependencies in a throwaway folder, and accord linted the draft above
    git(wt, ['commit', '-q', '--no-verify', '-m', subject]);
    sha = git(wt, ['rev-parse', 'HEAD']).trim();
  } finally {
    try {
      git(root, ['worktree', 'remove', '--force', wt]);
    } catch {
      // the folder is deleted below and the registration pruned
    }
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
    try {
      git(root, ['worktree', 'prune']);
    } catch {
      // nothing left to prune that git would not prune itself
    }
  }
  try {
    gitNoPrompt(root, ['push', 'origin', sha + ':refs/heads/' + branch], undefined, ctx.ssh);
  } catch (err) {
    throw new UsageError(`the draft is committed as ${sha} but the push failed: ${firstLine(err)} - push it with git push origin ${sha}:refs/heads/${branch}`);
  }
  ctx.stdout.write(`branch: ${branch}\nbase: ${short}\ntitle: ${subject}\nmerge: ${ctx.snapshot.config?.queue?.merge ?? 'owner'}\n`);
  return 0;
}
