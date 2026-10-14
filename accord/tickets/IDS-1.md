---
id: "IDS-1"                            # equals the file name: tickets/<id>.md
title: "Ticket ids follow a per-type, per-person convention"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
# depends_on: ["OTHER-ID"]
# The epic this ticket belongs to.
# parent: "EPIC-ID"
# Ids in the tracker, a map keyed by adapter name; values are strings.
# tracker: { github-issues: "1234" }
ui: false
# Optional design reference URL.
# design: "https://example.com/design/..."
# Written by `accord approve` after the owner says yes; never edit by hand.
# approved_hash:
# Written by `gate ready`; never edit by hand.
# ac_hash:
# Self-test ticks, e.g. [ac-1, ac-2]. Always the last key.
# verified: []
# The AC hash and the commit the ticks were made against.
# verified_hash:
# verified_commit:
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
Ticket ids are typed by hand today, so every repository grows its own naming (SHOW-1, VID-1, README-1).
For a team, an id should say the ticket's type and never collide when two people create tickets on parallel branches.
Success: with the convention on, `accord new ticket` assigns ids like `ST-LN-7` (fixed prefixes ST, BUG, EP; the creator's initials; their own next number), and lint rejects any other id.
A repository without the email → initials table keeps today's behaviour; existing tickets stay valid through an explicit legacy list.
Not in this ticket: renaming existing tickets, ids from a tracker, configurable branch names (the next ticket), verifying who someone really is.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: IDS-1

  @ac-1
  Scenario: A new ticket gets the creator's next number for its type
    Given config.yml maps "an@example.com" to initials "AN" and git user.email is "an@example.com"
    And tickets ST-AN-1 and ST-LN-9 exist in accord/tickets, the already fetched ref origin/t/ST-AN-3 exists, and no ST-AN-2 exists anywhere
    And the remote cannot be reached
    When `accord new ticket --type story` runs
    Then accord/tickets/ST-AN-4.md is written with type story, its path is printed, and the exit code is 0

  @ac-2
  Scenario: Creating a ticket is refused for an unregistered email or a hand-typed id
    Given config.yml maps "an@example.com" to initials "AN" and has no entry for "bo@example.com"
    When `accord new ticket --type bug` runs with git user.email "bo@example.com"
    And `accord new ticket ST-AN-9` runs with git user.email "an@example.com"
    Then each exits 2 and writes no file
    And the first message names "bo@example.com" and how to register, and the second names "ST-AN-9" and says that accord assigns ids

  @ac-3
  Scenario: Lint rejects an id that breaks the convention and spares the legacy list
    Given the initials table exists without "AN", and legacy_ids lists SHOW-1
    And tickets SHOW-1, FOO-1 with type story, ST-AN-4 with type bug, and BUG-AN-1 with type bug exist
    When `accord lint` runs
    Then FOO-1 gets an error naming the form `ST-<initials>-<n>`, ST-AN-4 gets an error naming `BUG-<initials>-<n>`, and SHOW-1 and BUG-AN-1 get none

  @ac-4
  Scenario: Lint rejects two people with the same initials
    Given the initials table maps both "an@example.com" and "anh@example.com" to "AN"
    When `accord lint` runs
    Then one error names "AN" and both emails

  @ac-5
  Scenario: Without the initials table nothing changes
    Given config.yml has no initials table
    When `accord new ticket FOO-1` runs and then `accord lint` runs
    Then accord/tickets/FOO-1.md is written as today and lint reports no id convention finding
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 Each ticket type (story, bug, epic) has its own prefix and its own number sequence; answered on the option "Prefix riêng theo loại" — "tôi nghĩ là option2."
- D-02 A ticket's type never changes and its id is never renamed: to change type, the ticket is closed (dropped) and a new one is created with the other type's id — "việc đổi tên thì tôi nghĩ ko cần, chỉ cần close ticket đó và clone ra một cái khác với tên bug."
- D-03 Configurable branch names are a separate ticket, done right after IDS-1; this ticket keeps `t/<id>` — "Ticket riêng, làm ngay sau IDS-1 (Recommended)"
- D-04 Scope is five parts: per-type prefixes in config.yml; `accord new ticket` assigns the next number; lint rejects a new ticket whose id breaks the convention while the existing tickets keep their ids; two people creating tickets on parallel branches never get the same id; a type change is drop plus create. Out of scope: renaming existing tickets, ids from a tracker, branch naming — "Đúng, đủ 5 phần (Recommended)"
- D-05 The id carries the creator's initials from an email → initials table in config, e.g. `ST-LN-7`, each person with their own sequence per type — "tôi nghĩ options 3. khi user dùng /accord skill, thì phải có cơ chế verify ai đang dùng accord."
- D-06 A person is recognised by `git config user.email`; on first use `/accord` asks for initials (suggested from `user.name`) and records them in config.yml; `accord new ticket` refuses an unregistered email, so there is one id format and no hash fallback; lint rejects two people with the same initials. Recognition is for naming only and is never a gate — "Email git + đăng ký lần đầu (Recommended)"
- D-07 Existing tickets are exempted by an explicit list in config.yml (e.g. `legacy_ids: [ASK-1, …]`), written once when the convention is turned on; any other id that breaks the convention is a lint error — "Danh sách cũ ghi trong config (Recommended)"
- D-08 The convention is on when config.yml holds the email → initials table and off without it, so a repository on 0.1.0 does not break on upgrade; `accord init` writes an empty table so a new repository starts with it on — "Bật khi có bảng người dùng (Recommended)"
- D-09 There is no project id: a project is the repository and its `accord/product/`, tracked through its epics, so the prefixes stay ST, BUG and EP, and all five criteria are the smallest version that counts as done; grouping by epic with progress belongs to the dashboard ticket — "Đồng ý (Recommended)"
- D-10 The next number reads only refs already in the clone (ticket files and local or fetched t/ branches) and never calls the network; the skill fetches first — "Chỉ ref đã fetch (Recommended)"
- D-11 The next number is the creator's highest existing number for that type plus one; a number is never reused — "Lớn nhất + 1 = ST-AN-4 (Recommended)"
- D-12 While the convention is on, every hand-typed id is refused, including one in the right form — "Từ chối mọi mã gõ tay (Recommended)"
- D-13 Lint checks an id's form and that its prefix matches its type, never that its initials are in the table, so a person removed from the table leaves valid tickets behind — "Không đòi (Recommended)"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->
- 2026-10-14, asked how a repository without prefixes in config.yml behaves: "tôi nghĩ là ko cần prefix nữa. vì một project thì chỉ cần phân biệt qua ST, BUG, EP là đủ." Prefixes are fixed, ST, BUG and EP, and are not configured; this replaces the config.yml prefix part of D-04 and D-01's configurable reading.

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->
- [x] What is the smallest version that still counts as done? All five criteria (D-09).

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
