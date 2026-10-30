---
ticket: "ST-LN-73"
commit: "9e22363f220f5ada265eea5b84fedcf8eb96024b"
reviewed_on: "2026-10-30"
---

## @ac-1 The fork count follows the free memory, capped by half the CPUs

Result: pass

Evidence: Exists: packages/cli/test/test-memory.test.ts:46-55 drives setup() with 10 GB and 30 GB free, 1 GB per fork, 4 GB reserve, half the CPUs 8 (workers({}, 16)); expects 6 and 8 for the root and both projects, and no log line. Substantive: test/lock.ts:183-187 computes fit = floor((free - reserve) / perFork) and sets min(current, fit) on every project and the root config. Wired: vitest.config.ts globalSetup ['./test/lock.ts'] runs the default export setup(project); the risk:regression test (test-memory.test.ts:25-44) runs a real vitest on packages/cli/test/fixtures/fork-cap and sees the capped fork count. Data flows: free comes from freemem() at test/lock.ts:167 and 173, and the cap from workers() in vitest.config.ts:7-12. node_modules/.cache/accord/junit.xml at HEAD 9e22363 shows this test passing, with 0 failures in the suite.

## @ac-2 An explicit ACCORD_TEST_WORKERS is a cap that the free memory can lower

Result: pass

Evidence: Exists: packages/cli/test/test-memory.test.ts:57-66 covers ACCORD_TEST_WORKERS=20 with 10 GB free (expects 6) and =3 with 30 GB free (expects 3). Substantive: workers() in vitest.config.ts:7-12 returns the validated variable and ignores the CPU half once it is set; test/lock.ts:184 takes the minimum. Wired and data flow: same globalSetup path as ac-1, and the cap is read from process.env at vitest.config.ts:21. The junit report shows the test passing.

## @ac-3 A run waits for enough free memory for one fork, with no time limit

Result: pass

Evidence: Exists: packages/cli/test/test-memory.test.ts:68-85 starts with 4.5 GB free and reads the free memory 20 times. The promise stays unsettled and no test starts. It expects exactly one line, "accord: waiting for free memory (4.5 GB free, 5 GB needed: ...)". After free rises to 7 GB it resolves with 3 forks and still only one line. Substantive: test/lock.ts:173-182 loops while free < reserve + perFork, logs once (the told flag), has no timeout, and re-reads the memory each poll. Wired: setup is the globalSetup default export, after acquire(). Data flows: the freeNow() result feeds both the wait test and the fit calculation. The junit report shows the test passing.

## @ac-4 The fork count is taken from the memory free once the lock is held

Result: pass

Evidence: Exists: packages/cli/test/test-memory.test.ts:87-103 holds the lock file with 2 GB free, waits for the lock-wait line, then sets free to 10 GB and removes the lock. The waiting run gets 6/6/6 and prints only the lock line, not the memory line. Substantive: test/lock.ts:165 awaits acquire() before the first freeNow() read at :173, so the memory is read after the lock is taken. Wired and data flow: the lock file is written with the run's own cwd (asserted at :100), and release removes it (:102). The junit report shows the test passing. The macOS risk test (:105-116) also passes, matching D-08.
