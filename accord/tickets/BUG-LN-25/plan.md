---
baseline: 0a8181c266beb36a1d7cd8d19a9f0782a1bbdd43
plan_hash: "fnv1a64:a58b231e6315a606"
---

Review mode `outcome`: one branch, no slices. Every task below can be finished from its own section, this
preamble, the ticket (its `## Approach` and Decisions D-01 to D-18) and its ledger.

Order. Task 1 writes the failing reproduction of the bug, a hand-edited panel copy that `accord gate done` does
not scan (@ac-1), then removes the four-folder skip from core and adds the exact-path `exempt` option (@ac-2).
Task 2 builds the CLI helper that decides which changed copies are exempt and wires it into all five call sites
(@ac-3). Task 3 adds the `agent-config` default pattern (@ac-4).

Rules for every task:
- Test ids. Every test this plan adds is a top-level `it(...)` with no `describe` around it. A report id is the
  file path from the repository root, `#`, then the title with each whitespace run turned into `-`. No new title
  holds `@`, a comma or an apostrophe. No existing test is renamed or removed; where a task changes an existing
  test it changes the body only.
- CLI tests read the built core: run `npm run build` before any CLI test. After an edit under
  `packages/core/templates/`, run `npm run gen`, then `npm run build`; `packages/core/src/generated/` is never
  edited by hand.
- A CLI test that commits uses `commitMsg` from `packages/cli/test/helpers/repo.ts`, never `-m`
  (`accord/product/conventions.md:6`), and passes `180_000` as the third argument of `it`, as the tests in
  `packages/cli/test/security-gate.test.ts` do.
- `packages/cli/test/security-gate.test.ts` mocks the CLI version to 0.7.0 (`:15-18`); `renderedFiles`
  (`packages/cli/src/commands/branch-fact.ts:10`) reads the same mocked `package.json`, so a `skills sync` run in
  that file renders the 0.7.0 copies. Its fixtures pin `runtimes: [claude]` (`test/helpers/lane.ts:45`), so
  `pluginTargets` renders the five `.claude/accord-panel/` files.
- Git reads reuse `gitFilesAt` (`packages/cli/src/load/fs.ts:1548`); no new git command is added.
- Commits follow `accord/product/conventions.md`. End every task with `npm run lint` and `npm run typecheck`,
  then the test command the brief prints.

## Task 1: Scan the copy folders except an exact exempt list

covers: @ac-1, @ac-2, D-01, D-04, D-06, D-15, D-18
files: packages/cli/test/security-gate.test.ts, packages/core/src/security/match.ts, packages/core/test/security.test.ts
verify: packages/cli/test/security-gate.test.ts#ac-1-gate-done-scans-a-hand-edited-accord-panel-copy-on-real-git-(BUG-LN-25) (@ac-1), packages/core/test/security.test.ts#ac-2-a-file-accord-does-not-write-in-a-copy-folder-is-scanned-(BUG-LN-25) (@ac-2), packages/core/test/security.test.ts#risk:parsing-the-trigger-reader-places-every-diff-spelling-(ST-LN-36-36-ac-1)
after: none

