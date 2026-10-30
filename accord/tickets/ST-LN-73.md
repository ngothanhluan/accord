---
id: "ST-LN-73"                            # equals the file name: tickets/<id>.md
title: "A test run waits for free memory and starts only the forks it allows"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
# depends_on: ["OTHER-ID"]
# How the dashboard ranks this ticket: high | medium | low; absent means medium.
# priority: medium
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
Why: a test run in this repository can still push the machine out of memory; on 2026-10-30 Claude Code twice stopped a run waiting on the lock because the machine was critically low (8.2 of 31.7 GB free while ST-LN-63 held the lock).
For whom: whoever runs this repository's tests, a person or an agent, on Windows, Linux or macOS.
Success: a run starts only once enough memory is free for one fork, and starts no more forks than the free memory allows after keeping memory free for the rest of the machine.
Not in scope: test runs in other projects (D-05), and a time limit on the wait (D-02).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-73

  @ac-1
  Scenario: The fork count follows the free memory, capped by half the CPUs
    Given no other run holds the lock and ACCORD_TEST_WORKERS is not set
    And half the CPUs is 8, each fork needs 1 GB, and 4 GB is kept free for the rest of the machine
    When a test run starts with 10 GB of memory free
    Then it runs at most 6 forks at once
    And a run that starts with 30 GB free runs at most 8 forks at once

  @ac-2
  Scenario: An explicit ACCORD_TEST_WORKERS is a cap that the free memory can lower
    Given no other run holds the lock and ACCORD_TEST_WORKERS is 20
    And half the CPUs is 2, each fork needs 1 GB, and 4 GB is kept free for the rest of the machine
    When a test run starts with 10 GB of memory free
    Then it runs at most 6 forks at once, since half the CPUs does not apply once the variable is set
    And a run that starts with 30 GB free and ACCORD_TEST_WORKERS set to 3 runs at most 3 forks at once

  @ac-3
  Scenario: A run waits for enough free memory for one fork, with no time limit
    Given no other run holds the lock and ACCORD_TEST_WORKERS is not set
    And half the CPUs is 8, each fork needs 1 GB, and 4 GB is kept free for the rest of the machine
    When a test run starts with 4.5 GB of memory free
    Then it prints one line, once for the whole wait, saying it waits for free memory, with 4.5 GB free and 5 GB needed
    And it starts no test while less than 5 GB is free, however long that lasts
    And once 7 GB is free it runs at most 3 forks at once

  @ac-4
  Scenario: The fork count is taken from the memory free once the lock is held
    Given another run holds the lock while 2 GB of memory is free, and ACCORD_TEST_WORKERS is not set
    And each fork needs 1 GB, 4 GB is kept free for the rest of the machine, and half the CPUs is 8
    When that run ends and 10 GB is free by the time the waiting run takes the lock
    Then the waiting run runs at most 6 forks at once

  @ac-5
  Scenario: On macOS the free memory counts the memory the system can release at once
    Given a recorded `vm_stat` output from macOS with a page size and counts of free, inactive and speculative pages
    When the free memory is read from it
    Then the result is the free, inactive and speculative pages together, times the page size
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 The parts are: the lock also waits for free memory; the fork count follows the free memory when the run starts, capped by the CPU default; one run's peak is measured before the threshold and memory per fork are set; what an explicit ACCORD_TEST_WORKERS does is settled; it works on Windows, Linux and macOS, CI included — "agreed"
- D-02 A run that holds the lock but has too little free memory for even one fork waits until there is enough, printing one line with the free and the needed GB, with no time limit, like the lock wait — "A"
- D-03 An explicit ACCORD_TEST_WORKERS is a cap: the run starts the smaller of that value and the forks the free memory allows, and the memory wait of D-02 still applies — "A"
- D-04 On macOS the free memory is read from `vm_stat` as the free pages plus the cache the system can release at once, and that reading is tested on a recorded `vm_stat` sample that runs on every OS — "A"
- D-05 The ticket covers this repository's own test runs only (test/lock.ts and the root vitest.config.ts); test runs in other projects are out of scope — "I think this ticket only optimizes for accord."
- D-06 One full run's peak memory is measured at the plan stage, before any code; the memory per fork and the memory kept free for the rest of the machine are set from it, with the measurement written beside them; the criteria test the behaviour with given figures, not the measured ones — "A"
- D-07 The smallest version that counts as done is all of D-01 to D-06 — "ok, all of it"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->
- 2026-10-30, on measuring the memory per fork and the reserve as figures in this repository's code: "Isn't this for more than accord? Different projects have different memory consumption, don't they?"

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
