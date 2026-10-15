# Ledger

## Tasks
- task 1 done 6749d38068f3
- task 2 done 115e1afc0a39
- task 3 done 3babcd2e085e
- task 4 done 81feaa7dc82d
- task 5 done 993396d9faa0

## Rulings

- Ruling: the `branch` pattern is an `allOf` of small patterns, a strict subset of git's branch-name rules, so lint names the rule that failed (critic round 2 Should 6, round 3 Nice 8) — cost if wrong: a team wanting `+`, `@` or non-ASCII in branch names is refused until the class widens.
- Ruling: anchor and the session-resume hook recognise `t/<id>` while another template is set, matching D-03 for claims (architect) — cost if wrong: one extra match a team did not want.
- Ruling: among several claim refs for one id, a pushed ref beats a local one and within each tier the newest tip commit wins; this replaces today's last-in-refname-order rule (critic round 1 Nice 9, round 3 Nice 7) — cost if wrong: the other author is shown as holder on a two-branch conflict.
- Ruling: a `t/` name is matched only by `t/{id}`; when two other templates match one name, the match whose id is an existing ticket wins (critic round 2 Nice 7, round 3 Nice 6) — cost if wrong: an overlapping pair of templates reads the wrong id.
- Ruling: the default branch's `branch` is used when it passes the `branch` pattern alone; the rest of that file is not validated, while the working tree's `branch` is dropped with any schema finding in its config, as every key is; an invalid working-tree template therefore leaves the default branch's template in force (D-06 read with D-07; critic round 3 Should 2) — cost if wrong: a teammate whose own config is broken still sees the team's template, which D-06's literal "use t/{id}" did not say.
- Ruling: `branch` is added to lane rows only, like `claimedBy`, so a 0.1.0 row stays byte-identical and no golden moves (critic round 3 Should 4) — cost if wrong: a ticket without `lane:` has no branch in the JSON.
- Ruling: the default-branch read runs with `GIT_NO_LAZY_FETCH=1`, `GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=never` and `credential.interactive=never`, and any failure adds no template; on git older than 2.44 a blobless clone may still fetch the blob, a recorded limit for every command (critic round 3 Should 5) — cost if wrong: a session hook waits on the network on old git.
- Ruling: the templates in force and each claim's branch travel in the snapshot, so core computes the unclaimed `branch` (critic round 3 Should 3) — cost if wrong: one more field on the exported snapshot type.
- Ruling: the default branch is the first of origin/HEAD, origin/main, origin/master that names a commit, read in one `cat-file --batch`, the order `gitPeopleOnRefs` uses (planner) — cost if wrong: a team whose default lives under another remote name gets no default-branch template.
- Ruling: when the default-branch read fails, no template is added and a new claim is named `t/{id}`, which everyone counts (D-03) (planner) — cost if wrong: on a broken git, claims fall back to `t/` names.
- Ruling: a claimed row with no host-supplied branch shows the name a new claim would use; only core tests build such snapshots (planner) — cost if wrong: one guessed branch name in core-only snapshots.
- Ruling: `activeTicket` takes the snapshot instead of reading the templates again, one source for the templates in force (planner) — cost if wrong: a signature change on one internal export.
- Ruling: Task 1 adds `branch` as a plain string and Task 4 adds the D-04 rules, so the ac-3 test is red before its task (planner) — cost if wrong: between Tasks 1 and 4 on the branch, an invalid template is briefly accepted.
- Ruling: the /accord Dashboard paragraph on `idleDays` is shortened to keep the skill within 5120 bytes; it still names `idleDays`, `idle <n>d` and the `accord status --json` row (planner) — cost if wrong: the hint that `next --json` never carries `idleDays` is lost.
- Ruling: `gitClaims` keeps per-id winners in a `Map`, then builds `claims` and `branches` as `Object.create(null)` objects, and the row reads `claimBranches` only through `Object.hasOwn`, so ids like `constructor` never read `Object.prototype` (planner, plan critic round 2 Nice 1) — cost if wrong: a one-line plan change if plain objects are preferred.
- Ruling: plan critic round 2 found no Must or Should; its two Nice were fixed in Task 3 by the planner with no further critic round — cost if wrong: a fault in that small fix is caught at review.
- Ruling: Task 2 was finished by a second executor from the first one's uncommitted draft after a laptop reset; the draft was checked against the brief and kept, and the test `a template on a ref other than the default branch sets nothing` is a negative guard that stays green without the change (executor, task 2) — cost if wrong: a fault in the draft is caught at review.
- Ruling: the ac-3 test asserts at least one `/branch` finding, all `schema.*`, since `feature/..{id}` breaks two rules (`..` and a segment starting with `.`) and lint names both; ac-3 asks for a schema error on `branch`, which two findings meet (executor, task 4) — cost if wrong: merging patterns or de-duplicating findings if one finding per template is wanted.

## Deferred
- The docs still describe only `t/<id>` claims: docs/specs/2026-10-12-workflow-layer-design.md:148 and :193 say a claim is "pushing a branch `t/<id>`", and docs/design.md never mentions `branch` (plan critic round 1, Nice).
- Holder order for two pushed `t/<id>` refs on different remotes changes even with no `branch` key: before, the last ref in refname order won; now the newest tip wins (packages/cli/src/load/fs.ts `gitClaims`; review round 1, Nice 1, asked of the owner).
- `config.yml` written by `init` documents `people` but not `branch`, so a new team cannot discover the key (packages/core/src/scaffold/init.ts; review round 1, Nice 2).
- Stale comment: packages/core/src/model/snapshot.ts:12 still says claims are the "author of the tip of branch t/<id>" (review round 1, Nice 3).
- `gitDefaultBranch` calls `branchTemplateOf(config.body)` twice on one line (packages/cli/src/load/fs.ts; review round 1, Nice 4).
- Whitespace: a blank line lost before the baseline doc comment in fs.ts, a long one-line header comment in packages/cli/src/commands/anchor.ts:3, and no final newline in lane-commands.test.ts, branch.test.ts and schemas.test.ts (review round 1, Nice 5).
- `risk:parsing branch refuses a template that breaks any one rule` in schemas.test.ts overlaps ac-3 at the schema layer; kept because it names the failed rule, as the Approach chose (review round 1, Nice 6).
