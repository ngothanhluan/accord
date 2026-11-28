// ST-LN-50 D-11 `accord config get|set|unset|check`: the one deterministic way to change accord/config.yml after init.
// A set or unset edits the file through core's text writers, validates the WHOLE result against config.schema.json,
// and writes once only when nothing is found; a refusal exits 2 and leaves the file byte-identical. Nothing is
// committed or pushed here: the onboarding skill does that.
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { appendConfigList, CONFIG_AREAS, citationFailures, DEFAULT_SUBJECTS, floorProblems, flowValue, getConfigValue, idConsequences, loadConfig, mergeProposals, parseValue, resolveKeyPath, setConfigValue, SUBJECT_NAMES, unsetConfigValue } from '@accord-dev/accord-core';
import type { ConfigProposal, LoadFinding } from '@accord-dev/accord-core';
import { CONFIG_FILE, describeFinding as describe, editRefusal } from '../load/config-edit.js';
import { detectProposals, detectSuggestions, refusal } from '../load/detect.js';
import { gitTicketIdsInHistory, UsageError } from '../load/fs.js';
import { SCRIPT_KINDS, shown } from '../load/script-trust.js';
import type { CommandContext } from '../run.js';
import { workingFacts } from './scout.js';

const FILE = CONFIG_FILE;
/** Phase 8.4 D-08 (T-08.4-14): the scan's file is read only when it is a regular file of at most this many bytes, and holds at most MAX_SCAN_ENTRIES entries. */
const MAX_SCAN_BYTES = 262144;
const MAX_SCAN_ENTRIES = 100;
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

/** Validate the edited text as a whole and write it once; any finding, or a text the writers could not edit, writes nothing. The refusal itself is `editRefusal`, shared with the proposals check. */
function commit(key: string, path: string[], file: string, before: string, after: string | undefined): void {
  if (after === undefined) {
    throw new UsageError(`${key}: ${FILE} is not a YAML mapping, or a parent of ${key} is not one - ${FILE} was not changed`);
  }
  const refused = editRefusal(path, before, after);
  if (refused !== undefined) throw new UsageError(`${refused.kind === 'schema' ? key + ': ' : ''}${refused.text} - ${FILE} was not changed`);
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

/** The scan's file as text: UTF-8 with or without a BOM, or UTF-16 with a BOM (what Windows PowerShell 5 writes with `>`), as a Windows editor or shell may save it. */
function decodeScanFile(bytes: Buffer): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return bytes.subarray(2).toString('utf16le');
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    const body = bytes.subarray(2);
    if (body.length % 2 !== 0) throw new Error('a UTF-16 file of an odd number of bytes');
    return Buffer.from(body).swap16().toString('utf16le');
  }
  const text = bytes.toString('utf8');
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Review WR-04: a value nested deeper than this many levels of object or array is dropped, never walked; a config value is at most 3 or 4 levels deep. */
const MAX_DEPTH = 8;
/** Review IN-04: the longest value (as JSON text) a scan proposal may hold, and the most characters of a printed key, value, evidence or reason. */
const MAX_VALUE = 1000;
/** Stands for a value nested over MAX_DEPTH levels, which is never kept: its identity marks the proposal for `scanRefusal`. */
const TOO_DEEP: unknown = Object.freeze({});

/** Whether `value` holds a container nested over MAX_DEPTH levels deep; an iterative walk, so no depth can overflow the stack. */
function nestedTooDeep(value: unknown): boolean {
  const stack: [unknown, number][] = [[value, 0]];
  for (let item = stack.pop(); item !== undefined; item = stack.pop()) {
    const [node, depth] = item;
    if (typeof node !== 'object' || node === null) continue;
    if (depth + 1 > MAX_DEPTH) return true;
    for (const child of Object.values(node)) stack.push([child, depth + 1]);
  }
  return false;
}

/** Whether any string of `value`, or any key of an object in it, holds a control, format or separator character. The value is tested itself, not its JSON text, which escapes the C0 ones. */
function holdsControl(value: unknown): boolean {
  const bad = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const node = stack.pop();
    if (typeof node === 'string' && bad.test(node)) return true;
    if (typeof node !== 'object' || node === null) continue;
    if (!Array.isArray(node) && Object.keys(node).some((k) => bad.test(k))) return true;
    for (const child of Object.values(node)) stack.push(child);
  }
  return false;
}

const capped = (text: string): string => (text.length > MAX_VALUE ? text.slice(0, MAX_VALUE) + '...' : text);
/** A value as printed on a `proposal:` or `dropped:` line: JSON through `shown`, cut at MAX_VALUE characters. */
const printedValue = (value: unknown): string => (value === TOO_DEEP ? '<nested too deeply>' : capped(shown(JSON.stringify(value) ?? '')));

