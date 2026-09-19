---
schema_version: 1
open_count: 17
waived_count: 0
fixed_count: 2
total_count: 19
last_updated: 2026-09-18T12:44:29.923Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 06 | unrun-verify | .planning/phases/06-skills/06-01-PLAN.md |  | Plan-level verification item 3 (second 'accord skills sync' reports unchanged on an Ubuntu leg) is unrun: nothing was committed, so CI never ran. Windows leg passed locally. | open |  | 2026-09-16T02:55:34.161Z |  |
| 2 | 06 | unrun-verify | .planning/phases/06-skills/06-02-SUMMARY.md |  | D-115 part 2 manual run (wrong-plan fixture through the dev plan-review step) is outstanding; belongs to phase verification | open |  | 2026-09-16T03:10:20.999Z |  |
| 3 | 06 | deviation | accord/config.yml |  | design.tokens names a path that does not exist; accord lint carries one standing lint.tokens-missing warning in this repository | open |  | 2026-09-16T03:10:21.378Z |  |
| 4 | 06 | deviation | packages/cli/test/spawn-surface.test.ts |  | 06-03: the plan's required ASCII assertion could not join spawn-surface's shared loop (lint/gate quote non-ASCII ticket text); it lives in skills-sync.test.ts instead | open |  | 2026-09-16T03:25:33.318Z |  |
| 5 | 06 | deviation | packages/core/test/skills.test.ts | 340 | A '\\b'-for-'\\b' typo made 06-02's runtime-product guard unable to fire; fixed here, other test files not audited for the same shape | open |  | 2026-09-16T03:40:52.053Z |  |
| 6 | 06 | deviation | packages/core/skills/ba/story.md |  | SKILL-04 open: three sentences restate rules the CLI enforces - ba/SKILL.md step 3 (READY_PROMOTE membership), ba/story.md section 4 (Ready row), ba/story.md section 6 (lint.vague-wording subject+level). Owner upheld the verdict 2026-09-16 and deferred the prose fix to Phase 7. See 06-06-SUMMARY.md CF-1. | fixed |  | 2026-09-16T05:51:22.586Z | 2026-09-18T02:56:51.054Z |
| 7 | 06 | unrun-verify | packages/cli/test/skills-sync.test.ts |  | 06-07: the two new link cases and the NF-02 case ran on the Windows leg only; the POSIX symlink leg is unrun because nothing is committed and CI never ran. One code path is expected to cover both (lstat isDirectory() is false for a POSIX symlink and a Windows junction alike), expected not observed. | open |  | 2026-09-17T04:03:46.193Z |  |
| 8 | 07 | unrun-verify | packages/cli/test/init.test.ts |  | 07-01: the eight accord init cases and the nine scaffold-planner cases ran on the Windows leg only; the POSIX leg is unrun because nothing is committed and CI has not run. The D-51 no-backslash assertion is precisely the one that can only fail on a host the author does not have. | open |  | 2026-09-17T14:26:33.099Z |  |
| 9 | 07 | unrun-verify | packages/cli/test/init.test.ts |  | 07-02: the fourteen accord init cases, the twelve scaffold-planner cases and the new spawn-surface init row all ran on the Windows leg only; the POSIX leg is unrun because nothing is committed and CI has not run. Same shape as entry 8, now over a report that also carries twenty-two skill-copy paths, which is where a path.join would first show a backslash. | open |  | 2026-09-17T14:55:00.000Z |  |
| 10 | 07 | deviation | packages/core/templates/ticket-build.md | 32 | 07-04 F-2: the shipped ticket templates (ticket-build.md:13,32; ticket-maintain.md:13,33; epic.md:13) name a design tool, which the widened deniedNames scan would flag the moment it is pointed at templates. Out of 07-04's scope (its scan covers initFiles entries plus the pointer block). Owner decision needed: treat the constraint as absolute and genericise the example URL, or write a carve-out into DENIED. Phase 9 is publish - last chance before the name ships. | fixed |  | 2026-09-18T03:27:13.954Z | 2026-09-18T12:44:28.037Z |
| 11 | 07 | unrun-verify | packages/cli/test/init.test.ts |  | 07-04: the eight new accord init pointer cases and the eleven new core scaffold cases ran on the Windows leg only; the POSIX leg is unrun because nothing is committed and CI has not run. Same shape as entries 8 and 9, now over two files accord appends to rather than creates - the separator and prefix-preservation assertions are the ones a line-ending difference would first break. | open |  | 2026-09-18T03:27:14.474Z |  |
| 12 | 07 | unrun-verify | packages/core/test/examples.test.ts |  | 07-06 F-1: the D-147 layer-1 claim is proven one direction short. The examples suite is shown to go red when the example DATA moves under a gate rule (two perturbation runs), but the rule-side demonstration - temporarily tightening isSha in packages/core/src/gate/done.ts so verified_commit 1234567 trips gate.sha-too-short - was denied by the sandbox and not retried. Owner call: run it once under supervision, or accept the data-side proof. 07-08 CI job does not close this; it exercises the same engine from the other side. | open |  | 2026-09-18T03:39:42.973Z |  |
| 13 | 07 | unrun-verify | packages/cli/test/workflow-script.test.ts |  | 07-07: the eleven cases that execute the emitted workflow script ran on the Windows leg only (Git/Cygwin bash 5.3.15); the POSIX leg is unrun because nothing is committed and CI has not run. The suite is gated on bash resolving rather than on platform, and a guard case outside the skipped describes fails on a POSIX host where bash did not resolve - so the ubuntu leg cannot report green having run nothing, but it has never actually reported anything. Same shape as entries 8, 9 and 11. | open |  | 2026-09-18T04:20:00.000Z |  |
| 14 | 07 | unrun-verify | .github/workflows/ci.yml |  | 07-08: the new 'examples' CI job has never run in CI. Its script body was executed by hand on this Windows host under Git bash and exited 0 for both examples (lint 0/0, gate done 0 errors 1 warning each), but the job itself is ubuntu-latest only and nothing in this tree is committed, so no runner has seen it. Same shape as entries 8, 9, 11 and 13. | open |  | 2026-09-18T04:09:32.435Z |  |
| 15 | 07 | deviation | packages/cli/src/guard.ts | 33 | 07-09 A-31 residual: on the one refusal path that still lands after a write - the greenfield skill-target assertNoLink pre-pass, whose roster cannot be known until config.yml exists - assertNoLink's message reads '<path> is not a regular file - nothing was written' while stdout truthfully lists four created scaffold paths. The message is shared with skills sync, where it is true, so rewording it is out of 07-09's scope. Needs a ticket: either scope the clause to the guard's own write set or drop it. | open |  | 2026-09-18T12:13:09.013Z |  |
| 16 | 07 | unrun-verify | packages/cli/test/init.test.ts |  | 07-09: the widened refuses helper (whole-tree before/after equality) and the new after-a-write report case ran on the Windows leg only; the POSIX leg is unrun because nothing is committed and CI has not run. Same shape as entries 8, 9 and 11. listAll walks the sandbox with readdirSync recursive and splits on path.sep, so a separator difference would show here first. | open |  | 2026-09-18T12:13:22.862Z |  |
| 17 | 07 | deviation | packages/core/src/scaffold/init.ts | 52 | 07-10 F-1 (A-34): the generated config.yml opens with 'Every key below is required; edit the values, keep the keys.' and now ends with a commented-out optional tests: block, whose own instruction line is the only marker of the exception. A-34 forbade rewording the header inside 07-10 - that is a decision about the whole document. Needs an owner ruling: qualify the header, or accept the tension. | open |  | 2026-09-18T12:28:49.701Z |  |
| 18 | 07 | deviation | packages/core/src/lint/rules.ts |  | 07-10 F-2: a team that follows the new commented block's instruction - uncomment before your first @test: ticket - immediately acquires a standing 'accord lint' warning 'lint.report-missing tests.report reports/junit.xml is not in the snapshot', until their test runner first writes the file. Same class as WINDOWS entry 3 and the papercut the D-134 design.tokens amendment removed. Warning only, and only after a deliberate human act; lint on a fresh init repo is still 0/0. Fix is a lint-rule decision, which 07-CONTEXT puts out of scope for phase 7. Needs a ticket. | open |  | 2026-09-18T12:28:50.244Z |  |
| 19 | 07 | deviation | packages/cli/src/render/table.ts | 24 | 07-11 F-1: a JSDoc example in packages/cli/src/render/table.ts:24 names a tracker product (Ji+ra, a DENIED entry) and reaches shipped bytes at packages/cli/dist/cli.js:419, because the bundler preserves block comments while stripping line comments. A-37 assumed the shipped surface was the templates and missed that dist is published. The deeper gap: all five deniedNames callers scan inputs to the build, none scans its output, so no test covers dist. Needs a ticket: reword the example to a neutral adapter key, and decide whether the scan grows a dist caller (which must exclude the CSS linear-gradient false positive without introducing an allowlist). Phase 9 is publish. | open |  | 2026-09-18T12:44:29.923Z |  |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "06",
    "file": ".planning/phases/06-skills/06-01-PLAN.md",
    "line": null,
    "description": "Plan-level verification item 3 (second 'accord skills sync' reports unchanged on an Ubuntu leg) is unrun: nothing was committed, so CI never ran. Windows leg passed locally.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-16T02:55:34.161Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "06",
    "file": ".planning/phases/06-skills/06-02-SUMMARY.md",
    "line": null,
    "description": "D-115 part 2 manual run (wrong-plan fixture through the dev plan-review step) is outstanding; belongs to phase verification",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-16T03:10:20.999Z",
    "resolved_at": null
  },
  {
    "id": 3,
    "kind": "deviation",
    "phase": "06",
    "file": "accord/config.yml",
    "line": null,
    "description": "design.tokens names a path that does not exist; accord lint carries one standing lint.tokens-missing warning in this repository",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-16T03:10:21.378Z",
    "resolved_at": null
  },
  {
    "id": 4,
    "kind": "deviation",
    "phase": "06",
    "file": "packages/cli/test/spawn-surface.test.ts",
    "line": null,
    "description": "06-03: the plan's required ASCII assertion could not join spawn-surface's shared loop (lint/gate quote non-ASCII ticket text); it lives in skills-sync.test.ts instead",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-16T03:25:33.318Z",
    "resolved_at": null
  },
  {
    "id": 5,
    "kind": "deviation",
    "phase": "06",
    "file": "packages/core/test/skills.test.ts",
    "line": 340,
    "description": "A '\\b'-for-'\\b' typo made 06-02's runtime-product guard unable to fire; fixed here, other test files not audited for the same shape",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-16T03:40:52.053Z",
    "resolved_at": null
  },
  {
    "id": 6,
    "kind": "deviation",
    "phase": "06",
    "file": "packages/core/skills/ba/story.md",
    "line": null,
    "description": "SKILL-04 open: three sentences restate rules the CLI enforces - ba/SKILL.md step 3 (READY_PROMOTE membership), ba/story.md section 4 (Ready row), ba/story.md section 6 (lint.vague-wording subject+level). Owner upheld the verdict 2026-09-16 and deferred the prose fix to Phase 7. See 06-06-SUMMARY.md CF-1.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-16T05:51:22.586Z",
    "resolved_at": "2026-09-18T02:56:51.054Z"
  },
  {
    "id": 7,
    "kind": "unrun-verify",
    "phase": "06",
    "file": "packages/cli/test/skills-sync.test.ts",
    "line": null,
    "description": "06-07: the two new link cases and the NF-02 case ran on the Windows leg only; the POSIX symlink leg is unrun because nothing is committed and CI never ran. One code path is expected to cover both (lstat isDirectory() is false for a POSIX symlink and a Windows junction alike), expected not observed.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-17T04:03:46.193Z",
    "resolved_at": null
  },
  {
    "id": 8,
    "kind": "unrun-verify",
    "phase": "07",
    "file": "packages/cli/test/init.test.ts",
    "line": null,
    "description": "07-01: the eight accord init cases and the nine scaffold-planner cases ran on the Windows leg only; the POSIX leg is unrun because nothing is committed and CI has not run. The D-51 no-backslash assertion is precisely the one that can only fail on a host the author does not have.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-17T14:26:33.099Z",
    "resolved_at": null
  },
  {
    "id": 9,
    "kind": "unrun-verify",
    "phase": "07",
    "file": "packages/cli/test/init.test.ts",
    "line": null,
    "description": "07-02: the fourteen accord init cases, the twelve scaffold-planner cases and the new spawn-surface init row all ran on the Windows leg only; the POSIX leg is unrun because nothing is committed and CI has not run. Same shape as entry 8, now over a report that also carries twenty-two skill-copy paths, which is where a path.join would first show a backslash.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-17T14:55:00.000Z",
    "resolved_at": null
  },
  {
    "id": 10,
    "kind": "deviation",
    "phase": "07",
    "file": "packages/core/templates/ticket-build.md",
    "line": 32,
    "description": "07-04 F-2: the shipped ticket templates (ticket-build.md:13,32; ticket-maintain.md:13,33; epic.md:13) name a design tool, which the widened deniedNames scan would flag the moment it is pointed at templates. Out of 07-04's scope (its scan covers initFiles entries plus the pointer block). Owner decision needed: treat the constraint as absolute and genericise the example URL, or write a carve-out into DENIED. Phase 9 is publish - last chance before the name ships.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-18T03:27:13.954Z",
    "resolved_at": "2026-09-18T12:44:28.037Z"
  },
  {
    "id": 11,
    "kind": "unrun-verify",
    "phase": "07",
    "file": "packages/cli/test/init.test.ts",
    "line": null,
    "description": "07-04: the eight new accord init pointer cases and the eleven new core scaffold cases ran on the Windows leg only; the POSIX leg is unrun because nothing is committed and CI has not run. Same shape as entries 8 and 9, now over two files accord appends to rather than creates - the separator and prefix-preservation assertions are the ones a line-ending difference would first break.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-18T03:27:14.474Z",
    "resolved_at": null
  },
  {
    "id": 12,
    "kind": "unrun-verify",
    "phase": "07",
    "file": "packages/core/test/examples.test.ts",
    "line": null,
    "description": "07-06 F-1: the D-147 layer-1 claim is proven one direction short. The examples suite is shown to go red when the example DATA moves under a gate rule (two perturbation runs), but the rule-side demonstration - temporarily tightening isSha in packages/core/src/gate/done.ts so verified_commit 1234567 trips gate.sha-too-short - was denied by the sandbox and not retried. Owner call: run it once under supervision, or accept the data-side proof. 07-08 CI job does not close this; it exercises the same engine from the other side.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-18T03:39:42.973Z",
    "resolved_at": null
  },
  {
    "id": 13,
    "kind": "unrun-verify",
    "phase": "07",
    "file": "packages/cli/test/workflow-script.test.ts",
    "line": null,
    "description": "07-07: the eleven cases that execute the emitted workflow script ran on the Windows leg only (Git/Cygwin bash 5.3.15); the POSIX leg is unrun because nothing is committed and CI has not run. The suite is gated on bash resolving rather than on platform, and a guard case outside the skipped describes fails on a POSIX host where bash did not resolve - so the ubuntu leg cannot report green having run nothing, but it has never actually reported anything. Same shape as entries 8, 9 and 11.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-18T04:20:00.000Z",
    "resolved_at": null
  },
  {
    "id": 14,
    "kind": "unrun-verify",
    "phase": "07",
    "file": ".github/workflows/ci.yml",
    "line": null,
    "description": "07-08: the new 'examples' CI job has never run in CI. Its script body was executed by hand on this Windows host under Git bash and exited 0 for both examples (lint 0/0, gate done 0 errors 1 warning each), but the job itself is ubuntu-latest only and nothing in this tree is committed, so no runner has seen it. Same shape as entries 8, 9, 11 and 13.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-18T04:09:32.435Z",
    "resolved_at": null
  },
  {
    "id": 15,
    "kind": "deviation",
    "phase": "07",
    "file": "packages/cli/src/guard.ts",
    "line": 33,
    "description": "07-09 A-31 residual: on the one refusal path that still lands after a write - the greenfield skill-target assertNoLink pre-pass, whose roster cannot be known until config.yml exists - assertNoLink's message reads '<path> is not a regular file - nothing was written' while stdout truthfully lists four created scaffold paths. The message is shared with skills sync, where it is true, so rewording it is out of 07-09's scope. Needs a ticket: either scope the clause to the guard's own write set or drop it.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-18T12:13:09.013Z",
    "resolved_at": null
  },
  {
    "id": 16,
    "kind": "unrun-verify",
    "phase": "07",
    "file": "packages/cli/test/init.test.ts",
    "line": null,
    "description": "07-09: the widened refuses helper (whole-tree before/after equality) and the new after-a-write report case ran on the Windows leg only; the POSIX leg is unrun because nothing is committed and CI has not run. Same shape as entries 8, 9 and 11. listAll walks the sandbox with readdirSync recursive and splits on path.sep, so a separator difference would show here first.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-18T12:13:22.862Z",
    "resolved_at": null
  },
  {
    "id": 17,
    "kind": "deviation",
    "phase": "07",
    "file": "packages/core/src/scaffold/init.ts",
    "line": 52,
    "description": "07-10 F-1 (A-34): the generated config.yml opens with 'Every key below is required; edit the values, keep the keys.' and now ends with a commented-out optional tests: block, whose own instruction line is the only marker of the exception. A-34 forbade rewording the header inside 07-10 - that is a decision about the whole document. Needs an owner ruling: qualify the header, or accept the tension.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-18T12:28:49.701Z",
    "resolved_at": null
  },
  {
    "id": 18,
    "kind": "deviation",
    "phase": "07",
    "file": "packages/core/src/lint/rules.ts",
    "line": null,
    "description": "07-10 F-2: a team that follows the new commented block's instruction - uncomment before your first @test: ticket - immediately acquires a standing 'accord lint' warning 'lint.report-missing tests.report reports/junit.xml is not in the snapshot', until their test runner first writes the file. Same class as WINDOWS entry 3 and the papercut the D-134 design.tokens amendment removed. Warning only, and only after a deliberate human act; lint on a fresh init repo is still 0/0. Fix is a lint-rule decision, which 07-CONTEXT puts out of scope for phase 7. Needs a ticket.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-18T12:28:50.244Z",
    "resolved_at": null
  },
  {
    "id": 19,
    "kind": "deviation",
    "phase": "07",
    "file": "packages/cli/src/render/table.ts",
    "line": 24,
    "description": "07-11 F-1: a JSDoc example in packages/cli/src/render/table.ts:24 names a tracker product (Ji+ra, a DENIED entry) and reaches shipped bytes at packages/cli/dist/cli.js:419, because the bundler preserves block comments while stripping line comments. A-37 assumed the shipped surface was the templates and missed that dist is published. The deeper gap: all five deniedNames callers scan inputs to the build, none scans its output, so no test covers dist. Needs a ticket: reword the example to a neutral adapter key, and decide whether the scan grows a dist caller (which must exclude the CSS linear-gradient false positive without introducing an allowlist). Phase 9 is publish.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-18T12:44:29.923Z",
    "resolved_at": null
  }
]
````
