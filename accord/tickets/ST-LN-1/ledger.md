# Ledger

## Tasks

## Rulings

- Ruling: the `branch` pattern is an `allOf` of small patterns, a strict subset of git's branch-name rules, so lint names the rule that failed (critic round 2 Should 6, round 3 Nice 8) — cost if wrong: a team wanting `+`, `@` or non-ASCII in branch names is refused until the class widens.
- Ruling: anchor and the session-resume hook recognise `t/<id>` while another template is set, matching D-03 for claims (architect) — cost if wrong: one extra match a team did not want.
- Ruling: among several claim refs for one id, a pushed ref beats a local one and within each tier the newest tip commit wins; this replaces today's last-in-refname-order rule (critic round 1 Nice 9, round 3 Nice 7) — cost if wrong: the other author is shown as holder on a two-branch conflict.
- Ruling: a `t/` name is matched only by `t/{id}`; when two other templates match one name, the match whose id is an existing ticket wins (critic round 2 Nice 7, round 3 Nice 6) — cost if wrong: an overlapping pair of templates reads the wrong id.
- Ruling: the default branch's `branch` is used when it passes the `branch` pattern alone; the rest of that file is not validated, while the working tree's `branch` is dropped with any schema finding in its config, as every key is; an invalid working-tree template therefore leaves the default branch's template in force (D-06 read with D-07; critic round 3 Should 2) — cost if wrong: a teammate whose own config is broken still sees the team's template, which D-06's literal "use t/{id}" did not say.
- Ruling: `branch` is added to lane rows only, like `claimedBy`, so a 0.1.0 row stays byte-identical and no golden moves (critic round 3 Should 4) — cost if wrong: a ticket without `lane:` has no branch in the JSON.
- Ruling: the default-branch read runs with `GIT_NO_LAZY_FETCH=1`, `GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=never` and `credential.interactive=never`, and any failure adds no template; on git older than 2.44 a blobless clone may still fetch the blob, a recorded limit for every command (critic round 3 Should 5) — cost if wrong: a session hook waits on the network on old git.
- Ruling: the templates in force and each claim's branch travel in the snapshot, so core computes the unclaimed `branch` (critic round 3 Should 3) — cost if wrong: one more field on the exported snapshot type.

## Deferred
