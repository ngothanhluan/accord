// Spec §8 `accord task-done <id> <n>`: writes the ledger line only when the report shows every verify case
// of task n passed and the report is newer than HEAD. The CLI never runs a test command; the orchestrator
// runs the tests, and this reads the evidence the Done gate reads.
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestStatus } from '@accord-dev/accord-core';
import { claimPinBefore, COMMIT_MESSAGE_FROM, commitRuleNotInForce, commitRuleOf, commitRuleProblem, commitRuleRefusal, forbiddenLines, normaliseKey, normaliseText, recordTaskDone, reportReasons, scanJUnit, stageOff, TASK_REPORT_FROM, taskVerdict, ticketTaskVerdict, trailerReason, workOf, writeTestTags } from '@accord-dev/accord-core';
import { assertNoLink } from '../guard.js';
import { withClaimPins } from '../load/claim-facts.js';
import { gitBranchCommits, UsageError } from '../load/fs.js';
import { readReport, reportPath, reportRel } from '../load/report.js';
import type { CommandContext } from '../run.js';
import { refuseLaneR, requireLaneTicket, taskNumber } from './lane-args.js';
import { repoWorkRoot, workRootOf } from './task-tree.js';
import { ID } from './worktree.js';

/** `git show -s --format=%ct` output as seconds; anything but digits would make every report look fresh. */
export function commitSeconds(out: string): number {
  const text = out.trim();
  if (!/^\d+$/.test(text)) throw new UsageError('git printed no commit time for HEAD; cannot tell whether the report is fresh');
  return Number(text);
}

/** HEAD's committer time (`ct`, the test report's freshness) and author time (`at`, the executor report's), in whole seconds, and its sha. */
export interface HeadTimes { ct: number; at: number; sha: string }

