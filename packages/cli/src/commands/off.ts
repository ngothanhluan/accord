// Phase 08.9.2 D-03, L-01: `accord off` and `accord on`, a person's own switch for one clone. `off` writes the marker `<git common dir>/accord-off`, which the launcher, the
// CLI and the pane read with plain file reads, and sets the panel flag in the checkout's `.claude/settings.local.json` for sessions that read that file. The marker, not an
// `env` variable, carries the switch: a session started in a linked worktree on Windows does not read the main checkout's local file (RESEARCH F-4).
// The marker records what `off` did to the flag, so `on` undoes exactly that and never a key `off` did not write.
import { appendFileSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gitDirsOf, offMarkerPath } from '../load/gitdir.js';
import { runGitSync } from '../load/git-spawn.js';

/** Phase 08.9.2 D-04: the one line a full-mode session start prints so a person who does not use accord sees how to switch it off; the quiet line (08.9.2-09) reuses it. The launcher form needs no global install. */
export const OFF_LINE = 'accord: not using accord? switch it off for yourself in this clone: node .claude/accord.mjs off (node .claude/accord.mjs on switches it back)';

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
/** A copy of `o` without `key`, every other key in its order. */
const without = (o: Record<string, unknown>, key: string): Record<string, unknown> => Object.fromEntries(Object.entries(o).filter(([k]) => k !== key));

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

/** The marker `off` wrote, or undefined when it is absent or unreadable (`unreadable` tells which). */
function readMarker(file: string): { marker?: Marker; unreadable: boolean } | undefined {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }
  try {
    const m = JSON.parse(text) as unknown;
    const panel = isObject(m) && isObject(m.panel) ? m.panel : undefined;
    const prior = panel?.prior;
    if (panel === undefined || (prior !== 'absent' && typeof prior !== 'boolean')) return { unreadable: true };
    return { marker: { since: String((m as Record<string, unknown>).since ?? ''), panel: { prior, createdMap: panel.createdMap === true } }, unreadable: false };
  } catch {
    return { unreadable: true };
  }
}

/**
 * Switch accord back on: put the panel flag back as the marker says `off` found it, then remove the marker. Only the flag `off` set is touched: a flag the person has
 * changed since (no longer `false`) stays, as does every other key, their order, and anything added while accord was off. The marker goes last, so a failed write can be retried.
 */
export function accordOn(io: OffIo): number {
  const marker = offMarkerPath(io.root);
  if (marker === undefined) {
    io.stderr.write(`accord on: cannot find the git folder of ${shown(io.root)}\n`);
    return 2;
  }
  const found = readMarker(marker);
  if (found === undefined) {
    io.stdout.write('accord is not off in this clone\n');
    return 0;
  }
  if (found.marker === undefined) {
    io.stderr.write(`accord on: the marker ${shown(marker)} is unreadable, so ${LOCAL} is left as it is\n`);
  } else {
    const file = join(io.root, '.claude', 'settings.local.json');
    const read = readLocal(file);
    if ('refusal' in read) {
      io.stderr.write(`accord on: ${read.refusal}; the panel flag is left as it is\n`);
    } else {
      const { settings } = read;
      const plugins = settings.enabledPlugins;
      // only the flag `off` wrote (false) is undone; a person who set it to true since keeps their choice
      if (isObject(plugins) && plugins[PANEL] === false) {
        const { prior, createdMap } = found.marker.panel;
        let next: Record<string, unknown>;
        if (prior === 'absent') {
          const rest = without(plugins, PANEL);
          next = createdMap && Object.keys(rest).length === 0 ? without(settings, 'enabledPlugins') : { ...settings, enabledPlugins: rest };
        } else {
          next = { ...settings, enabledPlugins: { ...plugins, [PANEL]: prior } };
        }
        if (asText(next) !== asText(settings)) writeAtomic(file, asText(next));
      }
    }
  }
  rmSync(marker, { force: true });
  io.stdout.write('accord is on again for you in this clone\n');
  return 0;
}
