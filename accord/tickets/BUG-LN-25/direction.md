# Direction: BUG-LN-25

Baseline read: the worktree at `t/BUG-LN-25` (f753cf63). D-06 to D-18 settle the shape. This report lists what the change must reach and puts the lightest working option first.

## Impact list

Core (pure):
- `packages/core/src/security/match.ts:175`: `OWN_COPIES`, the four-folder prefix list. It goes (D-06).
- `packages/core/src/security/match.ts:214-216`: `contentSkipped` and its doc line. Remove the prefix test and add an exact-path test against the new exempt list. Markdown, test files and `generated` stay skipped.
- `packages/core/src/security/match.ts:219-223`: the doc comment and signature of `securityTriggers`. `options` gains an optional exact-path exempt list. Nothing is exempt when the list is absent (D-15).
- `packages/core/src/security/match.ts:240`: `skipped` must pass the exempt list to `contentSkipped`.
- `packages/core/src/security/match.ts:276-278`: the signature of `matchedHunks`, which must forward the exempt list to its inner `securityTriggers` call.
- `packages/core/src/security/match.ts:293`: the second `contentSkipped` call, inside `matchedHunks`, which must use the same list so the hunks and the triggers agree.
- `packages/core/src/index.ts:122`: the export line. It needs no change because the options type is inline. This file is a `sensitive:` entry (`accord/config.yml:52`), so leaving it alone keeps the ticket off that area.
- `packages/core/templates/security.md:7-13`: the default pattern list. Add one path line, for example `- agent-config: path .claude/settings.json, .mcp.json — agent configuration that can start commands`. `pathMatches` (`match.ts:184-186`) and `matches` (`packages/core/src/gate/scope.ts:32`) already give the readings D-05 wants: an entry with a `/` is one exact path, so `.claude/settings.json` matches at the root only, and a bare `.mcp.json` matches at any depth. Path patterns run over `changed` plus both sides the diff shows (`match.ts:236`), so an add, an edit and a delete all match. `mergeSecurity` (`packages/core/src/security/spec.ts:180-222`) starts from `DEFAULT_SECURITY`, so a team file that does not name `agent-config` still gets it (ac-4). A `Removed:` line takes it out (D-12, since `UNREMOVABLE` at `spec.ts:163` is `security-config` alone), and a team line with the same id but another value is a lint problem while the default applies (D-14, `spec.ts:190-191`). Neither needs new code.
- `packages/core/src/generated/templates.ts`: generated, never edited by hand. It is the `"security.md"` entry of the object that `packages/core/scripts/gen-templates.mjs:1-19` writes from `packages/core/templates/*.{md,html}`, with CRLF and BOM removed. Regenerate it with `npm run gen` from the repository root (`package.json:8`, which runs gen-templates first). `DEFAULT_SECURITY` is parsed from it (`spec.ts:157`). The drift guard `packages/core/test/templates.test.ts:130-136` fails until it is regenerated. The folder is under `generated:` (`accord/config.yml:60`), so the security scan does not read it.

