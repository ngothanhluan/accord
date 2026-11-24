<!-- accord:start -->

## accord

Workflows for this repository are installed at `.claude/skills/accord*` and `.agents/skills/accord*`.
Type `/accord` to see where work stands, or `/accord <request>` to start something new.

A ticket is not started before `accord gate ready <id>` passes.
<!-- accord:end -->

## Repository conventions

- A pull request that only adds or queues draft tickets (a `backlog/<topic>-<date>` branch off `origin/main`, commit subject `backlog: queue …`) is merged as soon as it is opened, with a merge commit, without asking the owner. Pull requests for ticket work (claim, build, verify) still wait for the owner.
- A planned task's verify command (a GSD plan's verify block, an accord plan's `verify:` line) names only the test files the task writes or extends. A long pre-existing regression file (for example `packages/cli/test/worktree-clean.test.ts`, `git-count.test.ts`, `worktree-session.test.ts` or `audit-hygiene.test.ts`) runs in the wave-end set and in CI, never in a task's verify line.
