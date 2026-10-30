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
Chosen: lower maxWorkers from the globalSetup, after the lock. vitest.config.ts keeps its synchronous cap (half the CPUs, or the validated ACCORD_TEST_WORKERS) and takes no lock. `setup(project)` in test/lock.ts takes the lock with the unchanged `acquire()`, waits with one line and no time limit until the free memory is at least the reserve plus one fork (D-02), then sets every project in `project.vitest.projects` and `project.vitest.config` to min(current value, floor((free - reserve) / per fork)). In vitest 5.0.0 the worker count is read when the tests run, after globalSetup (index.B89dZ0-N.js:11780-11782, :21044). It is the least new code, and the config and its tests stay as they are.
Rejected: an async vitest.config.ts that takes the lock itself. An editor's vitest extension and `vitest list` load the config, so they would hold the lock or wait on memory, and the config tests would need a guard against their own run's lock.
Free memory: `os.freemem()` on Windows (available physical memory) and Linux (MemAvailable, page cache counted as free); on macOS `vm_stat` parsed as (free + inactive + speculative) x page size (D-04). GB is 10^9 bytes in the constants, the line and the tests.
Figures (D-06): the plan measures one full run's peak and sets the reserve and the per-fork figure from it, written beside the constants, and checks that the reserve plus one fork fits what a 16 GB CI runner has free after the build.
Affected: test/lock.ts (setup, the memory reader, the header comment), a new packages/cli/test/fixtures vm_stat sample, packages/cli/test/test-lock.test.ts or a sibling test file, and the comment on workers() in vitest.config.ts (D-03 makes it a cap).
Risks the critic raised, each kept and handled:
- Must: `setup` must take the lock path, as `acquire` does, so a test inside a run never waits on its own run's lock.
- The tests write a field on a stand-in project, which proves nothing about vitest; one `risk:resource` test runs vitest on a small fixture with the reader allowing one fork and asserts that no second fork started, so a vitest upgrade that reads the count earlier fails a test.
- `--maxWorkers` and `VITEST_MAX_WORKERS` set the value per package project, so every project is lowered to the same value; lowering one alone makes vitest abort the run.
- A Linux container with a memory limit: `os.freemem()` reads the host's MemAvailable, not the limit, so a run in such a container can still exceed it; no such container runs these tests today.
- Figures measured on a 32 GB host may never fit a 16 GB host, and the wait has no limit (D-02); the plan's check above guards CI, and the wait line names the needed GB so a person sees why.
- Watch mode (`vitest` without `run`, an editor extension) runs globalSetup once, so a rerun keeps the first count; `npm test` and tests.affected/tests.full use `vitest run`.
Tests: ac-1 to ac-4 at the unit layer, `setup` driven with an injected reader, lock path, poll of 0 ms and log; ac-4 with a lock file the test holds and releases; ac-5 on the recorded vm_stat sample on every OS; plus the one `risk:resource` vitest run.
