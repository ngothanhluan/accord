---
baseline: 3be1c058edab354ab449e75c966f0c6797dd4813
plan_hash: "fnv1a64:b6b59b166d5a957e"
---

Review mode `outcome`: one branch, no slices. Report case ids follow the JUnit id shape in
`packages/core/src/load/junit.ts`: `<classname>#<name>` with each whitespace run turned into `-`, and a
`describe` adding `<describe>->-` in front. Every new test below is a top-level `it(...)` with no `describe`
wrapper, whose name starts with its criterion (`ac-n`) when its verify id maps a scenario and otherwise with
`risk:<kind>`, the kind from the reviewer's list. No test name holds `@` or a comma. CLI tests import core from
`packages/core/dist`, so every task that changes core source runs `npm run build -w packages/core` before a CLI
test, and every task ends with `npm run build`.

Names used throughout: the id convention is on when `config.people` is defined (D-08) and off otherwise. The
prefix of a type is fixed (D-09, owner correction of 2026-10-14): story `ST`, bug `BUG`, epic `EP`. An id under
the convention matches `^(ST|BUG|EP)-[A-Z]{2,4}-[1-9][0-9]*$` (D-15, ledger Ruling on `[1-9][0-9]*`). Emails
compare case-insensitively (ledger Ruling).

## Task 1: Wiring: new ticket assigns the creator's next id from refs already in the clone
covers: @ac-1, D-01, D-04, D-05, D-08, D-09, D-10, D-11, D-14, D-15
files: packages/core/schemas/config.schema.json, packages/core/src/model/snapshot.ts, packages/core/src/lint/ids.ts (new), packages/core/src/index.ts, packages/cli/src/load/fs.ts, packages/cli/src/commands/new-ticket.ts, packages/cli/src/run.ts, packages/core/test/schemas.test.ts, packages/cli/test/new-ticket.test.ts
verify: packages/cli/test/new-ticket.test.ts#ac-1-new-ticket-assigns-the-creators-next-number-for-its-type (@ac-1), packages/cli/test/new-ticket.test.ts#risk:complex-branching-without-people-and-without-an-id-new-ticket-exits-2-and-writes-nothing, packages/cli/test/new-ticket.test.ts#risk:complex-branching-the-first-ticket-in-a-repository-with-no-commit-gets-number-1, packages/core/test/schemas.test.ts#risk:parsing-people-maps-an-email-to-2-to-4-capital-letters, packages/core/test/schemas.test.ts#risk:parsing-legacy_ids-is-a-list-of-distinct-ticket-ids

Tests first.
- `packages/cli/test/new-ticket.test.ts`, top-level
  `it('ac-1 new ticket assigns the creators next number for its type')`. `sandbox()` (valid-build). Append to
  `accord/config.yml` the lines `people:` and `  "an@example.com": AN`. With `writeFiles` from
  `./helpers/repo.js`, write `accord/tickets/ST-AN-1.md` as `laneTicket('ST-AN-1')` and
  `accord/tickets/ST-LN-9.md` as `laneTicket('ST-LN-9')` (`laneTicket` from `../../../test/helpers/lane.js`).
  `commitAll(repo)`; `gitRun(repo, 'update-ref', 'refs/remotes/origin/t/ST-AN-3', 'HEAD')`;
  `gitRun(repo, 'remote', 'add', 'origin', 'https://unreachable.invalid/accord.git')`;
  `gitRun(repo, 'config', 'user.email', 'an@example.com')`. Run `['new', 'ticket', '--type', 'story']`: code 0,
  stdout exactly `accord/tickets/ST-AN-4.md\n`, the file exists, holds `id: "ST-AN-4"` and a `type:` line
  containing `"story"`, and no `ST-AN-2.md` exists.
- `packages/cli/test/new-ticket.test.ts`, top-level
  `it('risk:complex-branching without people and without an id new ticket exits 2 and writes nothing')`:
  valid-build as copied, `['new', 'ticket']` exits 2, stderr names that an id is required, and `listing(repo)` is
  unchanged (no `undefined.md`; ledger Ruling).
