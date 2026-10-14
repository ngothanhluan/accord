---
ticket: "IDS-1"
commit: "669aa485013d3361b1228ebc9ecdf429248d9400"
reviewed_on: "2026-10-14"
---

## @ac-1 A new ticket gets the creator's next number for its type

Result: pass

Evidence: Exists: the test `ac-1 new ticket assigns the creators next number for its type` is at packages/cli/test/new-ticket.test.ts:188-206. It builds ST-AN-1 and ST-LN-9, an `origin/t/ST-AN-3` ref made with update-ref, an unreachable `https://unreachable.invalid` remote, and user.email an@example.com. It asserts exit 0, stdout `accord/tickets/ST-AN-4.md\n`, type "story", and that ST-AN-2 does not exist. junit.xml has this test with 0 failures in the run. Substantive: `nextTicketId` in packages/core/src/lint/ids.ts:14-21 takes the highest number for the `ST-AN-` head and adds 1. Ids come from the snapshot tickets, work folders and claims, plus `git log --all` over accord/tickets (packages/cli/src/load/fs.ts, `gitTicketIdsInHistory`). Wired: packages/cli/src/run.ts changes the command to `ticket [id]` and calls `newTicket`. packages/cli/src/commands/new-ticket.ts:46-72 reads the email, resolves initials, and calls `nextTicketId`. The file is written at lines 107-114, and the path is printed on stdout. Data flows: the ids come from real git and filesystem reads. Nothing in new-ticket.ts or fs.ts calls fetch (grep found no fetch), so the unreachable remote cannot matter (D-10). The claim ref is the source of 3, and the result of 4 shows it is used.

## @ac-2 Creating a ticket is refused for an unregistered email or a hand-typed id

Result: pass

Evidence: Exists: the test `ac-2 new ticket refuses an unregistered email and a hand-typed id` is at packages/cli/test/new-ticket.test.ts:253-270, and it passed. Substantive: packages/cli/src/commands/new-ticket.ts:39-42 throws a UsageError for a typed id while `people` exists, with the text "accord assigns ids". Lines 50-55 throw a UsageError for an unregistered email. That message names the email, `people` and accord/config.yml. UsageError maps to exit 2. Wired: both branches run before any path or write code (the ID guard and writeFileSync are later). The test asserts code 2 for both, the substring checks, an unchanged directory listing, and no ST-AN-9 file. Data flows: the email comes from `git config user.email` (`gitUserEmail`), and the test sets it per call.

## @ac-3 Lint rejects an id that breaks the convention and spares the legacy list

Result: pass

Evidence: Exists: the test `ac-3 lint rejects an id that breaks the convention and spares the legacy list` is at packages/core/test/lane-lint.test.ts, in the diff after `withPeople`. It passed. Substantive: `idConvention` in packages/core/src/lint/ids.ts:53-69 returns nothing without `people` and skips ids in `legacy_ids`. Otherwise it requires `^<PREFIX>-[A-Z]{2,4}-[1-9][0-9]*$` for the ticket's type. It never checks whether the initials are in the table (D-13). The error text carries `ST-<initials>-<n>` or `BUG-<initials>-<n>` plus the legacy_ids hint. The test expects FOO-1 and ST-AN-4 (typed bug) to be flagged, with the ST and BUG forms in their messages, and SHOW-1 and BUG-AN-1 not flagged. Wired: the rule is registered as `lint.id-convention` in packages/core/src/lint/rules.ts. `people` and `legacy_ids` are on AccordConfig in packages/core/src/model/snapshot.ts and in config.schema.json. Data flows: the rule reads real snapshot tickets and config. The test goes through the real loader and rule runner, not mocks.

## @ac-4 Lint rejects two people with the same initials

Result: pass

Evidence: Exists: the test `ac-4 lint rejects two people with the same initials` is in packages/core/test/lane-lint.test.ts, and it passed. Substantive: `initialsDuplicate` in packages/core/src/lint/ids.ts:71-90 groups emails by initials and emits one finding per duplicated group. The reason lists the initials and every email. The test asserts exactly one finding, on accord/config.yml, containing AN, an@example.com and anh@example.com. Wired: registered as `lint.initials-duplicate` in packages/core/src/lint/rules.ts. Data flows: it reads `snapshot.config.people`, which is loaded from config.yml.

## @ac-5 Without the initials table nothing changes

Result: pass

Evidence: Exists: the test `ac-5 without the initials table nothing changes` is at packages/cli/test/new-ticket.test.ts:310-320, and it passed. Substantive: packages/cli/src/commands/new-ticket.ts:43 takes the typed id when `people` is undefined (the old path). Both lint rules return [] when `people` is undefined (ids.ts:54 and ids.ts:73). The test creates FOO-1 and checks the stdout path and the file's id. It then runs `lint --json` through runCli and asserts neither `lint.id-convention` nor `lint.initials-duplicate` appears. Wired: the real CLI path (run.ts to newTicket, then lint) is exercised end to end. Data flows: the test's config has no `people` key, so the off state comes from the loader and is not hard-coded.

Caveat, not blocking: the tests exercise the criteria through the CLI and core, not through the `/accord` skill text. The skill docs (packages/core/skills/accord/ids.md) were not checked as a behaviour.
