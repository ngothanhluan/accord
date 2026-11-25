// accord hook launcher. Claude Code runs this file for every accord hook:
//   node ${CLAUDE_PROJECT_DIR}/.claude/accord.mjs <version> hook <event>
// It starts the accord CLI bundle of exactly <version> from a per-user cache and passes everything through, so a hook
// no longer pays for npx (about 1.5 s per call). The cache holds one folder per version:
//   <cache>/accord/versions/<version>/node_modules/ACCORD_PACKAGE_NAME/dist/cli.js
// A version that is not cached yet is installed once with `npm install --ignore-scripts` into a temporary folder and renamed
// into place. When that fails, a hook prints one line and exits 0, so a missing network never stops a session.
// Plain JavaScript, built-ins only, no dependency: the file is committed to the repository and read by the team.
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE = 'ACCORD_PACKAGE_NAME';
// Exactly what the CLI's own pin check accepts as a version; nothing else may reach a path or an npm argument.
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
// A session start and a session resume tell the model what they print; every other event keeps its stdout for the answer.
const SAYS_ON_STDOUT = new Set(['session-start', 'session-resume']);
const INSTALL_MS = 240_000;

/** One printable line: no control characters, cut at `max`. */
const oneLine = (text, max) =>
  String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l !== '')
    ?.replace(/[^\x20-\x7e]/g, '?')
    .slice(0, max) ?? '';

/** The cache base, the same three lines as the CLI's own cachePath(): LOCALAPPDATA on Windows, XDG_CACHE_HOME elsewhere. */
function cacheBase(io) {
  return io.platform === 'win32'
    ? (io.env.LOCALAPPDATA ?? join(io.homedir, 'AppData', 'Local'))
    : (io.env.XDG_CACHE_HOME ?? join(io.homedir, '.cache'));
}

/** npm's own script beside this Node, so no shell and no npm.cmd shim is needed; undefined when it is not there. */
function npmCli(io) {
  const nodeDir = dirname(io.execPath);
  const beside = io.platform === 'win32' ? join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js') : join(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js');
  return io.fs.existsSync(beside) ? beside : undefined;
}

/**
 * Install `<package>@<version>` into a temporary folder under `versionsDir` and rename it to `folder`. Returns undefined on
 * success, else the one-line reason. The version is already checked against VERSION; every other word is fixed.
 */
function fill(io, versionsDir, folder, version, bundleOf) {
  const temp = join(versionsDir, `.tmp-${version}-${io.pid}`);
  try {
    io.fs.mkdirSync(temp, { recursive: true });
    const args = ['install', '--prefix', temp, '--no-save', '--no-audit', '--no-fund', '--ignore-scripts', `${PACKAGE}@${version}`];
    const script = npmCli(io);
    // cwd is the temporary folder, so a package.json or .npmrc committed in the repository the hook runs in never reaches npm.
    const opts = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: io.env, timeout: INSTALL_MS, cwd: temp };
    // The one place a shell is used: Windows with no npm-cli.js beside Node, where npm is npm.cmd. Fixed words plus the checked version.
    const r = script === undefined ? io.spawnSync('npm', args, { ...opts, shell: io.platform === 'win32' }) : io.spawnSync(io.execPath, [script, ...args], opts);
    if (r.error !== undefined) return oneLine(r.error.message, 160) || 'npm did not start';
    if (r.status !== 0) return oneLine(r.stderr || r.stdout || '', 160) || `npm exited with status ${r.status}`;
    if (!io.fs.existsSync(bundleOf(temp))) return 'the installed package holds no dist/cli.js';
    if (io.fs.existsSync(folder) && !io.fs.existsSync(bundleOf(folder))) io.fs.rmSync(folder, { recursive: true, force: true }); // a half folder is no entry
    try {
      io.fs.renameSync(temp, folder);
    } catch (e) {
      if (!io.fs.existsSync(bundleOf(folder))) return oneLine(e instanceof Error ? e.message : e, 160); // another process may have won the rename
    }
    return undefined;
  } catch (e) {
    return oneLine(e instanceof Error ? e.message : e, 160) || 'the install failed';
  } finally {
    try {
      io.fs.rmSync(temp, { recursive: true, force: true });
    } catch {
      // a leftover temporary folder is harmless
    }
  }
}

/**
 * Run one launcher call and return the exit code. `io` carries everything the call touches, so a test needs no real cache:
 * { argv (the words after the script), env, platform, homedir, execPath, pid, readStdin, fs, spawnSync, stdout, stderr }.
 */
export function launch(io) {
  const [version, ...rest] = io.argv;
  const isHook = rest[0] === 'hook';
  const event = rest[1] ?? '';
  const say = (text) => (isHook && SAYS_ON_STDOUT.has(event) ? io.stdout : io.stderr).write(text + '\n');

  if (typeof version !== 'string' || !VERSION.test(version)) {
    io.stderr.write(`accord: "${oneLine(version ?? '', 40)}" is not a version; the hook expects node .claude/accord.mjs <version> hook <event>\n`);
    return isHook ? 0 : 2;
  }

  const versionsDir = join(cacheBase(io), 'accord', 'versions');
  const folder = join(versionsDir, version);
  const inside = relative(resolve(versionsDir), resolve(folder));
  if (inside === '' || inside.startsWith('..') || isAbsolute(inside)) {
    io.stderr.write('accord: the cache folder for this version is outside the cache\n');
    return isHook ? 0 : 2;
  }
  const bundleOf = (dir) => join(dir, 'node_modules', PACKAGE, 'dist', 'cli.js');
  const bundle = bundleOf(folder);

  if (!io.fs.existsSync(bundle)) {
    const reason = fill(io, versionsDir, folder, version, bundleOf);
    if (reason !== undefined) {
      const line = `accord: accord ${version} is not installed and could not be installed (${reason}); with network access run: node .claude/accord.mjs ${version} --version`;
      if (isHook) {
        say(line);
        return 0;
      }
      io.stderr.write(line + '\n');
      return 2;
    }
  }

  const input = isHook ? io.readStdin() : undefined;
  const r = io.spawnSync(io.execPath, [bundle, ...io.argv.slice(1)], {
    stdio: isHook ? ['pipe', 'inherit', 'inherit'] : 'inherit',
    env: io.env,
    ...(input === undefined ? {} : { input }),
  });
  return r.status ?? 1;
}

const readStdin = () => {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
};

// Run only as the main module, so a test can import `launch` and give it its own io. Both paths go through realpath: a
// repository reached through a link would otherwise differ from the module URL and the launcher would silently do nothing.
const isMain = (() => {
  try {
    return process.argv[1] !== undefined && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
})();
if (isMain) {
  process.exitCode = launch({
    argv: process.argv.slice(2),
    env: process.env,
    platform: process.platform,
    homedir: homedir(),
    execPath: process.execPath,
    pid: process.pid,
    readStdin,
    fs: { existsSync, mkdirSync, renameSync, rmSync },
    spawnSync,
    stdout: process.stdout,
    stderr: process.stderr,
  });
}