- `packages/cli/test/new-ticket.test.ts`, top-level
  `it('risk:complex-branching the first ticket in a repository with no commit gets number 1')`:
  `makeEmptyRepo()` from `./helpers/repo.js` (push it onto `repos` for cleanup), `writeFiles` with
  `accord/config.yml` as `CONFIG` from `../../../test/helpers/lane.js` plus `people:` /
  `  "an@example.com": AN`, `gitRun(repo, 'config', 'user.email', 'an@example.com')`, no commit. Run
  `['new', 'ticket', '--type', 'story']`: code 0, stdout `accord/tickets/ST-AN-1.md\n`, the file exists. Once
  Task 3 lands, the same case also covers its ref read on an unborn HEAD.
- `packages/core/test/schemas.test.ts`, top-level, using its `minimal.config` and `has` helpers:
  - `risk:parsing people maps an email to 2 to 4 capital letters`: `{ 'an@example.com': 'AN' }`,
    `{ 'an@example.com': 'ABCD' }` and `{}` are valid; values `'A'`, `'ABCDE'`, `'an'`, `'A1'` each give a
    `schema.pattern` finding at `/people/an@example.com`; a key `'not-an-email'` gives a finding at `/people`.
  - `risk:parsing legacy_ids is a list of distinct ticket ids`: `['SHOW-1', 'ASK-1']` is valid; `['SHOW-1',
    'SHOW-1']` gives `schema.uniqueItems` at `/legacy_ids`; `['a b']` gives `schema.pattern` at `/legacy_ids/0`.

Interface:
- `config.schema.json`, two optional properties appended after `stale_days`:
  `people`: `{ "type": "object", "propertyNames": { "pattern": "^[^@\\s]+@[^@\\s]+$" },
  "additionalProperties": { "type": "string", "pattern": "^[A-Z]{2,4}$" } }` (D-14, D-15);
  `legacy_ids`: `{ "type": "array", "uniqueItems": true, "items": { "type": "string", "pattern":
  "^[A-Za-z0-9][A-Za-z0-9._-]*$" } }` (D-07). The existing case `top-level properties are the six D-16 keys
  plus ...` in `schemas.test.ts` gains `'people', 'legacy_ids'` at the end of its expected list; its title stays.
- `AccordConfig` gains `people?: Record<string, string>` and `legacy_ids?: string[]`.
- `packages/core/src/lint/ids.ts` (new), exported from `index.ts`:
  - `ID_PREFIX = { story: 'ST', bug: 'BUG', epic: 'EP' } as const`.
  - `initialsOf(people: Record<string, string>, email: string): string | undefined`, matching the key
    case-insensitively.
  - `nextTicketId(type: 'story' | 'bug' | 'epic', initials: string, seen: readonly string[]): string`: the
    highest `<n>` among `seen` ids equal to `<prefix>-<initials>-<n>` with `<n>` matching `[1-9][0-9]*`, plus
    one; `1` when none (D-11). Pure; no other input.
- `packages/cli/src/load/fs.ts`, two exports, each one spawn with a literal argument array:
  - `gitUserEmail(root: string): string`: `git config user.email`, trimmed; `''` when git exits 1 (unset).
  - `gitTicketIdsInHistory(root: string): string[]`: `git log --all --full-history --no-renames --format=
    --name-only -- accord/tickets` (`--no-renames` as `gitRecordsSince` passes it: rename detection would need
    blobs a partial clone lacks, and listing both the old and the new path keeps every id ever used, as D-11
    wants; `--full-history` so a `--no-ff` merge that is TREESAME on accord/tickets does not hide a side branch
    that added and then deleted a ticket, whose number would otherwise be reissued after the branch is pruned),
    each path through the same `^accord\/tickets\/([^/]+?)(?:\.md$|\/)` match `gitFacts` uses, de-duplicated
    (ledger Rulings on `git log --all`). It first runs `git for-each-ref --count=1 --format=%(refname)`; empty
    output (an unborn HEAD and no other ref) returns `[]` without running `git log`, so a git version that exits
    128 on `log --all` with no ref is never reached. After that, any `git log` failure throws
    `UsageError('git log failed reading ticket ids' + stderr)`, because silently dropping ids could reuse a
    number. No `fetch`, no remote is contacted (D-10). The spawn passes
    `maxBuffer: 64 * 1024 * 1024`, as `gitBaselineFiles` does, and
    `env: { ...process.env, GIT_NO_LAZY_FETCH: '1' }`, so a partial clone never fetches a missing object from
    the remote. Known limit: in a treeless clone (`--filter=tree:0`) the trees `--name-only` needs are missing
    too, so this read fails and `new ticket` exits 2 naming it; a blobless clone works.
