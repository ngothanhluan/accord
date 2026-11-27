// CLI-08 `accord skills sync`: the one place accord puts its own text into a user's repository. Core decides
// what is written and where; this file contributes the filesystem and the report (D-107).
//
// D-112, four states and no fifth: `created` when nothing was there, `unchanged` when the copy still matches
// both its own stored hash and a fresh render, `updated` when an intact copy is behind the definition, and
// `overwrote local edits` when the copy's hash does not match its own contents. The last one is the whole
// point — overwriting is the contract the file itself states, and git is a hard precondition of the CLI, so
// nothing is unrecoverable; losing someone's work *without saying so* is what this report prevents.
//
// ST-LN-80 and Phase 8.3 D-01, the exception to "sync deletes nothing": a file accord once rendered and no longer renders
// (`RETIRED_FILES`) is removed, and reported `removed`, only while its marker shows nobody edited it; then a skill folder
// that removal emptied is removed too. A file nobody listed, or one someone edited, is never touched.
import { lstatSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  agentDir,
  agentsProblems,
  agentsRefusal,
  agentTargets,
  allSkillDirs,
  contentHash,
  hookEntries,
  hookText,
  isAccordHookCommand,
  isIntactRender,
  markerHash,
  mergeHooks,
  mergeHooksWithNotes,
  mergePanel,
  normaliseText,
  panelSettings,
  pluginDir,
  pluginTargets,
  RETIRED_FILES,
  RETIRED_SKILL_FOLDERS,
  runsAccordHook,
  skillTargets,
  withoutMarker,
} from '@accord-dev/accord-core';
import pkg from '../../package.json' with { type: 'json' };
import { assertNoLink } from '../guard.js';
import { UsageError } from '../load/fs.js';
import { shown } from '../load/script-trust.js';
import type { AccordConfig, SkillFile } from '@accord-dev/accord-core';
import type { CommandContext } from '../run.js';

export type SkillStatus = 'created' | 'unchanged' | 'updated' | 'overwrote local edits';

/**
 * One row of the report a command prints. Wider than this file's four states on purpose: `init` prints
 * the same list for its scaffold half, and a union spelled inline at both ends is a union the two ends
 * can drift apart on.
 */
export type ReportRow = { status: SkillStatus | 'skipped' | 'appended' | 'removed'; path: string };

/**
 * D-131: the one place accord writes a skill copy. `sync` and `init` both call it, so the marker-and-hash
 * rule above cannot come to mean one thing under one command and something else under the other.
 *
 * The caller owns everything around it — the `config.yml` requirement, the `assertNoLink` pre-pass, the
 * orphan scan, and the report — because those differ between the two callers and this does not.
 *
 * GC-WR-01: the caller may own the array too, so a status is recorded at the moment it becomes true rather
 * than when the loop finishes — a run that throws at target two still reports the `overwrote local edits`
 * that really happened at target one, which is the whole of what D-112 promises. The cost is that the
 * declared row type is wider than anything this function can produce: the element type belongs to the
 * report `init` prints, not to this function's own four states.
 */
export function writeSkillFiles(root: string, targets: SkillFile[], out: ReportRow[] = []): ReportRow[] {
  for (const { path, text } of targets) {
    const file = join(root, ...path.split('/'));
    const found = lstatSync(file, { throwIfNoEntry: false });
    if (found === undefined) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, text); // no encoding argument: Node defaults to utf8 and writes no BOM (FMT-08)
      out.push({ status: 'created', path });
      continue;
    }
    // RESEARCH.md Pitfall 1: git may have rewritten the line endings between the write and this read, so the
    // text is normalised exactly as the renderer's input was before either comparison is made.
    const onDisk = normaliseText(readFileSync(file, 'utf8'));
    const stored = markerHash(onDisk);
    const intact = stored !== undefined && stored === contentHash(withoutMarker(onDisk));
    if (intact && onDisk === text) {
      // D-112: not touched at all. "A second run is a no-op" means no write and no mtime change, not merely
      // the same bytes afterwards.
      out.push({ status: 'unchanged', path });
      continue;
    }
    writeFileSync(file, text);
    out.push({ status: intact ? 'updated' : 'overwrote local edits', path });
  }
  return out;
}

export const SETTINGS = '.claude/settings.json';

/** What `writeHooks` will do, decided before any file is written; `text` is absent when nothing changes. */
export type HooksPlan = { status: 'created' | 'unchanged' | 'updated'; text?: string; notes?: string[] };

