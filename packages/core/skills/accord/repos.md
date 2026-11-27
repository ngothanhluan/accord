---
kind: reference
---

# A ticket across repositories

Follow this when a plan names another repository: a path written `<name>:<path>`, or a slice with `repo: <name>`, where `<name>` is a key of `repos:` in `accord/config.yml`. Every fact about the other repository comes from an accord command. This session runs no git there, never reads or writes the other repository's `accord/` folder, and never touches the person's own checkout of it.

## The other clone

Run `accord repos status` to find each declared repository's clone. When it prints the not-found line for one, show the owner the `git clone` line it prints; the session asks once for a path, and the answer ends in `accord repos set <name> <path>`. Never clone it, and never tell an agent to.

Where the tool can add a directory to the session (`/add-dir <path>`), ask the owner once to add the clone, so agents can read its files. A tool without it reads the listing and packages the commands write.

## Plan

- For each other repository the change touches, run `accord repos baseline <name> --id <id>`. It prints `baseline_<name>: <sha>` and the `files:` path of the listing of that repository's tracked files. Give the planner the listing path with the paths `./plan.md` names.
- A task of another repository writes its paths as `<name>:<path>`, all in one repository. Each `baseline_<name>:` goes in the plan's frontmatter beside `baseline:`.
- A slice holds one repository's tasks and carries `repo: <name>`; a slice of this repository has no such line. The slices are the deploy order, the repository deployed first as slice 1 and this repository's slice last, as `./plan-slices.md` says.

## Build

`accord anchor` prints `Slice: <n> of <m> in repository <name>, from <sha>` when the slice is built in another repository. Run `accord worktree slice <id> <n>`: it opens a worktree of that clone on `slice/<id>/<n>` and prints its `worktree:` folder, which the brief names as `Work dir`. An executor works only there.

The CLI pushes it: run `accord worktree push <id> --repo <name>` where `./build.md` runs `accord worktree push <id>`. The session runs no git in another folder, so a fact about that clone comes from `accord brief`, `accord review-package` or `accord repos status`.

## Review

`accord review-package <id>` adds a `## Repository <name>` section for each other repository: its range, commits, stat, undeclared files and diff, with a `Files:` line naming the listing. Reviewers read that section and the listing; nobody runs git in the clone. The final review reads each repository from its `baseline_<name>`.

## Verify

Run `accord repos status <id>`. For each other repository it prints `suite:`, the command, and `suite-dir:`, where to run it, then each slice's branch, head and pull request, and `record:` lines. On `suite-dir: none` open the slice first with `accord worktree slice <id> <n>`. Run `suite:` in `suite-dir:`. A failing run is `fail` for every criterion that repository's slices cover.

Give the verifier the `record:` lines to copy verbatim into `## Repository <name>`, and the suite's result for the `Suite:` line it writes there.

A slice that `accord repos status <id>` prints as `held:` waits for an earlier slice of another repository. Run `accord pr wait <id>` as `./pr-wait.md` says until it ends `released`, or find the earlier slice already merged; only then verify that slice and write its block.

## Pull requests

Open another repository's slice with `accord pr <id> --slice <n>`, then `gh pr create --repo <repository> --head <head> --base <base> --draft --title "<title>" --body-file "<body-file>"` with the `repository:`, `head:`, `base:`, `title:` and `body-file:` lines it printed.

Mark every slice of a plan that names another repository ready with `accord pr ready <id> --slice <n>`, never `gh pr ready`: it refuses with `held:` while an earlier slice of another repository has not merged.

## Clean

`accord worktree clean` removes the worktree of the other repository's slice with the ticket's own, after the merge. The person's checkout of it stays as it was.
