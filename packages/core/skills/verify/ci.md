---
kind: reference
---

# CI on the pull request

Verify watches the pull request's CI once, while its own checks run. Only
GitHub Actions on a GitHub pull request is read; anything else is
reported as CI not checked, with the reason.

## Start: step 2, before the suite

1. Read `git remote get-url origin`. No `origin`, or a host other than
   `github.com`: CI not checked, "no GitHub remote"; skip the rest of Start.
2. Run `gh auth status`, then
   `gh pr list --head <branch> --state open --json number,url`. gh
   missing, not logged in, or unable to reach the repository: CI not
   checked, with gh's message; skip the rest of Start.
3. Run `git push -u origin <branch>`. A rejected push: CI not checked,
   with git's message; skip the rest of Start. Note `<sha>`, from
   `git rev-parse HEAD`, and the time. A push that changed nothing still
   counts: the runs already on `<sha>` are used.
4. When that list was empty, run `gh pr create --draft --fill`. A pull
   request already open is left as it is. Never merge it: merging waits
   for the owner.

Then run the suite and the verifier while CI runs.

## Wait: step 4, before the report

- When `accord/tickets/<id>/debug.md` has an open episode (its last
  `## ` heading is not `## Resolved`) and Wait is skipped or ends with
  its checks not checked, the report's not-checked line says "the fix
  for episode <n> was not seen passing on the other operating system".
- When Start was skipped, skip Wait; the report gives Start's reason.
- When `.github/workflows/` holds no workflow file other than
  `accord.yml`: CI not checked, "no workflow other than accord's"; skip
  the rest of Wait.
- Only runs on `<sha>` count:
  `gh run list --commit <sha> --json databaseId,workflowName,status,conclusion`.
  Leave out the workflow whose `name:` is in `.github/workflows/accord.yml`:
  never wait for it and never send it to debug; step 6's local checks
  stand in for it.
- Read the list once a minute until a run appears. None within ten
  minutes of the push: CI not checked, "no check appeared on `<sha>`
  within ten minutes".
- Then read it once a minute until every run is `completed`. A run not
  completed thirty minutes after it appeared: CI not checked for it, by
  name, "still running after thirty minutes".
- A check is a job: for each completed run,
  `gh run view <run-id> --json jobs` lists its jobs, and each job is one
  check, named `<workflowName> / <job name>`, with the job's
  `conclusion`. A run with no jobs is one check under its workflow name,
  with the run's `conclusion`.
- Once every run has finished: `success` passed; `failure`, `timed_out`
  and `startup_failure` failed; any other conclusion, `cancelled` and
  `skipped` among them, is CI not checked for that check, by name, and
  goes to no debug.
- Any failed check: give the owner one line, "CI failed on `<sha>`:
  <the failed checks' names>", show no report, ask for no tick, and
  follow `./failure.md` with the ids of the runs those checks belong to.
- Every check passed and `accord/tickets/<id>/debug.md` has an open
  episode (its last `## ` heading is not `## Resolved`): append
  `## Resolved` with one line naming `<sha>` and the passing checks, and
  commit `debug.md` alone.
- Otherwise the report gives each check's name and result.

## Finish: step 6, after the tick is committed

1. When `debug.md` still has an open episode, append `## Resolved`
   with one line, "the owner's decision: ticked with CI not checked",
   and commit `debug.md` alone.
2. Run `accord lint`. `<def>` is the first of `origin/HEAD`,
   `origin/main` and `origin/master` that `git rev-parse --verify -q`
   resolves. For every file `git diff --name-only --no-renames
   --diff-filter=D <def>...HEAD` lists as `accord/tickets/<t>.md` (a
   ticket renamed away is listed too), read its version at `<def>`. It is
   approved or done when its frontmatter has an `approved_hash` key; or a
   `verified` key whose value is not `[]`; or an `ac_hash` key with
   `lane: S`, with no `lane` key, or with a `lane` key whose value is not
   on its key line; a frontmatter it cannot read counts as approved. When
   it is approved or done and its `status` is not `dropped`, show "<t>: an
   approved or done ticket cannot be deleted before it is dropped -
   restore the file if this is the ticket's own branch, run accord drop
   <t>, merge the pull request of the drop/<t> branch it pushes, merge the
   default branch into this branch and push"; when it is approved or
   done, its `status` is `dropped` and its `## Dropped` section gives no
   reason it can read, show "<t>: fix the `## Dropped` reason on the
   default branch". Then: each such line is a failure: stop, nothing is pushed.
   When no `<def>` resolves, say the deletion check was not run. Run `accord gate done <t>` for every ticket file
   `git diff --name-only --diff-filter=d <def>...HEAD` lists as
   `accord/tickets/<t>.md`; when none resolves, run
   `accord gate done <id>` alone. Any failure: show it and stop; nothing
   is pushed.
3. Run `git status --porcelain --branch`. When it names an upstream on
   `origin` and `origin` is a GitHub remote: when it shows the branch
   ahead, run `git push`; then, unless
   `gh pr view --json isDraft --jq .isDraft` prints `false`, run
   `gh pr ready`. Do not wait for CI again. This step also finishes a
   session that stopped after the tick commit.
