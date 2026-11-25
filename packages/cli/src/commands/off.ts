// Phase 08.9.2 D-03, L-01: `accord off` and `accord on`, a person's own switch for one clone. Since the owner ruling of 2026-11-25 (UAT G-08.9.2-10: the panel flag `off` once also
// set in `.claude/settings.local.json` made the host drop the panel plugin, so a typed `/accord-panel` was an unknown command) `off` writes only the marker
// `<git common dir>/accord-off`, which the launcher, the CLI and the pane read with plain file reads; the pane stays closed unasked and the hooks stay silent while it exists,
// and a typed `/accord-panel` still opens the pane. The marker, not an `env` variable, carries the switch: a session started in a linked worktree on Windows does not read
// the main checkout's local file (RESEARCH F-4). A marker written by 0.20.0 or 0.20.1 also records what that `off` did to the panel flag, so `on` still undoes exactly that
// and never a key `off` did not write; a marker with no such record makes `on` open no settings file.
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { offMarkerPath } from '../load/gitdir.js';

/** Phase 08.9.2 D-04: the one line a full-mode session start prints so a person who does not use accord sees how to switch it off; the quiet line (08.9.2-09) reuses it. The launcher form needs no global install. */
export const OFF_LINE = 'accord: not using accord? switch it off for yourself in this clone: node .claude/accord.mjs off (node .claude/accord.mjs on switches it back); an agent runs either only when the person asks';

const PANEL = 'accord-panel@accord';
const LOCAL = '.claude/settings.local.json';

export interface OffIo {
  root: string;
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
}

