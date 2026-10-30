// ST-LN-78: `tests.affected` in this repository runs vitest through this script. On Windows with Docker running, it runs
// vitest in a Linux container over this checkout, where the suite takes about 85 s against 11-30 min on the host:
// every cli test spawns git and bash, and process creation on Windows is about ten times slower. Elsewhere, with
// ACCORD_TEST_LINUX=0, or without Docker, it runs vitest on the host as before. Windows coverage stays with CI's
// windows-latest jobs and `tests.full`, which still runs on the host.
//
// Usage: node scripts/test-linux.mjs <vitest arguments>
//
// The container runs as root on node:24-alpine with git, bash and procps: Debian trixie's git 2.47 lists a clean merge's
// files under --remerge-diff, which fails two after-verify tests that pass with git 2.54, and busybox ps has no lstart.
// The container's node_modules lives in Docker volumes keyed by package-lock.json, since the host's holds Windows
// binaries; it is installed once per key. The JUnit report's folder is mounted from the host, so `accord task-done`
// reads the report where `--outputFile.junit` names it. The test lock (test/lock.ts) is per machine on the host and per
// container here, so a container run does not wait for a host run; its memory guard reads the Docker VM's memory.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DOCKERFILE = "FROM node:24-alpine\nRUN apk add --no-cache git bash procps && git config --system --add safe.directory '*'\n";
const LABEL = 'accord-test-linux';
// Passed on to the container when set on the host.
const ENV = ['ACCORD_TEST_WORKERS', 'CI', 'FORCE_COLOR', 'NO_COLOR'];

/** A host path with forward slashes and an upper-case drive letter, so Windows paths compare as strings. */
const slash = (p) => p.replace(/\\/g, '/').replace(/^[a-z]:/, (d) => d.toUpperCase());
const absolute = (p) => p.startsWith('/') || /^[A-Za-z]:\//.test(p);
/**
 * The path of `p` below `root`, '' for root itself, or undefined when `p` is outside it. A drive-letter path compares
 * without regard to case, as Windows does, and keeps the letter case of `p`.
 */
function below(root, p) {
  if (/^[A-Z]:\//.test(root)) {
    const r = root.toLowerCase();
    const l = p.toLowerCase();
    return l === r ? '' : l.startsWith(r + '/') ? p.slice(r.length + 1).replace(/\/+$/, '') : undefined;
  }
  const rel = path.posix.relative(root, p);
  return rel.startsWith('..') || absolute(rel) ? undefined : rel;
}

/**
 * The `docker run` arguments for one vitest run, or undefined when `cwd` is outside `root`. Pure: every host path is
 * given. `git` is the checkout's git folders (`git rev-parse --git-dir --git-common-dir`), absent when git is not there;
 * `dotGit` is the host file that replaces a worktree's `.git` file, whose gitdir names a host path the container
 * cannot reach. Returns the arguments, the host path of the JUnit report, and the text of that `.git` file.
 */
export function containerArgs({ root, cwd, args, image, volume, workspaces, git, dotGit, env }) {
  // fileURLToPath of the script's folder ends with a separator; `${root}/.git` below must not hold two.
  root = slash(root).replace(/\/+$/, '');
  cwd = slash(cwd);
  const at = below(root, cwd);
  if (at === undefined) return undefined;
  const run = ['run', '--rm', '--init', '-v', `${root}:/work`, '-v', `${volume}-state:/state`];
  const modules = [];
  for (const dir of ['', ...workspaces]) {
    modules.push(path.posix.join('/work', dir, 'node_modules'));
    run.push('-v', `${volume}-${dir === '' ? 'root' : dir.replace(/\//g, '-')}:${modules.at(-1)}`);
  }
  let dotGitText;
  if (git !== undefined) {
    const dir = slash(git.dir);
    const common = slash(git.common);
    const inCommon = below(common, dir);
    if (dir === `${root}/.git`) run.push('-v', `${dir}:/work/.git:ro`);
    else if (inCommon !== undefined) {
      dotGitText = `gitdir: ${path.posix.join('/gitcommon', inCommon)}\n`;
      run.push('-v', `${common}:/gitcommon:ro`, '-v', `${slash(dotGit)}:/work/.git:ro`);
    }
  }
  let report;
  const out = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const inline = a.startsWith('--outputFile.junit=');
    if (inline || (a === '--outputFile.junit' && i + 1 < args.length)) {
      const value = slash(inline ? a.slice('--outputFile.junit='.length) : args[++i]);
      report = absolute(value) ? value : path.posix.join(cwd, value);
      run.push('-v', `${path.posix.dirname(report)}:/out`);
      out.push(`--outputFile.junit=/out/${path.posix.basename(report)}`);
      continue;
    }
    const inRoot = absolute(slash(a)) ? below(root, slash(a)) : undefined;
    out.push(inRoot === undefined ? a : path.posix.join('/work', inRoot));
  }
  for (const name of ENV) if (env[name] !== undefined) run.push('-e', name);
  run.push('-w', path.posix.join('/work', at), image, 'sh', '-c', inside(modules), 'sh', ...out);
  return { run, report, dotGitText };
}

