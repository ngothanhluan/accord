// CLI-04 command spine: every command is the same pipeline with a different middle — resolve the git
// root, load the snapshot, check the version pin, call one pure core function, print, return an exit
// code. argv, cwd, and both streams are injected, so a test drives the whole CLI in-process and
// nothing reaches `process.*` (STACK Decision 7). Exit codes follow STACK Decision 1: 0 pass,
// 1 lint/gate failure, 2 usage or environment error.
import { configPin, loadSnapshot } from '@accord-dev/accord-core';
import type { Lane, RepoSnapshot } from '@accord-dev/accord-core';
import { Command, CommanderError, Option } from 'commander';
import pkg from '../package.json' with { type: 'json' };
import { anchor } from './commands/anchor.js';
import { related } from './commands/related.js';
import { deferred } from './commands/deferred.js';
import { show } from './commands/show.js';
import { approve } from './commands/approve.js';
import { brief } from './commands/brief.js';
import { audit } from './commands/audit.js';
import { commitCheck, commitMessage } from './commands/commit.js';
import { conventionsWrite } from './commands/conventions.js';
import { pr } from './commands/pr.js';
import { taskClean, taskMerge, taskOpen } from './commands/task-tree.js';
import { waves } from './commands/waves.js';
import { budget } from './commands/budget.js';
import { configCheck, configGet, configSet, configUnset } from './commands/config.js';
import { gate } from './commands/gate.js';
import { hook, HOOK_EVENTS, preToolUseWrite } from './commands/hook.js';
import { init } from './commands/init.js';
import { lint } from './commands/lint.js';
import { newTicket } from './commands/new-ticket.js';
import { next } from './commands/next.js';
import { upgradeNotice } from './commands/notice.js';
import { dashboardCommand } from './commands/dashboard.js';
import { diffPackage } from './commands/diff-package.js';
import { reviewPackage } from './commands/review-package.js';
import { round } from './commands/round.js';
import { scoutCheckCommand } from './commands/scout.js';
import { skills } from './commands/skills.js';
import { subject } from './commands/subject.js';
import { status } from './commands/status.js';
import { taskDone } from './commands/task-done.js';
import { trust } from './commands/trust.js';
import { testsBaseline } from './commands/tests-baseline.js';
import { testsSkipped } from './commands/tests-skipped.js';
import { drop } from './commands/drop.js';
import { upgrade } from './commands/upgrade.js';
import { worktreeCheck, worktreeClean, worktreeOpen, worktreePush, worktreeSync } from './commands/worktree.js';
import { loadClaimView, loadLight, loadWithBranch, UsageError, withDefaultRef } from './load/fs.js';
import type { LightLoad } from './load/fs.js';
import { pinMessage, versionOnDisk } from './pin.js';
import { repoRoot } from './root.js';

export interface RunOptions {
  cwd: string;
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
  // Declared now although only the tracker adapter reads it, so adding that adapter does not reopen
  // this file or change the shape every test constructs.
  env?: NodeJS.ProcessEnv;
  stdin?: string; // only `hook` reads it (index.ts)
}

export interface CommandContext {
  root: string;
  snapshot: RepoSnapshot;
  // Checkout-only snapshot, set under 'claims': `show --approval` reads it, and a dependency counts as done on the
  // default branch (`snapshot.defaultRef`, BUG-LN-13 D-01), here only when no default ref resolves (BUG-LN-2 D-04).
  plain?: RepoSnapshot;
  /** ST-LN-63: the current branch of `root`, read once by the load (undefined name: git could not say; '' : detached); absent in light mode. */
  branch?: { name: string | undefined };
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
  env: NodeJS.ProcessEnv;
  stdin?: string;
  /** ST-LN-63: `core.sshCommand` per folder, filled by the first network git call of the run and kept across a reload. */
  ssh?: Map<string, string>;
  /** ST-LN-63: set by a light preflight (pick-up, `new ticket --worktree`); `fetchOrigin` finishes the full load from it and returns a context without it. */
  light?: LightLoad;
  /** Phase 8.1 D-18: the pin message of a run under the `report` pin check (only `accord audit`) whose pin differs from the running version; absent when the pin matches or the check refuses. */
  pinMismatch?: string;
  /** Phase 8.1 D-18: the pin the `report` pin check read (from the validated config, else the raw text); absent when config.yml names none or the check refuses. */
  pinned?: string;
}

