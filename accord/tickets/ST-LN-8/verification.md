---
ticket: "ST-LN-8"
commit: "bc07c15ed14b184356a48ee5ec240957edd25fd6"
reviewed_on: "2026-10-21"
---

## @ac-1 The executor is told how verify ids match, what it must not touch, and to read the conventions

Result: pass

Evidence: Exists: packages/core/agents/executor.md and planner.md carry the new lines (git diff main): the verify-id rule (classname, `#`, name, trim, whitespace to `-`, missing or empty classname gives the name alone), "read the JUnit report and find each verify id", never run `accord task-done`, never touch top-level `accord/` (fixture exception), read `accord/product/` and follow `conventions.md`; the planner reads `accord/product/`. packages/core/templates/ruleset.md rule 8 says every commit follows `accord/product/conventions.md` when it exists. Substantive: the text is real instructions, not placeholders. Wired: the test renders through `agentTargets(config())` and `rulesetText`, and the rendered copies .claude/agents/accord-executor.md and accord-planner.md are updated; packages/core/src/generated/agents.ts is regenerated. Data flows: JUnit report node_modules/.cache/accord/junit.xml has testcase `packages/core/test/agents.test.ts` / "ac-1 the executor is told how verify ids match what it must not touch and to read the conventions" with 0 failures in the whole report (failures="0" errors="0").

## @ac-2 Every brief ends with the repository's conventions

Result: pass

Evidence: Exists and substantive: packages/cli/src/commands/brief.ts:24-28 reads accord/product/conventions.md from disk and appends `'\n---\n\n' + conv` only when `conv.trim() === ''` is false (trim also strips BOM), so absent or whitespace-or-BOM-only files add nothing. Wired: `brief` is the `accord brief` command; packages/cli/test/lane-commands.test.ts "ac-2 every brief ends with the repository conventions" drives `run(['brief','T-1','2'])` after `init` (template written), with "- Never add a commit trailer." exact, a BOM+CRLF file byte for byte, blank variants, and a removed file. packages/core/templates/conventions.md is scaffolded by init (scaffold/init.ts, init.test.ts updated). Data flows: output equals brief plus the file's bytes, asserted with toBe. The JUnit report shows the test present, no failures.

## @ac-3 task-done refuses a task whose commit carries a forbidden line (D-07) when the repository forbids trailers

Result: pass

Evidence: Exists: packages/core/src/gate/trailers.ts `forbiddenLines` (body lines after the subject, `^\s*[A-Za-z0-9-]*-by:` or "generated with", case-insensitive, trimmed) and `trailerReason` (12-char sha plus line). packages/cli/src/load/fs.ts:593-629 `gitBranchCommits` runs `git log --first-parent HEAD ^<default ref> ^<since>` with a 64 MiB buffer; no default ref throws UsageError "run `git fetch origin`" (exit 2). packages/cli/src/commands/task-done.ts:57-62 computes `since` as the ledger commit of the highest recorded task below n and appends offenders to the refusal reasons before any ledger write. Wired: the check runs inside `taskDone` only when `commits.trailers === 'forbid'`. Data flows: packages/cli/test/trailers.test.ts in a temp repo covers exit 2 with no origin ref, exit 1 with sha and line and no ledger file, Signed-off-by, indented reviewed-BY, "Generated with", a task 2 case where the task 1 commit is excluded via the ledger, `allow` recording, and absent config recording. The JUnit report shows "ac-3 task-done refuses a task whose commit carries a forbidden line when the repository forbids trailers" with no failures.

## @ac-4 gate done refuses a ticket branch holding any forbidden line when the repository forbids trailers

Result: pass

Evidence: Exists: core rule `commitTrailer` in packages/core/src/gate/done.ts (fails closed when commits are not loaded) registered as `gate.commit-trailer` in packages/core/src/gate/rules.ts. Wired: packages/cli/src/commands/gate.ts loads `gitBranchCommits(ctx.root)` into the snapshot only for `gate done` under forbid, so the finding also reaches `--json`. The first-parent log excludes the second-parent commits and uses the origin default ref, not local main. Data flows: packages/cli/test/gate.test.ts "ac-4 ..." covers exit 2 plus `git fetch origin` with no origin ref, a clean branch with no finding, a merged side commit with Co-Authored-By not flagged, the robot "Generated with" line giving exit 1 with the sha and the line and an error-level JSON finding, and local main moved to HEAD still flagged. The JUnit report shows it with no failures. D-08 is implemented too: `onlyOwnRecords` in done.ts accepts `accord/product/conventions.md`, and core gate.test.ts has a case for it.

## @ac-5 Verify offers to promote a Ruling or Correction into the conventions

Result: pass

Evidence: Exists and substantive: packages/core/skills/verify/SKILL.md step 6 now reads the ticket's `## Corrections` and the ledger's Rulings, asks the owner about each one judged to hold across tickets, writes it as one rule line in `accord/product/conventions.md` on a yes, writes nothing without the yes, then commits `<id>.md`, `verification.md` and, when written, `conventions.md`. Wired: rendered into .claude/skills/accord-verify/SKILL.md and packages/core/src/generated/skills.ts, which the test reads via the sync file list. Data flows: packages/core/test/stage-skills.test.ts "ac-5 the verify skill offers to promote a ruling or correction into the conventions" checks the phrases and their order inside step 6; the JUnit report shows it with no failures. The D-09 build route is also present in packages/core/skills/build/SKILL.md, with a risk test.
