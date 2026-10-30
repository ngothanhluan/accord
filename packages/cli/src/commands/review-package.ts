// Spec §10 `accord review-package <id> [--base <ref>]`: what a reviewer reads — commits, stat, and the diff
// with ten lines of context. git only, literal argument arrays, no shell (CLI-07).
import { execFileSync } from 'node:child_process';
import { interfaceSigns, outsideScope, undeclaredFiles, workOf } from '@accord-dev/accord-core';
import { defaultRefOf, UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';
import { branchFactFor } from './branch-fact.js';
import { requireLaneTicket } from './lane-args.js';

// No leading '-', so a ref can never be read as a git option; no spaces or shell metacharacters.
// `~` and `^` after the first character admit HEAD~3 and main^.
const REF = /^[A-Za-z0-9][A-Za-z0-9._/~^-]*$/;

export function reviewPackage(ctx: CommandContext, id: string, options: { base?: string }): number {
  const laneS = requireLaneTicket(ctx, id).frontmatter?.lane === 'S';
  const base = options.base ?? (laneS ? defaultRefOf(ctx.root) : workOf(ctx.snapshot, id)?.plan?.baseline);
  if (base === undefined) {
    throw new UsageError(
      laneS
        ? 'no --base given and no default branch: none of origin/HEAD, origin/main, origin/master, main or master resolves'
        : 'no --base given and plan.md records no baseline:',
    );
  }
  if (!REF.test(base)) throw new UsageError('not a git ref: ' + base);
  const git = (args: string[]) =>
    execFileSync('git', args, {
      cwd: ctx.root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
  // Every git log passes the signature flags (conventions.md), so a signed HEAD never changes the output.
  const gitLog = (args: string[]) => git(['-c', 'log.showSignature=false', 'log', '--no-show-signature', ...args]);
  const range = base + '...HEAD';
  // A short reason for the one failure that explains itself, else git's own first stderr line.
  const why = (e: unknown): string => {
    const err = e as { code?: string; stderr?: string };
    if (err.code === 'ENOBUFS') return 'the diff is larger than 64 MiB';
    const line = (err.stderr ?? '').split('\n').find((l) => l.trim() !== '');
    return line === undefined ? 'git failed' : line.replace(/^fatal: /, '').trim();
  };
  try {
    git(['rev-parse', '--verify', '--quiet', base + '^{commit}']);
  } catch {
    let headless = false;
    try {
      git(['rev-parse', '--verify', '--quiet', 'HEAD^{commit}']);
    } catch {
      headless = true;
    }
    throw new UsageError(headless ? 'the repository has no commit to review' : 'unknown base ref: ' + base);
  }
  // ST-LN-26: a fix made after a merge from the default branch is reviewed without what that merge brought in.
  const def = defaultRefOf(ctx.root);
  const short = def?.replace(/^refs\/(remotes|heads)\//, '');
  let excluded = false;
  if (def !== undefined) {
    try {
      git(['merge-base', '--is-ancestor', 'HEAD', def]);
    } catch {
      try {
        const count = (extra: string[]) => git(['rev-list', '--count', base + '..HEAD', ...extra, '--']).trim();
        excluded = count(['^' + def]) !== count([]);
      } catch {
        // a count that fails leaves today's package
      }
    }
  }
  // Each git log is tried with --remerge-diff first and once more without it (git < 2.36).
  const log = (args: string[]): string => {
    const r = ['^' + def];
    const full = (extra: string[]) => gitLog([...args, ...extra, base + '..HEAD', ...r, '--']);
    try {
      return full(['--remerge-diff']);
    } catch {
      return full([]);
    }
  };
  const f = branchFactFor(ctx, id);
  const s = { ...ctx.snapshot, branchFacts: { [id]: f } };
  let parts: string[];
  try {
    parts = excluded
      ? [
          `# Review package: ${id} (${base}..HEAD, without ${short})`,
          '## Commits',
          gitLog(['--no-color', '--format=%h %s', base + '..HEAD', '^' + def, '--']).trimEnd() || '(none)',
          '## Stat',
          log(['--reverse', '--no-color', '--no-ext-diff', '--stat', '--format=%h %s']).trimEnd() || '(no changes)',
          '## Diff',
          log(['--reverse', '--no-color', '--no-ext-diff', '-p', '-U10', '--format=%h %s']).trimEnd() || '(no changes)',
        ]
      : [
          `# Review package: ${id} (${range})`,
          '## Commits',
          gitLog(['--no-color', '--format=%h %s', base + '..HEAD', '--']).trimEnd() || '(none)',
          '## Stat',
          git(['diff', '--no-color', '--no-ext-diff', '--stat', range, '--']).trimEnd() || '(no changes)',
          '## Diff',
          git(['diff', '--no-color', '--no-ext-diff', '-U10', range, '--']).trimEnd() || '(no changes)',
        ];
    const changed = excluded
      ? [...new Set(log(['--no-renames', '--name-only', '-z', '--format=']).split(/[\0\n]/).filter((p) => p !== ''))]
      : git(['diff', '--name-only', '-z', '--no-renames', range, '--']).split('\0').filter((p) => p !== '');
    const undeclared = undeclaredFiles(s, id, changed);
    parts.splice(
      parts.indexOf('## Diff'),
      0,
      '## Undeclared files',
      undeclared === undefined ? '(no plan)' : undeclared.join('\n') || '(none)',
    );
  } catch (e) {
    throw new UsageError(`cannot diff ${range}: ${why(e)}`);
  }
  // ST-LN-62: what `accord gate done` would name, shown before it runs; the command never fails on the fact.
  const cannot = (why: string) => `(cannot tell: ${why})`;
  const shown: string[] = [];
  if (laneS) {
    const o = outsideScope(s, id);
    shown.push(
      '## Out-of-scope files',
      'error' in f ? cannot(f.error) : o !== undefined && 'cannot' in o ? cannot(o.cannot) : o?.paths.join('\n') || '(none)',
    );
  }
  const signs = interfaceSigns(s, id);
  shown.push(
    '## Interface signs',
    'error' in f ? cannot(f.error) : signs?.map((x) => `${x.path}: ${x.sign}`).join('\n') || '(none)',
  );
  parts.splice(parts.indexOf('## Stat'), 0, ...shown);
  ctx.stdout.write(parts.join('\n\n') + '\n');
  return 0;
}