/**
 * Root, snapshot, pin — in that order, once per command (D-95, D-103). A repository with no `accord/`
 * folder throws the loader's own UsageError before the pin is ever consulted.
 */
function preflight(opts: RunOptions, mode: 'checkout' | 'stage' | 'claims' | 'light' = 'checkout', options: { pinCheck?: 'refuse' | 'report' } = {}): CommandContext {
  const root = repoRoot(opts.cwd);
  const parts = mode === 'claims' ? loadClaimView(root) : undefined;
  // ST-LN-63: a light load keeps the parts it read, so a command that goes on to the full load does not read them twice.
  const lit = mode === 'light' ? loadLight(root) : undefined;
  const read = parts === undefined && lit === undefined ? loadWithBranch(root, { stage: mode === 'stage' }) : undefined;
  const input = parts?.view ?? lit?.input ?? (read as NonNullable<typeof read>).input;
  const loaded = loadSnapshot(input);
  // ST-LN-63: the branch the load read, handed on so no command asks git for it again (none in light mode).
  const branch = parts?.branch ?? read?.branch;
  const plain = parts === undefined ? undefined : parts.checkout === parts.view ? loaded : loadSnapshot(parts.checkout);
  // D-94: a hard refusal, no flag and no environment variable that skips it. `config` is undefined
  // when config.yml is missing or failed the schema (D-31); those repositories must report their
  // schema findings through lint rather than a pin error, so the check is guarded rather than global.
  // D-18 (Phase 8.1): the `report` pin check is the second stated exception, beside `upgrade`: the pin is read here, before anything reads `snapshot.config`, from the validated config or, when this CLI's schema
  // refused it (a key a newer release added), from the raw text, and the message goes back on the context instead of being thrown. Only `accord audit` asks for it.
  let pinMismatch: string | undefined;
  let pinned: string | undefined;
  if (options.pinCheck === 'report') {
    pinned = loaded.config === undefined ? configPin(input.files['accord/config.yml']) : loaded.config.accord;
    pinMismatch = pinMessage(pinned, pkg.version, versionOnDisk());
  } else if (loaded.config !== undefined) {
    const message = pinMessage(loaded.config.accord, pkg.version, versionOnDisk());
    if (message !== undefined) throw new UsageError(message);
  }
  // BUG-LN-13 D-01: the default ref's records ride on the snapshot; `plain` stays the checkout.
  const snapshot = mode === 'claims' ? withDefaultRef(root, loaded, parts?.refs) : loaded;
  return { root, snapshot, ...(plain === undefined ? {} : { plain }), ...(branch === undefined ? {} : { branch }), stdout: opts.stdout, stderr: opts.stderr, env: opts.env ?? {}, ssh: new Map(), ...(lit === undefined ? {} : { light: lit.parts }), ...(opts.stdin === undefined ? {} : { stdin: opts.stdin }), ...(pinMismatch === undefined ? {} : { pinMismatch }), ...(pinned === undefined ? {} : { pinned }) };
}

/**
 * The whole commander tree, exported so `packages/cli/test/skill-commands.test.ts` can walk the same
 * object the CLI runs (SKILL-08, RESEARCH.md Pitfall 2 Option A). A literal list of command names in
 * that test is exactly what the requirement forbids: a command added in a later phase would not appear
 * in it, and a skill could then name a command that does not exist without CI noticing.
 *
 * Two things have to be threaded in rather than closed over: `opts`, which `configureOutput` and every
 * `preflight` call read, and the mutable exit code, which each action assigns — hence `setCode` rather
 * than a return value, because commander actions do not return one to the parser.
 */