/**
 * The pre-pass half: the link guard, then read, parse and merge `.claude/settings.json` for the claude runtime
 * only. The file is the owner's: anything that is not a JSON object is refused here, with the hooks printed to
 * add by hand, so the refusal lands before the first byte of the run. Writes nothing.
 */
export function planHooks(root: string, config: Pick<AccordConfig, 'runtimes'>): HooksPlan | undefined {
  if (!config.runtimes.includes('claude')) return undefined;
  assertNoLink(root, SETTINGS);
  const file = join(root, ...SETTINGS.split('/'));
  return hooksPlanFor(lstatSync(file, { throwIfNoEntry: false }) === undefined ? undefined : readFileSync(file, 'utf8'), config);
}

/** ST-LN-25: the plan for a settings file whose body is `text` (undefined: it does not exist); `planHooks` minus the file read. */
export function hooksPlanFor(text: string | undefined, config: Pick<AccordConfig, 'runtimes'>): HooksPlan | undefined {
  if (!config.runtimes.includes('claude')) return undefined;
  const entries = hookEntries(pkg);
  if (text === undefined) {
    return { status: 'created', text: JSON.stringify(mergePanel(mergeHooks({}, entries)), null, 2) + '\n' };
  }
  let parsed: unknown;
  let merged: Record<string, unknown>;
  let notes: string[];
  try {
    parsed = JSON.parse(text);
    const hooked = mergeHooksWithNotes(parsed, entries);
    notes = hooked.notes;
    merged = mergePanel(hooked.settings);
  } catch (err) {
    const keys = JSON.stringify(panelSettings, null, 2);
    if (err instanceof RangeError) {
      throw new UsageError(
        SETTINGS +
          ' already declares a marketplace named accord with another source; nothing was written. Rename it, then add these keys for the accord panel by hand:\n' +
          keys,
      );
    }
    if (!(err instanceof SyntaxError || err instanceof TypeError)) throw err;
    throw new UsageError(
      SETTINGS +
        ' is not a JSON object; nothing was written. Add these hooks by hand:\n' +
        JSON.stringify({ hooks: entries }, null, 2) +
        '\nand these keys for the accord panel:\n' +
        keys,
    );
  }
  const withNotes = notes.length > 0 ? { notes } : {};
  if (JSON.stringify(merged) === JSON.stringify(parsed)) return { status: 'unchanged', ...withNotes };
  return { status: 'updated', text: JSON.stringify(merged, null, 2) + '\n', ...withNotes };
}

/** The write half: applies a plan that is already known to be valid. */
export function writeHooks(root: string, plan: HooksPlan | undefined, out: ReportRow[]): void {
  if (plan === undefined) return;
  if (plan.text !== undefined) {
    const file = join(root, ...SETTINGS.split('/'));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, plan.text);
  }
  out.push({ status: plan.status, path: SETTINGS });
}

/**
 * ST-LN-80: remove each retired file (`RETIRED_FILES`) that is a real file under real folders, and only when
 * its marker shows nobody edited it. The check is the orphan scan's (`scannable`), so a link at `.claude` or
 * `.claude/agents` makes it a skip and nothing outside the repository is touched. A read or delete that fails
 * (a read-only folder, EBUSY, EPERM) leaves the file where it is and adds no row: sync goes on and the orphan
 * scan then lists it. An edited copy stays and is listed as an orphan.
 *
 * Phase 8.3 D-01: after the files, each skill folder (`<skill dir>/accord-<name>`, never a skill directory itself) that a
 * removal emptied, that this render does not produce, and that is a real folder under real folders, is removed with a
 * non-recursive `rmdirSync` and reported `removed` after the file rows. A folder that still holds a file (an edited copy, or
 * a file of the team's own) stays, whatever the reason, and the orphan scan then lists it; a failure adds no row.
 *
 * Phase 08.8 D-14 (IN-03, 08.3 review): that removal can fail (EBUSY or EPERM while an editor or antivirus holds the folder), and the next run found no retired file, so the emptied
 * folder was never tried again. Every run therefore also tries each folder of `RETIRED_SKILL_FOLDERS` (under each skill directory) that exists and holds no entry, with the same checks
 * (a real folder under real folders, not one this render produces, non-recursive `rmdirSync`); a folder that holds any file stays. Only a retired accord name is ever retried.
 */
