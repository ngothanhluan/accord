// ST-LN-97 D-12 the team script adapter, so accord can reach a tracker it has no adapter for. Contract
// version 1: `tracker.command` (committed repository content, trusted as `setup` and `git.sync` are, and run by `status` only when the
// default branch names the same command, WR-03) runs
// through the one team runner with the repository root as cwd and the keys on STDIN only, as one line
// `{"version":1,"keys":["ENG-1"]}`; they are never in the command text or argv. It prints one JSON object
// `{"version":1,"issues":{"ENG-1":{"title":"…","state":"…","labels":["…"]}}}`. The environment is the
// caller's plus ACCORD_TRACKER=script and ACCORD_ROOT; accord adds no secret of its own. Whatever the script
// does, its output is DISPLAY ONLY (D-01): a bad exit, a timeout, over-size output, invalid JSON, a wrong
// version or a malformed entry is one warning `tracker script: <reason>` and exit 0, never a verdict or an
// exit code. Unknown keys are ignored and a key the script left out gets an empty cell. Every shown field
// goes through `ascii` (T-05-19), and the run is bounded to 10 s and 1 MiB.
import { runTeamCommand } from '../load/team-run.js';
import { ascii, warningLine } from './common.js';
import type { IssueFacts, TrackerAdapter, TrackerIo, TrackerResult } from './index.js';

/** The script contract version this accord reads; a script that says another is refused, not guessed at. */
const CONTRACT_VERSION = 1;

/** A script may think for longer than an HTTP request, but `status` is a screen someone waits on. */
const SCRIPT_TIMEOUT_MS = 10_000;

/** What a script may print before it is killed: 1 MiB. */
const SCRIPT_MAX_BUFFER = 1024 * 1024;

/** One stderr line is a hint, not a log: cut it so one warning stays one short line. */
const STDERR_LINE_MAX = 160;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A strict v1 entry, reduced to printable ASCII; undefined when it is not exactly that shape. */
function factsOf(entry: unknown): IssueFacts | undefined {
  if (!isObject(entry)) return undefined;
  const { title, state, labels } = entry;
  if (typeof title !== 'string' || typeof state !== 'string') return undefined;
  if (!Array.isArray(labels) || !labels.every((l) => typeof l === 'string')) return undefined;
  return { title: ascii(title), state: ascii(state), labels: (labels as string[]).map((l) => ascii(l)).filter((l) => l !== '') };
}

/** The first stderr line that says something, as printable ASCII and short; undefined when there is none. */
function stderrHint(stderr: string): string | undefined {
  for (const line of stderr.split('\n')) {
    const text = ascii(line);
    if (text !== '') return text.length > STDERR_LINE_MAX ? text.slice(0, STDERR_LINE_MAX) + '...' : text;
  }
  return undefined;
}

/**
 * Ask the team's script about `keys`. Never rejects: the one-line warning is the failure, and the caller
 * prints it to stderr and exits as if nothing had happened. Which check fails first is fixed (timeout,
 * over-size, exit code, JSON, version, shape), so one broken script is always one reason.
 */
export async function fetchScript(
  command: string,
  keys: readonly string[],
  env: NodeJS.ProcessEnv,
  io: TrackerIo,
): Promise<TrackerResult> {
  const distinct = [...new Set(keys)];
  if (distinct.length === 0) return { issues: {} };

  const fail = (reason: string, stderr = ''): TrackerResult => {
    const hint = stderrHint(stderr);
    return { issues: {}, warning: warningLine('script', [reason], hint === undefined ? [] : [hint]) };
  };

  let result;
  try {
    result = (io.run ?? runTeamCommand)(command, {
      cwd: io.root,
      env: { ...env, ACCORD_TRACKER: 'script', ACCORD_ROOT: io.root },
      input: JSON.stringify({ version: CONTRACT_VERSION, keys: distinct }) + '\n',
      timeoutMs: SCRIPT_TIMEOUT_MS,
      maxBuffer: SCRIPT_MAX_BUFFER,
    });
  } catch (err) {
    return fail('could not run: ' + ascii(err instanceof Error ? err.message : String(err)));
  }

  if (result.timedOut) return fail('timed out after ' + SCRIPT_TIMEOUT_MS / 1000 + ' s', result.stderr);
  if (result.oversize) return fail('printed more than ' + SCRIPT_MAX_BUFFER / 1024 / 1024 + ' MiB', result.stderr);
  if (result.code !== 0) {
    return fail(result.code === null ? 'was killed' + (result.signal === null ? '' : ' by ' + ascii(result.signal)) : 'exited ' + result.code, result.stderr);
  }

  let body: unknown;
  try {
    body = JSON.parse(result.stdout);
  } catch {
    return fail('output is not JSON', result.stderr);
  }
  if (!isObject(body)) return fail('output is not a JSON object', result.stderr);
  if (body.version !== CONTRACT_VERSION) {
    const said = body.version === undefined ? 'output has no version' : 'version ' + ascii(JSON.stringify(body.version)) + ' is not supported';
    return fail(said + ', this accord reads version ' + CONTRACT_VERSION, result.stderr);
  }
  if (!isObject(body.issues)) return fail('issues is not an object', result.stderr);

  // A null prototype, so a key such as `__proto__` or `constructor` can neither read nor write anything inherited.
  const issues = Object.create(null) as Record<string, IssueFacts>;
  const failures: string[] = [];
  for (const key of distinct) {
    if (!Object.hasOwn(body.issues, key)) continue; // left out: an empty cell, not a failure
    const facts = factsOf(body.issues[key]);
    if (facts === undefined) failures.push(ascii(key) + ' malformed entry');
    else issues[key] = facts;
  }
  const hint = failures.length === 0 ? undefined : stderrHint(result.stderr);
  const warning = warningLine('script', failures, hint === undefined ? [] : [hint]);
  return { issues, ...(warning === undefined ? {} : { warning }) };
}

/** The adapter for `tracker.adapter: script`; `adapterFor` builds it only when the config has a command. */
export function scriptAdapter(command: string): TrackerAdapter {
  return {
    name: 'script',
    fetch: (keys, env, io) => fetchScript(command, keys, env, io),
  };
}