- `run.ts`: the command becomes `ticket [id]` and the action passes `id: string | undefined`; the description
  says the id is assigned when config.yml holds `people`.
- `newTicket(ctx, id: string | undefined, options)`. When `ctx.snapshot.config?.people` is defined and `id` is
  undefined: `email = gitUserEmail(ctx.root)`, `initials = initialsOf(people, email)`, and
  `seen = [...Object.keys(snapshot.tickets), ...Object.keys(snapshot.work ?? {}), ...Object.keys(snapshot.claims
  ?? {}), ...gitTicketIdsInHistory(ctx.root)]`; the id is `nextTicketId(options.type, initials, seen)`, and the
  existing path runs with it. (An unset or unregistered email, and a typed id, are Task 2's refusals; in this
  task they need only not write a file, so an undefined `initials` throws a `UsageError` naming the email.)
  When `people` is undefined and `id` is undefined: `UsageError('a ticket id is required: accord new ticket
  <id>')`. When `people` is undefined and `id` is given: today's behaviour, unchanged.

Must not change: every existing case in `new-ticket.test.ts`, `spawn-surface.test.ts` and
`skill-commands.test.ts` (the command path stays `new ticket`); the `ID` guard runs before any path is built;
the existing-file refusal; the epic-lane-M refusal; `loadFromFs` output for every command (the two new git
reads run only inside `newTicket`, so no golden moves).

End by running `npm run build`.

## Task 2: new ticket refuses an unregistered email, a typed id, and an invalid config.yml
covers: @ac-2, D-06, D-12
files: packages/cli/src/commands/new-ticket.ts, packages/cli/test/new-ticket.test.ts
verify: packages/cli/test/new-ticket.test.ts#ac-2-new-ticket-refuses-an-unregistered-email-and-a-hand-typed-id (@ac-2), packages/cli/test/new-ticket.test.ts#risk:complex-branching-an-invalid-config.yml-stops-new-ticket-naming-the-schema-finding

Tests first, top-level in `packages/cli/test/new-ticket.test.ts`:
- `ac-2 new ticket refuses an unregistered email and a hand-typed id`: valid-build with `people:` /
  `  "an@example.com": AN` appended to config.yml. `gitRun(repo, 'config', 'user.email', 'bo@example.com')`;
  `['new', 'ticket', '--type', 'bug']` exits 2, stderr contains `bo@example.com` and `people` and
  `accord/config.yml`, `listing(repo)` unchanged. Then set user.email to `an@example.com`;
  `['new', 'ticket', 'ST-AN-9']` exits 2, stderr contains `ST-AN-9` and `accord assigns ids`, and
  `ST-AN-9.md` does not exist.
- `risk:complex-branching an invalid config.yml stops new ticket naming the schema finding`: valid-build with
  `people:` / `  "an@example.com": an` appended (lowercase fails the pattern, so `config` is undefined and the
  convention would silently read as off). `['new', 'ticket', 'TCK-1']` exits 2, stderr contains
  `accord/config.yml` and `/people`, and `TCK-1.md` does not exist (ledger Ruling, critic round 2 Should 1).
  In the same sandbox, `['new', 'ticket', '--type', 'story']` with no id also exits 2 with stderr containing
  `/people` and not `a ticket id is required`, and `listing(repo)` is unchanged. In the same test, a second sandbox whose config.yml has no `people` key and an unrelated schema error
  (`profile: build` rewritten to `profile: other` with the file's `setConfig` helper) still writes `TCK-1.md`
  and exits 0, as today.

Interface, in `newTicket`, in this order, each a `UsageError` (exit 2) before any path is built. Step 1 is the
first check in `newTicket`: it runs before Task 1's `people === undefined && id === undefined` refusal
(`a ticket id is required`), because an invalid `people` value leaves `config`, and so `people`, undefined:
1. Only when the raw `accord/config.yml` text (read with `readFileSync(join(ctx.root, 'accord',
   'config.yml'), 'utf8')`, absent counts as empty) matches `/^people\s*:/m`, and `ctx.snapshot.errors` holds
   an entry with `file === 'accord/config.yml'` and a rule other than `load.config-missing`: the message is
   `accord/config.yml:<line> <pointer> <reason>` of the first such finding (`pointer` is the finding's own
   field; ajv's text alone does not carry it). When the finding has no `pointer` (a `load.yaml-syntax`
   finding) or no `line`, that part and its space are left out, so the message never prints `undefined`. Then ` - fix accord/config.yml before creating a ticket`. Without
   a `people` key an invalid config.yml keeps today's behaviour (Intent: no table keeps today's behaviour).
