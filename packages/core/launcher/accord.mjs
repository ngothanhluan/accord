// accord hook launcher. Claude Code runs this file for every accord hook:
//   node ${CLAUDE_PROJECT_DIR}/.claude/accord.mjs <version> hook <event>
// It starts the accord CLI bundle of exactly <version> from a per-user cache and passes everything through, so a hook
// no longer pays for npx (about 1.5 s per call). The cache holds one folder per version:
//   <cache>/accord/versions/<version>/node_modules/ACCORD_PACKAGE_NAME/dist/cli.js
// A version that is not cached yet is installed once by npm, with install scripts off, into a temporary folder and renamed into
// place, under a lock folder so two starts install it once. The cache keeps the three newest versions. When the install fails,
// a hook prints one line and exits 0, so a missing network never stops a session.
// Plain JavaScript, built-ins only, no dependency: the file is committed to the repository and read by the team.
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync } from 'node:fs';
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
const LOCK_WAIT_MS = 120_000; // how long a run waits for another run's install of the same version
const LOCK_STALE_MS = 10 * 60_000; // a lock older than this belongs to a killed run and is taken over
const POLL_MS = 200;
const KEEP_VERSIONS = 3; // version folders left after a fill, the running one included
// A first word made only of lowercase letters and dashes is a command (`node .claude/accord.mjs off`), not a version.
const COMMAND_WORD = /^[a-z][a-z-]*$/;
const PIN_LINE = /^accord:\s*"?([^"\s]+)"?\s*$/m;
// `accord off` writes this file in the git common folder; while it exists every hook of the clone is silent (Phase 08.9.2 D-03).
const OFF_MARKER = 'accord-off';

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
    io.fs.rmSync(temp, { recursive: true, force: true }); // a leftover of a killed run with the same pid
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

/** Keep the running version and the newest others, three folders in all; every other version folder is removed. Never throws. */
function prune(io, versionsDir, running) {
  try {
    const found = io.fs
      .readdirSync(versionsDir)
      .filter((name) => name !== running && VERSION.test(name))
      .map((name) => {
        try {
          return { name, time: io.fs.statSync(join(versionsDir, name)).mtimeMs };
        } catch {
          return undefined;
        }
      })
      .filter((entry) => entry !== undefined)
      .sort((a, b) => b.time - a.time);
    for (const old of found.slice(KEEP_VERSIONS - 1)) io.fs.rmSync(join(versionsDir, old.name), { recursive: true, force: true });
  } catch {
    // a cache that cannot be listed is left alone
  }
}

/**
 * Make sure the bundle of `version` is in the cache. One run installs at a time: the lock is a folder made with mkdirSync, so
 * the second run waits (up to LOCK_WAIT_MS) until the bundle appears or the lock is released. Returns undefined when the bundle
 * is there, else the one-line reason.
 */
function ensure(io, versionsDir, folder, version, bundleOf) {
  const lock = join(versionsDir, `.lock-${version}`);
  const began = io.now();
  try {
    io.fs.mkdirSync(versionsDir, { recursive: true });
    for (;;) {
      if (io.fs.existsSync(bundleOf(folder))) return undefined; // another run filled it
      try {
        io.fs.mkdirSync(lock);
        break; // the lock is ours
      } catch (e) {
        if (e?.code !== 'EEXIST') return oneLine(e instanceof Error ? e.message : e, 160) || 'the cache folder is not writable';
      }
      let age;
      try {
        age = io.now() - io.fs.statSync(lock).mtimeMs;
      } catch {
        continue; // released in between: try to take it
      }
      if (age > LOCK_STALE_MS) {
        io.fs.rmSync(lock, { recursive: true, force: true });
        continue;
      }
      if (io.now() - began >= LOCK_WAIT_MS) return `another install of ${version} did not finish within ${LOCK_WAIT_MS / 1000} s`;
      io.sleep(POLL_MS);
    }
    try {
      if (io.fs.existsSync(bundleOf(folder))) return undefined;
      if (io.fs.existsSync(folder)) io.fs.rmSync(folder, { recursive: true, force: true }); // a folder without its bundle is no entry
      const reason = fill(io, versionsDir, folder, version, bundleOf);
      if (reason === undefined) prune(io, versionsDir, version);
      return reason;
    } finally {
      try {
        io.fs.rmSync(lock, { recursive: true, force: true });
      } catch {
        // a lock that cannot be removed is taken over after ten minutes
      }
    }
  } catch (e) {
    return oneLine(e instanceof Error ? e.message : e, 160) || 'the install failed';
  }
}

/** The version accord/config.yml names, read beside this launcher's folder; undefined when there is no pin line. */
function pinOf(io) {
  try {
    const config = join(dirname(dirname(io.launcherPath)), 'accord', 'config.yml');
    return PIN_LINE.exec(io.fs.readFileSync(config, 'utf8'))?.[1];
  } catch {
    return undefined;
  }
}