/**
 * The scan's proposals from `file`: a JSON array whose every entry is `{ key, value, evidence }`. Any other file is a usage error (exit 2) naming the file with `/`, and the error never quotes the
 * file's text. A value nested over MAX_DEPTH levels is replaced by TOO_DEEP, so that one entry drops and the rest of the file is read.
 */
function readScanProposals(file: string, cwd: string): ConfigProposal[] {
  const abs = resolve(cwd, file);
  const name = shown(file.replace(/\\/g, '/'));
  let raw: string;
  try {
    const stat = statSync(abs);
    if (!stat.isFile()) throw new Error('not a regular file');
    if (stat.size > MAX_SCAN_BYTES) throw new Error(`${stat.size} bytes is over the ${MAX_SCAN_BYTES} byte limit`);
    raw = decodeScanFile(readFileSync(abs));
  } catch (err) {
    throw new UsageError(shown(`cannot read ${file}: ${err instanceof Error ? err.message : String(err)}`.replace(/\\/g, '/')));
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new UsageError(`${name} is not JSON: write it as UTF-8 text holding an array of { key, value, evidence } proposals`);
  }
  if (!Array.isArray(data)) throw new UsageError(`${name} is not a JSON array of { key, value, evidence } proposals`);
  if (data.length > MAX_SCAN_ENTRIES) throw new UsageError(`${name} holds ${data.length} entries, more than the ${MAX_SCAN_ENTRIES} allowed`);
  return data.map((entry: unknown, i): ConfigProposal => {
    const e = entry as Record<string, unknown> | null;
    const plain = typeof e === 'object' && e !== null && !Array.isArray(e);
    if (!plain || typeof e.key !== 'string' || typeof e.evidence !== 'string' || !Object.hasOwn(e, 'value')) {
      throw new UsageError(`${name}: entry ${i + 1} is not { key, value, evidence } with a string key and a string evidence`);
    }
    return { key: e.key, value: nestedTooDeep(e.value) ? TOO_DEEP : e.value, evidence: e.evidence };
  });
}

/** Every dotted key a proposal sets: the key itself, or for a plain-object value the key joined with each nested key, down to a value that is no non-empty object. The value is at most MAX_DEPTH levels deep. */
function leafPaths(key: string, value: unknown): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [key];
  const entries = Object.entries(value);
  return entries.length === 0 ? [key] : entries.flatMap(([k, v]) => leafPaths(`${key}.${k}`, v));
}

/**
 * Phase 8.4 D-07, D-08 (Ruling 5): the refusals only the CLI can check, handed to core's `mergeProposals` as its last rule, the first reason winning: a value nested over MAX_DEPTH levels or over MAX_VALUE
 * characters of JSON (WR-04, IN-04); a proposal that sets one of the scripts behind `accord trust` (a leaf path equal to or under a kind of SCRIPT_KINDS, also through a parent key's object value); a value
 * holding a control, format or separator character in any string or key (WR-02); a value `accord config set` would refuse (`refusal`, the one definition `config set` shares: the schema, a floor problem at the
 * edited key or a new one, and the ids and subjects the edit keeps valid; it also refuses a parent of a script key given a value that is no object, as the schema types every such parent as one);
 * the value the file already holds; and evidence whose `path:line` is no tracked file with that line (`citationFailures`, which reads the evidence as one citation line and runs no pattern, WR-01).
 * A command for a worktree's setup or for the tests is not refused for being a command (the owner's answer of 2026-11-21). A check that throws drops its proposal, never the run (WR-04).
 */
