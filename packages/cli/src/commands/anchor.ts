// Spec §6 `accord anchor [id]`: the active ticket's intent, vetoes, decisions, corrections, and position,
// for the SessionStart hook after compaction and for the first step of every stage skill. Without an id
// the active ticket is the current branch named by a template in force (t/{id} or config `branch`); on any other branch there is nothing to anchor.
// Phase 8.5 D-16, D-25: outside Claude Code this command is also the main session's channel for the ruleset, which Claude Code's session hooks print themselves: it comes first, built by the shared
// core assembly with the hooks' exact text, and only here, never in `anchorOf`, so the session-resume hook, which already prints it, never prints it twice.
import { anchorText, commitRuleLine, commitRuleOf, DEFAULT_BRANCH_TEMPLATE, firstMainSlice, productBlocks, sliceInWork, workOf } from '@accord-dev/accord-core';
import type { RepoSnapshot } from '@accord-dev/accord-core';
import { currentBranch, gitVerifySince, ticketOfBranch, withDefaultRef } from '../load/fs.js';
import { cliRuleset, readProductText } from '../load/product.js';
import { shown } from '../load/script-trust.js';
import { sliceStart } from '../load/slice-size.js';
import { sliceOfBranch } from '../load/slices.js';
import { stagesOffLines } from '../render/stages-off.js';
import type { CommandContext } from '../run.js';
import { requireLaneTicket } from './lane-args.js';
import { inClaude } from './worktree.js';

/** The id the current branch carries under a template in force; undefined on any other branch. Throws when git could not say. */
export function activeTicket(root: string, snapshot: RepoSnapshot, known?: { name: string | undefined }): string | undefined {
  // ST-LN-63: `known` is the branch the load of this same checkout already read.
  const branch = known === undefined ? currentBranch(root) : known.name;
  if (branch === undefined) throw new Error('could not read the current branch; nothing to anchor');
  return ticketOfBranch(branch, snapshot.branchTemplates ?? [DEFAULT_BRANCH_TEMPLATE], (id) => Object.hasOwn(snapshot.tickets, id), snapshot.config);
}

/**
 * Phase 8.1 D-06 (the free-text commits): one `Commit rule:` header line when `commits.message` is set, so every stage skill, which runs `accord anchor` first, and the session-resume hook
 * show the rule, in every tool, before the first commit of the stage; nothing when it is unset (today's anchor byte for byte). A pattern that is not in force is named with `accord lint`.
 */
function commitRuleHeader(ctx: CommandContext): string[] {
  const rule = commitRuleOf(ctx.snapshot.config);
  if (rule === undefined) return [];
  if ('problem' in rule) return [`Commit rule: commits.message is not in force (${shown(rule.problem)}); run accord lint`];
  return [`Commit rule: ${commitRuleLine(rule)}${rule.example === '' ? '' : ', e.g. ' + shown(rule.example)}; check each commit message with accord commit check <file> before you commit; merge commits and Revert "..." subjects pass`];
}

/**
 * Phase 15 D-07, D-10, Phase 08.9.3 D-08, D-14: the slice this checkout is working when the ticket's plan has `## Slice` sections. The checkout's own slice is a `slice/<id>/<n>` branch's, or on the ticket's claim branch the
 * first slice of this repository (`firstMainSlice`; slice 1 for a plan with no `repo:` line); the slice in work is the lowest of it and the other-repository slices worked from it whose criteria are not all in `verified:`
 * (`sliceInWork`, Ruling R11), so the ticks alone say which slice is finished. `repo` names the repository of the slice in work when it is another one; `tasks` are the task numbers the plan gives that slice, absent when the plan has
 * no slice with that number. A ticket whose plan has no `## Slice` section, a branch of another ticket and a checkout git cannot name give undefined, and no git runs for a plan without slices.
 */
export function currentSlice(ctx: CommandContext, id: string): { n: number; of: number; tasks?: number[]; repo?: string } | undefined {
  const slices = workOf(ctx.snapshot, id)?.plan?.slices;
  if (slices === undefined || slices.length === 0) return undefined;
  try {
    const name = ctx.branch === undefined ? currentBranch(ctx.root) : ctx.branch.name;
    if (name === undefined || activeTicket(ctx.root, ctx.snapshot, { name }) !== id) return undefined;
    const own = sliceOfBranch(name)?.n ?? firstMainSlice(slices) ?? 1;
    const verified = ctx.snapshot.tickets[id].frontmatter?.verified ?? [];
    const n = sliceInWork(slices, own, verified);
    const found = slices.find((s) => s.n === n);
    return { n, of: Math.max(...slices.map((x) => x.n)), ...(found === undefined ? {} : { tasks: found.tasks }), ...(found?.repo === undefined ? {} : { repo: found.repo }) };
  } catch {
    return undefined;
  }
}

