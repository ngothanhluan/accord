// ST-LN-50 D-11 `accord config get|set|unset|check`: the one deterministic way to change accord/config.yml after init.
// A set or unset edits the file through core's text writers, validates the WHOLE result against config.schema.json,
// and writes once only when nothing is found; a refusal exits 2 and leaves the file byte-identical. Nothing is
// committed or pushed here: the onboarding skill does that.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { appendConfigList, CONFIG_AREAS, DEFAULT_SUBJECTS, floorProblems, flowValue, getConfigValue, idConsequences, loadConfig, parseValue, resolveKeyPath, setConfigValue, SUBJECT_NAMES, unsetConfigValue } from '@accord-dev/accord-core';
import type { LoadFinding } from '@accord-dev/accord-core';
import { detectProposals } from '../load/detect.js';
import { gitTicketIdsInHistory, UsageError } from '../load/fs.js';
import { shown } from '../load/script-trust.js';
import type { CommandContext } from '../run.js';

const FILE = 'accord/config.yml';
const KEYS = 'the keys are in packages/core/schemas/config.schema.json (schemas/config.schema.json in the published @accord-dev/accord-core)';

/** What a change brings with it beyond the key itself: the ids it keeps valid (`legacy_ids`) and the commit subjects it still reads (`commits.legacy_subjects.<name>`) (D-11). One entry per list, each added item on its own output line. */
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

/**
 * ST-LN-50 D-05: a change under `ids` or `people` can leave ids that no longer follow the convention. They are appended to
 * legacy_ids in the same edit, before the schema check, so no ticket is renamed and lint stays green; ids are only ever added.
 * Every id the clone knows counts: tickets, records, claims, and the history of every ref already fetched.
 */
function withIdConsequences(ctx: CommandContext, path: string[], before: string, edited: string | undefined): { text: string | undefined; consequences: Consequence[] } {
  if (edited === undefined || edited === before || (path[0] !== 'ids' && path[0] !== 'people')) return { text: edited, consequences: [] };
  const next = loadConfig(FILE, edited).config; // an invalid result is refused by commit with its own findings
  const known = [
    ...Object.values(ctx.snapshot.tickets).map((t) => ({ id: t.id, type: t.frontmatter?.type })),
    ...[...Object.keys(ctx.snapshot.work ?? {}), ...Object.keys(ctx.snapshot.claims ?? {}), ...gitTicketIdsInHistory(ctx.root)].map((id) => ({ id })),
  ];
  const added = idConsequences(ctx.snapshot.config, next, known);
  if (added.length === 0) return { text: edited, consequences: [] };
  return { text: appendConfigList(edited, ['legacy_ids'], added), consequences: [{ key: 'legacy_ids', added }] };
}

/**
 * ST-LN-50 D-06: a changed `commits.subjects.<name>` can strand a claim or a plan-ready commit written under the template it replaces. The
 * replaced template, which is today's default when none was set, is appended to `commits.legacy_subjects.<name>` in the same edit, before the
 * schema check, unless it is listed already or equals the new one. Read from the text, not the schema-checked config, so a file that
 * fails the schema still gets the old template kept; templates are only ever added.
 */
function withSubjectConsequences(before: string, edited: string | undefined): { text: string | undefined; consequences: Consequence[] } {
  if (edited === undefined || edited === before) return { text: edited, consequences: [] };
  const template = (text: string, name: string): string | undefined => {
    const v = getConfigValue(text, ['commits', 'subjects', name]);
    return typeof v === 'string' ? v : undefined;
  };
  let text = edited;
  const consequences: Consequence[] = [];
  for (const name of SUBJECT_NAMES) {
    const was = template(before, name) ?? DEFAULT_SUBJECTS[name];
    const now = template(edited, name) ?? DEFAULT_SUBJECTS[name];
    const listed = getConfigValue(text, ['commits', 'legacy_subjects', name]);
    if (was === now || (Array.isArray(listed) && listed.includes(was))) continue;
    const appended = appendConfigList(text, ['commits', 'legacy_subjects', name], [was]);
    if (appended === undefined) continue; // a key that holds something else: `commit` refuses the result with its own finding
    text = appended;
    consequences.push({ key: `commits.legacy_subjects.${name}`, added: [was] });
  }
  return { text, consequences };
}

