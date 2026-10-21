# Plan review: ST-LN-33

## Round 1 (whole)
1. Should — the @ac-3 test splits only at "." and line ends, so a split that ignores "?" and "!" still passes; add a line with "?" and "!" breaks and extend the asserted arrays — open
2. Should — the D-06 comparison cannot pick out its two sessions: real folders hold many sessions on main and on t/ST-LN-33, and the longest-sentence quotes mix every session; copy each comparison transcript into its own empty folder and pass those two folders — open
3. Nice — Task 4's "Date.parse(o.timestamp) is a number" reads true for NaN; say "not NaN, as readRun does at scripts/benchmark.mjs:50" — deferred