function removeRetired(root: string, out: ReportRow[], config: AccordConfig): void {
  const candidates = new Set<string>(); // folders a removal of this run emptied, and the retired folders an earlier run may have emptied
  for (const path of RETIRED_FILES) {
    const parent = path.slice(0, path.lastIndexOf('/'));
    if (!scannable(root, parent)) continue;
    const file = join(root, ...path.split('/'));
    try {
      if (lstatSync(file, { throwIfNoEntry: false })?.isFile() !== true) continue;
      if (!isIntactRender(readFileSync(file, 'utf8'))) continue;
      rmSync(file);
      out.push({ status: 'removed', path });
      candidates.add(parent);
    } catch {
      // left where it is; the orphan scan reports it
    }
  }
  const rendered = new Set(skillTargets(config).map((t) => t.path.slice(0, t.path.lastIndexOf('/'))));
  const skillDirs = allSkillDirs();
  for (const dir of skillDirs) for (const name of Object.keys(RETIRED_SKILL_FOLDERS)) candidates.add(dir + '/' + name);
  for (const folder of [...candidates].sort()) {
    const dir = skillDirs.find((d) => folder.startsWith(d + '/accord-') && !folder.slice(d.length + 1).includes('/'));
    if (dir === undefined || rendered.has(folder) || !scannable(root, folder)) continue;
    try {
      const abs = join(root, ...folder.split('/'));
      if (readdirSync(abs).length > 0) continue;
      rmdirSync(abs);
      out.push({ status: 'removed', path: folder });
    } catch {
      // left where it is; the orphan scan reports it
    }
  }
}

/**
 * D-113: the scan opens every directory the table can produce (`allSkillDirs()`), and an accord
 * directory is an orphan when this render does not produce it: a dropped runtime, a role no longer
 * declared, or a 0.1.0 `accord-ba` or `accord-dev` that the stage skills replaced while `roles:` still
 * names them. The declared subset cannot be the scan set: a directory abandoned by dropping a runtime is
 * by definition not in it, so it would never be opened at all. `sync` deletes no orphan — an orphan keeps
 * loading in the runtime until someone removes it, so saying nothing was rejected, and deleting files
 * under a user's repository was rejected harder (the one retired file it removes is `removeRetired`'s).
 *
 * D-123: `accord` and `accord-*` and nothing else. A directory another tool owns is not read, not
 * counted, and not mentioned — inspecting someone else's files and editorialising about them is outside
 * accord's boundary.
 */
function orphans(root: string, config: AccordConfig): string[] {
  const rendered = new Set(skillTargets(config).map((t) => t.path.slice(0, t.path.lastIndexOf('/'))));
  const found: string[] = [];
  for (const dir of allSkillDirs()) {
    const abs = join(root, ...dir.split('/'));
    if (!scannable(root, dir)) continue;
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (!entry.isDirectory() || !(entry.name === 'accord' || entry.name.startsWith('accord-'))) continue;
      if (!rendered.has(dir + '/' + entry.name)) found.push(dir + '/' + entry.name);
    }
  }
  // Agent files: an `accord-*.md` the render no longer produces (a dropped runtime, a renamed definition).
  if (scannable(root, agentDir)) {
    const rendered = new Set(agentTargets(config).map((t) => t.path));
    for (const entry of readdirSync(join(root, ...agentDir.split('/')), { withFileTypes: true })) {
      const path = agentDir + '/' + entry.name;
      if (entry.isFile() && entry.name.startsWith('accord-') && entry.name.endsWith('.md') && !rendered.has(path)) found.push(path);
    }
  }
  if (scannable(root, pluginDir) && pluginTargets(config, pkg).length === 0) found.push(pluginDir);
  return found.sort();
}

/**
 * The read side of T-06-03: every component of `dir` under `root` must exist AND be a real directory
 * before the scan opens it. The single stat call this replaced followed links, so a junction at an
 * UNDECLARED target directory — one the write pre-pass never visits — routed the scan outside the
 * repository and printed an `rm -rf` aimed through it.
 *
 * Deliberately not merged with `assertNoLink` in `../guard.js`, which walks the same way. That one answers
 * "may accord WRITE here", and a link is a refusal: exit 2, nothing written. This one answers "may accord
 * LOOK here", and a link is a skip, because D-113 fixes that the orphan report must not change the exit code
 * and D-123 forbids reporting a directory accord did not generate. Same walk, different questions,
 * different dispositions.
 *
 * False also covers "does not exist" — a first run has neither directory — which is the union the one
 * link-following call answered before.
 */