function withConsequences(ctx: CommandContext, path: string[], before: string, edited: string | undefined): { text: string | undefined; consequences: Consequence[] } {
  const ids = withIdConsequences(ctx, path, before, edited);
  if (path[0] !== 'commits') return ids;
  return withSubjectConsequences(before, ids.text);
}

const describe = (f: LoadFinding): string => `${f.pointer !== undefined && f.pointer !== '' ? f.pointer + ' ' : ''}${f.reason}`;

/** `/strictness/levels/gate.design-missing` as the dotted key a person types. */
const dotted = (pointer: string): string => pointer.slice(1).split('/').join('.');

/**
 * ST-LN-50 D-08, D-09, D-10: the `strictness.levels` keys the engines would ignore (a floor rule, a stage's rule, an unknown rule, a Ready-promoted rule turned off).
 * An edit is refused when one stands at the key it edits or is new; one already in the file and not touched by this edit does not stop the edit, so a file
 * holding two of them can be cleaned up one `unset` at a time. `accord config check` and `accord lint` still name every one.
 */
function refusedByFloor(path: string[], before: string, after: string): { pointer: string; reason: string }[] {
  const edited = '/' + path.join('/');
  const known = new Set(floorProblems(loadConfig(FILE, before).config).map((p) => p.pointer));
  return floorProblems(loadConfig(FILE, after).config).filter((p) => p.pointer === edited || p.pointer.startsWith(edited + '/') || !known.has(p.pointer));
}

/** Validate the edited text as a whole and write it once; any finding, or a text the writers could not edit, writes nothing. */
function commit(key: string, path: string[], file: string, before: string, after: string | undefined): void {
  if (after === undefined) {
    throw new UsageError(`${key}: ${FILE} is not a YAML mapping, or a parent of ${key} is not one - ${FILE} was not changed`);
  }
  const found = loadConfig(FILE, after).findings;
  if (found.length > 0) throw new UsageError(`${key}: ${found.map(describe).join('; ')} - ${FILE} was not changed`);
  const floor = after === before ? [] : refusedByFloor(path, before, after);
  if (floor.length > 0) throw new UsageError(`${floor.map((p) => `${dotted(p.pointer)}: ${p.reason}`).join('; ')} - ${FILE} was not changed`);
  if (after !== before) writeFileSync(file, after);
}