/**
 * Phase 15 D-10: `Slice: <n> of <m>, from <short sha>` when this checkout is working a slice of the ticket's sliced plan (`currentSlice`); a slice of another repository reads `Slice: <n> of <m> in repository <name>, from
 * <short sha>` (Phase 08.9.3 D-08). `from` is where the slice starts (`sliceStart`, in that repository's clone for another repository), left out when git cannot say. Any other checkout prints nothing.
 */
function sliceLine(ctx: CommandContext, id: string, slice: { n: number; of: number; repo?: string } | undefined): string[] {
  if (slice === undefined) return [];
  try {
    const start = sliceStart(ctx.root, ctx.snapshot, id, slice.n);
    return [`Slice: ${slice.n} of ${slice.of}${slice.repo === undefined ? '' : ` in repository ${slice.repo}`}${start === undefined ? '' : `, from ${start.slice(0, 7)}`}`];
  } catch {
    return [];
  }
}

/**
 * The one anchor text of a ticket, for `accord anchor` and the session-resume hook alike (ST-LN-72 review round 2): ST-LN-50 D-08's `stages off for lane <L>: ...` lines close the base lines of the
 * header (Stage, Review base), before any Unfinished line and the first section (core places them: anchorText's `header`); nothing is added when nothing is off for the ticket's lane. The git fact the
 * verify resume line reads (gitVerifySince) is added here too, so both paths print the same lines.
 * Phase 8.5 D-17: for a lane S ticket the working branch's conventions.md (D-06) is read here, by the one reader of product files (a regular file only, no git, no link followed), and core prints it last at build and
 * review; any other lane reads nothing. Being shared, it also makes the session-resume hook re-deliver the block after a compaction, which is when a lane S session loses it.
 */
export const anchorOf = (ctx: CommandContext, id: string): string | undefined => {
  const lane = ctx.snapshot.tickets[id]?.frontmatter?.lane;
  const slice = currentSlice(ctx, id);
  return anchorText(
    { ...epicSnapshot(ctx, id), ...gitVerifySince(ctx.root, ctx.snapshot, id) },
    id,
    [...sliceLine(ctx, id, slice), ...stagesOffLines(ctx.snapshot.config, lane), ...commitRuleHeader(ctx)],
    lane === 'S' ? { conventions: readProductText(ctx.root, { from: 'working' }) } : undefined,
    slice?.tasks === undefined ? undefined : { n: slice.n, of: slice.of, tasks: slice.tasks },
  );
};

/**
 * ST-LN-28 D-13: the snapshot the anchor is built from. A story with `parent:` reads its epic from the default branch (a Decision added to the epic after the story branched
 * binds now), so its snapshot carries `defaultRef`; any other ticket, and a snapshot that already has one, is left as it is, and no git is spawned for it.
 */
export function epicSnapshot(ctx: CommandContext, id: string): RepoSnapshot {
  const parent = Object.hasOwn(ctx.snapshot.tickets, id) ? ctx.snapshot.tickets[id].frontmatter?.parent : undefined;
  // Phase 08.9.2 Ruling-narrow: a narrow load holds the story and its epic only, so the default branch's copies are read for every id of accord/tickets/ (`ctx.ids`), where the epic's siblings are.
  return parent === undefined || ctx.snapshot.defaultRef !== undefined ? ctx.snapshot : withDefaultRef(ctx.root, ctx.snapshot, undefined, undefined, undefined, ctx.ids);
}

export function anchor(ctx: CommandContext, id: string | undefined): number {
  // D-16: the ruleset and a blank line, the bytes the session hooks write before their anchor (the ruleset's own newline, then one more), for a session that is not Claude Code, with or
  // without an active ticket, and when the CLI cannot tell which tool this is.
  if (inClaude(ctx.env) === undefined) ctx.stdout.write(productBlocks('main-session', { ruleset: cliRuleset() })[0] + '\n\n');
  if (id !== undefined) {
    requireLaneTicket(ctx, id);
    ctx.stdout.write(anchorOf(ctx, id) ?? '');
    return 0;
  }
  // A hook must not fail a session start, but an empty anchor must not be silent: so every failure here
  // exits 0 and says why on stderr, and only a detached HEAD (nothing to anchor) says nothing.
  let active: string | undefined;
  try {
    active = activeTicket(ctx.root, ctx.snapshot, ctx.branch);
  } catch (e) {
    ctx.stderr.write((e as Error).message + '\n');
    return 0;
  }
  if (active === undefined) return 0;
  const text = anchorOf(ctx, active);
  if (text === undefined) ctx.stderr.write(active + ' is not a lane ticket in accord/tickets/; nothing to anchor\n');
  else ctx.stdout.write(text);
  return 0;
}