2. With `people` defined and `id` given: `<id> was typed by hand; accord assigns ids while accord/config.yml has
   people - run accord new ticket --type <type> without an id` (D-12, any form).
3. With `people` defined and `gitUserEmail` returning `''`: `git user.email is not set - set it with git config
   user.email <you@example.com>, then register it under people in accord/config.yml` (ledger Ruling).
4. With `people` defined and no entry for the email: `<email> is not registered - add "<email>": <INITIALS>
   (2 to 4 capital letters) under people in accord/config.yml, or ask /accord to register you` (D-06).

Must not change: Task 1's ac-1 case and its output; the no-`people` path, including that a typed id there is
accepted; the pin refusal runs first (it lives in `preflight`).

End by running `npm run build`.

## Task 3: new ticket refuses initials another email holds on the default branch or any other ref
covers: D-17, D-18
files: packages/core/src/lint/ids.ts (new), packages/core/src/index.ts, packages/cli/src/load/fs.ts, packages/cli/src/commands/new-ticket.ts, packages/core/test/ids.test.ts (new), packages/cli/test/new-ticket.test.ts
verify: packages/core/test/ids.test.ts#risk:complex-branching-the-default-branch-decides-who-holds-initials-before-any-other-ref, packages/core/test/ids.test.ts#risk:parsing-peopleOf-reads-only-people-and-never-throws, packages/cli/test/new-ticket.test.ts#risk:parsing-new-ticket-reads-people-on-every-ref-and-refuses-initials-another-email-holds

Tests first.
- `packages/core/test/ids.test.ts` (new), top-level:
  - `risk:complex-branching the default branch decides who holds initials before any other ref`, calling
    `initialsHolder('AN', 'an@example.com', byRef, def)`:
    default `origin/main` maps `An@Example.com` to AN and `origin/t/x` maps `bo@example.com` to AN: `undefined`
    (the default branch decides, same email in another case passes);
    default maps `old@example.com` to AN and another ref maps `an@example.com` to AN: `'old@example.com'`;
    default has no AN and another ref maps `bo@example.com` to AN: `'bo@example.com'`;
    `def` undefined and some ref maps `bo@example.com` to AN: `'bo@example.com'` (D-17 fallback, ledger Ruling);
    no ref holds AN: `undefined`.
  - `risk:parsing peopleOf reads only people and never throws`: a config text with a YAML syntax error gives
    `undefined`; text with `people: { "an@example.com": AN }` and an unknown top-level key gives
    `{ 'an@example.com': 'AN' }`; text whose `people` is a list, or has a non-string value, gives `undefined`;
    `''` gives `undefined`.
- `packages/cli/test/new-ticket.test.ts`, top-level
  `it('risk:parsing new ticket reads people on every ref and refuses initials another email holds')`:
  valid-build; config.yml with `people:` / `  "bo@example.com": AN`; `commitAll`;
  `gitRun(repo, 'update-ref', 'refs/remotes/origin/feature', 'HEAD')`; rewrite config.yml with
  `people:` / `  "an@example.com": AN`; `commitAll`; set user.email to `an@example.com`. No `origin/HEAD`,
  `origin/main` or `origin/master` exists, so every ref is checked. `['new', 'ticket']` exits 2, stderr names
  `AN` and `bo@example.com`, and `listing(repo)` is unchanged.

Interface:
- `lint/ids.ts`, exported from `index.ts`:
  - `peopleOf(text: string): Record<string, string> | undefined`: `parseYamlMap` from `load/yaml.ts` on
    `normaliseText(text)`; returns `map.people` only when it is a mapping whose every value is a string; never
    throws (ledger Ruling: only `people` is parsed).
  - `initialsHolder(initials: string, email: string, byRef: Record<string, Record<string, string>>,
    defaultRef: string | undefined): string | undefined`: the other email holding `initials`. When `defaultRef`
    is defined and its map holds `initials`, only it decides (D-18); otherwise the first other email, in
    sorted ref order, holding them on any ref (D-17). Emails compare case-insensitively.
