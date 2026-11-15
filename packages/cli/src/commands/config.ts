// ST-LN-50 D-11 `accord config get|set|unset|check`: the one deterministic way to change accord/config.yml after init.
// A set or unset edits the file through core's text writers, validates the WHOLE result against config.schema.json,
// and writes once only when nothing is found; a refusal exits 2 and leaves the file byte-identical. Nothing is
// committed or pushed here: the onboarding skill does that.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { flowValue, getConfigValue, loadConfig, parseValue, resolveKeyPath, setConfigValue, unsetConfigValue } from '@accord-dev/accord-core';
import type { LoadFinding } from '@accord-dev/accord-core';
import { UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';

const FILE = 'accord/config.yml';
const KEYS = 'the keys are in packages/core/schemas/config.schema.json (schemas/config.schema.json in the published @accord-dev/accord-core)';

/** What a change brings with it beyond the key itself: the ids it keeps valid, the subjects it still accepts (D-11). Empty until a key has one. */
interface Consequence {
  key: string;
  added: string[];
}

function read(ctx: CommandContext, key: string): { path: string[]; file: string; text: string } {
  const path = resolveKeyPath(key);
  if (path === undefined) throw new UsageError(`no config key ${key} - ${KEYS}`);
  const file = join(ctx.root, 'accord', 'config.yml');
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    throw new UsageError(`no ${FILE} in ${ctx.root} - run accord init`);
  }
  return { path, file, text };
}

const describe = (f: LoadFinding): string => `${f.pointer !== undefined && f.pointer !== '' ? f.pointer + ' ' : ''}${f.reason}`;

/** Validate the edited text as a whole and write it once; any finding, or a text the writers could not edit, writes nothing. */
function commit(key: string, file: string, before: string, after: string | undefined): void {
  if (after === undefined) {
    throw new UsageError(`${key}: ${FILE} is not a YAML mapping, or a parent of ${key} is not one - ${FILE} was not changed`);
  }
  const found = loadConfig(FILE, after).findings;
  if (found.length > 0) throw new UsageError(`${key}: ${found.map(describe).join('; ')} - ${FILE} was not changed`);
  if (after !== before) writeFileSync(file, after);
}

function report(ctx: CommandContext, key: string, from: unknown, to: unknown, options: { json?: boolean }): number {
  const consequences: Consequence[] = [];
  const same = JSON.stringify(from ?? null) === JSON.stringify(to ?? null);
  const shown = (v: unknown): string => (v === undefined || v === null ? 'unset' : flowValue(v));
  ctx.stdout.write(
    options.json === true
      ? JSON.stringify({ key, from: from ?? null, to: to ?? null, consequences }, null, 2) + '\n'
      : same
        ? `unchanged: ${key}\n`
        : `changed: ${key} ${shown(from)} -> ${shown(to)}\n` + consequences.map((c) => `${c.key} +${c.added.join(', ')}\n`).join(''),
  );
  return 0;
}

export function configGet(ctx: CommandContext, key: string, options: { json?: boolean }): number {
  const { path, text } = read(ctx, key);
  const value = getConfigValue(text, path);
  ctx.stdout.write(options.json === true ? JSON.stringify({ key, value: value ?? null }, null, 2) + '\n' : (value === undefined ? 'unset' : flowValue(value)) + '\n');
  return 0;
}

export function configSet(ctx: CommandContext, key: string, raw: string, options: { json?: boolean }): number {
  const { path, file, text } = read(ctx, key);
  let value: unknown;
  try {
    value = parseValue(raw);
  } catch (err) {
    throw new UsageError(`${key}: ${(err as Error).message} - ${FILE} was not changed`);
  }
  const from = getConfigValue(text, path);
  const same = from !== undefined && JSON.stringify(from) === JSON.stringify(value);
  commit(key, file, text, same ? text : setConfigValue(text, path, value));
  return report(ctx, key, from, value, options);
}

export function configUnset(ctx: CommandContext, key: string, options: { json?: boolean }): number {
  const { path, file, text } = read(ctx, key);
  const from = getConfigValue(text, path);
  commit(key, file, text, from === undefined ? text : unsetConfigValue(text, path));
  return report(ctx, key, from, undefined, options);
}

export function configCheck(ctx: CommandContext, options: { json?: boolean }): number {
  let text: string;
  try {
    text = readFileSync(join(ctx.root, 'accord', 'config.yml'), 'utf8');
  } catch {
    throw new UsageError(`no ${FILE} in ${ctx.root} - run accord init`);
  }
  const findings = loadConfig(FILE, text).findings;
  ctx.stdout.write(
    options.json === true
      ? JSON.stringify({ findings }, null, 2) + '\n'
      : findings.length === 0
        ? `${FILE}: valid\n`
        : findings.map((f) => `${f.file}:${f.line ?? 1} ${describe(f)}\n`).join(''),
  );
  return findings.length === 0 ? 0 : 1;
}
