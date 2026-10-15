// CLI-08 `accord skills sync`: the one place accord puts its own text into a user's repository. Core decides
// what is written and where; this file contributes the filesystem and the report (D-107).
//
// D-112, four states and no fifth: `created` when nothing was there, `unchanged` when the copy still matches
// both its own stored hash and a fresh render, `updated` when an intact copy is behind the definition, and
// `overwrote local edits` when the copy's hash does not match its own contents. The last one is the whole
// point — overwriting is the contract the file itself states, and git is a hard precondition of the CLI, so
// nothing is unrecoverable; losing someone's work *without saying so* is what this report prevents.
import { lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  agentDir,
  agentTargets,
  allSkillDirs,
  contentHash,
  hookEntries,
  markerHash,
  mergeHooks,
  mergePanel,
  normaliseText,
  pluginTargets,
  skillTargets,
  withoutMarker,
} from '@accord-dev/accord-core';
import pkg from '../../package.json' with { type: 'json' };
import { assertNoLink } from '../guard.js';
import { UsageError } from '../load/fs.js';
import type { AccordConfig, SkillFile } from '@accord-dev/accord-core';
import type { CommandContext } from '../run.js';

export type SkillStatus = 'created' | 'unchanged' | 'updated' | 'overwrote local edits';

/**
 * One row of the report a command prints. Wider than this file's four states on purpose: `init` prints
 * the same list for its scaffold half, and a union spelled inline at both ends is a union the two ends
 * can drift apart on.
 */
export type ReportRow = { status: SkillStatus | 'skipped' | 'appended'; path: string };

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
export type HooksPlan = { status: 'created' | 'unchanged' | 'updated'; text?: string };

/**
 * The pre-pass half: the link guard, then read, parse and merge `.claude/settings.json` for the claude runtime
 * only. The file is the owner's: anything that is not a JSON object is refused here, with the hooks printed to
 * add by hand, so the refusal lands before the first byte of the run. Writes nothing.
 */
export function planHooks(root: string, config: Pick<AccordConfig, 'runtimes'>): HooksPlan | undefined {
  if (!config.runtimes.includes('claude')) return undefined;
  assertNoLink(root, SETTINGS);
  const entries = hookEntries(pkg);
  const file = join(root, ...SETTINGS.split('/'));
  if (lstatSync(file, { throwIfNoEntry: false }) === undefined) {
    return { status: 'created', text: JSON.stringify(mergePanel(mergeHooks({}, entries)), null, 2) + '\n' };
  }
  let parsed: unknown;
  let merged: Record<string, unknown>;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
    merged = mergePanel(mergeHooks(parsed, entries));
  } catch (err) {
    if (!(err instanceof SyntaxError || err instanceof TypeError)) throw err;
    throw new UsageError(
      SETTINGS + ' is not a JSON object; nothing was written. Add these hooks by hand:\n' + JSON.stringify({ hooks: entries }, null, 2),
    );
  }
  if (JSON.stringify(merged) === JSON.stringify(parsed)) return { status: 'unchanged' };
  return { status: 'updated', text: JSON.stringify(merged, null, 2) + '\n' };
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
 * D-113: the scan opens every directory the table can produce (`allSkillDirs()`), and an accord
 * directory is an orphan when this render does not produce it: a dropped runtime, a role no longer
 * declared, or a 0.1.0 `accord-ba` or `accord-dev` that the stage skills replaced while `roles:` still
 * names them. The declared subset cannot be the scan set: a directory abandoned by dropping a runtime is
 * by definition not in it, so it would never be opened at all. `sync` never deletes — an orphan keeps
 * loading in the runtime until someone removes it, so saying nothing was rejected, and deleting files
 * under a user's repository was rejected harder.
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

export function skills(ctx: CommandContext): number {
  // D-121: `sync` reads `roles:` and `runtimes:`, so a repository without a valid config has nothing to
  // filter by. A config-free mode defaulting to every role and every runtime would make that filtering
  // meaningless; the pin check in `preflight` has already run for the same reason.
  const config = ctx.snapshot.config;
  if (config === undefined) {
    throw new UsageError('accord/config.yml is missing or failed its schema; run accord lint');
  }

  const targets = [...skillTargets(config), ...agentTargets(config), ...pluginTargets(config, pkg)];
  // T-06-03: refuse before the first byte, over every destination. The loop below writes as it iterates, so
  // a guard inside it leaves everything sorted ahead of the bad path on disk while the message claims
  // "nothing was written" — a false report is worse than either outcome on its own.
  for (const { path } of targets) assertNoLink(ctx.root, path);
  const hooks = planHooks(ctx.root, config);

  // Computed once, then rendered — so a `--json` mode added later cannot disagree with the text.
  const results = writeSkillFiles(ctx.root, targets);
  writeHooks(ctx.root, hooks, results);

  // Scanned after the writes, so a directory this run created is already on disk when it is judged.
  const stale = orphans(ctx.root, config);

  ctx.stdout.write(results.map((r) => r.status + ' ' + r.path + '\n').join(''));
  // stderr, like status's advisory line: an orphan is something to tell the reader about, not part of
  // the report of what was written — and it must not change the exit code (D-113).
  ctx.stderr.write(
    stale.map((d) => 'orphan ' + d + ' - no longer declared; accord never deletes - remove it with: rm -rf ' + d + '\n').join(''),
  );
  return 0;
}