- `fs.ts` export `gitPeopleOnRefs(root: string): { byRef: Record<string, Record<string, string>>; defaultRef?:
  string }`: one `git for-each-ref --format=%(refname) refs/heads refs/remotes`, dropping names ending in
  `/HEAD`; then one `git cat-file --batch` with `input` the lines `<ref>:accord/config.yml`, read as a Buffer and
  split by each header's byte size (`<sha> blob <size>`), a `missing` line skipped. The cat-file spawn passes
  `maxBuffer: 64 * 1024 * 1024` and `env: { ...process.env, GIT_NO_LAZY_FETCH: '1' }`, so many refs never
  overflow the buffer and a partial clone never reaches the network for another ref's blob (D-10); an object
  that lazy fetch would have supplied reads as missing and is skipped. With no ref at all (an unborn HEAD),
  cat-file is not spawned and `byRef` is `{}`, which Task 1's no-commit case then exercises. Each blob goes
  through
  `peopleOf`, an `undefined` result skipped (ledger Ruling). `defaultRef`: the target of `git symbolic-ref -q
  refs/remotes/origin/HEAD`, else `refs/remotes/origin/main`, else `refs/remotes/origin/master`, whichever is
  in the list; none leaves it undefined (ledger Ruling). A failed for-each-ref or cat-file throws a
  `UsageError` naming the read; a failed symbolic-ref only means none.
