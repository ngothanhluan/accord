// Spec §10 `accord review-package <id> [--base <ref>]`: what a reviewer reads — commits, stat, and the diff
// with ten lines of context. git only, literal argument arrays, no shell (CLI-07).
// Phase 8.5 D-03, D-05, D-07, D-23: after `## Slop` the package carries the reviewer's product blocks (the ruleset, the epic block of a story, the default branch's `## Conventions` and the
// branch's own `## Product files changed`, from core's `productBlocks`), so a branch cannot loosen a rule for its own reviewer; `--out <file>` writes the package into the report folder.
import { execFileSync } from 'node:child_process';
import { lstatSync } from 'node:fs';
import { join } from 'node:path';
import { epicBlock, interfaceSigns, isSha, matchedHunks, outsideScope, productBlocks, securityExemptRounds, securitySpec, securityTriggers, slopLine, stageOff, triggerText, undeclaredFiles, workOf } from '@accord-dev/accord-core';
import type { RepoSnapshot } from '@accord-dev/accord-core';
import { currentBranch, defaultRefOf, UsageError } from '../load/fs.js';
import { packageDiff, REF, roundOneBase, why } from '../load/package-diff.js';
import { cliRuleset, productChange, readProductText } from '../load/product.js';
import { resolveRepo, toPosix } from '../load/repos.js';
import { REPORT_DIR, writeAgentFile } from '../load/report.js';
import { exemptCopies, securityRoundRanges } from '../load/security-facts.js';
import { shown as printable } from '../load/script-trust.js';
import { branchRef, sliceHomeOf, sliceStart } from '../load/slice-size.js';
import { sliceOfBranch } from '../load/slices.js';
import { slopFacts } from '../load/slop-facts.js';
import { nearestCode, readWalk } from '../load/walk.js';
import type { CommandContext } from '../run.js';
import { currentSlice, epicSnapshot } from './anchor.js';
import { branchFactFor, renderedFilesOf } from './branch-fact.js';
import { refuseLaneR, requireLaneTicket } from './lane-args.js';
import { readRecorded } from './worktree.js';

const cannot = (why: string) => `(cannot tell: ${why})`;
const NONE = '(none: no pattern matched)';

interface SecuritySections {
  triggers: string;
  checklist: string;
  hunks: string;
}

/**
 * ST-LN-36 D-05 (4): the security sections of a package, from its own diff text and changed list so they run no git command of their own. `triggers` is the `## Security triggers`
 * text; with `full`, `checklist` (every item in force, default and team) and `hunks` (matchedHunks, or the none line) are read too.
 * Phase 08.9.3 D-04: `others` are the diffs of the other repositories, scanned by the same patterns each over its own paths (a path pattern is a path of that repository) and printed with the `<name>:` prefix; their hunks
 * follow this repository's under a `### Repository <name>` heading. The generated paths and the exempt skill copies are this repository's, so none applies to another one.
 */
export function securitySections(s: RepoSnapshot, diffText: string, changed: string[], full: boolean, at: { root: string; head: string }, unreadable?: string[], others: OtherDiff[] = []): SecuritySections {
  try {
    const spec = securitySpec(s);
    const generated = s.config?.generated ?? [];
    // BUG-LN-25 D-06, D-08: the copies left out are the ones gate done leaves out, read at this package's own head; a read that fails is `(cannot tell: …)` below.
    const exempt = exemptCopies(at.root, at.head, changed, renderedFilesOf(s.config));
    const found = securityTriggers(spec, diffText, changed, { generated, unreadable, exempt });
    const foundOthers = others.flatMap((o) => securityTriggers(spec, o.diff, o.changed, { generated: [], unreadable: o.unread }).map((t) => ({ ...t, path: `${o.name}:${t.path}` })));
    let triggers = [...found, ...foundOthers].map(triggerText).join('\n') || NONE;
    // ST-LN-36 D-06: a line of the repository's file that did not read is said here too, so a reviewer is never told the list is whole when it is not.
    const unread = spec.problems.length;
    if (unread > 0) triggers += `\n(accord/product/security.md: ${unread} ${unread === 1 ? 'line' : 'lines'} not read; run accord lint)`;
    if (!full) return { triggers, checklist: '', hunks: '' };
    return {
      triggers,
      checklist: spec.checklist.map((c) => `- ${c.id}: ${c.text}`).join('\n') || '(none)',
      hunks: [
        matchedHunks(spec, diffText, changed, { generated, unreadable, exempt }).join('\n') || NONE,
        ...others.map((o) => `### Repository ${o.name}\n\n${matchedHunks(spec, o.diff, o.changed, { generated: [], unreadable: o.unread }).join('\n') || NONE}`),
      ].join('\n\n'),
    };
  } catch (e) {
    const unread = cannot(e instanceof Error ? e.message : String(e));
    return { triggers: unread, checklist: unread, hunks: unread };
  }
}

