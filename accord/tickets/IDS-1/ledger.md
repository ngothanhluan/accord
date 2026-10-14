# Ledger

## Tasks

## Rulings

- Ruling: the next number is drawn from ticket files, ticket work folders, claim branches (local and already fetched `t/<id>` refs), and ids in the git log of accord/tickets — D-11 forbids reuse and the git log still lists deleted ticket ids — cost if wrong: a gap in the numbering, never a collision.
- Ruling: an unset git `user.email` counts as unregistered: exit 2, and the message says to set it — cost if wrong: only the message wording.
- Ruling: the next number also reads the history of every ref already in the clone (e.g. `git log --all` over accord/tickets), not only HEAD, so a merged ticket whose `t/` branch was pruned still counts — critic Must 1 against D-11 — cost if wrong: one more local git read per `new ticket`.
- Ruling: the /accord skill registers a person only when `people` already exists and never creates the table — creating it would turn the convention on with no `legacy_ids` and fail every existing ticket's gates (critic Should 3) — cost if wrong: a repository owner adds the table by hand once.
- Ruling: with no table and no id, `accord new ticket` exits 2 instead of writing `undefined.md` (critic Should 4) — cost if wrong: none.
- Ruling: emails match case-insensitively (critic Nice 6) — cost if wrong: two emails differing only in case count as one person.
- Ruling: the skill runs `git fetch` with `GIT_TERMINAL_PROMPT=0`, and on failure says so and continues, since D-10 needs only refs already in the clone (critic Nice 7) — cost if wrong: an id assigned from slightly stale refs, still caught by the claim push.
- Ruling: the default branch is the target of `refs/remotes/origin/HEAD`, else `origin/main`, else `origin/master`; with none, D-18 falls back to checking every ref (D-17) — cost if wrong: a repository with another default name gets the stricter D-17 check.
- Ruling: `accord new ticket` exits 2 naming the schema finding when config.yml exists but fails validation (critic round 2, Should 1) — cost if wrong: none.
- Ruling: the skill's registration edit is committed with the ticket file on `t/<id>`, never on the default branch (critic round 2, Should 2; spec §5) — cost if wrong: none.
- Ruling: a registration found on another ref is reused instead of asking again, and lint flags one email mapped to two initials or emails differing only in case (critic round 2, Should 3 and Nice 8) — cost if wrong: one extra lint row.
- Ruling: refs' config.yml is read in one `git cat-file --batch` spawn, parsing only `people`, skipping any ref whose file is missing or unparsable, never throwing (critic round 2, Should 5 and Nice 10) — cost if wrong: a broken ref's registrations are not seen.
- Ruling: the skill drops a ticket by committing `status: dropped` and merging, never by deleting its branch; deleting an unmerged pruned branch can free its number, a recorded limit of D-11 (critic round 2, Should 6) — cost if wrong: a reused number in that one case.
- Ruling: the fetch is `git -c credential.interactive=never -c core.sshCommand="ssh -o BatchMode=yes" fetch`, replacing the GIT_TERMINAL_PROMPT ruling above (critic round 2, Should 7) — cost if wrong: a hang on an exotic credential helper.
- Ruling: the number part is `[1-9][0-9]*` (critic round 2, Nice 9) — cost if wrong: none.

## Deferred
