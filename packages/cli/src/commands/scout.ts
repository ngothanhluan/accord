// ST-LN-81 `accord scout check <file>`: core judges a scout report against the files git tracks; this file
// contributes the facts (git's tracked list, the files on disk) and the printed form.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { parseScoutReport, scoutCheck } from '@accord-dev/accord-core';
import type { ScoutFacts, ScoutResult } from '@accord-dev/accord-core';
import { gitTracked, gitTreeAt, hasLocalChanges, lastCommitOf, readBlobs, UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';
import { renderedFiles } from './branch-fact.js';

/** The printed form of a result: one `fail:` line per failure, then the verdict line. */
export function scoutLines(result: ScoutResult): string {
  let out = '';
  for (const f of result.failures) out += 'fail: ' + f + '\n';
  const lane = result.lane;
  if (lane !== undefined) {
    out += 'expected files: ' + lane.expected.length + (lane.expected.length > 0 ? ' (' + lane.expected.join(', ') + ')' : '') + '\n';
    out += 'code areas: ' + lane.areas.length + (lane.areas.length > 0 ? ' (' + lane.areas.join(', ') + ')' : '') + '\n';
    for (const s of lane.sensitive) out += 'sensitive: ' + s.path + ' is under ' + s.entry + ' (' + s.area + '), accord/config.yml:' + s.line + '\n';
    out += 'lifts to lane M: ' + (lane.lifts.length > 0 ? lane.lifts.join('; ') : 'no counted condition holds') + '\n';
  }
  const n = result.failures.length;
  out += n === 0 ? 'scout check passed\n' : 'scout check failed: ' + n + (n === 1 ? ' failure' : ' failures') + '\n';
  return out;
}

/** The working tree's facts: the tracked list from `git ls-files -z` and the files on disk. */
export function workingFacts(root: string): Pick<ScoutFacts, 'tracked' | 'read'> {
  return {
    tracked: gitTracked(root),
    read: (paths) =>
      paths.map((p) => {
        try {
          return readFileSync(join(root, ...p.split('/')), 'utf8');
        } catch {
          return undefined;
        }
      }),
  };
}

/** The report's repository path, or undefined when it lies outside the repository. */
function repoPath(root: string, abs: string): string | undefined {
  const rel = relative(realpathSync.native(root), realpathSync.native(abs)).split(sep).join('/');
  return rel === '' || rel.startsWith('..') || isAbsolute(rel) ? undefined : rel;
}

/** The one judging call, for either tree: the facts of that tree plus the working tree's config and generated paths. */
function judge(
  ctx: CommandContext,
  facts: Pick<ScoutFacts, 'tracked' | 'read'>,
  text: string,
  path: string | undefined,
  ticket?: string,
): ScoutResult {
  let config: string | undefined;
  try {
    config = readFileSync(join(ctx.root, 'accord', 'config.yml'), 'utf8');
  } catch {
    config = undefined;
  }
  const rendered = ctx.snapshot.config === undefined ? [] : renderedFiles(ctx.snapshot.config).map((f) => f.path);
  return scoutCheck({
    ...facts,
    text,
    rendered,
    ...(config === undefined ? {} : { config }),
    ...(path === undefined ? {} : { path }),
    ...(ticket === undefined ? {} : { ticket }),
  });
}

export function scoutCheckCommand(ctx: CommandContext, file: string, cwd: string, ticket?: string): number {
  if (ticket !== undefined) {
    const named = /^[^/\\]+$/.test(ticket) && ticket !== '.' && ticket !== '..';
    if (!named || !existsSync(join(ctx.root, 'accord', 'tickets', ticket + '.md'))) {
      throw new UsageError('--ticket ' + ticket.replace(/\\/g, '/') + ': there is no accord/tickets/' + ticket.replace(/\\/g, '/') + '.md');
    }
  }
  const abs = resolve(cwd, file);
  let text: string;
  try {
    text = readFileSync(abs, 'utf8');
  } catch (err) {
    throw new UsageError(('cannot read ' + file + ': ' + (err instanceof Error ? err.message : String(err))).replace(/\\/g, '/'));
  }
  const result = judge(ctx, workingFacts(ctx.root), text, repoPath(ctx.root, abs), ticket);
  ctx.stdout.write(scoutLines(result));
  return result.failures.length > 0 ? 1 : 0;
}

/** The facts of `commit`: its tracked paths and its blobs, read in bounded batches. */
export function commitFacts(root: string, commit: string): Pick<ScoutFacts, 'tracked' | 'read'> {
  const tree = gitTreeAt(root, commit).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const byPath = new Map(tree.map((b) => [b.path, b]));
  return {
    tracked: tree.map((b) => b.path),
    read: (paths) => {
      const found: { sha: string; size: number }[] = [];
      const slots: number[] = [];
      paths.forEach((p, i) => {
        const blob = byPath.get(p);
        if (blob !== undefined) {
          found.push(blob);
          slots.push(i);
        }
      });
      const texts = readBlobs(root, found, 'commit ' + commit);
      const out: (string | undefined)[] = new Array<string | undefined>(paths.length).fill(undefined);
      slots.forEach((slot, k) => {
        out[slot] = texts[k];
      });
      return out;
    },
  };
}

/** Why `accord approve <id>` must refuse a lane M ticket for want of a scout report, or undefined when it may go on. */
export function scoutRefusal(ctx: CommandContext, id: string): string | undefined {
  const file = 'accord/tickets/' + id + '/scout.md';
  let text: string;
  try {
    text = readFileSync(join(ctx.root, 'accord', 'tickets', id, 'scout.md'), 'utf8');
  } catch {
    return (
      'cannot approve ' + id + ': ' + file + " is missing; save the scout's report there once accord scout check passes on it, " +
      'or write a line "skipped: <reason>" in it\n'
    );
  }
  if (parseScoutReport(text).skipped !== undefined) return undefined;
  const commit = hasLocalChanges(ctx.root, file) ? undefined : lastCommitOf(ctx.root, file);
  const facts = commit === undefined ? workingFacts(ctx.root) : commitFacts(ctx.root, commit);
  const result = judge(ctx, facts, text, file);
  if (result.failures.length === 0) return undefined;
  const where = commit === undefined ? 'on the working tree, since it has uncommitted changes' : 'at commit ' + commit.slice(0, 12) + ', the commit that last changed it';
  return (
    'cannot approve ' + id + ': ' + file + ' fails accord scout check ' + where + ' and holds no line "skipped: <reason>"\n' +
    result.failures.map((f) => 'fail: ' + f + '\n').join('')
  );
}