/** HeadTimes from one `git show -s`. */
function headTimes(root: string): HeadTimes {
  const out = execFileSync('git', ['-c', 'log.showSignature=false', 'show', '--no-show-signature', '-s', '--format=%ct %at %H', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
  const [ct, at, sha] = out.trim().split(' ');
  return { ct: commitSeconds(ct ?? ''), at: commitSeconds(at ?? ''), sha: sha ?? '' };
}

/** headTimes(root) read on the first call only, so task-done asks git once however many of its checks need HEAD's times. */
const headTimesOnce = (root: string): (() => HeadTimes) => {
  let times: HeadTimes | undefined;
  return () => (times ??= headTimes(root));
};

/**
 * shortcut: compares whole seconds (git's %ct), so a report written in the same second as the commit, but
 * before it, counts as fresh; upgrade to a content check if that ever lets a stale report through.
 */
export function staleReport(ctx: CommandContext, times: () => HeadTimes = headTimesOnce(ctx.root)): string | undefined {
  const report = ctx.snapshot.config?.tests?.report;
  if (report === undefined || ctx.snapshot.tests === undefined) return undefined; // taskVerdict reports this
  // D-51: the raw config value may carry a backslash; the loader read the file under the slashed key.
  const rel = normaliseKey(report);
  const committed = times().ct * 1000;
  const written = Math.floor(statSync(join(ctx.root, ...rel.split('/'))).mtimeMs / 1000) * 1000;
  return written < committed ? `${rel} was written before the last commit; run the tests again` : undefined;
}

/**
 * Phase 08.9.3 D-06: `staleReport` for the report of another repository: the file written before that worktree's last commit (whole seconds, as `staleReport`) does not show the tests of that commit. Only judged when the
 * verdict passed and the file was read; a report that is missing is its own reason.
 */
function staleOther(other: Elsewhere, judge: boolean): string | undefined {
  const read = other.report?.read;
  if (!judge || other.report === undefined || read === undefined) return undefined;
  const written = Math.floor(read.mtimeMs / 1000) * 1000;
  return written < other.head.ct * 1000 ? `${other.report.label} was written before the last commit of the ${other.repo} worktree; run the tests again` : undefined;
}

/**
 * ST-LN-59 D-07, D-16: the reasons the executor's report file does not let task `n` be recorded: missing, written before HEAD's author time (author time, because the rebase of a
 * wave's integration moves committer time and not this), or without its red-reason and self-review lines. None for a ticket claimed before TASK_REPORT_FROM; the same claim read
 * decides `accord brief`'s ask, and a failed read gives the check (fail closed). The CLI checks that the lines are there, not that they are true, and never reads `config.runtimes` (D-18).
 */
function reportProblems(ctx: CommandContext, id: string, n: number, sha: string, times: () => HeadTimes, elsewhere?: string): string[] {
  const claimed = withClaimPins(ctx.root, ctx.snapshot, id);
  if (claimPinBefore(claimed, id, TASK_REPORT_FROM)) return [];
  // ST-LN-92 D-03: the report lies where `accord brief` put it, under the task's worktree while it exists (it is cleaned only after task-done), named there by its absolute path.
  // Phase 08.9.3 D-04: a task of another repository wrote its report under that repository's worktree, and the report is fresh against that worktree's own HEAD
  const root = elsewhere ?? workRootOf(ctx.root, claimed, id, n, `accord task-done ${id} ${n}`) ?? ctx.root;
  const inTicket = root === ctx.root.replace(/\\/g, '/');
  const rel = inTicket ? reportRel(id, n) : reportPath(root, id, n);
  const report = readReport(root, id, n);
  if (report === undefined) return [`the executor report ${rel} is missing: the executor writes it as its last step`];
  // D-18: in a task worktree the report is fresh against that worktree's own HEAD (its last commit, or its base); other tasks' ledger commits move the ticket checkout's HEAD,
  // not this one. Only then is a second HEAD read made: the plain path keeps its one `git show -s`.
  const own = inTicket ? undefined : headTimes(root);
  const at = own === undefined ? times().at : own.at;
  const head = own === undefined ? sha : own.sha.slice(0, 12);
  if (Math.floor(report.mtimeMs / 1000) < at) {
    return [`the executor report ${rel} was written before HEAD's commit ${head}: the executor writes it after its last commit`];
  }
  return reportReasons(report.text);
}

/**
 * Phase 08.9.3 D-04, D-06, D-12: a task built in another repository as task-done sees it: its worktree (`repoWorkRoot`, a UsageError when it is not open on the slice holding the task), that worktree's HEAD, and the report
 * `repos.<name>.report` declares, read there (`report` is absent when none is declared; `read` is absent when it is declared and no regular file is there).
 */
interface Elsewhere {
  repo: string;
  dir: string;
  head: HeadTimes;
  report?: { rel: string; label: string; read?: { tests: Record<string, TestStatus>; mtimeMs: number } };
}

/** The declared report of the other repository, read under its worktree: undefined for a missing file, a link, a non-file or a path that leaves the worktree. Parsed with core's `scanJUnit`, as the loader reads this repository's. */
function readOtherReport(dir: string, rel: string): { tests: Record<string, TestStatus>; mtimeMs: number } | undefined {
  if (rel.startsWith('/') || rel.split('/').includes('..')) return undefined;
  try {
    assertNoLink(dir, rel);
  } catch (e) {
    if (e instanceof UsageError) return undefined;
    throw e;
  }
  const file = join(dir, ...rel.split('/'));
  const found = lstatSync(file, { throwIfNoEntry: false });
  if (found === undefined || !found.isFile()) return undefined;
  return { tests: scanJUnit(normaliseText(readFileSync(file, 'utf8'))), mtimeMs: found.mtimeMs };
}

function elsewhereOf(ctx: CommandContext, id: string, n: number, repo: string): Elsewhere | undefined {
  const dir = repoWorkRoot(ctx.root, ctx.snapshot, id, n, `accord task-done ${id} ${n}`);
  if (dir === undefined) return undefined;
  const entry = ctx.snapshot.config?.repos !== undefined && Object.hasOwn(ctx.snapshot.config.repos, repo) ? ctx.snapshot.config.repos[repo] : undefined;
  const head = headTimes(dir);
  if (entry?.report === undefined) return { repo, dir, head };
  // D-51: the raw config value may carry a backslash
  const rel = normaliseKey(entry.report);
  const read = readOtherReport(dir, rel);
  return { repo, dir, head, report: { rel, label: `${repo}:${rel}`, ...(read === undefined ? {} : { read }) } };
}

// T-03.1-28: an anchored pattern, so a pair is exactly `ac-<n>=<test id>` and the id is one tag with no whitespace.
const PAIR = /^ac-([1-9][0-9]*)=(\S+)$/;

/** `--test ac-<n>=<test id>` pairs as plan-style maps (`ac` as `@ac-n`); a malformed pair is a UsageError. */
function parsePairs(pairs: string[]): { ac: string; test: string }[] {
  return pairs.map((p) => {
    const m = PAIR.exec(p);
    if (m === null) throw new UsageError(`not a test pair: ${p}; write --test ac-<n>=<test id>`);
    return { ac: '@ac-' + m[1], test: m[2] };
  });
}

export function taskDone(ctx: CommandContext, id: string, task: string, pairs: string[] = []): number {
  const n = taskNumber(task);
  const laneTicket = requireLaneTicket(ctx, id);
  // T-04-12: the id names the ledger and report paths; a ticket file `accord/tickets/...md` loads under the key `..`. Checked after the lookup, so an
  // unknown id keeps its `no ticket` refusal.
  if (!ID.test(id)) throw new UsageError('not a valid ticket id: ' + id);
  refuseLaneR(laneTicket, id, 'plan tasks');
  // ST-LN-50 D-08 Ruling: with the plan stage off the whole ticket is task 1 and its tests are named by --test; with it on, --test has no meaning.
  const planOff = stageOff(ctx.snapshot, id, 'plan');
  const lane = laneTicket.frontmatter?.lane;
  if (!planOff && pairs.length > 0) {
    throw new UsageError(`--test is for a ticket built without a plan: the plan stage is on for lane ${lane}; name the verify cases in plan.md, or turn it off with strictness.stages.${lane}.plan`);
  }
  if (planOff && n !== 1) {
    throw new UsageError(`the plan stage is off for lane ${lane} (strictness.stages.${lane}.plan): the whole ticket is task 1, there is no task ${n}`);
  }
  const testMaps = planOff ? parsePairs(pairs) : [];
  const commit = ctx.snapshot.git?.commit;
  if (commit === undefined) throw new UsageError('the repository has no commit; commit the task before recording it');
  // T-05-07, T-04-12: `id` is a key the loader found on disk and matched ID above, so it is a plain file stem and never a traversal
  // (a stem alone can be `..`, from a ticket file `accord/tickets/...md`).
  const rel = 'accord/tickets/' + id + '/ledger.md';
  const file = join(ctx.root, 'accord', 'tickets', id, 'ledger.md');
  // Phase 08.9.3 D-04, D-12: a task built in another repository is recorded here at that repository's worktree HEAD
  const planTask = planOff ? undefined : workOf(ctx.snapshot, id)?.plan?.tasks.find((x) => x.n === n);
  const other = planTask?.repo === undefined ? undefined : elsewhereOf(ctx, id, n, planTask.repo);
  const sha = other === undefined ? commit.slice(0, 12) : other.head.sha.slice(0, 12);
  const next = recordTaskDone(existsSync(file) ? readFileSync(file, 'utf8') : undefined, n, sha);
  // D-06: the cases are joined against the report read in the other worktree when `repos.<name>.report` is declared and there; with none, no case is joined (the note below says so)
  const otherReport = other === undefined ? undefined : { report: other.report?.label ?? '', ...(other.report?.read === undefined ? {} : { tests: other.report.read.tests }) };
  const verdict = planOff ? ticketTaskVerdict(ctx.snapshot, id, testMaps) : taskVerdict(ctx.snapshot, id, n, otherReport);
  const ticket = ctx.snapshot.tickets[id];
  const ticketFile = join(ctx.root, ...ticket.file.split('/'));
  // D-12: the tag of a case of another repository carries its name, `@test:<name>:<case id>`
  const planned = planOff ? testMaps : (planTask?.maps ?? []);
  const maps = other === undefined ? planned : planned.map((m) => ({ ...m, test: `${other.repo}:${m.test}` }));
  // A recorded task is re-checked only for tags: the committed ledger makes HEAD newer than the report.
  const times = headTimesOnce(ctx.root);
  const stale = other === undefined ? (next !== undefined && verdict.verdict === 'pass' ? staleReport(ctx, times) : undefined) : staleOther(other, next !== undefined && verdict.verdict === 'pass');
  const reasons = [...verdict.reasons, ...(stale === undefined ? [] : [stale]), ...(next === undefined ? [] : reportProblems(ctx, id, n, sha, times, other?.dir))];
  if (other?.report !== undefined && other.report.read === undefined) reasons.push(`${other.report.label} is not a file in the ${other.repo} worktree ${other.dir}; run the tests there (repos.${other.repo}.report)`);
  // Phase 8.1 D-06, D-07: commits.message is judged over the same range as commits.trailers (the first task reads back to the default ref, so accord's claim and planning commits are judged there too),
  // for a ticket claimed at or after COMMIT_MESSAGE_FROM; a pattern that is not in force is one reason naming `accord lint`.
  // Ruling R15: this repository's commit rules are judged over this repository's commits only; the other repository's conventions are its own (D-03)
  const trailers = other === undefined && ctx.snapshot.config?.commits?.trailers === 'forbid';
  const rule =
    next !== undefined && other === undefined && ctx.snapshot.config?.commits?.message !== undefined && !claimPinBefore(withClaimPins(ctx.root, ctx.snapshot, id), id, COMMIT_MESSAGE_FROM)
      ? commitRuleOf(ctx.snapshot.config)
      : undefined;
  if (next !== undefined && (trailers || rule !== undefined)) {
    const done = workOf(ctx.snapshot, id)?.ledger?.done ?? {};
    const below = Object.keys(done).map(Number).filter((k) => k < n);
    const since = below.length === 0 ? undefined : done[String(Math.max(...below))];
    const commits = gitBranchCommits(ctx.root, since);
    if (trailers) for (const c of commits) for (const l of forbiddenLines(c.message)) reasons.push(trailerReason(c.sha, l));
    if (rule !== undefined && 'problem' in rule) reasons.push(commitRuleNotInForce(rule.problem));
    else if (rule !== undefined) {
      for (const c of commits) {
        const problem = c.merge === true ? undefined : commitRuleProblem(rule, c.message);
        if (problem !== undefined) reasons.push(commitRuleRefusal(c.sha, problem));
      }
    }
  }
  const refuse = (lines: string[]): number => {
    ctx.stdout.write(`task ${n} of ${id} is not done:\n` + lines.map((r) => '  ' + r + '\n').join(''));
    return 1;
  };
  if (next !== undefined && reasons.length > 0) return refuse(reasons);
  if (next !== undefined || verdict.verdict === 'pass') {
    const tagged = writeTestTags(readFileSync(ticketFile, 'utf8'), ticket.scenarios, maps);
    if (tagged.conflicts.length > 0) {
      return refuse(tagged.conflicts.map((c) => `${c.ac} already carries @test:${c.existing}; ${planOff ? '--test names' : 'the plan maps it to'} ${c.test}`));
    }
    if (tagged.written.length > 0) writeFileSync(ticketFile, tagged.text);
    for (const w of tagged.written) ctx.stdout.write(`wrote @test:${w.test} on ${w.ac} in ${ticket.file}\n`);
  }
  if (next === undefined) {
    // D-05: a recorded task whose mapped test is not passing must not look done while a tag is still unwritten.
    const left = verdict.verdict === 'pass' ? [] : writeTestTags(readFileSync(ticketFile, 'utf8'), ticket.scenarios, maps).written;
    if (left.length > 0) return refuse([...verdict.reasons, ...left.map((w) => `${w.ac} is left without @test:${w.test}`)]);
    ctx.stdout.write(`task ${n} of ${id} is already recorded in ${rel}\n`);
    return 0;
  }
  mkdirSync(join(ctx.root, 'accord', 'tickets', id), { recursive: true });
  writeFileSync(file, next);
  ctx.stdout.write(`recorded task ${n} done at ${sha} in ${rel}\n`);
  if (other !== undefined && other.report === undefined) {
    ctx.stdout.write(`note: repository ${other.repo} declares no repos.${other.repo}.report, so task ${n}'s verify cases were not read here; verify runs repos.${other.repo}.tests in full (D-06, D-12)\n`);
  }
  return 0;
}