function scanRefusal(ctx: CommandContext, text: string): (p: ConfigProposal) => string | undefined {
  const refuse = refusal(ctx.root, (path, before, edited) => withConsequences(ctx, path, before, edited).text);
  let facts: ReturnType<typeof workingFacts> | undefined;
  return (p) => {
    try {
      if (p.value === TOO_DEEP) return `the value is nested more than ${MAX_DEPTH} levels deep`;
      const json = JSON.stringify(p.value) ?? '';
      if (json.length > MAX_VALUE) return `value over ${MAX_VALUE} characters`;
      for (const leaf of leafPaths(p.key, p.value)) {
        const kind = SCRIPT_KINDS.find((k) => leaf === k || leaf.startsWith(k + '.'));
        if (kind !== undefined) return `sets ${kind}, a script that runs only after accord trust`;
      }
      if (holdsControl(p.value)) return 'the value holds a control character';
      const why = refuse(p);
      if (why !== undefined) return `accord config set would refuse it: ${why}`;
      const path = resolveKeyPath(p.key);
      if (path !== undefined && JSON.stringify(getConfigValue(text, path)) === json) return 'same as the current value';
      facts ??= workingFacts(ctx.root);
      const failure = citationFailures(p.evidence, facts).find((f) => f.startsWith('citation '));
      return failure === undefined ? undefined : `evidence ${failure}`;
    } catch (err) {
      return `checking it failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  };
}

/**
 * Phase 8.3 D-08, D-13 (Ruling 9): the settings area by area for `/accord-config`. Per area in data order `area: <id> - <title>` (with ` (not walked: accord writes these)` for an area accord writes itself), then per
 * top-level key `  <key> = <YAML flow value, or unset> - <what it controls>`, then each proposal for that key as init prints it. The areas and the texts come from core's data (packages/core/schemas/config-areas.json), the
 * values from the file's text, the proposals from the detector `accord init` runs (read-only, bounded, never throws), so the skill needs no scan of its own (D-09). Writes nothing. Every string that comes from the repository
 * (a value, an evidence line) passes `shown()`.
 *
 * Phase 8.4 D-07, D-08: with `options.proposals`, the named file (a JSON array of `{ key, value, evidence }` the onboarding session wrote from its scan, resolved against `cwd`) is
 * merged with init's proposals by core's `mergeProposals`: init's wins on the same key, an ancestor or a descendant, and each refused scan proposal prints as
 * `dropped: <key> = <JSON value>  (<reason>)` after the areas, whatever area was asked, or as the `dropped` list of `--json`. Core drops a scan proposal with no config key, for a key accord writes or with
 * evidence that is no file and line or count; `scanRefusal` then drops a script behind `accord trust`, a control character, a value `config set` refuses, the current value and a citation that does not resolve.
 * Still writes nothing.
 */
export function configAreas(ctx: CommandContext, area: string | undefined, options: { json?: boolean; proposals?: string }, cwd: string = ctx.root): number {
  const ids = CONFIG_AREAS.map((a) => a.id);
  if (area !== undefined && !ids.includes(area)) throw new UsageError(`no area ${shown(area)} - the areas are ${ids.join(', ')}`);
  let text: string;
  try {
    text = readFileSync(join(ctx.root, 'accord', 'config.yml'), 'utf8');
  } catch {
    throw new UsageError(`no ${FILE} in ${ctx.root} - run accord init`);
  }
  const init = detectProposals(ctx.root);
  const merged = options.proposals === undefined ? { proposals: init, dropped: [] } : mergeProposals(init, readScanProposals(options.proposals, cwd), scanRefusal(ctx, text));
  const proposals = merged.proposals;
  const suggestions = detectSuggestions(ctx.root); // Phase 11 D-12: text only, shown under the key of the area they advise (init's own lines), never merged with proposals
  const fromInit = new Set<ConfigProposal>(init); // mergeProposals returns init's own objects, so identity tells the two origins apart
  const marked = options.proposals !== undefined;
  const droppedValue = (v: unknown): unknown => (v === TOO_DEEP ? '<nested too deeply>' : (JSON.stringify(v) ?? '').length > MAX_VALUE ? printedValue(v) : v);
  const dropped = merged.dropped.map((d) => ({ key: capped(d.key), value: droppedValue(d.value), evidence: capped(d.evidence), reason: capped(d.reason) }));
  const rows = CONFIG_AREAS.filter((a) => area === undefined || a.id === area).map((a) => ({
    id: a.id,
    title: a.title,
    walk: a.walk !== false,
    keys: a.keys.map((k) => ({
      key: k.key,
      text: k.text,
      value: getConfigValue(text, [k.key]) ?? null,
      proposals: proposals
        .filter((p) => p.key.split('.')[0] === k.key)
        .map((p) => ({ key: p.key, value: p.value, evidence: p.evidence, ...(marked ? { source: fromInit.has(p) ? 'init' : 'scan' } : {}) })),
      ...(suggestions.some((s) => s.key === k.key) ? { suggestions: suggestions.filter((s) => s.key === k.key).map((s) => ({ key: s.key, text: s.text, evidence: s.evidence })) } : {}),
    })),
  }));
  if (options.json === true) {
    ctx.stdout.write(JSON.stringify(options.proposals === undefined ? { areas: rows } : { areas: rows, dropped }, null, 2) + '\n');
    return 0;
  }
  for (const a of rows) {
    ctx.stdout.write(`area: ${a.id} - ${a.title}${a.walk ? '' : ' (not walked: accord writes these)'}\n`);
    for (const k of a.keys) {
      ctx.stdout.write(`  ${k.key} = ${k.value === null ? 'unset' : shown(flowValue(k.value))} - ${k.text}\n`);
      for (const p of k.proposals) ctx.stdout.write(`  proposal: ${marked ? `[${p.source}] ` : ''}${shown(p.key)} = ${printedValue(p.value)}  (evidence: ${capped(shown(p.evidence))})\n`);
      for (const s of k.suggestions ?? []) ctx.stdout.write(`  suggestion: ${shown(s.key)}: ${capped(shown(s.text))}  (evidence: ${capped(shown(s.evidence))})\n`);
    }
  }
  for (const d of merged.dropped) ctx.stdout.write(`dropped: ${capped(shown(d.key))} = ${printedValue(d.value)}  (${capped(shown(d.reason))})\n`);
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
