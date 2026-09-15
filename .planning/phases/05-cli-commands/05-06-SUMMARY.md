---
phase: 05
plan: 06
subsystem: cli
tags: [cli, tracker, github-issues, status, independence, INTG-01, CLI-05]
status: complete

requires:
  - "packages/cli/src/render/table.ts (05-04): the trackerCells parameter of renderRows and EMPTY_CELL — this plan is its first caller"
  - "packages/cli/src/commands/status.ts (05-04): the archived filter and the --json path"
  - "packages/cli/src/run.ts (05-01): RunOptions.env, CommandContext, the shared preflight, the exit-code map"
  - "packages/core/src/status/rows.ts (05-02): StatusRow.tracker, the adapter-keyed id map"
  - "packages/cli/test/helpers/repo.ts (05-01): makeRepo, run, cleanup"
provides:
  - "fetchIssues(repo, numbers, env, fetchImpl?) — the read-only github-issues adapter"
  - "IssueFacts { title, state, labels } — sanitised, single-line ASCII"
  - "status enrichment: one tracker cell per linked row, on the text path only"
  - "packages/cli/test/tracker.test.ts — the independence guard that goes red if tracker data ever reaches a verdict"
affects:
  - "Phase 8 MCP host: the adapter is CLI-only (it spawns gh and reads the environment); a second host needs its own token source or none at all"
  - "Phase 7 init writes config.yml with tracker.adapter; adapter none stays fully usable and costs no request"

tech-stack:
  added: []
  patterns:
    - "Node 22 global fetch with a fetchImpl default parameter as the only test seam — no HTTP client, no octokit, no dependency"
    - "the environment arrives as a typed NodeJS.ProcessEnv parameter, so the module's only route to it is visible in its signature; process.env is never read"
    - "failure is a return value (a warning string), never an exception: the function's type says it cannot change an exit code"
    - "vi.mock('node:child_process') with importOriginal, intercepting only `gh` so the real `git` the loader needs keeps working"

key-files:
  created:
    - packages/cli/src/tracker/github-issues.ts
    - packages/cli/test/tracker.test.ts
  modified:
    - packages/cli/src/commands/status.ts
    - packages/cli/src/run.ts
    - packages/cli/test/helpers/repo.ts

decisions:
  - "Under --json no request is issued at all, not merely discarded: D-98 makes stdout the core array verbatim, so enrichment is a rendering concern and the whole fetch lives after the --json early return. A consequence worth naming: `status --json` never prints a tracker warning either, because it never asked"
  - "A row that declares a github-issues id but could not be read renders EMPTY_CELL explicitly, rather than falling through to its own flattened tracker map. Otherwise a failed fetch and a successful one would be indistinguishable from the cell alone, which is exactly what D-100 forbids"
  - "The gate-invariance case performs one warm-up `gate ready` before comparing the two runs. A passing Ready writes ac_hash into the ticket (D-96) and shifts every line number below it, so without the warm-up the case would measure accord's own write rather than the tracker's influence — it failed for that reason on first run"
  - "The invariance case asserts something stronger than equal results: that the injected fetch recorded zero calls during a gate or lint run. Equality could in principle hold by coincidence; zero calls cannot"
  - "numbers is readonly string[] (the frontmatter signature), not number[] (the prose in the task action). Ticket tracker values are strings by schema, and converting to a number and back would lose a leading zero for nothing"
  - "One warning line combines every per-issue failure and the no-token note, so D-100's 'one line on stderr' holds when several things are wrong at once"

metrics:
  duration: 9 min
  completed: 2026-09-15

actuals:
  tokens: 13200
  tasks: 3
  commits: 0
  plan_head_before: 97a7977174efa56e1d98594355d15a46af50a8b9
---

# Phase 5 Plan 6: `github-issues` Adapter Summary

A read-only tracker adapter that enriches `accord status` with issue title, state, and labels, and a
test suite whose real subject is the opposite: that nothing accord decides depends on it.

## What Was Built