/**
 * True while the person's off marker (`accord off`) exists in this clone: `<git common dir>/accord-off`, found with plain file reads from the checkout this
 * launcher sits in (`.git` is the common folder itself, or a file `gitdir: <path>` whose `commondir` leads back to it). The same reads as the CLI's gitdir.ts.
 * Never throws; anything unreadable means not off.
 */
function isOff(io) {
  try {
    const root = dirname(dirname(io.launcherPath));
    const dotGit = join(root, '.git');
    let text;
    try {
      text = io.fs.readFileSync(dotGit, 'utf8');
    } catch (e) {
      if (e?.code !== 'EISDIR') return false; // no .git here, or one that cannot be read
      return io.fs.existsSync(join(dotGit, OFF_MARKER)); // a folder: the common folder itself
    }
    const line = String(text).split('\n', 1)[0].trim();
    if (!line.startsWith('gitdir:')) return false;
    const gitDir = resolve(root, line.slice('gitdir:'.length).trim());
    let common = gitDir;
    try {
      const named = String(io.fs.readFileSync(join(gitDir, 'commondir'), 'utf8')).split('\n', 1)[0].trim();
      if (named !== '') common = resolve(gitDir, named);
    } catch {
      // no commondir: the per-worktree folder is the common one
    }
    return io.fs.existsSync(join(common, OFF_MARKER));
  } catch {
    return false;
  }
}

/**
 * True for the one PreToolUse call the CLI answers with `{}` and nothing else: an Agent or Task call for any agent but
 * accord-executor. Write, Edit and MultiEdit (the verification.md guard), an executor dispatch and text that is not JSON all
 * go to the CLI, which fails open on its own.
 */
function answeredAtOnce(text) {
  try {
    const call = JSON.parse(text);
    if (call === null || typeof call !== 'object') return false;
    if (call.tool_name !== 'Agent' && call.tool_name !== 'Task') return false;
    return call.tool_input?.subagent_type !== 'accord-executor';
  } catch {
    return false;
  }
}

/**
 * Run one launcher call and return the exit code. `io` carries everything the call touches, so a test needs no real cache:
 * { argv (the words after the script), env, platform, homedir, execPath, pid, launcherPath, readStdin, fs, spawnSync, now, sleep, stdout, stderr }.
 */
export function launch(io) {
  let argv = io.argv;
  // D-03: switched off for this clone: a hook prints nothing and starts nothing, before the pin, stdin or any cache path is touched.
  if ((argv[0] === 'hook' || argv[1] === 'hook') && isOff(io)) return 0;
  if (typeof argv[0] === 'string' && COMMAND_WORD.test(argv[0])) {
    // No version word: the version is the pin in accord/config.yml, so the line a person types stays short after every upgrade.
    const pin = pinOf(io);
    if (pin === undefined) {
      io.stderr.write('accord: no "accord:" pin found in accord/config.yml beside this launcher; run node .claude/accord.mjs <version> <command>\n');
      return argv[0] === 'hook' ? 0 : 2;
    }
    argv = [pin, ...argv];
  }
  const [version, ...rest] = argv;
  const isHook = rest[0] === 'hook';
  const event = rest[1] ?? '';
  const say = (text) => (isHook && SAYS_ON_STDOUT.has(event) ? io.stdout : io.stderr).write(text + '\n');

  if (typeof version !== 'string' || !VERSION.test(version)) {
    io.stderr.write(`accord: "${oneLine(version ?? '', 40)}" is not a version; the hook expects node .claude/accord.mjs <version> hook <event>\n`);
    return isHook ? 0 : 2;
  }

  // A call for another agent than the executor needs nothing from the repository: answer it before any cache path is built.
  const input = isHook ? io.readStdin() : undefined;
  if (isHook && event === 'pre-tool-use' && answeredAtOnce(input)) {
    io.stdout.write('{}\n');
    return 0;
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
    const reason = ensure(io, versionsDir, folder, version, bundleOf);
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

  const r = io.spawnSync(io.execPath, [bundle, ...argv.slice(1)], {
    stdio: isHook ? ['pipe', 'inherit', 'inherit'] : 'inherit',
    env: io.env,
    ...(input === undefined ? {} : { input }),
  });
  return r.status ?? 1;
}

/** A synchronous pause: Atomics.wait on a private one-element array, no busy loop. */
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

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
    launcherPath: fileURLToPath(import.meta.url),
    readStdin,
    fs: { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync },
    spawnSync,
    now: Date.now,
    sleep,
    stdout: process.stdout,
    stderr: process.stderr,
  });
}