/** The marker's content. `panel` is present only in a marker written by 0.20.0 or 0.20.1: what that `off` did to the panel flag, its value before (`absent` when the key was not there) and whether it had to create the `enabledPlugins` map. */
interface Marker {
  since: string;
  panel?: { prior: 'absent' | boolean; createdMap: boolean };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shown = (p: string): string => p.replace(/\\/g, '/');
/** A copy of `o` without `key`, every other key in its order. */
const without = (o: Record<string, unknown>, key: string): Record<string, unknown> => Object.fromEntries(Object.entries(o).filter(([k]) => k !== key));

const oneLine = (e: unknown): string => String((e as Error).message ?? e).split('\n')[0] as string;

/** Temp file, then rename, so a reader never sees half a file (the way notice.ts writes its cache). A failed write (on Windows a rename over a file another process holds open) leaves no temp file behind and returns its one-line reason; undefined means it worked. */
function writeAtomic(file: string, text: string): string | undefined {
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(tmp, text);
    renameSync(tmp, file);
    return undefined;
  } catch (e) {
    try {
      rmSync(tmp, { force: true });
    } catch {
      // the reason returned below is the one that matters
    }
    return oneLine(e);
  }
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

export function accordOff(io: OffIo): number {
  const marker = offMarkerPath(io.root);
  if (marker === undefined) {
    io.stderr.write(`accord off: cannot find the git folder of ${shown(io.root)}\n`);
    return 2;
  }
  // An existing marker is kept as it is (a 0.20.x one keeps its panel record for `on`), so a second `off` changes nothing. Nothing else is written: not the local settings, not the exclude file.
  // Only a marker that is not there counts as none yet: one that cannot be read (a sharing violation, a folder in its place) is never overwritten, for it may hold a panel record `on` needs.
  const found = readMarker(marker);
  if (found?.readError !== undefined) {
    io.stderr.write(`accord off: cannot read the marker ${shown(marker)}: ${found.readError}; it is left as it is\n`);
    return 2;
  }
  if (found === undefined) {
    const made: Marker = { since: new Date().toISOString() };
    const failed = writeAtomic(marker, JSON.stringify(made, null, 2) + '\n');
    if (failed !== undefined) {
      io.stderr.write(`accord off: cannot write the marker ${shown(marker)}: ${failed}\n`);
      return 2;
    }
  } else if (found.marker?.panel !== undefined) {
    // an older accord's marker still records a panel flag set to false in the checkout where that `off` ran, so the pane command may be unknown there until `on` puts the flag back
    io.stdout.write('accord is already off for you in this clone, by an older accord that also set the panel flag: node .claude/accord.mjs on puts the flag back, and a new off then keeps /accord-panel working\n');
    return 0;
  }
  io.stdout.write('accord is off for you in this clone: its hooks stay silent and the pane does not open by itself (type /accord-panel to open it); node .claude/accord.mjs on switches it back\n');
  return 0;
}

/** The marker `off` wrote, or undefined when it is absent; `readError` is its one-line reason when it exists but cannot be read; `unreadable` is true (and `marker` missing) when it is no JSON object or its `panel` record is malformed. */
function readMarker(file: string): { marker?: Marker; unreadable: boolean; readError?: string } | undefined {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch (e) {
    if ((e as { code?: string }).code === 'ENOENT') return undefined;
    return { unreadable: true, readError: oneLine(e) };
  }
  try {
    const m = JSON.parse(text) as unknown;
    if (!isObject(m)) return { unreadable: true };
    const since = String(m.since ?? '');
    if (!Object.keys(m).includes('panel')) return { marker: { since }, unreadable: false }; // what the new `off` writes: no flag to undo
    const panel = isObject(m.panel) ? m.panel : undefined;
    const prior = panel?.prior;
    if (panel === undefined || (prior !== 'absent' && typeof prior !== 'boolean')) return { unreadable: true };
    return { marker: { since, panel: { prior, createdMap: panel.createdMap === true } }, unreadable: false };
  } catch {
    return { unreadable: true };
  }
}

/**
 * Switch accord back on: remove the marker. A marker written by 0.20.0 or 0.20.1 also carries the `panel` record of what that `off` did to the panel flag, and `on` first puts
 * the flag back as `off` found it. Only the flag `off` set is touched: a flag the person has changed since (no longer `false`) stays, as does every other key, their order, and
 * anything added while accord was off. A marker with no record opens no settings file. The marker goes last, so a failed write can be retried.
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
  if (found.readError !== undefined) {
    io.stderr.write(`accord on: cannot read the marker ${shown(marker)}: ${found.readError}; it is left in place, so try again\n`);
    return 2;
  }
  if (found.marker === undefined) {
    io.stderr.write(`accord on: the marker ${shown(marker)} is unreadable, so ${LOCAL} is left as it is\n`);
  } else if (found.marker.panel !== undefined) {
    const record = found.marker.panel;
    const file = join(io.root, '.claude', 'settings.local.json');
    const read = readLocal(file);
    if ('refusal' in read) {
      io.stderr.write(`accord on: ${read.refusal}; the panel flag is left as it is\n`);
    } else {
      const { settings } = read;
      const plugins = settings.enabledPlugins;
      // only the flag `off` wrote (false) is undone; a person who set it to true since keeps their choice
      if (!isObject(plugins) || plugins[PANEL] === undefined) {
        // The marker is shared by every worktree of the clone, but the flag an older `off` set sits in the checkout where that `off` ran. This checkout has no entry for it, so `on` cannot reach it from here.
        io.stderr.write(`accord on: the marker came from an older accord that may have set ${PANEL} to false in the checkout where it ran off, not in this one; if /accord-panel is unknown there, delete that key from its ${LOCAL}\n`);
      } else if (plugins[PANEL] === false) {
        const { prior, createdMap } = record;
        let next: Record<string, unknown>;
        if (prior === 'absent') {
          const rest = without(plugins, PANEL);
          next = createdMap && Object.keys(rest).length === 0 ? without(settings, 'enabledPlugins') : { ...settings, enabledPlugins: rest };
        } else {
          next = { ...settings, enabledPlugins: { ...plugins, [PANEL]: prior } };
        }
        if (asText(next) !== asText(settings)) {
          const failed = writeAtomic(file, asText(next));
          if (failed !== undefined) {
            io.stderr.write(`accord on: cannot write ${LOCAL}: ${failed}; the marker is left in place, so try again\n`);
            return 2;
          }
        }
      }
    }
  }
  rmSync(marker, { force: true });
  io.stdout.write('accord is on again for you in this clone\n');
  return 0;
}