Test written first, the bug's reproduction: `ac-1 gate done scans a hand-edited accord panel copy on real git
(BUG-LN-25)` in `packages/cli/test/security-gate.test.ts`. Fixture: a repository claimed under 0.7.0 as the
`claimed` helper builds it (`:33-51`), whose base commit also holds every file `accord skills sync` writes there
(run `skills sync` through the file's `run` helper before the base commit, and commit what it wrote,
`.claude/settings.json` included). The ticket's code commit adds one line `spawnSync('git', ['status']);` at the
end of `.claude/accord-panel/plugin/hooks/register.js` and changes no other file under `.claude/`; review.md
records round 1 at that commit with no `Security:` line. Assert that `gate done T-1 --json` gives one
`gate.security-unreviewed` finding whose reason holds `.claude/accord-panel/plugin/hooks/register.js:<n>: spawn`,
`<n>` being the added line's number in the new file. At the baseline this test fails: the reason names no trigger,
because the folder skip drops the line.

Then, in `packages/core/src/security/match.ts`:
- `OWN_COPIES` (`:175`) goes, and `contentSkipped` (`:214-216`) skips a path for content patterns when it is
  Markdown, a test file, under a `generated` entry, or exactly equal to a path in the `exempt` list. Nothing else
  is skipped by folder; the doc comments at `:214` and `:219-222` say so.
- `securityTriggers` and `matchedHunks` gain the optional `exempt` option below. Absent, nothing is exempt (D-15).
  `matchedHunks` passes it to its inner `securityTriggers` call (`:278`) and to its own `contentSkipped` call
  (`:293`), so the hunks and the triggers agree.

```interfaces
// packages/core/src/security/match.ts (exported unchanged through packages/core/src/index.ts:122, which this task does not edit)
export function securityTriggers(spec: SecuritySpec, diffText: string, changed: readonly string[], options: { generated: readonly string[]; unreadable?: readonly string[]; exempt?: readonly string[] }): Trigger[]
export function matchedHunks(spec: SecuritySpec, diffText: string, changed: readonly string[], options: { generated: readonly string[]; unreadable?: readonly string[]; exempt?: readonly string[]; cap?: number }): string[]
```

Behaviour that must not change: path patterns run over every changed path and both sides of a rename, exempt or
not (an exempt copy is skipped for content patterns only, as the old prefix skip was); Markdown, test files and
`generated` paths stay content-skipped; a changed path the diff text does not show stays a `cannot` trigger;
triggers stay deduplicated and sorted as today; every caller that passes no `exempt` compiles unchanged
(`packages/cli/test/review-package-security.test.ts:374`, `:408`, `:451`).

Core tests in `packages/core/test/security.test.ts`:
- New `ac-2 a file accord does not write in a copy folder is scanned (BUG-LN-25)`: a diff that adds
  `.claude/skills/accord/helper.js` holding `spawn(1);`, read by `securityTriggers(DEFAULT_SECURITY, ...)` with
  `exempt` holding the rendered paths `.claude/skills/accord/SKILL.md` and
  `.claude/accord-panel/plugin/hooks/register.js` but not `helper.js`, gives
  `.claude/skills/accord/helper.js:1: spawn (process spawn)` through `triggerText`; `matchedHunks` with the same
  options prints that hunk. The same diff with `helper.js` itself in `exempt` gives no content trigger and no hunk.
- The existing `risk:parsing the trigger reader places every diff spelling` test (`:188-198`) asserts the bug:
  remove `.claude/skills/accord/x.ts` from its skipped section and its `names` list (`:194`, `:197`), and fix
  the comment at `:188`. Its other assertions stay.

## Task 2: Exempt only the copies whose head text equals the render, at all five call sites

covers: @ac-3, D-06, D-07, D-08, D-09, D-10, D-11, D-16, D-17, D-18
files: packages/cli/src/load/security-facts.ts, packages/cli/src/commands/gate.ts, packages/cli/src/commands/round.ts, packages/cli/src/commands/review-package.ts, packages/cli/src/commands/diff-package.ts, packages/cli/test/security-gate.test.ts
verify: packages/cli/test/security-gate.test.ts#ac-3-copies-freshly-written-by-skills-sync-raise-no-trigger-on-real-git-(BUG-LN-25) (@ac-3), packages/cli/test/security-gate.test.ts#risk:security-only-a-copy-whose-head-text-equals-the-render-is-exempt-and-a-failed-copy-read-fails-closed-(BUG-LN-25)
after: 1

Test written first: `ac-3 copies freshly written by skills sync raise no trigger on real git (BUG-LN-25)` in
`packages/cli/test/security-gate.test.ts`. Fixture, claimed under 0.7.0:
- The base commit holds every file `skills sync` writes under the 0.7.0 CLI, `.claude/settings.json` included,
  except that the five `.claude/accord-panel/` files are replaced by `pluginTargets({ runtimes: ['claude'] },
  { name: <the CLI package's name>, version: '0.6.0' })` from `@accord-dev/accord-core`: the older copies. It also
  holds an `accord/product/security.md` with one team line pattern that matches a line sync rewrites in a `.js`
  copy, for example `- panel-spec: line /accord@[0-9]/ — the package spec the panel runs` under `## Patterns`,
  with empty `## Checklist` and `## Removed` sections. A pattern that matches only `.md` copies proves nothing.
- On the ticket branch, after the claim and plan commits, run `skills sync` and commit what it wrote; review.md
  records round 1 at that commit with `Security: no pattern matched`.
- Assert that no path the round changed under its base lies outside `.claude/skills/`, `.agents/skills/`,
  `.claude/agents/`, `.claude/accord-panel/` and `accord/tickets/T-1/` (round 1 runs from the plan's
  `baseline:`, `packages/cli/src/load/package-diff.ts:20-21`, so it holds the ticket's own files from the plan
  commit on), so `.claude/settings.json` is untouched and `agent-config` of Task 3 cannot fire.
- Assert that `gate done T-1 --json` has no `gate.security-unreviewed` finding; that in process
  `withSecurityFacts(repo, s, 'T-1', () => renderedFiles(config))` gives round 1 no trigger, while
  `withSecurityFacts(repo, s, 'T-1', () => [])` gives round 1 a trigger naming
  `.claude/accord-panel/plugin/hooks/register.js` and `panel-spec` (the fixture is not vacuous); and that the
  `## Security triggers` section of `review-package T-1 --security --round 1` and of
  `diff-package <base> <round 1 head> --security` is `(none: no pattern matched)` (D-08).
  `s` is built as at `:152`.

The helper, in `packages/cli/src/load/security-facts.ts` beside `factsFor`:

```interfaces
// packages/cli/src/load/security-facts.ts
export function exemptCopies(root: string, head: string, changed: readonly string[], rendered: () => readonly SkillFile[]): string[]
export function withSecurityFacts(root: string, snapshot: RepoSnapshot, id: string, rendered: () => readonly SkillFile[]): RepoSnapshot
// packages/cli/src/commands/review-package.ts
export function securitySections(s: RepoSnapshot, diffText: string, changed: string[], full: boolean, at: { root: string; head: string }, unreadable?: string[]): SecuritySections
```

- `exemptCopies` returns, in `changed` order, each changed path that `rendered()` holds whose text at `head`, read
  with one `gitFilesAt(root, head, <those paths>)`, equals the rendered text after `normaliseText` from
  `@accord-dev/accord-core` (D-17, as `packages/cli/src/load/fs.ts:1827` compares). A path absent at `head` (a
  deleted copy) is not exempt (D-11); a copy that differs from the running accord's render is not exempt, and the
  marker hash is never read (D-06, D-09). It calls `rendered` and starts a git process only when some changed path
  starts with `.claude/` or `.agents/`, the two roots every path `renderedFiles` returns lies under (ledger
  deferred approach 1.2); otherwise it returns `[]`. A git failure throws, as `gitFilesAt` does.
- `factsFor` takes the getter from `withSecurityFacts`, calls it at most once per command, and passes
  `exempt: exemptCopies(root, r.head, pkg.changed, getter)` at `:83`, each round read at its own head (D-07),
  inside the existing `try`, so a failed read is an `error` fact (D-10).
- `gate.ts:67` and `round.ts:42` pass `() => (config === undefined ? [] : renderedFiles(config))` with
  `config = ctx.snapshot.config` and `renderedFiles` from `./branch-fact.js` (D-16).
- `securitySections` computes the exempt list inside its `try` (ledger deferred approach 1.1), with the getter
  built from `s.config` the same way, and passes `exempt` to both `securityTriggers` and `matchedHunks`; a failed
  read prints `(cannot tell: …)` in all three sections, as any failure there does today. Its callers pass
  `at`: `review-package.ts:80` `{ root: ctx.root, head: at.head }`; `:237` and `:240`
  `{ root: ctx.root, head: 'HEAD' }`; `diff-package.ts:57` `{ root: ctx.root, head: headSha }` (D-07, D-08).
- `security-gate.test.ts:153` and `:160` pass `() => []` as the new argument; their assertions stay.

Behaviour that must not change: a ticket claimed before 0.7.0, without lane, without a version 2 round, or with
review checks skipped still gets its snapshot back with no git process (`:144-175` asserts it); round ranges and
the D-10 final-review exemption are as today; review-package and diff-package print the same layout, and
diff-package without `--security` runs nothing new; a package that changes no path under `.claude/` or
`.agents/` starts no extra git process.

Then `risk:security only a copy whose head text equals the render is exempt and a failed copy read fails closed
(BUG-LN-25)` in the same file, on one real repository: with a rendered list of three paths, a commit holds path
one with its rendered text in CRLF (exempt), path two edited (not exempt), path three deleted (not exempt), and a
changed `src/a.js` that is not rendered (not exempt); `exemptCopies` returns path one alone. With a changed list
holding no path under `.claude/` or `.agents/`, it returns `[]`, never calls the getter and starts no git process
(`countedSync`). `securitySections` over a changed rendered path with `at.root` a fresh temporary folder that is not
a git repository (so `git cat-file` fails; a `head` naming no commit would only read as missing) prints
`(cannot tell:` in all three sections. On a `claimed` fixture whose code commit changes a `.claude/` path,
`withSecurityFacts` with a getter that throws gives the fact `{ error: <the thrown message> }`.

## Task 3: Add the agent-config default pattern

covers: @ac-4, D-02, D-03, D-05, D-12, D-13, D-14, D-18
files: packages/core/templates/security.md, packages/core/src/generated/templates.ts, packages/core/test/security.test.ts
verify: packages/core/test/security.test.ts#ac-4-a-change-to-agent-configuration-raises-agent-config-under-a-team-security-file-(BUG-LN-25) (@ac-4), packages/core/test/security.test.ts#risk:parsing-the-default-security-file-reads-into-seven-patterns-and-eight-checklist-items-(ST-LN-36-36-ac-1)
after: 2

Test written first: `ac-4 a change to agent configuration raises agent-config under a team security file
(BUG-LN-25)` in `packages/core/test/security.test.ts`. The spec is `securitySpec(withFile(<team file>))` with a
team `accord/product/security.md` that never names agent configuration: the `OWN_FILE` form of
`packages/cli/test/review-package-security.test.ts:138-151` (`# Security review`, `## Patterns` holding
`- infra: path infra/ — infrastructure`, empty `## Checklist` and `## Removed`). Diffs built with `SECTION`
(`:82-88`), each file's lines holding no text a default line pattern matches:
- `.claude/settings.json` added (`new file mode`, `--- /dev/null`), edited, and deleted (`deleted file mode`,
  `+++ /dev/null`): each gives the trigger `.claude/settings.json: agent-config (agent configuration that can start
  commands)` through `triggerText`.
- `.mcp.json` and `sub/.mcp.json` added: each gives `agent-config` for its path.
- `sub/.claude/settings.json` added gives no `agent-config` trigger (D-05: the root file only).
Also assert, on the same team file: a `- Removed: agent-config — <reason>` line under `## Removed` takes the
pattern out with no problem (D-12); a team line `- agent-config: path other.json — x` is one problem and the
default still applies (D-14); the checklist ids stay the eight defaults (D-13).

Then add to `packages/core/templates/security.md`, directly before the `security-config` line (`:13`), the line
`- agent-config: path .claude/settings.json, .mcp.json — agent configuration that can start commands`, and run
`npm run gen` to regenerate `packages/core/src/generated/templates.ts`. No code changes: `pathMatches`
(`packages/core/src/security/match.ts:184-186`) reads an entry with a `/` as one exact path and a bare file name
at any depth, path patterns run over both sides of every changed path, and `mergeSecurity` starts from
`DEFAULT_SECURITY`.

Update the default id lists in `packages/core/test/security.test.ts` (bodies only, no test renamed):
`DEFAULT_IDS` (`:8`) gains `agent-config` before `security-config`; the lists at `:259` and `:301` gain it in the
same place, and the comments at `:258` say eight defaults. The test at `:55` keeps its title (its id is a report
id) and checks the new list through `DEFAULT_IDS`.

Behaviour that must not change: every other template line, its order and its checklist; `security-config` stays
last of the patterns and cannot be removed; the drift guard
`packages/core/test/templates.test.ts:130-136` passes after `npm run gen`; `init` still writes the template
verbatim (`packages/core/test/scaffold.test.ts:97-98`, `packages/cli/test/init.test.ts:164`). A package that
changes `.claude/settings.json` now has an `agent-config` trigger (D-02); the CLI tests found that change it and run
`gate done` read other rules only (`packages/cli/test/branch-fact.test.ts:148-181`), so this task edits no other
test file, and a test that fails for that reason is named in the task report, not edited.

## Failure modes

- A round synced while `accord/config.yml` named other runtimes or roles than it does at `gate done`: its copies
  are compared with today's render, so they are scanned and can ask for a security review that nothing changed
  (fail closed). Owner: Task 2.
- A new runtime whose copies lie outside `.claude/` and `.agents/`: `exemptCopies` never renders for it,
  so its freshly synced copies are scanned and can raise triggers (fail closed). Owner: Task 2.
- A repository that commits test fixtures holding `.mcp.json` files: every edit of such a fixture calls the
  security reviewer, since `.mcp.json` matches at any depth (D-05) until the team removes the default. Owner:
  Task 3.