/**
 * Phase 8.1 D-14: the `## Slop` text of a package: one `- slop:<kind> <path>:<line> — <label>` per hit of the ticket's cumulative diff (not of this package's own range, so a final reviewer sees
 * exactly what `accord gate done` judges), `(none: no pattern matched)` when there is none, and a note when lines of accord/product/slop.md did not read. Every printed value goes through printable().
 */
function slopSection(ctx: CommandContext, s: RepoSnapshot, id: string, def: string | undefined): string {
  const facts = slopFacts(ctx.root, s, id, renderedFilesOf(s.config), { defaultRef: def });
  if ('error' in facts) return cannot(printable(facts.error));
  let text = facts.hits.map((h) => printable(slopLine(h))).join('\n') || NONE;
  if (facts.unread > 0) text += `\n(accord/product/slop.md: ${facts.unread} ${facts.unread === 1 ? 'line' : 'lines'} not read; run accord lint)`;
  return text;
}

/** The security package's layout, shared with `accord diff-package --security` (ST-LN-83 07-07). */
export const securityText = (title: string, sec: SecuritySections): string =>
  [title, '## Checklist', sec.checklist, '## Security triggers', sec.triggers, '## Matched hunks', sec.hunks].join('\n\n') + '\n';

/**
 * D-23, R-5: print the package, or with `--out` write it through the one writer of agent files (`.accord-reports/<id>/<name>`, UTF-8 with no byte order mark) and print what a skill reads:
 * the `Head:` line when the package has one, then `file: <path>`.
 */
function emit(ctx: CommandContext, id: string, text: string, out: string | undefined, head: string | undefined): void {
  if (out === undefined) {
    ctx.stdout.write(text);
    return;
  }
  const file = writeAgentFile(ctx.root, id, out, text);
  ctx.stdout.write((head === undefined ? '' : 'Head: ' + head + '\n') + 'file: ' + file + '\n');
}

/** A full 40 or 64 digit sha as its first twelve digits; any other ref as typed. */
const abbrev = (ref: string): string => (/^[0-9a-f]{40,64}$/.test(ref) ? ref.slice(0, 12) : ref);

/**
 * `--security --round <k>`: the security package of the k-th `## Round` section of review.md, over the range the security record rule reads (securityRoundRanges), so a session refused for a
 * skipped security review can review exactly that round. A `(final review)` round that follows a round of its stretch has none (D-10): its fix is reviewed at the re-review round after it.
 */
function securityRoundPackage(ctx: CommandContext, id: string, asked: string, out: string | undefined): number {
  if (!/^[1-9][0-9]*$/.test(asked)) throw new UsageError(`--round takes a round number, 1 or more: ${asked}`);
  const k = Number(asked);
  const ranges = securityRoundRanges(ctx.root, ctx.snapshot, id);
  if ('error' in ranges) throw new UsageError(`cannot read the rounds of ${id}: ${ranges.error}`);
  const at = ranges.rounds[k - 1];
  if (at === undefined) {
    const n = ranges.rounds.length;
    throw new UsageError(n === 0 ? `--round ${k}: review.md of ${id} records no round` : `--round ${k}: review.md of ${id} records ${n} ${n === 1 ? 'round' : 'rounds'}`);
  }
  if (securityExemptRounds(ctx.snapshot, id).has(k)) {
    throw new UsageError(`--round ${k} is a (final review) round that follows a round of its stretch, which has no security package of its own (D-10); its fix is reviewed at the re-review round after it`);
  }
  const range = `${abbrev(at.base)}...${abbrev(at.head)}`;
  let pkg;
  try {
    pkg = packageDiff(ctx.root, { base: at.base, head: at.head, def: defaultRefOf(ctx.root), allowPlainLog: false });
  } catch (e) {
    if (e instanceof UsageError) throw e;
    throw new UsageError(`cannot diff round ${k} (${range}): ${why(e)}`);
  }
  emit(ctx, id, securityText(`# Security package: ${id} (${range})\nHead: ${abbrev(at.head)}`, securitySections(ctx.snapshot, pkg.diff, pkg.changed, true, { root: ctx.root, head: at.head }, pkg.unread)), out, abbrev(at.head));
  return 0;
}

