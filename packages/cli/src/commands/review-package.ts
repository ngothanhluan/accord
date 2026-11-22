// Spec §10 `accord review-package <id> [--base <ref>]`: what a reviewer reads — commits, stat, and the diff
// with ten lines of context. git only, literal argument arrays, no shell (CLI-07).
// Phase 8.5 D-03, D-05, D-07, D-23: after `## Slop` the package carries the reviewer's product blocks (the ruleset, the epic block of a story, the default branch's `## Conventions` and the
// branch's own `## Product files changed`, from core's `productBlocks`), so a branch cannot loosen a rule for its own reviewer; `--out <file>` writes the package into the report folder.
import { execFileSync } from 'node:child_process';
import { epicBlock, interfaceSigns, matchedHunks, outsideScope, productBlocks, securityExemptRounds, securitySpec, securityTriggers, slopLine, stageOff, triggerText, undeclaredFiles, workOf } from '@accord-dev/accord-core';
import type { RepoSnapshot } from '@accord-dev/accord-core';
import { defaultRefOf, UsageError } from '../load/fs.js';
import { packageDiff, REF, roundOneBase, why } from '../load/package-diff.js';
import { cliRuleset, productChange, readProductText } from '../load/product.js';
import { writeAgentFile } from '../load/report.js';
import { exemptCopies, securityRoundRanges } from '../load/security-facts.js';
import { shown as printable } from '../load/script-trust.js';
import { slopFacts } from '../load/slop-facts.js';
import { nearestCode, readWalk } from '../load/walk.js';
import type { CommandContext } from '../run.js';
import { epicSnapshot } from './anchor.js';
import { branchFactFor, renderedFilesOf } from './branch-fact.js';
import { refuseLaneR, requireLaneTicket } from './lane-args.js';

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
 */
export function securitySections(s: RepoSnapshot, diffText: string, changed: string[], full: boolean, at: { root: string; head: string }, unreadable?: string[]): SecuritySections {
  try {
    const spec = securitySpec(s);
    const generated = s.config?.generated ?? [];
    // BUG-LN-25 D-06, D-08: the copies left out are the ones gate done leaves out, read at this package's own head; a read that fails is `(cannot tell: …)` below.
    const exempt = exemptCopies(at.root, at.head, changed, renderedFilesOf(s.config));
    const found = securityTriggers(spec, diffText, changed, { generated, unreadable, exempt });
    let triggers = found.map(triggerText).join('\n') || NONE;
    // ST-LN-36 D-06: a line of the repository's file that did not read is said here too, so a reviewer is never told the list is whole when it is not.
    const unread = spec.problems.length;
    if (unread > 0) triggers += `\n(accord/product/security.md: ${unread} ${unread === 1 ? 'line' : 'lines'} not read; run accord lint)`;
    if (!full) return { triggers, checklist: '', hunks: '' };
    return {
      triggers,
      checklist: spec.checklist.map((c) => `- ${c.id}: ${c.text}`).join('\n') || '(none)',
      hunks: matchedHunks(spec, diffText, changed, { generated, unreadable, exempt }).join('\n') || NONE,
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
  const base = lastHead ?? options.base ?? roundOneBase(ctx.root, ctx.snapshot, id, { defaultRef: laneS ? laneSDefault : planOffDefault });
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
  if (options.security === true) {
    // The security package: the same range and diff, but only the checklist, the triggers and the hunks they match.
    const at = parts[0].indexOf('\nHead: ');
    emit(ctx, id, securityText(`# Security package: ${id} (${label})${at < 0 ? '' : parts[0].slice(at)}`, securitySections(s, diffText, changedFiles, true, { root: ctx.root, head: 'HEAD' }, unread)), options.out, headLine);
    return 0;
  }
  shown.push('## Security triggers', securitySections(s, diffText, changedFiles, false, { root: ctx.root, head: 'HEAD' }, unread).triggers);
  shown.push('## Slop', slopSection(ctx, s, id, def));
  // D-03, D-05, D-07: the reviewer's product blocks, read from the default ref this function already read (no second lookup); a clone with no default ref gets the working copy and the one line saying so.
  const product = productBlocks('reviewer', {
    ruleset: cliRuleset(),
    epic: epicBlock(epicSnapshot(ctx, id), id),
    conventions: readProductText(ctx.root, { from: 'default', ref: def }),
    changed: productChange(ctx.root, def, 'HEAD'),
  });
  parts.splice(parts.indexOf('## Stat'), 0, ...shown, ...product);
  emit(ctx, id, parts.join('\n\n') + '\n', options.out, headLine);
  return 0;
}
