# Ledger

## Tasks
- task 1 done 501be00fdb30
- task 2 done ab0aa8a18baa
- task 3 done 3e324dd90507
- task 4 done bb53cb946207
- task 5 done 34d884229f86
- task 6 done 01455d0cf06f

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
- Ruling: in a treeless clone (`--filter=tree:0`) the history read in `accord new ticket` (`git log --all --no-renames --name-only`) fails and the command exits 2 naming the git log failure, while a blobless clone works — the trees are missing and `GIT_NO_LAZY_FETCH=1` stops git fetching them, a recorded limit of D-10 (plan critic round 4, Should 1) — cost if wrong: a team using treeless clones cannot create tickets under the convention until they fetch the trees or use a full or blobless clone.
- Ruling: a fourth plan revision round, past the three-round limit, to fix critic round 4's one Should (`--no-renames` on the `git log --all` id read) and its two Nice — the owner chose "Cho thêm 1 vòng sửa (Recommended)" — cost if wrong: one more planner and critic run.
- Ruling: D-02's "clone" means the new ticket carries the dropped ticket's sections below the frontmatter (not `approved_hash` or `ac_hash`) and is approved again; D-02's text already says clone, so the ticket is unchanged — the owner answered "Chép nội dung sang (Recommended)" (plan critic round 5, Should 1) — cost if wrong: one sentence in `ids.md`.
- Ruling: a fifth plan revision round fixes round 5's Should and its three Nice, and its critic reads only that revision's diff — the owner answered "Critic chỉ đọc phần vừa sửa (Recommended)" — cost if wrong: a fault elsewhere in the plan, already reviewed five times, is caught at review instead.
- Ruling: a type change carries over the frontmatter keys that describe the work, `lane`, `ui`, `design`, `parent`, `depends_on`, `tracker`, and never `id`, `type`, `status`, `approved_hash`, `ac_hash`, `verified*`, or the `## Dropped` section — the owner answered "Chuyển key mô tả công việc (Recommended)" (plan critic round 6, Should 2) — cost if wrong: one sentence in `ids.md`.
- Ruling: a merge conflict under `people` keeps each email once and asks the owner when the two sides give one email different initials, because a duplicate YAML key makes config.yml unreadable for every command (plan critic round 6, Should 1) — cost if wrong: one sentence in `ids.md`.
- Ruling: a sixth plan revision round, again with a diff-only critic — the owner answered "Critic đọc diff thêm lần nữa (Recommended)" — cost if wrong: about 65k tokens.
- Ruling: `title` also carries over on a type change; it describes the work, the test the owner chose in "Chuyển key mô tả công việc (Recommended)", and the six keys named there were an example list (plan critic round 7, Should 1) — cost if wrong: one word in `ids.md`.
- Ruling: the plan stage ends after one more diff-only critic: a Must stops and asks the owner; a Should that one sentence fixes, or a Nice, is fixed by the planner, recorded here, and build starts with no further critic — the owner answered "Diff cuối, Should nhỏ thì vào build (Recommended)" — cost if wrong: a fault in that last fix is caught at review.
- Ruling: a type change always runs `accord new ticket --type <the other type> --lane <lane>` (the dropped ticket's lane, L for a new epic, M for a story or bug made from an epic), so the lane template is used and `lane` is never copied; fixed after the last diff-only critic under the owner's stop rule, with no further critic (plan critic round 8, Should 1) — cost if wrong: a type change writes a ticket lint rejects, found at review or first use.
- Ruling: gitTicketIdsInHistory lets a `for-each-ref` failure throw a raw error rather than a UsageError, since the brief named UsageError only for `git log` (executor, task 1) — cost if wrong: an unfriendly message in a repository whose ref store is broken, which earlier git reads already catch.
- Ruling: the schema tests read the finding's `pointer`, which is where `/people/...` lives (executor, task 1) — cost if wrong: none.
- Ruling: verify-named cases are top-level `it` calls, because the JUnit id carries every enclosing `describe` title; the shared `base` in the ids config tests became `idsBase` to avoid a collision (executor, task 1 retry) — cost if wrong: none, no behaviour change.
- Ruling: the invalid-config refusal of `new ticket` prints `accord/config.yml:<line> <pointer> <reason>`, leaving out the line or pointer when absent, as the brief specified (executor, task 2) — cost if wrong: message wording only.
- Ruling: the `peopleOf` test uses `true` as its non-string value, since the YAML parse keeps `5` a string (stringNumerics) (executor, task 3) — cost if wrong: a numeric `people` value passes `peopleOf`, and the schema refuses it first, as task 2 does.
- Ruling: `defaultRef` is origin/HEAD's target, else origin/main, else origin/master, else none; `initialsHolder` takes the default ref's map only when it holds the initials (D-18) and otherwise scans the other refs in sorted order (executor, task 3) — cost if wrong: a repository whose default branch has another name on another remote falls back to scanning every ref.
- Ruling: `lint.id-convention` skips a ticket whose type is not story, bug or epic, since no prefix exists for it and the schema already flags it (executor, task 4) — cost if wrong: such an id gets no convention finding.

## Deferred