- `newTicket`, after Task 2's step 4 and before the id is computed: `holder = initialsHolder(initials, email,
  byRef, defaultRef)`; when defined, `UsageError('initials <AN> already belong to <holder> on another branch -
  choose other initials for <email> in accord/config.yml')`.

Must not change: Tasks 1 and 2 cases, including the no-commit case; in the ac-1 sandbox the HEAD branch maps `an@example.com` to AN and
`origin/t/ST-AN-3` has the same config, so ac-1 still assigns `ST-AN-4`.

End by running `npm run build`.

## Task 4: lint rejects ids that break the convention and duplicate initials
covers: @ac-3, @ac-4, D-07, D-13, D-16
files: packages/core/src/lint/ids.ts (new), packages/core/src/lint/rules.ts, packages/core/test/lane-lint.test.ts
verify: packages/core/test/lane-lint.test.ts#ac-3-lint-rejects-an-id-that-breaks-the-convention-and-spares-the-legacy-list (@ac-3), packages/core/test/lane-lint.test.ts#ac-4-lint-rejects-two-people-with-the-same-initials (@ac-4), packages/core/test/lane-lint.test.ts#risk:complex-branching-emails-differing-only-in-case-are-flagged-as-one-person

Tests first, top-level in `packages/core/test/lane-lint.test.ts`, with its `rules` helper and a local
`withPeople(people: string[], legacy?: string[])` that returns `CONFIG + 'people:\n' + people lines` (each
`  "<email>": <AB>`) plus `legacy_ids: [<ids>]` when given:
- `ac-3 lint rejects an id that breaks the convention and spares the legacy list`: config
  `withPeople(['"lu@example.com": LN'], ['SHOW-1'])`; tickets `SHOW-1` and `FOO-1` as `laneTicket(id)` (story),
  `ST-AN-4` and `BUG-AN-1` as `laneTicket(id).replace('type: story', 'type: bug')`. The `lint.id-convention`
  findings are exactly two: one on `accord/tickets/FOO-1.md` whose reason contains `ST-<initials>-<n>` and
  `legacy_ids`, one on `accord/tickets/ST-AN-4.md` whose reason contains `BUG-<initials>-<n>`.
- `ac-4 lint rejects two people with the same initials`: `withPeople(['"an@example.com": AN',
  '"anh@example.com": AN'])` and no ticket; exactly one `lint.initials-duplicate` finding, on
  `accord/config.yml`, whose reason contains `AN`, `an@example.com` and `anh@example.com`.
- `risk:complex-branching emails differing only in case are flagged as one person`:
  `withPeople(['"An@example.com": AN', '"an@example.com": LN'])`; exactly one `lint.initials-duplicate`
  finding naming both emails (ledger Ruling, critic round 2 Nice 8).

Interface, in `lint/ids.ts`, both `Rule['check']`, both returning `[]` when `snapshot.config?.people` is
undefined (D-08):
- `idConvention`: per ticket with a `frontmatter`, skipping ids in `config.legacy_ids` (D-07): when `t.id` does
  not match `^<ID_PREFIX[type]>-[A-Z]{2,4}-[1-9][0-9]*$`, `{ file: t.file, pointer: '/id', reason: 'id "<id>"
  does not follow <PREFIX>-<initials>-<n> for a <type>; if it predates the convention, add it to legacy_ids in
  accord/config.yml' }` (D-16). Never checks that the initials are in `people` (D-13).
- `initialsDuplicate`: `file: 'accord/config.yml'`, `pointer: '/people'`. One finding per initials held by more
  than one email: `initials "<AB>" belong to <email>, <email>; each person needs their own`. One finding per
  group of emails equal when lower-cased: `<email> and <email> differ only in case and count as one person; keep
  one`.
Rows in `RULES` after `lint.dropped-reason`: `lint.id-convention` and `lint.initials-duplicate`, each
`level: 'error'`, `profiles: ['build', 'maintain']`.

Must not change: every existing case in `lane-lint.test.ts`, `lint.test.ts` and the lint goldens, since no
fixture or helper config holds `people`; `lint.id-mismatch`.

End by running `npm run build`.

## Task 5: Without people nothing changes, and init starts a repository with the convention on
covers: @ac-5, D-08
files: packages/core/src/scaffold/init.ts, packages/cli/test/new-ticket.test.ts
verify: packages/cli/test/new-ticket.test.ts#ac-5-without-the-initials-table-nothing-changes (@ac-5), packages/core/test/scaffold.test.ts#initFiles-—-the-config-it-plans->-validates-against-config.schema.json-with-no-finding, packages/core/test/scaffold.test.ts#initFiles-—-the-config-it-plans->-copies-the-example's-two-tests:-comment-lines-word-for-word-(A-33)

Test first, top-level in `packages/cli/test/new-ticket.test.ts`:
`ac-5 without the initials table nothing changes`: valid-build as copied (no `people`). `['new', 'ticket',
'FOO-1']`: code 0, stdout `accord/tickets/FOO-1.md\n`, the file holds `id: "FOO-1"`. Then `['lint', '--json']`:
its `findings` hold no rule `lint.id-convention` or `lint.initials-duplicate`. This is a guard test: it passes
as soon as it is written. Its red step is a mutation check: drop the `people === undefined` early return in
`idConvention`, see it fail, and restore it.

Interface: the `CONFIG` text in `scaffold/init.ts` gains four lines and one blank line, placed exactly here:
directly after the line `runtimes: [claude, codex]` and the blank line that follows it, and before the line
`# Where the test report lands. ...`, which must keep its blank line above it. The inserted block is:
```
# Who creates tickets: git user.email -> initials, 2 to 4 capital letters, such as "an@example.com": AN.
# While this key exists, accord new ticket assigns every id (ST-AN-7, BUG-AN-1, EP-AN-2) and lint checks them.
# Unlike the keys above it is optional: deleting it turns the id convention off.
people: {}

```
(D-08). So the four lines directly above `# tests:` (the copied pair at `key - 4` and `key - 3` and the two
instruction lines at `key - 2` and `key - 1`) are byte-identical to today, and the A-33 case keeps passing. The
existing scaffold case `validates against config.schema.json with no finding` proves the config validates.

Must not change: `init` output paths and the skip-if-exists contract; the init CLI case asserting `lint` is
clean on a fresh repository (no ticket exists, so the convention reports nothing); the `tests:` comment block
and the WR-01 and A-33 offsets in `scaffold.test.ts`.

End by running `npm run build`.

## Task 6: The /accord skill assigns ids, registers people, and drops instead of renaming
covers: D-02, D-03, D-06, D-10
files: packages/core/skills/accord/SKILL.md, packages/core/skills/accord/ids.md (new), packages/core/src/generated/skills.ts, .claude/skills/accord/SKILL.md, .claude/skills/accord/ids.md (new), packages/core/test/stage-skills.test.ts, docs/design.md
verify: packages/core/test/stage-skills.test.ts#stage-skills-name-what-the-spec-requires->-accord-names-every-required-phrase, packages/core/test/skills.test.ts#render-output-invariants->-every-SKILL.md-is-at-most-MAX_SKILL_BYTES-bytes-(spec-§2), packages/core/test/skills.test.ts#generated-module->-generated-module-matches-skills/-(drift)

Test first: in `packages/core/test/stage-skills.test.ts`, the `accord` row of `REQUIRED` gains
`'accord new ticket --type'` and `'./ids.md'`. It fails until the skill text below lands. The drop rule lives
in `ids.md`, which `REQUIRED` does not read, so no phrase of it is added there.

Size budget, measured by the critic: the rendered `.claude/skills/accord/SKILL.md` (what the size test
measures, marker included; `loads` is stripped on render) is 4889 bytes against 5120, and the source is 112
lines against `MAX_SKILL_LINES` 120. The only SKILL.md edits are the `loads` line and the lane M bullet below,
about +150 bytes and +2 lines; no Rules line is added and no other prose is touched.

Text, naming no other tool:
- `skills/accord/SKILL.md`: frontmatter `loads: [accord/ids.md, shared/ask.md]`. The lane M bullet (today
  three lines, from `- **M.** Run` to `then load `accord-intent`.`) is replaced with exactly:
  ```
  - **M.** Run `accord new ticket <id> --lane M`; when config.yml has
    `people`, follow `./ids.md` and run `accord new ticket --type <story|bug>
    --lane M` with no id instead. Create branch `t/<id>`, commit the
    ticket file and any `people` edit on it, and
    push it (the pushed branch is the claim), then load `accord-intent`.
  ```
  `--lane M` and `push it (the pushed branch is the claim)` each stay whole on one line, and
  `accord new ticket --type` sits on one line, so every `REQUIRED` phrase matches. The branch stays `t/<id>`
  (D-03).
- `skills/accord/ids.md` (new) also holds the drop rule: a ticket's type never changes; to change it, set
  `status: dropped` with its `## Dropped` reason, commit and merge that, and create a new ticket with
  `accord new ticket --type <the other type>`; copy into the new ticket every section below the dropped
  ticket's frontmatter (Intent, Acceptance criteria, Vetoes, Decisions, Corrections and the rest), never its
  `approved_hash` or `ac_hash`, and then the owner approves the new ticket again (D-02, owner's answer "Chép
  nội dung sang"); never delete a `t/` branch to drop a ticket (D-02, ledger Ruling). On a merge conflict under
  `people`, keep every entry. It also says: fetch first with
  `git -c credential.interactive=never -c core.sshCommand="ssh -o BatchMode=yes" fetch`; on failure say so and
  continue, since only refs already in the clone are read (D-10). Register only when `people` exists, never
  create it. When `accord new ticket` says your email is not registered: look for it on other branches with
  `git -c credential.interactive=never -c core.sshCommand="ssh -o BatchMode=yes" log --all -S "<email>"
  --oneline -- accord/config.yml` and `git show <commit>:accord/config.yml` (the same prefix, since reading
  blobs can fetch in a partial clone), and reuse those initials; if that lookup fails, or finds nothing, ask the owner for initials, 2 to 4 capital letters, suggested from
  `git config user.name`, and add `"<email>": <INITIALS>` under `people`, writing `people:` with the entry on
  the next line, indented two spaces, in place of `people: {}` when the file has that form (D-06). Recognition names tickets and
  is never a gate. When it says the initials belong to someone else, ask for other initials. Never retry
  with an id.
- `docs/design.md` §7: the `new ticket` line becomes `accord new ticket [id]` with the note that the id is
  assigned as `<ST|BUG|EP>-<initials>-<n>` when `config.yml` holds `people`, and is required otherwise; one
  sentence after the block naming `people`, `legacy_ids`, and the two lint rules.

Then run, in order: `npm run gen`, `npm run build`, and `node packages/cli/dist/cli.js skills sync`, which
rewrites `.claude/skills/accord/SKILL.md` and writes `.claude/skills/accord/ids.md`. The rendered SKILL.md stays
at or under 5120 bytes; detail goes in `ids.md`, not in SKILL.md. The case `no rendered text restates a rule the
CLI enforces (SKILL-04, D-148)` in `skills.test.ts` must also pass: the skill names commands and what to do on a
refusal, never a list of what `new ticket` or lint checks. That case is not on the verify line because its
report id holds a comma (`(SKILL-04, D-148)`), and the verify line splits tokens on commas; run it with the
skills tests and confirm it passes.

Must not change: every phrase already in the `accord` row of `REQUIRED` (including `--lane M`, `t/<id>`,
`push it (the pushed branch is the claim)` and `claim: <id>`); the Dashboard, Continue and Pick up sections; the
other skills.
