// Phase 08.9.3 D-07, D-04, T-08.9.3-28: the one place `gh` is run for a repository that is not the one this checkout is. `gh` takes the repository from `GH_REPO` (`<owner>/<repo>`), so it needs no clone and no session
// aims it at another folder; the value comes from `ghRepoOf` of a `remote:` accord/config.yml declared and its schema validated, never from typed text. The call is an argument array with no shell and no prompt.
// Callers pass read verbs only (`accord repos status` reads a pull request and writes nothing, Phase 15 D-21).
import { execFileSync } from 'node:child_process';
import { parseRepoUrl } from '@accord-dev/accord-core';

/** One `gh` call may run this long and print this much; a call over either is a failed call. */
const GH_TIMEOUT_MS = 60_000;
const GH_MAX_BUFFER = 16 * 1024 * 1024;

/** The owner and repository patterns of core's product/repo.ts (a pull request link is read with them): the value of `GH_REPO` can name nothing but a github.com repository. */
const OWNER = /^[A-Za-z0-9][A-Za-z0-9_-]{0,38}$/;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;

/** `ssh.github.com` is github.com over port 443; an ssh config alias such as `github.com-work` is not placed (it may be any host). */
const HOSTS: readonly string[] = ['github.com', 'ssh.github.com'];

/**
 * The `<owner>/<repo>` of a remote URL that names a repository on github.com, or undefined for any other host or form: the answer `GH_REPO` is set from. The parts pass the same character
 * limits as a pull request link (no leading `-`, no `.` or `..` repository, none ending `.git`).
 */
export function ghRepoOf(remote: string): string | undefined {
  const where = parseRepoUrl(remote);
  if (where === undefined || !HOSTS.includes(where.host)) return undefined;
  const { owner, repo } = where;
  if (!OWNER.test(owner) || !REPO.test(repo) || repo === '.' || repo === '..' || repo.toLowerCase().endsWith('.git')) return undefined;
  return `${owner}/${repo}`;
}

/**
 * Run `gh` by name with an argument array and no shell, from `root` (this checkout). The environment is the process's with `env` over it; a prompt and the update notice are never allowed. With `repo`
 * (an `<owner>/<repo>` that passes the patterns above, else a thrown Error before anything runs) `GH_REPO` is set to it, over whatever the environment held, so `gh` reads that repository.
 */
export function ghRun(root: string, args: string[], env: NodeJS.ProcessEnv, repo?: string): string {
  if (repo !== undefined) {
    const [owner, name, ...rest] = repo.split('/');
    if (rest.length > 0 || !OWNER.test(owner) || !REPO.test(name ?? '')) throw new Error('not an <owner>/<repo> name: ' + repo.slice(0, 80).replace(/[^\x20-\x7e]/g, ''));
  }
  return execFileSync('gh', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: GH_TIMEOUT_MS,
    maxBuffer: GH_MAX_BUFFER,
    env: { ...process.env, ...env, GH_PROMPT_DISABLED: '1', GH_NO_UPDATE_NOTIFIER: '1', ...(repo === undefined ? {} : { GH_REPO: repo }) },
  });
}

/** The first line of what a failed `gh` said, with control characters dropped and at most 200 characters: it is text from outside and is printed as one line. */
export function ghFirstLine(err: unknown): string {
  const e = err as { stderr?: unknown; message?: unknown };
  const said = String(e.stderr ?? '').trim() !== '' ? String(e.stderr) : String(e.message ?? err);
  const line = (said.trim().split(/\r?\n/)[0] ?? '').replace(/[^\x20-\x7e]/g, '').trim();
  return (line === '' ? 'gh failed' : line).slice(0, 200);
}

/**
 * The `<owner>/<repo>` `gh` is aimed at for the declared repository `name` (Ruling R17): `ghRepoOf` of `repos.<name>.remote`, or undefined when `name` is not declared or its remote is not a github.com one.
 */
export function ghRepoOfDeclared(config: { repos?: Readonly<Record<string, { remote: string }>> } | undefined, name: string): string | undefined {
  const repos = config?.repos;
  return repos !== undefined && Object.hasOwn(repos, name) ? ghRepoOf(repos[name].remote) : undefined;
}
