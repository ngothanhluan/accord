// Phase 08.9.2 D-03, L-01: `accord off` and `accord on`, a person's own switch for one clone. `off` writes the marker `<git common dir>/accord-off`, which the launcher, the
// CLI and the pane read with plain file reads, and sets the panel flag in the checkout's `.claude/settings.local.json` for sessions that read that file. The marker, not an
// `env` variable, carries the switch: a session started in a linked worktree on Windows does not read the main checkout's local file (RESEARCH F-4).
// The marker records what `off` did to the flag, so `on` undoes exactly that and never a key `off` did not write.
import { appendFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gitDirsOf, offMarkerPath } from '../load/gitdir.js';
import { runGitSync } from '../load/git-spawn.js';

const PANEL = 'accord-panel@accord';
const LOCAL = '.claude/settings.local.json';

export interface OffIo {
  root: string;
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
}

/** What `off` did to the panel flag: its value before (`absent` when the key was not there) and whether it had to create the `enabledPlugins` map. */
interface Marker {
  since: string;
  panel: { prior: 'absent' | boolean; createdMap: boolean };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shown = (p: string): string => p.replace(/\\/g, '/');

/** Temp file, then rename, so a reader never sees half a file (the way notice.ts writes its cache). */
function writeAtomic(file: string, text: string): void {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, file);
}

const asText = (settings: Record<string, unknown>): string => JSON.stringify(settings, null, 2) + '\n';

/** The local settings as an object (absent means `{}`); a refusal text when the file is no JSON object or its panel key is not what `off` can restore. */
function readLocal(file: string): { settings: Record<string, unknown> } | { refusal: string } {
  let text: string | undefined;
  try {
    text = readFileSync(file, 'utf8');
  } catch (e) {
    if ((e as { code?: string }).code !== 'ENOENT') return { refusal: `cannot read ${LOCAL}: ${String((e as Error).message).split('\n')[0]}` };
  }
  if (text === undefined) return { settings: {} };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    return { refusal: `${LOCAL} is not a JSON object` };
  }
  if (!isObject(parsed)) return { refusal: `${LOCAL} is not a JSON object` };
  const plugins = parsed.enabledPlugins;
  if (plugins !== undefined && !isObject(plugins)) return { refusal: `${LOCAL} holds an enabledPlugins that is not an object` };
  const flag = isObject(plugins) ? plugins[PANEL] : undefined;
  if (flag !== undefined && typeof flag !== 'boolean') return { refusal: `${LOCAL} holds an enabledPlugins entry for ${PANEL} that is not true or false` };
  return { settings: parsed };
}

/** When git does not ignore the local settings file, add it once to the clone's `info/exclude` (never a committed .gitignore); returns the line to print, if any. */
function keepOutOfGit(io: OffIo, commonDir: string): string | undefined {
  try {
    runGitSync(['check-ignore', '-q', '--', LOCAL], { cwd: io.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return undefined; // exit 0: already ignored
  } catch (e) {
    if ((e as { status?: number }).status !== 1) return undefined; // git could not say: leave the file alone rather than guess
  }
  const exclude = join(commonDir, 'info', 'exclude');
  let have = '';
  try {
    have = readFileSync(exclude, 'utf8');
  } catch {
    // no exclude file yet
  }
  if (have.split(/\r?\n/).includes(LOCAL)) return undefined;
  mkdirSync(dirname(exclude), { recursive: true });
  appendFileSync(exclude, (have === '' || have.endsWith('\n') ? '' : '\n') + LOCAL + '\n');
  return `accord off: git did not ignore ${LOCAL}; added it to ${shown(exclude)} so it stays out of commits`;
}

export function accordOff(io: OffIo): number {
  const dirs = gitDirsOf(io.root);
  const marker = offMarkerPath(io.root);
  if (dirs === undefined || marker === undefined) {
    io.stderr.write(`accord off: cannot find the git folder of ${shown(io.root)}\n`);
    return 2;
  }
  const file = join(io.root, '.claude', 'settings.local.json');
  const read = readLocal(file);
  if ('refusal' in read) {
    io.stderr.write(`accord off: ${read.refusal}; nothing was changed\n`);
    return 2;
  }
  const { settings } = read;
  const plugins = settings.enabledPlugins;
  const prior = isObject(plugins) && PANEL in plugins ? (plugins[PANEL] as boolean) : 'absent';

  // The marker first: with it written, `on` can always undo what follows. An existing marker is kept as it is, so a second `off` changes nothing.
  let existing = false;
  try {
    readFileSync(marker, 'utf8');
    existing = true;
  } catch {
    // none yet
  }
  if (!existing) {
    const made: Marker = { since: new Date().toISOString(), panel: { prior, createdMap: plugins === undefined } };
    writeAtomic(marker, JSON.stringify(made, null, 2) + '\n');
  }

  // Copy the map, set the one key; every other key and the order stay.
  writeAtomic(file, asText({ ...settings, enabledPlugins: { ...(isObject(plugins) ? plugins : {}), [PANEL]: false } }));

  const kept = keepOutOfGit(io, dirs.commonDir);
  if (kept !== undefined) io.stdout.write(kept + '\n');
  io.stdout.write('accord is off for you in this clone: its hooks stay silent and the pane stays closed; node .claude/accord.mjs on switches it back\n');
  return 0;
}

export function accordOn(io: OffIo): number {
  // Task 2 of plan 08.9.2-06 fills this in: restore the panel flag from the marker, then remove the marker.
  void io;
  return 0;
}