function scannable(root: string, dir: string): boolean {
  const parts = dir.split('/');
  for (let i = 0; i < parts.length; i++) {
    const found = lstatSync(join(root, ...parts.slice(0, i + 1)), { throwIfNoEntry: false });
    if (found?.isDirectory() !== true) return false;
  }
  return true;
}

/** A hook problem as the audit prints it: the text after the gap id and the fix after `- fix:`. */
export interface HookProblem {
  text: string;
  fix: string;
}

/** What `accord audit` reads of the rendered files and of accord's hooks (Phase 8.1 G3b, D-08 group 2); every list holds repository-relative paths or hook problems, sorted as found. */
export interface RenderHealth {
  /** How many skill, agent and plugin files this config renders. */
  checked: number;
  /** Expected skill, agent and plugin files that are not on disk. */
  missing: string[];
  /** Expected files whose render marker does not match their contents (what `sync` would report as `overwrote local edits`). */
  edited: string[];
  orphans: string[];
  /** Files accord once rendered and no longer renders, still on disk (`RETIRED_FILES`). */
  retired: string[];
  hooksMissing: HookProblem[];
  hooksEdited: HookProblem[];
  hooksDoubled: HookProblem[];
}

/**
 * Where `path` stands under `root`, read the way the orphan scan reads (`scannable`): a link anywhere on the way is a skip, never followed and never a throw. `missing` is a path whose
 * walk ends at a name that does not exist; a regular file gives its text.
 */