const gitIn = (dir: string, args: string[]): string =>
  execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });

/** The full sha a ref resolves to in `dir`, or undefined: only a hexadecimal name ever reaches a later git argument. */
function shaIn(dir: string, ref: string): string | undefined {
  try {
    const sha = gitIn(dir, ['rev-parse', '--verify', '--quiet', ref + '^{commit}']).trim();
    return isSha(sha) ? sha : undefined;
  } catch {
    return undefined;
  }
}

/** Whether `path` is a regular file itself (a link is not followed). */
function isFile(path: string): boolean {
  try {
    return lstatSync(path).isFile();
  } catch {
    return false;
  }
}

/** One other repository's change as the security reading takes it: the diff text and the changed paths as git in its clone printed them (no prefix), and the files its `--text` read left unread. */
export interface OtherDiff {
  name: string;
  diff: string;
  changed: string[];
  unread?: string[];
}

/**
 * Phase 08.9.3 D-04, D-05: the `## Repository <name>` section of every other repository the plan names (its tasks' `repo` and its slices' `repo:`), in name order, and what the security reading needs of each. The section's range is read in that
 * repository's clone (`packageDiff(clone, ...)`, so no session runs git there): its base is `baseline_<name>`, its tip the newest slice branch of that repository there (this clone's copy, else origin's). A repository with no clone
 * is a UsageError carrying the D-02 line; one with no slice branch yet, or no baseline that names a commit, is a `(cannot tell: ...)` section. Text of that repository (commit subjects, diff lines) is data under headings this function prints.
 * A plan naming no other repository gives no text and runs no git.
 */