**`packages/cli/src/tracker/github-issues.ts`** — `fetchIssues(repo, numbers, env, fetchImpl = fetch)`.
Token lookup is `env.GITHUB_TOKEN` when non-empty, otherwise `execFileSync('gh', ['auth', 'token'])`
with a literal argument array and no shell; every failure of that spawn, ENOENT included, returns
`undefined` and is never rethrown (D-102). One `GET /repos/{repo}/issues/{n}` per entry, in parallel,
no list endpoint and no pagination (D-101). Only `title`, `state`, and `labels[].name` are read from a
response body, each reduced to printable ASCII on one line with whitespace collapsed (T-05-19). The
function never rejects: a 404, a rejected fetch, an exhausted rate limit, or a body that is not an
issue omits that one number and contributes to a single warning string returned alongside (D-100).
No dependency was added — `fetch` is the Node 22 global.

**`packages/cli/src/commands/status.ts`** — a `trackerCells` helper, called after the archived filter
and after the `--json` early return, guarded on both `tracker.adapter === 'github-issues'` and the
presence of `tracker.repo`. It fills the `trackerCells` parameter `renderRows` has accepted since
05-04 and had no caller for: `#<n> <state> <title> <labels,joined>` for a row whose issue was read,
`EMPTY_CELL` for a row whose issue failed, and no entry at all for a row that declares no id — which
keeps that row's own flattened tracker map. The warning, when present, is one line on `ctx.stderr`;
the return value is untouched.

**`packages/cli/src/run.ts`** — the `status` action is now `async` and awaited. It is the only async
action; `parseAsync` was already in use, so the exit code is still settled before `runCli` returns.

**`packages/cli/test/tracker.test.ts`** — 21 cases, none of which touch the network.

## How It Was Verified

Full toolchain, run from `C:/Work/accord`:

| Command | Result |
|---------|--------|
| `npm test` | **29 files / 706 tests passed** (baseline entering this plan: 28 / 685) |
| `npm run lint` | clean |
| `npm run typecheck` | clean |
| `npm run build` | clean, `dist/cli.js` 19.09 kB |

No pre-existing failure was observed, so none had to be reported or worked around.

**No network in tests.** The unit cases pass `fetchImpl` directly; the `runCli` cases use
`vi.stubGlobal('fetch', …)`. `node:child_process` is mocked with `importOriginal` so that only `gh` is
intercepted — by default it throws `ENOENT`, so a test run never spawns the author's real
`gh auth token`, and `git` stays real because every sandbox is loaded through `git ls-files`. Total
suite duration 4.8 s.

**The independence invariant (ROADMAP criterion 5, D-99).** Two cases:

- `gate ready CLEAN --json` and `gate done CLEAN --json`, over a sandbox whose `config.yml` names the
  adapter and whose ticket declares `github-issues: "7"`, run once with `GITHUB_TOKEN` and `GH_TOKEN`
  set and once with the environment scrubbed. The parsed `GateResult` objects are deeply equal and the
  exit codes match, for both gates.
- `lint --json` over an adapter-free sandbox and an adapter-configured one, likewise deeply equal.

Both additionally assert the injected fetch recorded **zero calls** — no gate and no lint ever reached
the network, which is a stronger statement than equal output.

**Degradation.** Named cases cover: empty list (no request at all), `GITHUB_TOKEN` present (`gh` never
spawned), `gh` supplying a token, empty `GITHUB_TOKEN` treated as unset, `gh` absent via ENOENT
(unauthenticated request plus a warning), non-ok status, rejected fetch, malformed body, every request
failing, and a hostile title containing a newline, a carriage return, an escape, and non-ASCII
characters. In every case `status` still printed its full table and still exited 0, with exactly one
line on stderr.

**Ordering (D-101).** The same scenario is run twice — once with a fetch that resolves immediately,
once with staggered delays that resolve `#9` before `#7` — and the two captured stdout strings are
asserted byte-identical.

**Token secrecy (T-05-17).** Asserted at both levels: the returned warning contains no substring of
either the `GITHUB_TOKEN` value or the `gh` output, and a full `status` run with a token in the
environment writes no part of it to stdout or stderr.

**Spawn surface (CLI-07).** The new `execFileSync('gh', ['auth', 'token'], …)` site is admitted by the
existing 05-01 allowlist, which permits exactly `git` and `gh` as string literals with no `shell`
option. The backslash loop over `lint`, `gate ready`, `gate done`, `status`, and `new ticket` still
passes on this host.

## Deviations from Plan