export function buildProgram(opts: RunOptions, setCode: (n: number) => void): Command {
  const program = new Command('accord')
    .description('check the accord folder in this repository')
    .exitOverride()
    .configureOutput({
      writeOut: (str) => {
        opts.stdout.write(str);
      },
      writeErr: (str) => {
        opts.stderr.write(str);
      },
    })
    .version(pkg.version);

  // The one command that cannot use `preflight`: that calls `loadFromFs`, whose `accordFiles` throws
  // `no accord/ folder in <root>` (load/fs.ts:38-41) before the pin is ever consulted — and `init` is the
  // command that creates that folder. The root is all it needs, so it resolves that itself. Registered
  // first because it is the first thing a user runs, and it takes no options at all (D-134).
  program
    .command('init')
    .description('write the accord contract into this repository, skipping every path that exists')
    .action(() => {
      setCode(
        init({ root: repoRoot(opts.cwd), stdout: opts.stdout, stderr: opts.stderr, env: opts.env ?? {} }),
      );
    });

  program
    .command('lint')
    .description('report every finding in the accord folder')
    .option('--json', 'print the LintResult object instead of text')
    .action((options: { json?: boolean }) => {
      setCode(lint(preflight(opts), options));
    });

  // All three subcommands route through the same preflight the lint action uses, so the pin check is never
  // conditional on which gate was asked for (D-95).
  const gates = program.command('gate').description('run one gate against one ticket');
  for (const which of ['ready', 'plan', 'done'] as const) {
    gates
      .command(which + ' <id>')
      .description('report whether the ticket passes the ' + which + ' gate')
      .option('--json', 'print the GateResult object instead of text')
      .action((id: string, options: { json?: boolean }) => {
        setCode(gate(preflight(opts), which, id, options));
      });
  }

  program
    .command('approve <id>')
    .description("record the owner's approval of a lane ticket as approved_hash")
    .action((id: string) => {
      setCode(approve(preflight(opts), id));
    });

  program
    .command('task-done <id> <task>')
    .description('record a plan task as done when the test report shows its verify cases passed; with the plan stage off, task 1 is the whole ticket')
    .option('--test <pair>', 'with the plan stage off: ac-<n>=<test id>, once per scenario', (value: string, previous: string[]) => [...previous, value], [])
    .action((id: string, task: string, options: { test: string[] }) => {
      setCode(taskDone(preflight(opts), id, task, options.test));
    });

  program
    .command('brief <id> <task>')
    .description("print the ticket and one plan task: the brief an executor receives; from 0.6.0 it names the task's report file and clears that task's old report")
    .action((id: string, task: string) => {
      setCode(brief(preflight(opts), id, task));
    });

  program
    .command('waves <id>')
    .description('print the plan tasks left to build in waves that may run in parallel, and the parallel cap')
    .action((id: string) => {
      setCode(waves(preflight(opts), id));
    });

  program
    .command('review-package <id>')
    .description('print the commits, stat, and diff a reviewer reads')
    .option('--base <ref>', "the commit or branch the work started from (default: the plan's baseline:; with the plan stage off, the default branch)")
    .option('--security', 'print the security package: the checklist, the security triggers and only the hunks they match')
    .option('--round <n>', 'with --security: the package of the n-th ## Round section of review.md')
    .action((id: string, options: { base?: string; security?: boolean; round?: string }) => {
      setCode(reviewPackage(preflight(opts), id, options));
    });

  program
    .command('diff-package <base> <head>')
    .description('print the review package of the changes from <base> to <head>, for a review of code accord did not build')
    .option('--security', 'print the security package: the checklist, the security triggers and only the hunks they match')
    .action((base: string, head: string, options: { security?: boolean }) => {
      setCode(diffPackage(preflight(opts), base, head, options));
    });

  program
    .command('round <id>')
    .description('print the next review round, its cap and the fix executor model, or the stop or refusal; --plan counts plan critique rounds, --approach approach critique rounds')
    .option('--plan', 'count the plan critique rounds in plan-review.md')
    .option('--approach', 'count the approach critique rounds in approach-review.md')
    .action((id: string, options: { plan?: boolean; approach?: boolean }) => {
      setCode(round(preflight(opts), id, options));
    });

  program
    .command('budget <id>')
    .description('print whether a lane R ticket is within its timebox and token budget since its claim commit, or stop: ask owner, and the Spent line its research record states')
    .action((id: string) => {
      setCode(budget(preflight(opts), id));
    });

  // D-95: `new ticket` is deliberately *not* exempt from the pin. The ticket template changes between
  // versions, so scaffolding from a template the repository is not pinned to is exactly the split
  // PITFALLS section 11 describes — the same shared preflight therefore stops it before any path is
  // constructed and before any byte is written. `--type` picks the template and `--lane` picks the lane
  // variant; `--title` sets the title (ST-LN-83 D-03), and there is no `feature` subcommand — the one in docs/design.md section 7 died with
  // the features/ folder.
  program
    .command('new')
    .description('scaffold a document a human then fills in')
    .command('ticket [id]')
    .description("write accord/tickets/<id>.md from the active profile's template, or the lane template under --lane, filling nothing in; the id is assigned when config.yml holds people")
    .addOption(
      new Option('--type <type>', 'which template to render')
        .choices(['epic', 'story', 'bug'])
        .default('story'),
    )
    .addOption(new Option('--lane <lane>', 'write a lane ticket (S, M, L, P, or R: research)').choices(['S', 'M', 'L', 'P', 'R']))
    .option('--title <text>', "the ticket's title, one line; required with --lane S or --lane M (and with --queue), so the similar tickets can be checked")
    .option('--worktree', 'write the ticket in its own new worktree on its claim branch, commit and push it, then run setup there')
    .option('--queue', "write the draft on a backlog branch off origin's default branch from a temporary worktree and push it, without touching this checkout")
    .option('--note <line>', 'with --queue: one line of the queued idea under ## Intent, up to four; repeat the option', (line: string, previous: string[]) => [...previous, line], [] as string[])
    .option('--related <ids>', 'the ticket ids this request continues or builds on, comma-separated, or none')
    .option('--split <file>', 'an epic and its stories from a split file, in one step: use with --type epic --lane L, and --queue to put all of them in one commit on one backlog branch')
    .option('--no-dup-check', 'create without checking for similar tickets, which is also how a script passes the --title that --lane S or --lane M needs; for scripts and tests, never for a request a person made')
    .action((id: string | undefined, options: { type: 'epic' | 'story' | 'bug'; lane?: Lane; worktree?: boolean; title?: string; queue?: boolean; note?: string[]; related?: string; dupCheck?: boolean; split?: string }) => {
      setCode(newTicket(preflight(opts, options.worktree === true || options.queue === true ? 'light' : 'checkout'), id, options, opts.cwd));
    });

  // D-121: the same `preflight` every other repository-reading command uses, so the pin check and the
  // `config.yml` requirement come for free and in the right order — root, snapshot, pin — before any path
  // is composed. Chained like `new ticket`, which means `.command('sync')` returns the *child*: if `skills`
  // ever gains a second subcommand this must switch to the `gates` local-variable form above.
  program
    .command('skills')
    .description('manage the accord skill copies in this repository')
    .command('sync')
    .description('write every skill this config declares into .claude/skills/ and .agents/skills/')
    .action(() => {
      setCode(skills(preflight(opts)));
    });

  const tests = program.command('tests').description('manage the test policy records');
  tests
    .command('baseline')
    .description('write accord/tests-baseline.txt from the untraced cases in the report, once')
    .action(() => {
      setCode(testsBaseline(preflight(opts)));
    });
  tests
    .command('skipped')
    .description('print every case the test report records as skipped, with the operating system it ran on')
    .action(() => {
      setCode(testsSkipped(preflight(opts)));
    });

  const scout = program.command('scout').description('check a scout report');
  scout
    .command('check <file>')
    .description("check a scout report's citations and logged absence searches against the files git tracks, and print its lane numbers")
    .option('--ticket <id>', "leave that ticket's own files and listed research records out of every search")
    .action((file: string, o: { ticket?: string }) => {
      setCode(scoutCheckCommand(preflight(opts), file, opts.cwd, o.ticket));
    });

  program
    .command('drop <id>')
    .description("put the ticket file, set to dropped with its reason, on a new branch drop/<id> from origin's default branch and push it, printing the pull request to open")
    .option('--reason <reason>', 'why the ticket is dropped; replaces the ## Dropped section')
    .option('--rejected', "also add 'Rejected: <title> — <reason>' to accord/product/conventions.md in the drop commit; pass it only on the owner's yes")
    .action((id: string, o: { reason?: string; rejected?: boolean }) => {
      setCode(drop(preflight(opts), id, o));
    });

  // ST-LN-50 D-06: the subject of a commit accord writes, rendered from the team's template, so skills never carry a literal one.
  program
    .command('subject <name> <id> [tail...]')
    .description('print the commit subject for a kind (claim, plan_ready, plan_round, approach_round, intent, ticket_understood, ticket_question, scout, drop, rebind, ruleset_backfill, queue, people, conventions) and a ticket id, from commits.subjects; for people the second argument is the email of the people entry, for conventions the UTC date of the conventions branch; a tail, such as a round count, follows after one space')
    .action((name: string, id: string, tail: string[]) => {
      setCode(subject(preflight(opts), name, id, tail));
    });

  // Phase 8.1 D-04, D-05: the commit-message rule a team sets in `commits.message`, checked before a commit is made.
  const commit = program.command('commit').description("check a commit message against the team's commit rule (commits.message in accord/config.yml)");
  commit
    .command('check <file>')
    .description('read the first line of a commit message file and judge it against commits.message: exit 0 when it passes or no rule is set, exit 1 naming the rule and a message that passes, exit 2 when the file cannot be read or the configured pattern is not in force; merge commits and Revert subjects are exempt at the gates, not here')
    .action((file: string) => {
      setCode(commitCheck(preflight(opts), file, opts.cwd));
    });
  commit
    .command('message <id>')
    .description("run the team's commits.message.command, only after accord trust allowed it, with the ticket in its environment (ACCORD_TICKET, ACCORD_TICKET_FILE, ACCORD_BASE_REF, ACCORD_ROOT): its first output line is the subject and the rest the body; write the message to a file under .git and print message-file: <path> for git commit -F, then judge it against commits.message like commit check (exit 1 naming the rule); an untrusted script is never run (exit 2 naming accord trust), and a failing, slow, oversized or empty one is exit 2 with no file")
    .action((id: string) => {
      setCode(commitMessage(preflight(opts), id));
    });

  // Phase 8.1 D-01, D-03: the title and the body file of a ticket's pull request, from the team's template and what the ticket knows; `gh pr create` itself stays in the skills.
  program
    .command('pr <id>')
    .description("write the body file of a ticket's pull request from the repository's PR template with every heading kept and the ticket's id, title, Intent, criteria and test evidence filled in, and print title: <title>, body-file: <path>, template: <path>, and one remaining: <heading> line per section left for you to write; the skill then runs gh pr create --title <title> --body-file <path>")
    .action((id: string) => {
      setCode(pr(preflight(opts), id));
    });

  // ST-LN-50 D-11: the deterministic way to change accord/config.yml; every subcommand reads the repository, so each goes
  // through the same preflight and the pin check. Nothing is committed: the onboarding skill does that.
  const config = program.command('config').description('read or change accord/config.yml by dotted key; a change is validated against the schema as a whole before the file is written, and nothing is committed');
  config
    .command('get <key>')
    .description('print the value of a key as YAML flow, or unset')
    .option('--json', 'print { key, value } instead of text')
    .action((key: string, o: { json?: boolean }) => {
      setCode(configGet(preflight(opts), key, o));
    });
  config
    .command('set <key> <value>')
    .description('set a key: a value starting with [ or { is a YAML flow collection, any other value a string; a refusal exits 2 and leaves the file untouched')
    .option('--json', 'print { key, from, to, consequences } instead of text')
    .action((key: string, value: string, o: { json?: boolean }) => {
      setCode(configSet(preflight(opts), key, value, o));
    });
  config
    .command('unset <key>')
    .description('remove a key, and a parent mapping it leaves empty')
    .option('--json', 'print { key, from, to, consequences } instead of text')
    .action((key: string, o: { json?: boolean }) => {
      setCode(configUnset(preflight(opts), key, o));
    });
  config
    .command('check')
    .description('report every finding in accord/config.yml and write nothing')
    .option('--json', 'print { findings } instead of text')
    .action((o: { json?: boolean }) => {
      setCode(configCheck(preflight(opts), o));
    });

  // Owner decision (2026-11-15): a script the repository declares (`tracker.command`, `git.sync`) runs only after the person allowed it here, once, in a record inside .git.
  program
    .command('trust [script...]')
    .description('with no script named, show each script accord/config.yml declares (tracker.command under tracker.adapter: script, git.sync, build.regenerate, commits.message.command, pr.command and audit.command): the command, a digest of what it covers, the files an allow covers and the ones that changed, and allow nothing; with tracker.command@<digest>, git.sync@<digest>, build.regenerate@<digest>, commits.message.command@<digest>, pr.command@<digest> or audit.command@<digest> named, the digest as shown, allow that script to run in this repository, refused when the files changed since: a local record inside .git, never committed, bound to the command and to the files it reaches, so a change to either asks again; accord checks only the files it lists, so whoever allows a script must review the pull request that changed it; --revoke withdraws the allows of the scripts named, or every allow')
    .option('--revoke', 'withdraw the allows of the scripts named, or every allow of this repository')
    .action((scripts: string[], o: { revoke?: boolean }) => {
      setCode(trust(preflight(opts), scripts, o));
    });

  // A stated exception to the pin check, like `--version` and `--help`: it runs as the newer accord against a
  // repository that still pins the older one, so it takes no `preflight` (ST-LN-25).
  program
    .command('upgrade')
    .description("run as the newer accord: push a branch upgrade/<version> from origin's default branch whose one commit pins this version in config.yml, the workflow and the hooks, with the skill files skills sync writes; the checkout is not touched")
    .action(() => {
      setCode(upgrade({ root: repoRoot(opts.cwd), stdout: opts.stdout, stderr: opts.stderr, env: opts.env ?? {} }));
    });

  // Phase 8.1 D-08, D-10: the optional audit of what a machine can see about a repository's conventions; it reads files only, calls no model, and no gate runs it.
  program
    .command('audit')
    .description("report what a machine can see about this repository's conventions: fact: <name>: <value> lines (languages, layout, linter and its rules, formatter, type checking, tests, PR template, commit rule, conventions), then gap: <id>: <text> - fix: <fix> lines, then gaps: <n>; exit 0 whenever it ran, whatever it found; it reads files only, calls no model, and no gate runs it")
    .action(async () => {
      // D-18: the second stated exception to the pin check, beside `upgrade`: the audit reports a mismatch as a gap (pinCheck 'report'); every other command still refuses it.
      setCode(await audit(preflight(opts, 'checkout', { pinCheck: 'report' })));
    });

  // Phase 8.1 D-09: the convention lines the owner accepted in /accord-audit, on their own branch for a pull request the owner merges; the skill opens it.
  const conventions = program.command('conventions').description("the team's conventions file, accord/product/conventions.md");
  conventions
    .command('write <file>')
    .description('read the accepted lines from <file> (each "- <convention> — enforced by: <rule id or prose>", printable, at most 300 characters, no comment marker; a line already in the file is skipped and named), append them to accord/product/conventions.md as origin\'s default branch has it, in a temporary worktree, commit them with the conventions subject, push branch conventions/<date> and print branch:, base: and title:; refused (exit 2) when a line cannot be read or origin already has that branch; the checkout is not touched and nothing is merged')
    .action((file: string) => {
      setCode(conventionsWrite(preflight(opts), file, opts.cwd));
    });

  const worktree = program.command('worktree').description('work each ticket in its own git worktree');
  worktree
    .command('clean')
    .description('fetch, then remove the worktree, the local branch and the origin branch of each ticket done on the default branch, delete the worktree and branches of tickets dropped there when nothing is lost, and prune stale remote refs, naming what is removed, deleted or kept')
    .action(() => {
      setCode(worktreeClean(preflight(opts)));
    });
  worktree
    .command('check')
    .description('exit 2 naming the ticket this Claude Code session works, before any other work starts')
    .action(() => {
      setCode(worktreeCheck(preflight(opts)));
    });
  worktree
    .command('open <id>')
    .description("find or prepare the ticket's worktree, or take its hold from inside it")
    .option('--continue', 'continue a claimed ticket: never claim, refuse when it has no branch')
    .action((id: string, o: { continue?: boolean }) => {
      setCode(worktreeOpen(preflight(opts, o.continue === true ? 'checkout' : 'light'), id, { continue: o.continue === true }));
    });
  worktree
    .command('sync <id>')
    .alias('merge')
    .description("at verify, or at done under git.merge: rebase: fetch, then take the remote main into the ticket's branch the way git.merge in accord/config.yml says: merge (the default) or squash by a merge commit, rebase by rebasing and pushing with a lease, after first moving an unchanged verification (verified_commit and verification.md's commit) to the rebased commit in one records-only commit, or printing verify again when the ticket's files changed; a conflict is aborted, named, and exits 2; git.sync, a team command, runs instead of either, with the ticket only in its environment; any failure of it is refused and exits 2")
    .action((id: string) => {
      setCode(worktreeSync(preflight(opts, 'stage'), id));
    });
  worktree
    .command('push <id>')
    .description("push the ticket's claim branch to origin; a failed push prints git's message and exits 0, its commits stay local until the next push")
    .option('--force-with-lease', 'after a commit is reworded: replace the branch on origin only while it is still where this clone last saw it and this branch once held that commit')
    .action((id: string, o: { forceWithLease?: boolean }) => {
      setCode(worktreePush(preflight(opts), id, { lease: o.forceWithLease === true }));
    });
  // ST-LN-92 D-03: a task of a wave in its own worktree, run in the ticket's own checkout, for a ticket claimed from 0.6.0.
  const taskTree = worktree.command('task').description("a build task's own worktree beside the ticket's, for a ticket claimed at 0.6.0 or later; run in the ticket's checkout");
  taskTree
    .command('open <id> <n>')
    .description("create task n's worktree <main folder>-<id>+t<n> on branch accord-task/<id>/<n> from the ticket branch's HEAD, run the setup list there, and print path: and branch:; run again it prints the same lines")
    .action((id: string, n: string) => {
      setCode(taskOpen(preflight(opts), id, n));
    });
  taskTree
    .command('merge <id> <n>')
    .description("rebase task n's branch onto the ticket branch in its worktree, then fast-forward the ticket branch to it, so the ticket history stays linear; a conflict stops the rebase and names each path, generated or hand-written (exit 1); run again once the paths are resolved and added, it continues")
    .action((id: string, n: string) => {
      setCode(taskMerge(preflight(opts), id, n));
    });
  taskTree
    .command('clean <id> <n>')
    .description("remove task n's worktree and delete its branch, only when the ticket branch holds its commits; otherwise exit 1 and remove nothing")
    .action((id: string, n: string) => {
      setCode(taskClean(preflight(opts), id, n));
    });

  program
    .command('status')
    .description('print one row per ticket')
    .option('--json', 'print the StatusRow array instead of the table')
    .option('--all', 'include archived tickets (D-93)')
    // The only async action: `status` may ask the tracker what it knows (INTG-01). `parseAsync`
    // awaits it, so the exit code is still settled before runCli returns.
    .action(async (options: { json?: boolean; all?: boolean }) => {
      setCode(await status(preflight(opts, 'claims'), options));
    });

  program
    .command('next')
    .description('list lane tickets that passed Ready, have no task recorded, and are unblocked and unclaimed')
    .option('--json', 'print the StatusRow array instead of the table')
    .action((options: { json?: boolean }) => {
      setCode(next(preflight(opts, 'claims'), options));
    });

  program
    .command('dashboard')
    .description('print the ranked sections for the viewer')
    .option('--json', 'print the Dashboard object instead of text')
    .action(async (options: { json?: boolean }) => {
      setCode(await dashboardCommand(preflight(opts, 'claims'), options));
    });

  program
    .command('anchor [id]')
    .description("print the active ticket's intent, vetoes, decisions, corrections, and position")
    .action((id: string | undefined) => {
      setCode(anchor(preflight(opts, 'stage'), id));
    });

  program
    .command('related <id>')
    .description('print the Vetoes and Decisions of the tickets related to <id>, for the scout at intent and the critic at approach')
    .action((id: string) => {
      setCode(related(preflight(opts), id));
    });

  program
    .command('deferred <id>')
    .description("print the ledger's Must and Should deferred items, for the owner at verify")
    .action((id: string) => {
      setCode(deferred(preflight(opts), id));
    });

  program
    .command('show <id>')
    .description('print one ticket: with --approval its approved sections, otherwise the row facts of a lane ticket, Intent, and each criterion with its state')
    .option('--json', 'print the TicketDetail object instead of text')
    .addOption(new Option('--approval', "print the approved sections for the owner's yes, criteria compacted").conflicts('json'))
    .addOption(new Option('--short', 'with --approval: the short view the owner approves from, the full ticket one path away').conflicts('json'))
    .action((id: string, options: { json?: boolean; approval?: boolean; short?: boolean }) => {
      setCode(show(preflight(opts, 'claims'), id, options));
    });

  program
    .command('hook <event>')
    .description('print the ruleset for a Claude Code hook: ' + HOOK_EVENTS.join(', '))
    .action(async (event: string) => {
      if (!(HOOK_EVENTS as readonly string[]).includes(event)) {
        throw new UsageError('unknown hook event ' + event + '; expected one of ' + HOOK_EVENTS.join(', '));
      }
      if (event === 'prompt-expansion') {
        // The hook never blocks a prompt because of a broken repository (ledger Ruling): any failure to build
        // the context is one stderr line and an allow.
        let ctx: CommandContext;
        try {
          ctx = preflight(opts, 'light');
        } catch (e) {
          opts.stderr.write(`accord hook prompt-expansion: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}; allowed`.replace(/\\/g, '/') + '\n');
          opts.stdout.write('{}\n');
          setCode(0);
          return;
        }
        setCode(hook(ctx, event));
        return;
      }
      if (event === 'pre-tool-use') {
        // ST-LN-39 D-08: a Write, Edit or MultiEdit is decided from stdin alone, so no repository is loaded for it.
        const written = preToolUseWrite(opts);
        if (written !== undefined) {
          setCode(written);
          return;
        }
        // Ledger Ruling 32: a broken repository never blocks a dispatch; any failure is one stderr line and an allow.
        try {
          let cwd: string | undefined;
          try {
            const sent = JSON.parse(opts.stdin ?? '') as unknown;
            const c = typeof sent === 'object' && sent !== null ? (sent as Record<string, unknown>).cwd : undefined;
            if (typeof c === 'string') cwd = c;
          } catch {
            cwd = undefined;
          }
          setCode(hook(preflight({ ...opts, cwd: cwd ?? opts.cwd }, 'checkout'), event));
        } catch (e) {
          opts.stderr.write(`accord hook pre-tool-use: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}; allowed`.replace(/\\/g, '/') + '\n');
          opts.stdout.write('{}\n');
          setCode(0);
        }
        return;
      }
      const ctx = preflight(opts, 'stage');
      setCode(hook(ctx, event as (typeof HOOK_EVENTS)[number]));
      if (event === 'session-start') {
        const line = await upgradeNotice(ctx.snapshot.config?.accord);
        if (line !== undefined) opts.stdout.write(line + '\nsay the line above to the owner in your first reply of this session\n');
      }
    });

  return program;
}