export function repositorySections(ctx: CommandContext, id: string, options: { base?: string } = {}): { text: string; repos: OtherDiff[] } {
  const plan = workOf(ctx.snapshot, id)?.plan;
  const names = new Set<string>();
  for (const t of plan?.tasks ?? []) if (t.repo !== undefined) names.add(t.repo);
  for (const s of plan?.slices ?? []) if (s.repo !== undefined) names.add(s.repo);
  if (plan === undefined || names.size === 0) return { text: '', repos: [] };
  // D-05: while the slice in work is a slice of a repository, its section starts where that slice starts; the final review (--base, which only the plan's baseline can be) reads every repository from its baseline_<name>
  const inWork = options.base === undefined ? currentSlice(ctx, id) : undefined;
  const blocks: string[] = [];
  const repos: OtherDiff[] = [];
  for (const name of [...names].sort()) {
    const heading = `## Repository ${name}`;
    const resolved = resolveRepo(ctx.root, ctx.snapshot.config, name);
    if ('refused' in resolved) throw new UsageError(resolved.refused);
    const clone = resolved.path;
    // the tip: the newest slice of this repository whose branch exists in its clone
    let tip: string | undefined;
    let tipN = 0;
    for (const n of (plan.slices ?? []).filter((x) => x.repo === name).map((x) => x.n).sort((a, b) => b - a)) {
      const home = sliceHomeOf(ctx.snapshot, id, n);
      const ref = home === undefined ? undefined : branchRef(clone, home.branch);
      tip = ref === undefined ? undefined : shaIn(clone, ref);
      if (tip !== undefined) {
        tipN = n;
        break;
      }
    }
    if (tip === undefined) {
      blocks.push(`${heading}\n\n${cannot(`no slice branch of ${name} exists yet in ${toPosix(clone)}, so there is nothing to read there`)}`);
      continue;
    }
    const given = plan.repoBaselines !== undefined && Object.hasOwn(plan.repoBaselines, name) ? plan.repoBaselines[name] : undefined;
    const start = inWork?.repo === name ? sliceStart(ctx.root, ctx.snapshot, id, inWork.n) : undefined;
    const base = start !== undefined && isSha(start) ? shaIn(clone, start) : given !== undefined && isSha(given) ? shaIn(clone, given) : undefined;
    if (base === undefined) {
      blocks.push(`${heading}\n\n${cannot(`baseline_${name} of the plan names no commit of the clone at ${toPosix(clone)}`)}`);
      continue;
    }
    let pkg;
    try {
      pkg = packageDiff(clone, { base, head: tip, def: defaultRefOf(clone), allowPlainLog: false, parts: true });
    } catch (e) {
      if (e instanceof UsageError) throw e;
      throw new UsageError(`cannot diff ${name} ${abbrev(base)}...${abbrev(tip)}: ${why(e)}`);
    }
    // the changed paths no task of that repository names, as this repository's `## Undeclared files` reads its own
    const declared = plan.tasks.flatMap((t) => [...(t.repoFiles ?? []), ...(t.repoNewFiles ?? [])]).filter((x) => x.repo === name).map((x) => x.path);
    const undeclared = [...new Set(pkg.changed)]
      .filter((p) => !declared.some((d) => (d.endsWith('/') ? p.startsWith(d) : p === d)))
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    let worktree: string | undefined;
    try {
      worktree = readRecorded(ctx.root).find((e) => e.id === id && e.repo === name)?.path;
    } catch {
      worktree = undefined;
    }
    const range = `${abbrev(base)}...${abbrev(tip)}${pkg.excluded ? `, without ${pkg.short}` : ''}`;
    // the listing `accord repos baseline` wrote, so a reviewer reads the other repository's tree from a file the CLI wrote (Ruling, research question 4); a link or a missing file is not named
    const listing = `${REPORT_DIR}/${id}/repos/${name}.files`;
    const listed = isFile(join(ctx.root, ...listing.split('/')));
    blocks.push(
      [
        heading,
        `Range: ${range} (slice ${tipN}${worktree === undefined ? '' : `, worktree ${toPosix(worktree)}`})` + (listed ? `\nFiles: ${toPosix(ctx.root).replace(/\/+$/, '')}/${listing}` : ''),
        '### Commits',
        pkg.commits || '(none)',
        '### Stat',
        pkg.stat || '(no changes)',
        '### Undeclared files',
        undeclared.join('\n') || '(none)',
        '### Diff',
        pkg.diff || '(no changes)',
      ].join('\n\n'),
    );
    repos.push({ name, diff: pkg.diff, changed: pkg.changed, ...(pkg.unread === undefined ? {} : { unread: pkg.unread }) });
  }
  return { text: blocks.join('\n\n'), repos };
}

/** The start of the slice this checkout is on when it is on `slice/<id>/<n>` of this ticket; undefined on any other branch, and when git cannot say. */
function sliceBase(ctx: CommandContext, id: string): string | undefined {
  const name = ctx.branch === undefined ? currentBranch(ctx.root) : ctx.branch.name;
  const slice = name === undefined ? undefined : sliceOfBranch(name);
  return slice === undefined || slice.id !== id ? undefined : sliceStart(ctx.root, ctx.snapshot, id, slice.n);
}

