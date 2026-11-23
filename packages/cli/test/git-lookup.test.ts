// Phase 08.8 D-15: Node raises ENOENT both for a folder it cannot open and for a program it cannot find, and on Windows a folder or a PATH written in Git Bash form
// (`/c/Work/x`, `/c/...:/usr/bin`) is neither a folder nor a path list Node can use. These cases pin the one helper both git spawn sites go through.
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { UsageError } from '../src/load/fs.js';
import { gitStartFailure, runGitSync, windowsForm, windowsPathList } from '../src/load/git-spawn.js';
import { cleanup, commitAll, gitRun, makeLaneRepo, run } from './helpers/repo.js';

const enoent = Object.assign(new Error('spawnSync git ENOENT'), { code: 'ENOENT' });

describe('git lookup (D-15)', () => {
  const repos: string[] = [];
  afterEach(() => {
    while (repos.length > 0) cleanup(repos.pop() as string);
  });

  // Phase 08.8 D-15: ENOENT names a missing folder or a missing git, never both, and the folder wins when the folder is the missing one.
  it('risk:complex-branching a git start failure names a missing folder apart from a missing git (D-15)', () => {
    const gone = (): boolean => false;
    const here = (): boolean => true;
    const missing = gitStartFailure(enoent, '/no/such/dir', { PATH: '/usr/bin:/bin' }, gone, 'linux');
    expect(missing).toBeInstanceOf(UsageError);
    expect(missing.message).toBe('cannot use the folder /no/such/dir: it does not exist here');
    const noGit = gitStartFailure(enoent, '/work', { PATH: '/usr/bin:/bin:/opt/x' }, here, 'linux');
    expect(noGit.message).toBe('git is required but was not found on PATH (3 entries searched)');
    const empty = gitStartFailure(enoent, '/work', {}, here, 'linux');
    expect(empty.message).toBe('git is required but was not found on PATH (0 entries searched)');
    const win = gitStartFailure(enoent, '/c/x', { PATH: 'C:\\a;C:\\b' }, gone, 'win32');
    expect(win.message).toContain('cannot use the folder /c/x: it does not exist here');
    expect(win.message, 'a Git Bash folder form is offered in the Windows form').toContain('C:/x');
    const other = gitStartFailure(Object.assign(new Error('boom'), { code: 'EACCES', stderr: 'fatal: not a git repository\n' }), '/work', { PATH: '/usr/bin' }, here, 'linux');
    expect(other.message).toBe('not a git repository (or git failed): /work\nfatal: not a git repository');
  });

  // Phase 08.8 D-15: the two conversions Windows needs for what Git Bash hands over; both leave every other form and platform alone.
  it('risk:regression windowsForm and windowsPathList read Git Bash forms (D-15)', () => {
    expect(windowsForm('/c/Work/x', 'win32')).toBe('C:/Work/x');
    expect(windowsForm('/c', 'win32')).toBe('C:/');
    expect(windowsForm('/c/x', 'linux')).toBe('/c/x');
    expect(windowsForm('C:/x', 'win32')).toBe('C:/x');
    expect(windowsForm('/tmp/x', 'win32'), 'a path with no one-letter drive is left for git to judge').toBe('/tmp/x');
    expect(windowsPathList('/c/Program Files/Git/cmd:/usr/bin', 'win32')).toBe('C:\\Program Files\\Git\\cmd');
    expect(windowsPathList('/c/a:/d/b', 'win32')).toBe('C:\\a;D:\\b');
    expect(windowsPathList('C:\\a;C:\\b', 'win32')).toBe('C:\\a;C:\\b');
    expect(windowsPathList('/c/a:/d/b', 'linux')).toBe('/c/a:/d/b');
  });

  // Phase 08.8 D-15: the live 0.11.1 case, reproduced by cause: the hook's `cwd` arrives as `/c/...` and the repository is found anyway.
  it.runIf(process.platform === 'win32')('risk:regression on Windows the session hook finds the repository from a Git Bash cwd (D-15)', async () => {
    const repo = makeLaneRepo();
    repos.push(repo);
    commitAll(repo);
    gitRun(repo, 'checkout', '-b', 't/T-1');
    const bashForm = repo.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_m, d: string) => '/' + d.toLowerCase());
    expect(bashForm.startsWith('/'), 'the sandbox path is on a drive').toBe(true);
    const r = await run(['hook', 'session-resume'], repo, {}, JSON.stringify({ cwd: bashForm }));
    expect(r.code, r.err).toBe(0);
    for (const text of [r.out, r.err]) {
      expect(text).not.toContain('git is required');
      expect(text).not.toContain('cannot use the folder');
    }
    expect(r.out, 'the anchor of the ticket on the branch shows the repository was read').toContain('Owners can export their report as CSV.');
  }, 60_000);

  // Phase 08.8 D-15: a PATH written as `/c/...` entries joined by `:` is retried once in Windows form.
  it.runIf(process.platform === 'win32')('risk:regression runGitSync retries a Git Bash form PATH once on Windows (D-15)', () => {
    const gitDir = (process.env.PATH ?? process.env.Path ?? '').split(delimiter).find((d) => d !== '' && existsSync(join(d, 'git.exe')));
    expect(gitDir, 'git.exe is on this host PATH').toBeDefined();
    const bashPath = (gitDir as string).replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_m, d: string) => '/' + d.toLowerCase());
    const sandbox = makeLaneRepo();
    repos.push(sandbox);
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k.toLowerCase() !== 'path'));
    const out = runGitSync(['--version'], { cwd: sandbox, env: { ...env, PATH: bashPath + ':/usr/bin' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    expect(out).toMatch(/^git version /);
  });
});