// Installs node_modules into the volumes once per key, under a lock so two runs never install at once; npm ci cannot
// remove a mount point, so a half-finished install is emptied first, the mounted volumes only.
const inside = (modules) => `set -e
exec 9>/state/lock
flock 9
if [ ! -f /state/installed ]; then
  for d in ${modules.join(' ')}; do find "$d" -mindepth 1 -maxdepth 1 -exec rm -rf {} +; done
  (cd /work && npm ci --no-audit --no-fund --no-update-notifier --loglevel=error && npm rebuild @accord-dev/accord --ignore-scripts --no-update-notifier --loglevel=error)
  touch /state/installed
fi
flock -u 9
exec node /work/node_modules/vitest/vitest.mjs "$@"`;

function docker(args, options = {}) {
  return spawnSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...options });
}

function onHost(root, args) {
  const r = spawnSync(process.execPath, [path.join(root, 'node_modules', 'vitest', 'vitest.mjs'), ...args], { stdio: 'inherit' });
  return r.status ?? 1;
}

export function main(args, env = process.env) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  if (process.platform !== 'win32' || env.ACCORD_TEST_LINUX === '0') return onHost(root, args);
  if (docker(['info', '--format', '{{.ServerVersion}}'], { timeout: 30_000 }).status !== 0) {
    process.stderr.write('test-linux: Docker is not running; vitest runs on this machine\n');
    return onHost(root, args);
  }
  const hash = (text) => createHash('sha256').update(text).digest('hex').slice(0, 12);
  const image = `${LABEL}:${hash(DOCKERFILE)}`;
  if (docker(['image', 'inspect', image]).status !== 0) {
    const built = docker(['build', '--label', LABEL, '-t', image, '-'], { input: DOCKERFILE, stdio: ['pipe', 'inherit', 'inherit'] });
    if (built.status !== 0) {
      process.stderr.write(`test-linux: docker build of ${image} failed\n`);
      return built.status ?? 1;
    }
    // Images of an older DOCKERFILE; one a running container still uses is kept.
    for (const old of docker(['image', 'ls', '--filter', `label=${LABEL}`, '--format', '{{.Repository}}:{{.Tag}}']).stdout.split('\n')) {
      if (old !== '' && old !== image) docker(['image', 'rm', old]);
    }
  }
  const volume = `${LABEL}-${hash(image + readFileSync(path.join(root, 'package-lock.json'), 'utf8'))}`;
  const workspaces = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).workspaces ?? [];
  const rev = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir'], { cwd: root, encoding: 'utf8' });
  const [dir, common] = rev.status === 0 ? rev.stdout.trim().split('\n') : [];
  const dotGit = path.join(tmpdir(), `${LABEL}-${process.pid}.git`);
  const plan = containerArgs({
    root, cwd: process.cwd(), args, image, volume, workspaces, dotGit, env,
    git: dir !== undefined && common !== undefined ? { dir, common } : undefined,
  });
  if (plan === undefined) {
    process.stderr.write(`test-linux: ${process.cwd()} is outside ${root}; vitest runs on this machine\n`);
    return onHost(root, args);
  }
  for (const v of ['state', 'root', ...workspaces.map((w) => w.replace(/\//g, '-'))]) docker(['volume', 'create', '--label', LABEL, `${volume}-${v}`]);
  removeOldVolumes(volume);
  const before = plan.report === undefined ? undefined : mtime(plan.report);
  if (plan.report !== undefined) mkdirSync(path.dirname(plan.report), { recursive: true });
  if (plan.dotGitText !== undefined) writeFileSync(dotGit, plan.dotGitText);
  try {
    return spawnSync('docker', plan.run, { stdio: 'inherit' }).status ?? 1;
  } finally {
    if (existsSync(dotGit)) rmSync(dotGit);
    // The container writes the report with the Docker VM's clock, which can lag the host's after sleep, and
    // `accord task-done` refuses a report older than the last commit: a report this run wrote takes the host's time.
    if (plan.report !== undefined && mtime(plan.report) !== before && existsSync(plan.report)) {
      const now = new Date();
      utimesSync(plan.report, now, now);
    }
  }
}

const mtime = (file) => (existsSync(file) ? statSync(file).mtimeMs : undefined);

// A week, so worktrees on different package-lock.json files keep their own volumes while they are worked, and a volume
// another run has just created is never removed before it is mounted.
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;

/** Removes labelled volumes of another key created more than KEEP_MS ago; one still mounted by a run is kept. */
function removeOldVolumes(volume) {
  const names = docker(['volume', 'ls', '-q', '--filter', `label=${LABEL}`]).stdout.split('\n').filter((n) => n !== '' && !n.startsWith(`${volume}-`));
  if (names.length === 0) return;
  for (const line of docker(['volume', 'inspect', '--format', '{{.Name}} {{.CreatedAt}}', ...names]).stdout.split('\n')) {
    const [name, created] = line.split(' ');
    if (name && Date.now() - Date.parse(created) > KEEP_MS) docker(['volume', 'rm', name]);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) process.exitCode = main(process.argv.slice(2));
