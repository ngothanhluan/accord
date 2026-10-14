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
- Ruling: the schema tests are named `risk:parsing` and the D-18 precedence test `risk:complex-branching`, replacing the Approach's `risk:schema` and `risk:regression`, which are not on the reviewer's kind list (planner) — cost if wrong: test names only.
- Ruling: the skill detail goes in a new reference `packages/core/skills/accord/ids.md` loaded by /accord, since the skill file must stay within 5120 bytes (planner) — cost if wrong: one extra file.
- Ruling: Task 5 adds no test of `init` writing `people: {}`; the existing scaffold test validating the init config against the schema is its check (planner) — cost if wrong: nothing fails if `people: {}` is later removed from init.
- Ruling: Task 6 relies on the existing stage-skills phrase, size and drift tests, as in the TAGS-1 plan (planner) — cost if wrong: the reviewer may want a `risk:` test there.
- Ruling: with no `people` key, an invalid config.yml keeps today's `new ticket` behaviour; the Task 2 refusal is gated on the raw key (plan critic round 1, Should 2; Intent) — cost if wrong: an invalid `people` value under another spelling of the key goes unrefused.
- Ruling: the D-02 drop rule lives only in `ids.md`, which /accord reads only when `people` exists, because of the 5120-byte skill limit (plan critic round 1, Should 4) — cost if wrong: a repository without `people` gets no drop-instead-of-rename guidance, where ids are not assigned anyway.
- Ruling: a repository with no ref at all is detected with `git for-each-ref --count=1` before `git log --all` runs and yields no ids, covering git versions that exit 128 on an unborn HEAD (plan critic round 2, Should 1) — cost if wrong: one extra local spawn per `new ticket`.
- Ruling: the SKILL-04 "restates a rule" case is not on Task 6's verify line because its report id holds a comma, which the verify line splits on (as in TAGS-1); Task 6 tells the executor to run it — cost if wrong: that case is checked only in the full suite.
- Ruling: `GIT_NO_LAZY_FETCH` needs git 2.44 or later; on older git in a partial clone, reading another ref's config.yml may fetch the missing blob, a recorded limit of D-10 (plan critic round 3, Nice 2) — cost if wrong: on that setup `new ticket` may contact the remote or wait on credentials.

## Deferred
