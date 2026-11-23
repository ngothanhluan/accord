// Phase 08.8 D-15: Node raises the same ENOENT for a folder it cannot open and for a program it cannot find, so "git is required but was not found" was also printed for a
// missing folder. On Windows the hook's `cwd` or the PATH can also arrive in Git Bash form (`/c/Work/x`, `/c/...:/usr/bin`), which Node cannot use. This is the one place git
// is started for `repoRoot` and `gitTree`, and the one place an ENOENT becomes a sentence. `git` is spawned by name with a literal argument array and no shell, never a
// package manager and never a `.cmd` shim (CLI-07); the PATH retry only rewrites the form of entries already on PATH and adds none.
import { execFileSync } from 'node:child_process';
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { existsSync } from 'node:fs';
import { UsageError } from './fs.js';

/** A Git Bash drive form: `/c` or `/c/rest`, one letter after the first slash and nothing else in that segment. */
const DRIVE_FORM = /^\/([A-Za-z])(?:\/(.*))?$/s;

/** `/c/Work/x` as `C:/Work/x` on Windows; every other path and every other platform is returned as given. */
export function windowsForm(path: string, platform: NodeJS.Platform = process.platform): string {
  if (platform !== 'win32') return path;
  const m = DRIVE_FORM.exec(path);
  return m === null ? path : `${(m[1] as string).toUpperCase()}:/${m[2] ?? ''}`;
}

/** The entries of a PATH, empty ones dropped: `;`-separated on Windows unless it is written the Git Bash way (starts with `/`, no `;`), else `:`-separated. */
function pathEntries(path: string, platform: NodeJS.Platform): string[] {
  const sep = platform === 'win32' && (path.includes(';') || !path.startsWith('/')) ? ';' : ':';
  return path.split(sep).filter((e) => e !== '');
}

/**
 * A Git Bash PATH (`/c/Program Files/Git/cmd:/usr/bin`) as a Windows one (`C:\Program Files\Git\cmd`) on Windows: each `/x/...` entry becomes `X:\...`, an entry with no
 * drive letter cannot be placed and is dropped. A `;`-separated PATH, a PATH that starts with a drive and every other platform are returned as given.
 */
export function windowsPathList(path: string, platform: NodeJS.Platform = process.platform): string {
  if (platform !== 'win32' || path.includes(';') || /^[A-Za-z]:/.test(path)) return path;
  return pathEntries(path, platform)
    .flatMap((e) => {
      const m = DRIVE_FORM.exec(e);
      return m === null ? [] : [`${(m[1] as string).toUpperCase()}:\\${(m[2] ?? '').replace(/\//g, '\\')}`];
    })
    .join(';');
}

/** A value of the person's environment or of a hook input, shown with control characters spelled out (T-08.8-22). */
const shown = (text: string): string => text.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, (ch) => '<U+' + (ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0') + '>');

/**
 * The sentence for a failed git start in `cwd`. ENOENT is either of two causes: the folder does not exist here (then, on Windows, a `/c/...` form is offered as `C:/...`), or
 * git is not on PATH (then how many PATH entries were searched). Any other failure keeps `not a git repository (or git failed)` with git's own words.
 */
export function gitStartFailure(
  err: unknown,
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
  exists: (path: string) => boolean = existsSync,
  platform: NodeJS.Platform = process.platform,
): UsageError {
  const e = err as { code?: string; stderr?: unknown };
  if (e.code !== 'ENOENT') return new UsageError('not a git repository (or git failed): ' + shown(cwd) + '\n' + String(e.stderr ?? '').trim());
  const folder = windowsForm(cwd, platform);
  if (!exists(folder)) {
    const offer = folder === cwd ? '' : ` (on Windows this folder is written ${shown(folder)})`;
    return new UsageError(`cannot use the folder ${shown(cwd)}: it does not exist here${offer}`);
  }
  const key = Object.keys(env).find((k) => k.toLowerCase() === 'path');
  const path = key === undefined ? '' : (env[key] ?? '');
  return new UsageError(`git is required but was not found on PATH (${pathEntries(path, platform).length} entries searched)`);
}

/** What `runGitSync` takes: the options of `execFileSync` with a string encoding, and the folder git runs in. */
export type GitSpawn = ExecFileSyncOptionsWithStringEncoding & { cwd: string };

/**
 * Runs `git <args>` in `opts.cwd` and returns its output. A Git Bash folder form is converted first; on Windows an ENOENT in a folder that exists, with a PATH written the Git Bash
 * way, is retried once with that PATH in Windows form. A remaining ENOENT becomes `gitStartFailure`; any other error is thrown as it came, for the caller's own wording.
 */
export function runGitSync(args: readonly string[], opts: GitSpawn): string {
  const cwd = windowsForm(opts.cwd);
  try {
    return execFileSync('git', [...args], { ...opts, cwd });
  } catch (err) {
    if ((err as { code?: string }).code !== 'ENOENT') throw err;
    const env = opts.env ?? process.env;
    if (process.platform === 'win32' && existsSync(cwd)) {
      const key = Object.keys(env).find((k) => k.toLowerCase() === 'path');
      const fixed = key === undefined ? '' : windowsPathList(env[key] ?? '');
      if (key !== undefined && fixed !== '' && fixed !== env[key]) {
        try {
          return execFileSync('git', [...args], { ...opts, cwd, env: { ...env, [key]: fixed } });
        } catch (again) {
          if ((again as { code?: string }).code !== 'ENOENT') throw again;
        }
      }
    }
    throw gitStartFailure(err, opts.cwd, env);
  }
}