CLI (host):
- `packages/cli/src/commands/branch-fact.ts:10-12`: `renderedFiles(config)`, the one definition of what sync writes (D-16). Reused, unchanged.
- `packages/cli/src/load/fs.ts:1548-1557`: `gitFilesAt(root, ref, paths)`, which reads texts with one `cat-file --batch` over stdin and leaves a missing path out. Reused for the head-text read. A git failure throws a `UsageError`. `fs.ts:1826-1827` already compares in the D-17 form, `normaliseText(head) === r.text`, for the branch fact.
- `packages/cli/src/load/security-facts.ts:67-89` (`factsFor`) and `:97-103` (`withSecurityFacts`). `withSecurityFacts` takes the rendered files from its callers (D-16). For each round it reads, at that round's own head `r.head` (D-07), the text of each `pkg.changed` path that the rendered files hold. It passes the paths whose text equals the render as the exempt list at `:83`. A failed read throws inside the `try`, and the existing `catch` at `:86-88` turns it into an `error` fact (D-10). A deleted copy has no head text, so it is not exempt (D-11). A copy that differs from the running accord's render is not exempt either (D-09).
- `packages/cli/src/commands/gate.ts:67` and `packages/cli/src/commands/round.ts:42`: the two callers of `withSecurityFacts`. Each passes `renderedFiles(config)`, or `[]` when there is no config (D-08, D-16).
- `packages/cli/src/commands/review-package.ts:27-46`: `securitySections`. It needs the exempt list for `securityTriggers` at `:31` and for `matchedHunks` at `:40`. Its `catch` at `:42-45` already turns any failure into `(cannot tell: …)` in all three sections. Its three callers read at their own head:
  - `:80`, for `--security --round k`, reads at `at.head`.
  - `:237`, for `--security`, reads at `HEAD`.
  - `:240`, the plain package's triggers, reads at `HEAD`.
- `packages/cli/src/commands/diff-package.ts:57`: the fifth caller, which reads at `headSha`. The file has no ticket, but it has `ctx.snapshot.config`, so `renderedFiles` applies.

Tests:
- `packages/core/test/security.test.ts:188-198`: this test asserts that `.claude/skills/accord/x.ts` is skipped (`:194`, `:197`), which is the bug. It must drop that path, or assert the path is scanned, as the ac-2 test does.
- `packages/core/test/security.test.ts:8` (`DEFAULT_IDS`), `:55` (the test name says "seven patterns"), `:258-259` and `:301`: these list the default ids in order and gain `agent-config`.
- `packages/core/test/security.test.ts`: new tests for ac-2 (`securityTriggers` with an exempt list that lacks the path) and ac-4 (a team `security.md` without `agent-config`, and diffs that add, edit and delete `.claude/settings.json` and add `sub/.mcp.json`), as D-18 says.
- `packages/cli/test/security-gate.test.ts`: new real-git tests for ac-1 and ac-3 (D-18). The helper `claimed` (`:33-51`) and the pinned config `test/helpers/lane.ts:45` (`runtimes: [claude]`) mean `pluginTargets` renders the five `.claude/accord-panel/` files. The file mocks the CLI version to 0.7.0 (`:15-18`), and `renderedFiles` reads the same mocked `package.json`.
- `packages/cli/test/security-gate.test.ts:153` and `:160` call `withSecurityFacts(repo, s, 'T-1')` directly. They must pass the rendered files if the parameter is required.
- `packages/cli/test/review-package-security.test.ts:374`, `:408` and `:451` call `securityTriggers` with `{ generated: [] }`. They still compile because the option is optional, so no change is needed.

Not reached, checked:
- `packages/core/skills/review/security.md` does not restate the skip rule (scout).
- `packages/cli/src/commands/scout.ts:62` uses `renderedFiles` for something else and is unchanged.
- `RETIRED_FILES` (`packages/core/src/skills/agents.ts:32-35`) are all `.md`, and Markdown is content-skipped anyway (`match.ts:173`), so D-11's "not on the retired list" changes no trigger today.
- `.claude/settings.json` is not in `renderedFiles` (`branch-fact.ts:9`), so a sync edit to it still raises `agent-config` (D-02, D-05).
- `packages/core/src/index.ts` needs no change.

## Options

### Option 1: Exact-path exempt list, read per package with the existing reader. Recommended.
- What it does:
  - Core: `contentSkipped` drops the prefix list and skips a path only when it is in the optional `exempt` list.
  - CLI: one small helper beside `factsFor` takes a root, a head, the changed paths and the rendered files. It returns the changed rendered paths whose head text, after `normaliseText`, equals the render. It reads them with `gitFilesAt` and starts no git process when no changed path is rendered. All five call sites use it.
  - Template: one default line, then `npm run gen`.
