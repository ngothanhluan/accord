## Episode 1

## Symptom
`node scripts/benchmark.mjs --round 1 --plan` from C:/Work/accord-st-ln-14 (HEAD a2c75bb) exits 1:

```
file:///C:/Work/accord-st-ln-14/scripts/benchmark.mjs:830
    if (notBench(name)) refs[name] = sha;
    ^

ReferenceError: Cannot access 'notBench' before initialization
    at liveState (file:///C:/Work/accord-st-ln-14/scripts/benchmark.mjs:830:5)
    at runPlan (file:///C:/Work/accord-st-ln-14/scripts/benchmark.mjs:613:18)
    at main (file:///C:/Work/accord-st-ln-14/scripts/benchmark.mjs:805:80)
    at file:///C:/Work/accord-st-ln-14/scripts/benchmark.mjs:814:109
```

Nothing was written to C:/Work/accord-bench (no round-1.json, no wt/).

## Hypotheses
1. Temporal dead zone: `const notBench` at scripts/benchmark.mjs:824 is declared after the entry line at :814 that calls `main()` synchronously during module evaluation, so `liveState` (:830) reads it before its declaration has run. Evidence for: the stack trace ends at :814 (module body) and the error is the TDZ ReferenceError. Evidence against: none found.
2. The test or measurement is wrong (a stale or different copy of the script ran, or a Node quirk). Evidence for: none. Evidence against: the trace paths are this worktree's file and the line numbers match the current source.
3. Some other top-level `const`/`let`/`class` that main() reaches is also declared after :814 and would fail next. Evidence for: the ordering pattern could repeat. Evidence against: see probe 1.

Ranked: 1, 3, 2.

## Probes
- Read scripts/benchmark.mjs:797-831 → the entry guard at :814 runs `process.exitCode = main(...)`; `const notBench` is at :824; `liveState` is an `export function` at :826 (hoisted) and uses `notBench` at :830; `onLiveRefs` (:843) uses it at :845. `stopOnEscape` (:850) calls `liveState` at :861 → this supports 1.
- `awk 'NR>814 && /^(export )?(const|let|var|class) /'` on scripts/benchmark.mjs → only line 824 `const notBench`; everything else after :814 is a function declaration (`writeReport`, `liveState`, `onLiveRefs`, `stopOnEscape`), which hoists → hypothesis 3 ruled out. `grep async|await` → none, so main() is fully synchronous and nothing after :814 runs before it. The imported modules (round.mjs, compliance.mjs, plan-review.mjs) are evaluated before this module's body runs, so they cannot have this ordering problem.
- `git log -S notBench -- scripts/benchmark.mjs` → added in 27402b4 (task 11: "--judge and --round 1 stop when a round run edited or committed in a live checkout"), appended below the entry line.
- Two scratch copies of scripts/*.mjs under the scratchpad (`iso/a`, `iso/b`). `yaml` is imported by its absolute file URL because the copies have no node_modules. In copy a, line 814 is replaced by a direct `liveState('C:/Work/accord-st-ln-14')` (read-only git) at the same point in module evaluation. Copy b is a with only the `notBench` line moved above line 814. → a: `ReferenceError: Cannot access 'notBench' before initialization` at :830; b: `ok 20 refs 9 worktrees`. With the declaration order as the only variable, this confirms 1 and rules out 2.
- `npx vitest run packages/core/test/benchmark-worktree.test.ts` → 4 passed. The test imports the module, so `fileURLToPath(import.meta.url) === path.resolve(process.argv[1])` is false, main() never runs during evaluation, and `notBench` is initialized before the test calls `liveState`. `grep` of packages/core/test/benchmark-*.test.ts finds no test that spawns scripts/benchmark.mjs as a process. That explains why the suite missed the bug.

## Fixes
- Fix 1 (cfd3e13): the entry line moved to the last line of scripts/benchmark.mjs. Reproduction test `risk:regression --round 1 --plan run as a process records live checkouts` failed before it ("expected stderr … not to contain 'before initialization'") and passes after; `npx vitest run packages/core/test/benchmark-` → 26 passed. Failed fixes: 0.

## Root cause
scripts/benchmark.mjs:824 declares `const notBench = (r) => r && !r.startsWith('refs/heads/bench/');` after the entry line scripts/benchmark.mjs:814, which calls `main()` synchronously while the module is still evaluating. When the script runs as a process, `main` → `runPlan` (:613) → `liveState` (:830) reads `notBench` while it is still in its temporal dead zone and throws. The same happens through `--round 1` / `--judge` → `stopOnEscape` (:861) → `liveState`, and through `onLiveRefs` (:845). In each case it happens before anything is written to the bench root. `notBench` is the only top-level `const`/`let`/`class` after :814; all its users route through this one declaration. Unit tests import the module, so they never reach main() during evaluation and cannot see the bug. Evidence: probe copies a and b differ in only that one line's position; a throws and b passes.

## Resolved
Root cause: `const notBench` was declared after the entry line that runs main() while scripts/benchmark.mjs loads; fixed in cfd3e13 by moving the entry line to the end of the file.