export function readRegular(root: string, path: string): { state: 'missing' } | { state: 'skip' } | { state: 'file'; text: string } {
  const parts = path.split('/');
  for (let i = 0; i < parts.length; i++) {
    const found = lstatSync(join(root, ...parts.slice(0, i + 1)), { throwIfNoEntry: false });
    if (found === undefined) return { state: 'missing' };
    if (i === parts.length - 1 ? !found.isFile() : !found.isDirectory()) return { state: 'skip' };
  }
  try {
    return { state: 'file', text: readFileSync(join(root, ...parts), 'utf8') };
  } catch {
    return { state: 'skip' };
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Phase 8.1 D-08 group 2: the rendered skill, agent and panel plugin files, and accord's hooks in .claude/settings.json, as a report. It writes nothing and follows no link.
 * The files are judged by their render marker like `sync` judges them: an older but intact copy is neither missing nor edited. The hooks are judged per hook identity (event, subcommand, `if`)
 * of `hookEntries`, because the settings file is the owner's and shared with other tools, and only with the claude runtime in `runtimes`, the only one that renders a hook.
 */
export function renderHealth(root: string, config: AccordConfig): RenderHealth {
  const out: RenderHealth = { checked: 0, missing: [], edited: [], orphans: [], retired: [], hooksMissing: [], hooksEdited: [], hooksDoubled: [] };
  const targets = [...skillTargets(config), ...agentTargets(config), ...pluginTargets(config, pkg)];
  out.checked = targets.length;
  for (const { path } of targets) {
    const found = readRegular(root, path);
    if (found.state === 'missing') out.missing.push(path);
    else if (found.state === 'file' && !isIntactRender(found.text)) out.edited.push(path);
  }
  out.orphans = orphans(root, config);
  for (const path of RETIRED_FILES) {
    if (scannable(root, path.slice(0, path.lastIndexOf('/'))) && lstatSync(join(root, ...path.split('/')), { throwIfNoEntry: false })?.isFile() === true) out.retired.push(path);
  }
  if (!config.runtimes.includes('claude')) return out;

  const found = readRegular(root, SETTINGS);
  if (found.state === 'skip') return out;
  if (found.state === 'missing') {
    out.hooksMissing.push({ text: SETTINGS + " does not exist, so it holds none of accord's hooks", fix: 'accord skills sync' });
    return out;
  }
  const entries = hookEntries(pkg);
  let parsed: unknown;
  try {
    parsed = JSON.parse(found.text);
    mergeHooksWithNotes(parsed, entries);
  } catch (err) {
    if (!(err instanceof SyntaxError || err instanceof TypeError)) throw err;
    out.hooksMissing.push({ text: SETTINGS + ' is not a JSON object, so no accord hook can be read from it', fix: 'make it a JSON object, then run accord skills sync, which refuses it until then' });
    return out;
  }
  const hooksOf = (event: string): Record<string, unknown>[] => {
    const list = isRecord(parsed) && isRecord(parsed.hooks) ? parsed.hooks[event] : undefined;
    if (!Array.isArray(list)) return [];
    return list.flatMap((entry) => (isRecord(entry) && Array.isArray(entry.hooks) ? entry.hooks.filter(isRecord) : []));
  };
  // D-01: a hook is judged by the words of `command` plus `args` (an exec form hook has `args`); `args` that is not a list of strings is not accord's.
  const commandOf = (h: Record<string, unknown>): string | undefined => {
    if (typeof h.command !== 'string') return undefined;
    if (h.args === undefined) return h.command;
    return Array.isArray(h.args) && h.args.every((a) => typeof a === 'string') ? hookText({ command: h.command, args: h.args as string[] }) : undefined;
  };
  for (const [event, groups] of Object.entries(entries)) {
    const present = hooksOf(event);
    for (const wanted of groups.flatMap((g) => g.hooks)) {
      const sub = runsAccordHook(hookText(wanted));
      const kind = `accord ${event} hook for ${sub}${wanted.if === undefined ? '' : ' if ' + wanted.if}`;
      const same = present.filter((h) => {
        const c = commandOf(h);
        return c !== undefined && runsAccordHook(c) === sub && (typeof h.if === 'string' ? h.if : undefined) === wanted.if;
      });
      if (same.length === 0) out.hooksMissing.push({ text: `${SETTINGS} has no ${kind}`, fix: 'accord skills sync' });
      else if (same.length > 1) out.hooksDoubled.push({ text: `${SETTINGS} has ${same.length} of the ${kind}`, fix: `remove the extra accord hook from ${SETTINGS}` });
    }
    // a hook that runs accord in a form sync did not write: sync keeps it (D-16), so it is named here with the edit first
    for (const h of present) {
      const c = commandOf(h);
      if (c !== undefined && runsAccordHook(c) !== undefined && !isAccordHookCommand(c)) {
        out.hooksEdited.push({
          text: `${SETTINGS} ${event} hook "${shown(c)}" runs accord hook ${runsAccordHook(c)} in a form accord skills sync did not write`,
          fix: `restore it to the form sync writes or remove it in ${SETTINGS}, then run accord skills sync (sync alone keeps it)`,
        });
      }
    }
  }
  return out;
}

export function skills(ctx: CommandContext): number {
  // D-121: `sync` reads `roles:` and `runtimes:`, so a repository without a valid config has nothing to
  // filter by. A config-free mode defaulting to every role and every runtime would make that filtering
  // meaningless; the pin check in `preflight` has already run for the same reason.
  const config = ctx.snapshot.config;
  if (config === undefined) {
    throw new UsageError('accord/config.yml is missing or failed its schema; run accord lint');
  }

  // Phase 11 D-02, D-17: an `agents:` entry that breaks a role's rule is refused before any path is computed or written, so a refused config leaves .claude/ and .agents/ as they were.
  const problems = agentsProblems(config);
  if (problems.length > 0) throw new UsageError(agentsRefusal(problems));

  const targets = [...skillTargets(config), ...agentTargets(config), ...pluginTargets(config, pkg)];
  // T-06-03: refuse before the first byte, over every destination. The loop below writes as it iterates, so
  // a guard inside it leaves everything sorted ahead of the bad path on disk while the message claims
  // "nothing was written" — a false report is worse than either outcome on its own.
  for (const { path } of targets) assertNoLink(ctx.root, path);
  const hooks = planHooks(ctx.root, config);

  // Computed once, then rendered — so a `--json` mode added later cannot disagree with the text.
  const results = writeSkillFiles(ctx.root, targets);
  writeHooks(ctx.root, hooks, results);
  removeRetired(ctx.root, results, config);

  // Scanned after the writes, so a directory this run created is already on disk when it is judged.
  const stale = orphans(ctx.root, config);

  ctx.stdout.write(results.map((r) => r.status + ' ' + r.path + '\n').join(''));
  // D-16: one line per accord hook the owner edited, which sync kept; printed on every run, `unchanged` included.
  ctx.stdout.write((hooks?.notes ?? []).map((n) => n + '\n').join(''));
  // stderr, like status's advisory line: an orphan is something to tell the reader about, not part of
  // the report of what was written — and it must not change the exit code (D-113).
  ctx.stderr.write(
    stale
      .map(
        (d) =>
          'orphan ' +
          d +
          ' - no longer declared; accord deletes no orphan - remove it with: rm -rf ' +
          d +
          (d === pluginDir ? ' - then remove extraKnownMarketplaces.accord and enabledPlugins["accord-panel@accord"] from ' + SETTINGS : '') +
          '\n',
      )
      .join(''),
  );
  return 0;
}