export async function runCli(argv: string[], opts: RunOptions): Promise<number> {
  let code = 0;
  const program = buildProgram(opts, (n) => {
    code = n;
  });

  // D-51: an OS or git message can echo a Windows path; no `\` is ever printed.
  const slashed = (message: string) => message.replace(/\\/g, '/') + '\n';
  try {
    await program.parseAsync(argv, { from: 'user' });
  } catch (err) {
    if (err instanceof UsageError) {
      opts.stderr.write(slashed(err.message));
      return err.exitCode;
    }
    if (err instanceof CommanderError) {
      // `--version` and `--help` are answered before any action runs, so they never reach preflight
      // and D-95's exemption holds by construction. Every other commander refusal is a bad argument,
      // which STACK Decision 1 puts at exit 2 — exit 1 is reserved for a lint or gate verdict.
      // D-26: `accord help` and `accord help <command>` throw `commander.help` with exit code 0; bare `accord` throws it with exit code 1, which stays a usage error.
      if (err.code === 'commander.help') return err.exitCode === 0 ? 0 : 2;
      return err.code === 'commander.version' || err.code === 'commander.helpDisplayed' ? 0 : 2;
    }
    opts.stderr.write(slashed(err instanceof Error ? err.message : String(err)));
    return 2;
  }
  return code;
}