export function reviewPackage(ctx: CommandContext, id: string, options: { base?: string; security?: boolean; round?: string; out?: string }): number {
  const ticket = requireLaneTicket(ctx, id);
  refuseLaneR(ticket, id, 'review package');
  if (options.round !== undefined && options.security !== true) throw new UsageError('--round is for the security package: give --security too');
  if (options.security === true && options.round !== undefined) {
    if (options.base !== undefined) throw new UsageError('--round takes the range of the recorded round; give no --base');
    return securityRoundPackage(ctx, id, options.round, options.out);
  }
  const laneS = ticket.frontmatter?.lane === 'S';
  const git = (args: string[]) =>
    execFileSync('git', args, {
      cwd: ctx.root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
  const commitOf = (ref: string): string | undefined => {
    try {
      return git(['rev-parse', '--verify', '--quiet', ref + '^{commit}']).trim();
    } catch {
      return undefined;
    }
  };
  // ST-LN-57: a version 2 record builds every loop round from the last round's head; a version 1 or
  // unversioned record with rounds keeps today's package.
  const work = workOf(ctx.snapshot, id);
  const rec = work?.rounds;
  const v2 = rec?.version === 2;
  const old = rec !== undefined && !v2 && rec.cycles.some((c) => c.rounds.length > 0);
  const baseline = work?.plan?.baseline;
  // ST-LN-50 D-08: with the plan stage off a ticket has no plan baseline, so its work is read from the default branch, as lane S's is (and as readWalk and the round facts read it).
  const planOffDefault = !laneS && baseline === undefined && stageOff(ctx.snapshot, id, 'plan') ? defaultRefOf(ctx.root) : undefined;
  const loopBase = "in a version 2 review record every loop round is built from the last round's head; ";
  let lastHead: string | undefined;
  if (v2) {
    if (options.base !== undefined) {
      if (laneS) throw new UsageError(loopBase + 'lane S takes no --base');
      const given = commitOf(options.base);
      if (planOffDefault !== undefined) {
        // the final review's base with no plan: the default branch, or where this branch left it
        let mergeBase: string | undefined;
        try {
          mergeBase = git(['merge-base', planOffDefault, 'HEAD']).trim();
        } catch {
          mergeBase = undefined;
        }
        if (given === undefined || (given !== commitOf(planOffDefault) && given !== mergeBase)) {
          throw new UsageError(loopBase + '--base is accepted only for the final review, as the default branch (the plan stage is off): ' + planOffDefault);
        }
      } else if (baseline === undefined || given === undefined || given !== commitOf(baseline)) {
        throw new UsageError(loopBase + "--base is accepted only for the final review, as the plan's baseline: " + (baseline ?? '(none)'));
      }
    } else {
      let k = rec!.cycles.length - 1;
      while (k >= 0 && rec!.cycles[k].rounds.length === 0) k--;
      if (k >= 0) {
        const rounds = rec!.cycles[k].rounds;
        const last = rounds[rounds.length - 1];
        if (last.head === undefined) throw new UsageError(`round ${rounds.length} of cycle ${k + 1} names no readable head in review.md; fix its heading`);
        if (commitOf(last.head) === undefined) {
          throw new UsageError(
            `round ${rounds.length} of cycle ${k + 1}'s head ${last.head} names no commit in this repository; after a rebase, retype each round's head to the commit that now holds the same change`,
          );
        }
        lastHead = last.head;
      }
    }
  }
  // The default ref read for a lane S base is the one the exclusion below uses.
  const laneSDefault = laneS && (options.base === undefined || v2) ? defaultRefOf(ctx.root) : undefined;
  // Phase 15 D-10: on a slice branch (slice 2 or later) before any round is recorded, the package reads from where the slice starts, so each slice is reviewed on its own diff; a round's head and --base come first.
  const roundless = rec === undefined || rec.cycles.every((c) => c.rounds.length === 0);
  const sliceAt = !laneS && lastHead === undefined && options.base === undefined && roundless ? sliceBase(ctx, id) : undefined;
  const base = lastHead ?? options.base ?? sliceAt ?? roundOneBase(ctx.root, ctx.snapshot, id, { defaultRef: laneS ? laneSDefault : planOffDefault });
  if (base === undefined) {
    throw new UsageError(
      laneS
        ? 'no --base given and no default branch: none of origin/HEAD, origin/main, origin/master, main or master resolves'
        : stageOff(ctx.snapshot, id, 'plan')
          ? 'no --base given, the plan stage is off so there is no plan baseline, and no default branch: none of origin/HEAD, origin/main, origin/master, main or master resolves'
          : 'no --base given and plan.md records no baseline:',
    );
  }
  if (!REF.test(base)) throw new UsageError('not a git ref: ' + base);
  const range = base + '...HEAD';
  try {
    git(['rev-parse', '--verify', '--quiet', base + '^{commit}']);
  } catch {
    let headless = false;
    try {
      git(['rev-parse', '--verify', '--quiet', 'HEAD^{commit}']);
    } catch {
      headless = true;
    }
    throw new UsageError(headless ? 'the repository has no commit to review' : 'unknown base ref: ' + base);
  }
  const def = laneSDefault ?? defaultRefOf(ctx.root);
  const f = branchFactFor(ctx, id, { defaultRef: def });
  const s = { ...ctx.snapshot, branchFacts: { [id]: f } };
  let parts: string[];
  let label: string;
  let diffText: string;
  let changedFiles: string[];
  let unread: string[] | undefined;
  try {
    // ST-LN-36: the package diff of a head is one function (the security record rule reads each round's head through it); ST-LN-26's exclusion of a merge from the default branch lives there.
    const pkg = packageDiff(ctx.root, { base, head: 'HEAD', def, allowPlainLog: old, parts: true });
    const changed = pkg.changed;
    label = pkg.excluded ? `${base}..HEAD, without ${pkg.short}` : range;
    parts = [
      `# Review package: ${id} (${label})`,
      '## Commits',
      pkg.commits || '(none)',
      '## Stat',
      pkg.stat || '(no changes)',
      '## Diff',
      pkg.diff || '(no changes)',
    ];
    // ST-LN-36 D-05: the security triggers read the package's own diff text and changed list, so they run no git command of their own.
    diffText = pkg.diff;
    changedFiles = changed;
    unread = pkg.unread;
    const undeclared = undeclaredFiles(s, id, changed);
    parts.splice(
      parts.indexOf('## Diff'),
      0,
      '## Undeclared files',
      undeclared === undefined ? '(no plan)' : undeclared.join('\n') || '(none)',
    );
  } catch (e) {
    if (e instanceof UsageError) throw e;
    throw new UsageError(`cannot diff ${range}: ${why(e)}`);
  }
  // ST-LN-62: what `accord gate done` would name, shown before it runs; the command never fails on the fact.
  let headLine: string | undefined;
  if (!old) {
    const walk = readWalk(ctx.root, { laneS, def, baseline });
    const commit = ctx.snapshot.git?.commit;
    const head = 'error' in walk ? '(cannot tell: ' + walk.error + ')' : commit === undefined ? '(cannot tell: no commit)' : nearestCode(walk, commit, id);
    headLine = head;
    parts[0] += '\nHead: ' + head;
  }
  const shown: string[] = [];
  if (laneS) {
    const o = outsideScope(s, id);
    shown.push(
      '## Out-of-scope files',
      'error' in f ? cannot(f.error) : o !== undefined && 'cannot' in o ? cannot(o.cannot) : o?.paths.join('\n') || '(none)',
    );
  }
  const signs = interfaceSigns(s, id);
  shown.push(
    '## Interface signs',
    'error' in f ? cannot(f.error) : signs?.map((x) => `${x.path}: ${x.sign}`).join('\n') || '(none)',
  );
  // Phase 08.9.3 D-04, D-05: read before anything is written, so a repository with no clone stops the command with its D-02 line and no package.
  const others = repositorySections(ctx, id, options);
  if (options.security === true) {
    // The security package: the same range and diff, but only the checklist, the triggers and the hunks they match.
    const at = parts[0].indexOf('\nHead: ');
    emit(ctx, id, securityText(`# Security package: ${id} (${label})${at < 0 ? '' : parts[0].slice(at)}`, securitySections(s, diffText, changedFiles, true, { root: ctx.root, head: 'HEAD' }, unread, others.repos)), options.out, headLine);
    return 0;
  }
  shown.push('## Security triggers', securitySections(s, diffText, changedFiles, false, { root: ctx.root, head: 'HEAD' }, unread, others.repos).triggers);
  shown.push('## Slop', slopSection(ctx, s, id, def));
  // D-03, D-05, D-07: the reviewer's product blocks, read from the default ref this function already read (no second lookup); a clone with no default ref gets the working copy and the one line saying so.
  const product = productBlocks('reviewer', {
    ruleset: cliRuleset(),
    epic: epicBlock(epicSnapshot(ctx, id), id),
    conventions: readProductText(ctx.root, { from: 'default', ref: def }),
    changed: productChange(ctx.root, def, 'HEAD'),
  });
  parts.splice(parts.indexOf('## Stat'), 0, ...shown, ...product);
  if (others.text !== '') parts.push(others.text);
  emit(ctx, id, parts.join('\n\n') + '\n', options.out, headLine);
  return 0;
}
