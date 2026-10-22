# Ledger: BUG-LN-6

## Rulings

- Ruling: the silent remote waits for a release file the test writes, capped at 60 s, instead of `sleep 30` and a fixed 31 s wait — the test then ends as soon as its assertions do, and the remote stays silent past the 15 s bound the test asserts — cost if wrong: an orphaned shell runs up to 60 s after a failed test.
- Ruling: the cli test and hook timeout rise to 90 s on win32 only, for every cli test file, not per test — slow Windows runners hit tests across files (37 s for one that takes 7 s), and POSIX keeps 30 s so a real hang still fails fast there — cost if wrong: a hang on Windows takes 90 s to fail.
- Ruling: review round 1 started while the full suite was still running — the reviewer reads the diff, not test results — cost if wrong: a fix after a failing suite needs another round.
