// Phase 08.9.3 D-01, D-02: `accord repos set <name> <path>` stores where the clone of another repository (declared under `repos:` in accord/config.yml by its remote URL) lives on this machine,
// and `accord repos status` reads each one back. Both read and write only; nothing is cloned, fetched, switched or touched in the other repository (D-02, D-04). The CLI has no prompt: a skill asks the
// person where the clone is, and its answer ends in `accord repos set`.
import { resolve } from 'node:path';
import { UsageError } from '../load/fs.js';
import { checkClone, resolveRepo, storeRepoPath, toPosix } from '../load/repos.js';
import type { CommandContext } from '../run.js';

/** The names `repos:` declares, in name order. */
const declared = (ctx: CommandContext): string[] => Object.keys(ctx.snapshot.config?.repos ?? {}).sort();

/**
 * `accord repos set <name> <path>`: store the clone at `path` (made absolute against `cwd`, kept with forward slashes) as where `name` lives. Refused with exit 2, storing nothing, unless `name` is declared,
 * `path` is a clone (a `.git` folder: a linked worktree has a `.git` file and a plain folder none) and its configured origin names `repos.<name>.remote`.
 */
export function reposSet(ctx: CommandContext, name: string, path: string, cwd: string): number {
  const names = declared(ctx);
  const entry = ctx.snapshot.config?.repos;
  if (entry === undefined || !Object.hasOwn(entry, name)) {
    throw new UsageError(
      names.length === 0
        ? `accord/config.yml declares no repository (repos:), so there is no ${name} to store; nothing was stored`
        : `${name} is not declared in accord/config.yml; it declares ${names.join(', ')}; nothing was stored`,
    );
  }
  const where = toPosix(resolve(cwd, path));
  const remote = entry[name].remote;
  const check = checkClone(where, remote);
  if (!check.ok) {
    if (check.why === 'origin') throw new UsageError(`the clone at ${where} has origin ${check.origin ?? 'none'}, not ${remote} (repos.${name}.remote); nothing was stored`);
    throw new UsageError(
      check.why === 'no-folder'
        ? `${where} is not a folder; nothing was stored`
        : `${where} is not a clone: it has no .git folder of its own (a linked worktree or a plain folder is no clone); nothing was stored`,
    );
  }
  try {
    storeRepoPath(ctx.root, name, where);
  } catch (e) {
    throw new UsageError(`could not store the path of ${name}: ${(e as Error).message}`);
  }
  ctx.stdout.write(`repos: ${name} -> ${where}\n`);
  return 0;
}

/** `accord repos status`: one line per declared repository, `<name>: <path> (stored)` for a verified clone and the refusal line otherwise; exit 2 after the last line when any is refused or not found. */
export function reposStatus(ctx: CommandContext): number {
  const names = declared(ctx);
  if (names.length === 0) {
    ctx.stdout.write('repos: none declared in accord/config.yml\n');
    return 0;
  }
  let code = 0;
  for (const name of names) {
    const found = resolveRepo(ctx.root, ctx.snapshot.config, name);
    if ('refused' in found) {
      ctx.stdout.write(found.refused + '\n');
      code = 2;
    } else {
      ctx.stdout.write(`${name}: ${found.path} (${found.how})\n`);
    }
  }
  return code;
}