function report(ctx: CommandContext, key: string, from: unknown, to: unknown, consequences: Consequence[], options: { json?: boolean }): number {
  const same = JSON.stringify(from ?? null) === JSON.stringify(to ?? null);
  const shown = (v: unknown): string => (v === undefined || v === null ? 'unset' : flowValue(v));
  ctx.stdout.write(
    options.json === true
      ? JSON.stringify({ key, from: from ?? null, to: to ?? null, consequences }, null, 2) + '\n'
      : same
        ? `unchanged: ${key}\n`
        : `changed: ${key} ${shown(from)} -> ${shown(to)}\n` + consequences.flatMap((c) => c.added.map((a) => `${c.key} +${c.key === 'legacy_ids' ? a : JSON.stringify(a)}\n`)).join(''),
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
  const out = withConsequences(ctx, path, text, same ? text : setConfigValue(text, path, value));
  commit(key, path, file, text, out.text);
  return report(ctx, key, from, value, out.consequences, options);
}

export function configUnset(ctx: CommandContext, key: string, options: { json?: boolean }): number {
  const { path, file, text } = read(ctx, key);
  const from = getConfigValue(text, path);
  const out = withConsequences(ctx, path, text, from === undefined ? text : unsetConfigValue(text, path));
  commit(key, path, file, text, out.text);
  return report(ctx, key, from, undefined, out.consequences, options);
}

/**
 * Phase 8.3 D-08, D-13 (Ruling 9): the settings area by area for `/accord-config`. Per area in data order `area: <id> - <title>` (with ` (not walked: accord writes these)` for an area accord writes itself), then per
 * top-level key `  <key> = <YAML flow value, or unset> - <what it controls>`, then each proposal for that key as init prints it. The areas and the texts come from core's data (packages/core/schemas/config-areas.json), the
 * values from the file's text, the proposals from the detector `accord init` runs (read-only, bounded, never throws), so the skill needs no scan of its own (D-09). Writes nothing. Every string that comes from the repository
 * (a value, an evidence line) passes `shown()`.
 */
export function configAreas(ctx: CommandContext, area: string | undefined, options: { json?: boolean }): number {
  const ids = CONFIG_AREAS.map((a) => a.id);
  if (area !== undefined && !ids.includes(area)) throw new UsageError(`no area ${shown(area)} - the areas are ${ids.join(', ')}`);
  let text: string;
  try {
    text = readFileSync(join(ctx.root, 'accord', 'config.yml'), 'utf8');
  } catch {
    throw new UsageError(`no ${FILE} in ${ctx.root} - run accord init`);
  }
  const proposals = detectProposals(ctx.root);
  const rows = CONFIG_AREAS.filter((a) => area === undefined || a.id === area).map((a) => ({
    id: a.id,
    title: a.title,
    walk: a.walk !== false,
    keys: a.keys.map((k) => ({
      key: k.key,
      text: k.text,
      value: getConfigValue(text, [k.key]) ?? null,
      proposals: proposals.filter((p) => p.key.split('.')[0] === k.key).map((p) => ({ key: p.key, value: p.value, evidence: p.evidence })),
    })),
  }));
  if (options.json === true) {
    ctx.stdout.write(JSON.stringify({ areas: rows }, null, 2) + '\n');
    return 0;
  }
  for (const a of rows) {
    ctx.stdout.write(`area: ${a.id} - ${a.title}${a.walk ? '' : ' (not walked: accord writes these)'}\n`);
    for (const k of a.keys) {
      ctx.stdout.write(`  ${k.key} = ${k.value === null ? 'unset' : shown(flowValue(k.value))} - ${k.text}\n`);
      for (const p of k.proposals) ctx.stdout.write(`  proposal: ${p.key} = ${JSON.stringify(p.value)}  (evidence: ${shown(p.evidence)})\n`);
    }
  }
  return 0;
}

export function configCheck(ctx: CommandContext, options: { json?: boolean }): number {
  let text: string;
  try {
    text = readFileSync(join(ctx.root, 'accord', 'config.yml'), 'utf8');
  } catch {
    throw new UsageError(`no ${FILE} in ${ctx.root} - run accord init`);
  }
  const loaded = loadConfig(FILE, text);
  // A config the schema accepts can still name a rule the floor does not let a team set (D-08): those are findings too, and the exit code is 2, as for `accord config set`.
  // A team section that replaces a required one (D-10) is named by its own rule, as `accord lint` names it.
  const floor: LoadFinding[] = floorProblems(loaded.config).map((p) => ({
    file: FILE,
    rule: p.pointer.startsWith('/template/') ? 'lint.template-section' : 'lint.config-floor',
    pointer: p.pointer,
    reason: p.reason,
  }));
  const findings = [...loaded.findings, ...floor];
  ctx.stdout.write(
    options.json === true
      ? JSON.stringify({ findings }, null, 2) + '\n'
      : findings.length === 0
        ? `${FILE}: valid\n`
        : findings.map((f) => `${f.file}:${f.line ?? 1} ${describe(f)}\n`).join(''),
  );
  return floor.length > 0 ? 2 : findings.length === 0 ? 0 : 1;
}
