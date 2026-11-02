// ST-LN-81 `accord scout check <file>`: core judges a scout report against the files git tracks; this file
// contributes the facts (git's tracked list, the files on disk) and the printed form.
import { readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { scoutCheck } from '@accord-dev/accord-core';
import type { ScoutFacts, ScoutResult } from '@accord-dev/accord-core';
import { gitTracked, UsageError } from '../load/fs.js';
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

export function scoutCheckCommand(ctx: CommandContext, file: string, cwd: string): number {
  const abs = resolve(cwd, file);
  let text: string;
  try {
    text = readFileSync(abs, 'utf8');
  } catch (err) {
    throw new UsageError(('cannot read ' + file + ': ' + (err instanceof Error ? err.message : String(err))).replace(/\\/g, '/'));
  }
  const path = repoPath(ctx.root, abs);
  let config: string | undefined;
  try {
    config = readFileSync(join(ctx.root, 'accord', 'config.yml'), 'utf8');
  } catch {
    config = undefined;
  }
  const rendered = ctx.snapshot.config === undefined ? [] : renderedFiles(ctx.snapshot.config).map((f) => f.path);
  const result = scoutCheck({
    ...workingFacts(ctx.root),
    text,
    rendered,
    ...(config === undefined ? {} : { config }),
    ...(path === undefined ? {} : { path }),
  });
  ctx.stdout.write(scoutLines(result));
  return result.failures.length > 0 ? 1 : 0;
}