**1. [Rule 3 — blocking] `run()` in the test helper hardcoded `env: {}`.**
The invariance and token-secrecy cases need to pass an environment into `runCli`. Added an optional
third parameter `env: NodeJS.ProcessEnv = {}` to `packages/cli/test/helpers/repo.ts`; every existing
call site is unchanged and keeps the same behaviour. Test-only.

**2. Signature: `numbers: readonly string[]`, not `number[]`.**
The plan's `artifacts_this_phase_produces` block and its `must_haves` say `readonly string[]`; the
prose inside Task 1's `<action>` says `number[]`. Took the frontmatter, which agrees with the ticket
schema (tracker values are strings, `minLength: 1`).

**3. The `runCli` cases stub the global `fetch` rather than injecting `fetchImpl` through the command.**
Task 3 asks that every case inject a fetch. Threading a `fetchImpl` from `RunOptions` through
`CommandContext` into `status` would add a production seam that exists only for tests, for a file
whose one seam the plan explicitly names as `fetchImpl`'s default parameter. `vi.stubGlobal` gives the
same guarantee — no case reaches the network — with no production change. The unit cases still inject
`fetchImpl` directly.

## Findings / assumptions needing a decision

None of these blocked the work; each is the most defensible reading of a behaviour the plan does not
specify, recorded here rather than silently assumed.

**F-1. No request timeout.** `fetch`'s default applies, which on Node is effectively none. The threat
register already accepts the unbounded `Promise.all` as T-05-21 at pilot scale, but a hung connection
to `api.github.com` will hang `accord status` indefinitely rather than degrade. **Assumed:** no
timeout, matching T-05-21's acceptance and the "no retry policy, no config knobs" instruction.
**Alternative:** an `AbortSignal.timeout(5000)` per request, roughly three lines, turning a hang into
an ordinary D-100 degradation. Worth a decision before the adapter meets a real network.

**F-2. Partial results are shown, not suppressed.** When some issues resolve and others do not, the
resolved rows render their facts and the failed rows render the empty cell. **Assumed:** show what was
obtained — D-101 says explicitly that one failed request damages one row rather than the table.
**Alternative (rejected):** all-or-nothing, which would make one 404 erase every other row's
enrichment.

**F-3. An issue nobody references is never fetched, and an id nothing matches is never noticed.**
Numbers come only from visible rows, so there is no notion of an "extra" issue. A ticket declaring
`github-issues: "999"` where no such issue exists is simply a 404 — one warning line, one empty cell.
**Assumed:** that is correct and needs no separate rule; a tracker id that points nowhere is a ticket
problem, and lint owns ticket problems.

**F-4. A duplicate id across two tickets costs one request, and both rows render it.** The numbers are
de-duplicated before the fetch. **Assumed:** obviously right; recorded because it is unstated.

**F-5. The no-token warning fires even when every request succeeded.** An unauthenticated run against
a public repository works, and still prints `no GitHub token found`. **Assumed:** audible is better
than silent — D-100's whole point is that the user can tell why enrichment is thin, and the
unauthenticated rate limit (60/hour) is the thing they will hit next. **Alternative:** warn only when
something actually failed.

**F-6. The tracker column budget is 32 characters.** A long issue title truncates with `...`, the
existing 05-04 `fit` behaviour. Not widened — the column count is a 05-04 decision and widening it
would move the status golden.

## Known Stubs

None.

## Threat Flags

None. The surface this plan introduces — outbound HTTPS GET, the `gh` spawn, and untrusted response
text reaching a terminal — is exactly what `<threat_model>` T-05-17 through T-05-21 already registers,
and each `mitigate` disposition has an assertion in `tracker.test.ts`.

## Commits

**Uncommitted (project policy).** `.claude/CLAUDE.md` forbids committing without explicit approval, so
every file above is left in the working tree for review. `HEAD` is unchanged at
`97a7977174efa56e1d98594355d15a46af50a8b9`.

## Self-Check

- `packages/cli/src/tracker/github-issues.ts` — FOUND
- `packages/cli/test/tracker.test.ts` — FOUND
- `packages/cli/src/commands/status.ts` — FOUND (modified)
- `packages/cli/src/run.ts` — FOUND (modified)
- `packages/cli/test/helpers/repo.ts` — FOUND (modified)
- Commits — none expected, none made; `git rev-parse HEAD` returns `97a7977…`

## Self-Check: PASSED