- Rung: minimum new code over the readers already in the repository (`renderedFiles`, `gitFilesAt`, `normaliseText`, the `catch` blocks already in `factsFor` and `securitySections`).
- Cost: about 15 lines in core, about 40 in the CLI across 6 files, one template line plus the regenerated file, and 4 new tests plus 4 updated assertions. This fits D-04's 3 tasks:
  1. The failing ac-1 reproduction, the core option and the prefix removal, with ac-2 in core.
  2. The CLI helper and the five call sites, with ac-3.
  3. The template line and regeneration, with ac-4.
- Risk: one extra `cat-file` per package that touches a rendered copy, at most one per recorded round in gate done and accord round. A round made with an older accord that changed a copy is now scanned (D-09). That is intended, but it can add a trigger to a ticket in flight that synced in an earlier round.
- Serves: @ac-1, @ac-2 and @ac-3, through the exact-path exemption (D-06, D-07, D-08, D-09, D-10, D-11, D-15, D-16, D-17), and @ac-4 through the template line (D-02, D-05, D-12, D-13, D-14).

### Option 2: The same, but gate done reads every round's copy texts in one batch
- What it does: everything in Option 1. In addition, `factsFor` first gathers the `(r.head, path)` pairs of every round and reads them with one `catBatch` before it scans, in the way the branch fact already batches its reads (`fs.ts:1775-1800`).
- Rung: an added layer over Option 1, serving one named constraint: the number of git processes on `gate done` and `accord round` (ST-LN-63's one-batch pattern).
- Cost: about 20 more lines in `security-facts.ts`, plus a spawn-count test (`risk:regression`) to hold it.
- Risk: the batch must be built after every round's `packageDiff`, so the scan loop becomes two passes. A mistake there exempts one round's path at another round's head and breaks D-07.
- Serves: no criterion. It only lowers the number of git processes, and a ticket has few rounds.

Recommended: Option 1. It meets every criterion and Decision with the least new code. Option 2's batch saves at most one git process per round, and the extra pass would add a way to break D-07.

## Failure scenarios

None are required. The ticket does not touch auth, money, migration or data deletion: it changes which lines the security scan reads, and the gate stays fail-closed (D-09, D-10, D-11).

## Notes for the plan

- The ac-3 fixture must already hold the `.claude/settings.json` that sync would write. Otherwise sync edits that file, `agent-config` fires (D-05), and the change is no longer "only the files sync rewrote".
- The team line pattern in that fixture (D-18) must match a line that sync rewrites in a `.js` or `.json` copy, for example the version stamped into `plugin.json` or `register.js` (`packages/core/src/skills/plugin.ts:26,30`). A pattern that matches only `.md` copies proves nothing, because Markdown is skipped anyway.
- The "older copies" can be written in the fixture with `pluginTargets(config, { name, version: '0.6.0' })` from core. The test's `skills sync` then renders 0.7.0.
- The exemption covers content patterns only, as the old prefix skip did (`match.ts:216`). A team path pattern over a copy folder still fires on a synced copy. Neither the criteria nor the Decisions ask otherwise.
- The package diff can be a per-commit log (`git log -p`), not a single diff. A copy hand-edited in one commit and restored by sync in a later commit equals the render at the head and is exempt. What an agent loads at that head is accord's own text.
- Under review mode `human`, task 1 alone leaves synced `.js` and `.json` copies scanned until task 2 lands. Tasks 1 and 2 belong in one slice.

Rulings:
- Ruling: `docs/releases.md` gets no entry in this ticket — no criterion asks for one, and the release PR writes the notes — if wrong, the release notes miss the behaviour change and someone adds one bullet later.
- Ruling: the new default goes before `security-config` in the template, so `security-config` stays last — the order is cosmetic, and only the id lists in `security.test.ts` depend on it — if wrong, those lists are reordered.

Skipped: I ran nothing and did not check the spawn counts of `review-package` and `diff-package` against any existing test. Risk: one test outside the files read here may count git processes on a fixture that changes a rendered copy.
