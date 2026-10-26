# Plan review: ST-LN-44

## Round 1 (whole)

Three critics, lenses criteria, build, security; merged and de-duplicated.

1. Must — The ac-4 test only checks that each old `expect` text appears somewhere in the new place, so a repeated assertion or a call of a local assertion helper can be lost: #13 `refused(text)`/`noBranch()` (upgrade.test.ts:81-88), #19 `blocked()` (hook.test.ts:92-98), #27 `again(C)` (worktree.test.ts:228-234); compare old and new as a multiset and count each local assertion-helper call, with its arguments, as an assertion — fixed
2. Must — `EXCEPTIONS` takes whole rows out of the ac-4 loop (async rewrites of #6/#17/#35/#57, #4's read-once `fact()`), so none of their assertions is checked, against D-07; drop `EXCEPTIONS`: keep assertion text identical or add one `MAPPED` entry per rewritten line — fixed
3. Must — A rule 3 "keep" answer can never make ac-1 pass for a destination with a new title (#31, #34, #58 destinations) or for a test outside the table (Task 2's copy-vs-built test), and rewriting a row as kept breaks ac-3 and `rows().length === 113`; give table.md a per-destination ceiling that `rows()` parses and allow appended rows — fixed
4. Must — Tasks 28, 29 and 31 use `verify: check:...` ids that no junit report holds, so `accord task-done` refuses them (packages/core/src/gate/task.ts:27-33) and build never reaches review — fixed
5. Must — Task 30's verify tests fail by design until Task 31 and main-session step 2 have run, but build records each task before dispatching the next, so task-done 30 refuses and build goes to debug — fixed
6. Should — `MAPPED` is loosely checked: `cite` only has to be a substring of the note (`''` passes) and `to` only a passed case (e.g. `MAPPED[28]` to bin.test.ts with cite `CLI`); require that `to`'s title, or the `#n` row it names, appears in `cite` — fixed
7. Should — The ac-3 "before" filter (last title segment found in the source at BASE) drops every title built at run time (new-ticket.test.ts:86, :94, :148; the `it.each` at lane-commands.test.ts:825); treat `${…}` and `%s` as wildcards or take the before list from a run at BASE — fixed
8. Should — Rule 3 (table.md:23) says each listed entry carries a proposed further split or keep; Task 31 proposes none, main-session step 2 forwards the bare list, and no path covers an owner's "split further"; step 2 writes one proposal per entry and states that a split reopens the plan — fixed
9. Should — Rule 3's verify clause (table.md:28) cannot be checked at verify: the ac-1 test reads the committed measuring run and the rule 3 script is thrown away in the OS temp folder (#81 at 9 s in the measuring run and 12 s at verify stays green); keep the script under accord/tickets/ST-LN-44/ and name its run on verify's junit — fixed
10. Should — Task 1's H8 risk test cannot tell the temp-folder check from a plain "is not process.cwd()" check: both refusal inputs walk up to the checkout and `''` (Risk C's unset path) is never tried; add refusals for `join(checkout,'packages')` and `''` — fixed
11. Should — H7 (no origin) is applied to every destination of #24, #58 (Task 22) and #47 (Task 19), but some push, fetch or run a real pick-up (#24's first: worktree.test.ts:1303/1308; #58's third: :1209/:1213; #58's first and #47's third: worktree.ts:412), and `remote remove origin` before H3's `worktree add ... origin/main` deletes `refs/remotes/origin/*`; name the destinations H7 applies to and run it only after any real pick-up and any `origin/main` use — fixed
12. Should — #79 (Task 10) copies the drop template, whose root has `t/ST-10` created and checked out (drop.test.ts:27-33), so `worktree add -q -b t/ST-10` (:145) fails; #79 copies a plain `makeTemplate()` template — fixed
13. Should — Task 9's verify id drops the comma in #20's first destination ("done, then review", table.md:96), so task-done 9 cannot find it; such titles stay off verify lines (plan.md:46-48) — fixed
14. Should — Task 2 sets the copy's root to `realpathSync.native(mkdtempSync())`, with backslashes on Windows, while makeClone's root is git's `/` toplevel (helpers/worktree.ts:48) and the CLI prints `/` paths (src/commands/worktree.ts:78-80); #36's `c.sibling('ST-9')` then fails worktree.test.ts:44 and :52 — fixed
15. Should — Task 14 shares one template between #30 (T-2 with `depends_on: ["T-1"]` in the checkout, show.test.ts:173) and #64 (T-2 only on its claim branch, `blockedBy: []`, :126, :138), which breaks #64's `toMatchObject` — fixed
16. Should — Task 8 caps each #3 destination at 3 git commands, but "fails on a fix committed between a round and its verdict" needs a reset plus three commits (lane-s.test.ts:163-169), so the executor must stop — fixed
17. Should — No verify line names a criterion test the task changes (Task 15 names only #106 while it rewrites #43, #44, #46, #95; Task 6, T7 #2/#6/#9/#57, T11 #12, T12 #53/#91, T13 #28/#71/#81, T21 #18/#52/#80/#97, T24 #65/#76/#85, T25 #38/#55, T26 #14), so a break shows only at review — fixed
18. Should — Tasks 28-30 read the executor reports of Tasks 6-26 (plan.md:60, :711-712, :775), but build passes an executor only the brief path and nothing stores those reports, so Task 30 cannot copy `MAPPED` from them — fixed
19. Should — Task 30 is more than half an executor's context (all of table.md, old and new bodies of ~90 rows, five parsers, four tests); split it, e.g. parsers with ac-1 to ac-3 in one task and ac-4 by file group in others; Task 28 is near the limit too — repeated as 2.1
20. Nice — Nothing checks that a template and its remote stay unchanged, so a test writing to `tpl` instead of its copy (e.g. `tpl.otherClone()` in #13) goes unnoticed; record `for-each-ref` of each template root and remote in `beforeAll` and compare in `afterAll` — deferred
21. Nice — Task 2's test does the probe push before the `for-each-ref` comparison of copy and built clone, so the copy holds `probe` refs the built clone lacks — deferred
22. Nice — Task 12 #68 says six dashboard runs at :269-275, which hold five; Task 30's imports omit `readDir` (stage-baseline.test.ts:7); Task 17 #87 builds commits with `commit-tree`, so it cannot use `commitMsg` as plan.md:44-45 requires — deferred

## Round 2 (whole)

One critic, no lens. fixed: 1.1-1.18. withdrawn: none.

1. Should — repeats 1.19: Tasks 28 and 29 are each still more than half an executor's context: Task 28 (plan.md:776-797) reads the old and new bodies of all 48 worktree.test.ts rows (~2,400 old and ~2,800 new lines) plus their notes, and Task 29 (plan.md:799-812) about 50 rows in 15 files; split per region group (Tasks 18-20, 21-23, 24-26) and per file group, or drop the manual audits for Task 33's mechanical check — fixed
2. Must — The ac-4 test never uses up a `maps.json` `now` entry (plan.md:1006-1012), so a dropped assertion can be mapped to text another old line already matched: row #4, after-verify.test.ts:42 `expect(fact()?.at(-1)?.files)...` dropped and mapped to :41's text passes while the `.files` check is gone (Task 9, plan.md:356-358); a used entry removes its `now` from the working copy, and #4 rebinds `fact` to a cached read so every assertion text stays the same — fixed
3. Should — Task 30's first risk test hard-codes the approved table (113 rows, 29 kept, row 2's ceiling 106, plan.md:881-883), so any late keep through main-session steps 2-3 turns verify's full run red; check counts on a frozen copy of the approved text, or only that rows 1-113 are present and `tableProblems` is `[]` — fixed
4. Should — Task 6 (plan.md:265-267) requires row-1 `maps.json` entries for checks `asserts` never reads (show-approval.test.ts:139-141, :145, :148 are `if (...) bad.push(...)`, not `expect(`), so Task 33 fails "`old` is in that row's `old`" and blocks; Task 6 writes no row-1 entries and the D-08 mapping lives in the table note and the audit — fixed
5. Should — Calls of file-level assertion helpers count as the assertion, but the plan maps the `expect` inside the helper: #103 `dropAndMerge` (worktree.test.ts:1438-1443; Task 23, plan.md:691-692) and #5 `laneSBranch` (:2166-2176; Task 26, plan.md:746-748); say `old` is the helper-call statement, and drop the #5 entry — fixed
6. Should — Rows #71 and #96 name their CLI test only as "as in #28" / "as in #20" (table.md:147, :172), but Task 33's cite rule (plan.md:1011-1012) accepts `#m` only for row m's own test or destinations, so Task 13's entry naming `accord approve > after approval gate ready passes` is rejected; also resolve `#m` to a case whose title row m's note quotes — fixed
7. Nice — Task 16 (plan.md:523-525) adds a `maps.json` entry for the :52 `task-done` exit check, which lands unchanged in lane-flow.test.ts:50-55, so the entry is never used — repeated as 3.3

## Round 3 (whole)

One critic, no lens, after the re-plan for D-12 and D-13 (baseline 1cec2ac). fixed: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6. withdrawn: none.

1. Should — The plan requires `commitMsg` for new commits (plan.md:80-81), but `commitMsg` passes no git identity (repo.ts:109-120) and `makeLaneRepo` sets none (repo.ts:51-55, :145-156); Tasks 13 (#54, #78), 14 (#30, #64) and 16 never write one, so #64's template commit takes the machine's identity (show.test.ts:138 expects `fixture@example.invalid`) and a CI runner with no global identity fails with "Author identity unknown"; a lane-repo template or stage setup writes `user.email fixture@example.invalid`, `user.name fixture` and `commit.gpgsign false` before its first `commitMsg`, unless the row asserts another identity — fixed
2. Should — A late keep of an `unchanged` row (plan.md:1235-1236) makes Task 37 check it (plan.md:1146-1147), but base-tests.json freezes only 19 files (plan.md:1154-1157), not those of #100, #108, #112; #108 (5.75 s) and #100 (7.56 s) are inside rule 3's margin, so a keep of #108 makes `baseText` throw at verify; freeze every distinct file of rows 1-118, or skip kept rows whose `how` is `-` — fixed
3. Should — repeats 2.7: Task 16's `maps.json` entry under `10` for "its old exit check" (plan.md:614-616) maps an assertion that is not dropped and names no `old` or kind; its cite "ledger line written in setup" holds neither the title segment nor `#m`, so Task 37 reports BLOCKED; delete the sentence — fixed
4. Should — ac-3's before list is frozen at `<BASE>` by sha256 (plan.md:1106-1109, :1202-1208), but the owner's standing rule merges origin/main when Continue reports `behind:`; a test main renames or removes after `<BASE>` then shows as gone with no table row and Task 36 fails, with no route in the plan — fixed

## Round 4 (diff)

One critic, diff of the fix after round 3. fixed: 3.1, 3.2, 3.3, 3.4. withdrawn: none.

1. Should — Main session step 4 moves ac-3's before list to the full run at `M` after any later merge of origin/main, recorded only as a ledger Ruling, while the approved Approach says ac-3 and ac-4 read the state at 1cec2ac; at verify ac-3's evidence names `M`, not the approved commit, and needs a change note and a re-approval at the costliest stage — fixed, owner: "Hold merging main until after the measuring run" (2026-10-26, against asking the owner at each merge and against leaving the plan as it is)

## Round 5 (diff)

One critic, diff of the fix for 4.1 on the owner's decision. fixed: 4.1. withdrawn: none.

1. Must — Step 4 holds a merge only on a Continue that reports `behind:`, but Continue merges origin/main by itself at stages intent to review on a clean worktree and prints `merged:` (worktree.ts:498-536, skills accord/worktree.md:26-31), so the hold cannot be carried out, and the plan has no route once a merge lands before Task 35: a renamed test then fails ac-3 at Task 36 and a changed row body goes unchecked by ac-4 — fixed, owner: "Hold, with a fallback if a merge lands anyway" (2026-10-26, against changing the Approach now so merges are free)
2. Should — The hold starts at `plan: ST-LN-44 ready`, but the before list is already fixed (0dcbd4c) and Continue merges at stage plan too, so a merge before the ready commit breaks the same checks; the owner's words give no start point — fixed, owner: "Hold, with a fallback if a merge lands anyway" (2026-10-26, against changing the Approach now so merges are free)
3. Should — The hold ends when Task 35 is recorded, but step 2's answer can add a new measuring task after a merge has landed, so the new after list holds merged code against the 1cec2ac before list; the hold must last until step 2's list is answered — fixed, owner: "Hold, with a fallback if a merge lands anyway" (2026-10-26, against changing the Approach now so merges are free)

## Round 6 (diff)

One critic, diff of the fix for 5.1-5.3 on the owner's decision. fixed: 5.1, 5.2, 5.3. withdrawn: none.

1. Should — The fallback replaces only before-junit.xml and adds no new measuring run, but the hold now lasts past Task 35, so a merge after Task 35 (e.g. a Continue opened to answer step 2) compares a before list at `<merge>^2` with an after list older than the merge, and a test main added fails ac-3 at Task 36; when `<merge>` is newer than Task 35's commit the re-plan must add a measuring task that replaces after-junit.xml and rule3-list.md, then step 2 again — open
2. Nice — Fallback step 3 does not list the task that replaces table-approved.md and Task 34's hash when the owner's yes renames a row's title — deferred
3. Nice — Task 36 copies BEFORE_SHA256 from "the newest ledger Ruling naming that file", but newer Rulings name before-junit.xml without a sha256; say "the newest Ruling that records a sha256 for that file" — deferred
4. Nice — The ledger already quotes `Ruling: the merge hold of plan step 4 ended at <sha>` with the literal placeholder, which an executor searching for the phrase could take as the end marker — deferred
