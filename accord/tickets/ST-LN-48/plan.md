---
baseline: 9d850dfd492b560fc661dd615a4a5db8ce68b1c9
plan_hash: "fnv1a64:05521b965843dc74"
---

Review mode `outcome`: one branch, no slices. Every task below can be finished from its own section, this
preamble, the ticket and its ledger.

Order: Task 1 is the wiring. It writes the check (a local function in a new CLI test) and proves on a temporary
repository that it fails and names the file and line (ac-2). Task 2 pins the English quote rule (ac-5). Tasks 3 to 6
move the five non-English traits to French; Task 6 holds the Gherkin dialect test that maps ac-4. Tasks 7 to 10 put
the remaining fixture and test prose into English, family by family. Task 12 translates the HTML doc and adds the
ac-1 test over every tracked file, which passes only once Tasks 1 to 10 and Main session step 2 are done. Task 11 pins
the stage of every ticket (ac-3) and is built last, after Task 12, after the last review round of the other tasks and
after Main session step 3: the approved Approach runs `accord approve`, the fingerprints and the status diff last, at
the verified commit, so a quote fixed at review is re-approved before its fingerprint is taken. Task 11 keeps its
number.

The main session, not an executor, edits every file under the repository's top-level `accord/` folder (ticket
records, `accord/product/conventions.md`, `accord/tests-baseline.txt`). The steps it takes, and before which task, are
in `## Main session steps` at the end of this plan. A task that depends on one says so in its first line.

Rules for every task:
- The check's letter set (the ticket's ac-1, ledger Ruling 1): U+0102, U+0103, U+0110, U+0111, U+01A0, U+01A1,
  U+01AF, U+01B0, and U+1EA0 to U+1EF9. Never write one of these letters into any file. Code that needs one writes it
  as a JavaScript escape: a backslash, `u`, then the four hex digits (only Task 1 does).
- Line for line: a translated file keeps its number of lines and every line keeps its line number, so every `line`
  value in tests and goldens stays put. Translate every Vietnamese line of each file the task names, including lines
  with only grave or acute accents, circumflex vowels, or no marks at all (ledger Ruling 17); read each file whole.
- Language: the text the task says is French uses exactly the French given. All other Vietnamese prose becomes plain
  English. The same Vietnamese phrase gets the same wording everywhere inside one fixture folder, so a verification
  note that repeats a scenario still repeats it and one that does not still does not. Do not introduce words that a
  lint rule reads: EARS keywords (when, if, then, while, where, shall) inside prose, the sentinel words
  `lint.sentinel` looks for, or tokens that look like file paths.
- A test that asserts translated text changes by the same substitution as the fixture it reads.
- Fixture hashes (ledger Ruling 15 applied to fixtures): before translating a fixture ticket, note which of its
  `ac_hash:` and `verified_hash:` values equal `acHash(ticket.scenarios)` today. After translating, set exactly those
  to the new `acHash`; a value that did not match (STALE's `fnv1a64:deadbeefdeadbeef`) stays as written. Compute
  `acHash` with a throwaway file `packages/core/test/zz-hash.test.ts` that imports `acHash` from `../src/gate/hash.js`,
  `loadSnapshot` from `../src/index.js` and `readFixture` from `./helpers/fixture.js`, and logs the hash of each
  ticket of the fixture; run it with `npx vitest run packages/core/test/zz-hash.test.ts` and delete it before the
  task ends. Tickets whose scenarios were identical before (the `fnv1a64:0e84e174c4cdc76b` group in `gate-done` and
  `gate-no-report`) get identical translations, so they share one new hash.
- Goldens: regenerate only the goldens of the fixtures the task touched:
  `npx vitest run packages/core/test/snapshot.test.ts -u -t "fixture <name>"`,
  `npx vitest run packages/core/test/lint.test.ts -u -t "fixture <name>"`,
  `npx vitest run packages/core/test/gate.test.ts -u -t "gate case <name>"`,
  `npx vitest run packages/core/test/status.test.ts -u -t "status case <name>"` (the describe titles are
  `'gate case ' + row.name` at `gate.test.ts:125` and `'status case ' + row.name` at `status.test.ts:71`; `-t` matches
  the space-joined name, so the filter has a space, never a hyphen). Then review
  `git diff -U0 -- packages/core/test/__golden__`: no removed or added line holds `"line":`, `"rule":`, `"level":`
  or `"verdict":`, except where the task says otherwise. A golden that `-u` rewrites beyond the task's `files:` line
  is kept as written and named in the report.
- Test ids: a report id is the test file's path from the repository root, then `#`, then the `describe` titles and
  the `it` title joined by ` > `, with each run of whitespace turned into `-`. A new test is a top-level `it(...)`. No
  new or renamed title holds `@` or a comma.
- Renamed tests: the report lists each renamed test as `old id -> new id`, read from the JUnit report, so the main
  session can replace it in place in `accord/tests-baseline.txt` (ledger Ruling 4). Executors never edit that file.
- A test that makes a commit uses `commitMsg` from `packages/cli/test/helpers/repo.ts` (`-F <file>
  --cleanup=verbatim`, never `-m`). `commitMsg` supplies no git identity, so before the first commit the test runs
  `gitRun(repo, 'config', 'user.email', 'an@example.com')`, `gitRun(repo, 'config', 'user.name', 'an')` and
  `gitRun(repo, 'config', 'commit.gpgsign', 'false')` in the temporary repository, as `repoWith` in
  `packages/cli/test/lane-s.test.ts:53-59` does.
- CLI tests import core from `packages/core/dist`. After any change under `packages/core/`, run
  `npm run build -w packages/core` before running a CLI test. Run one file with `npx vitest run <path>`. End every task
  with `npm run build`, `npm run lint` and `npm run typecheck`, then run the test files the task names.
- Files are LF with no BOM. Add no dependency. Core (`packages/core/src`) imports no `node:` module; tests may.

## Task 1: Wiring: the repository check fails on a committed d with stroke and names its path and line
covers: @ac-2, D-04, D-06
files: packages/cli/test/no-vietnamese.test.ts (new)
verify: packages/cli/test/no-vietnamese.test.ts#ac-2-the-check-fails-on-a-committed-d-with-stroke-and-names-its-path-and-line-3 (@ac-2)

Consumes: `makeEmptyRepo`, `gitRun`, `writeFiles`, `commitMsg` and `cleanup` from `./helpers/repo.js`. Produces: the local
function `vietnameseLines(root)`, which Task 12's ac-1 test calls. The check is a test of this repository only;
`accord lint` gains no rule (D-06), so nothing under `packages/*/src` changes.

Test first, in the new file:
- `it('ac-2 the check fails on a committed d with stroke and names its path and line 3', ..., 60_000)`:
  - `repo = makeEmptyRepo()`, then the three `gitRun(repo, 'config', ...)` calls of the preamble (`user.email`,
    `user.name`, `commit.gpgsign false`), so the commit works on a runner with no global identity or with signing on.
    `writeFiles(repo, { 'docs/notes/a.md': 'one\ntwo\nthree X\n' })`, where `X` stands
    for U+0111 written in the source as a backslash, `u`, then `0111` (a JavaScript escape, never the letter).
    `commitMsg(repo, 'add a')`.
  - `expect(vietnameseLines(repo)).toEqual(['docs/notes/a.md:3'])`: a non-empty list is the check failing, and the
    entry is the path relative to the repository root, with `/`, then the line.
  - `cleanup(repo)` in a `finally`.

Interface, in the same file:
- `const LETTER`: a regular expression with the `u` flag holding one character class of the check's letter set,
  each letter written as a backslash-`u` escape of its four hex digits (`0102`, `0103`, `0110`, `0111`, `01A0`,
  `01A1`, `01AF`, `01B0`, and the range `1EA0` to `1EF9`), so the file passes its own check (ledger Ruling 1).
- `function vietnameseLines(root: string): string[]`:
  - `execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })`, split on
    the NUL character, empty entries dropped (conventions.md: NUL-separated).
  - For each path: `abs = join(root, ...rel.split('/'))`. Skip it unless
    `statSync(abs, { throwIfNoEntry: false })?.isFile()` (a path deleted in the working tree, ledger Ruling 18, or a
    submodule folder). `buf = readFileSync(abs)`; skip it when `buf.includes(0)` (the whole-file NUL test).
  - `buf.toString('utf8').normalize('NFC').split('\n')`; for each line `i` where `LETTER.test(line)`, push
    `rel + ':' + (i + 1)`.
  - Return the list in `ls-files` order.

Must not change: every other test and every helper in `helpers/repo.ts`.

## Task 2: The conventions hold exactly one rule line for English owner quotes
covers: @ac-5, D-02
files: packages/core/test/convention.test.ts
verify: packages/core/test/convention.test.ts#ac-5-conventions.md-holds-exactly-one-rule-line-for-English-owner-quotes (@ac-5)

Precondition: the main session has done Main session step 1, so `accord/product/conventions.md` holds the rule line.
When it is not there, stop and report it; do not edit that file.

Consumes: the file's existing `read(rel)` helper. Produces: the ac-5 test.

Test, appended at the end of `packages/core/test/convention.test.ts` as a top-level `it`:
- `it('ac-5 conventions.md holds exactly one rule line for English owner quotes')`:
  - `rules = read('accord/product/conventions.md').split('\n').filter((l) => l.startsWith('- '))`.
  - `quote = rules.filter((l) => /owner quote/i.test(l))`, and `expect(quote).toHaveLength(1)`.
  - `quote[0]` contains each of `Decisions`, `Corrections`, `approval commit messages` and
    `faithful English translation`.

Must not change: the five existing tests of the file and its `section` helper.

## Task 3: The reference matcher keeps a French diacritic, and the D-85 notes and hash vectors move to French
covers: D-03, D-04
files: packages/core/test/refs.test.ts, packages/core/test/hash.test.ts, packages/core/src/gate/refs.ts
verify: packages/core/test/refs.test.ts#normalise-(D-85-encoding)->-risk:parsing-lower-cases-and-keeps-French-diacritics

Consumes: `normalise`, `stripRefs`, `noteBlocks`, `unresolvedRefs` and `acHash` as they are. Produces: the matcher
trait in French (ac-4 trait two). The scenario used here is the one Task 4 writes into the valid-build LOGIN-1
fixture, so both say the same thing.

Tests first, in `packages/core/test/refs.test.ts`:
- `normalise (D-85 encoding)`: the test `lower-cases and keeps Vietnamese diacritics` becomes
  `risk:parsing lower-cases and keeps French diacritics`, with body
  `expect(normalise('Où')).toBe('où'); expect(normalise('Où')).not.toBe('ou');`.
- `describe('the two CONTEXT Vietnamese cases (D-85)')` becomes `describe('the two CONTEXT non-English cases (D-85)')`,
  and the file's line 3 comment says "non-English" for "Vietnamese". Inside it:
  - `name = 'Connexion réussie'` and `steps = ['il envoie un e-mail et un mot de passe valides', 'il voit le tableau de bord']`.
  - The own-words note is `'src/auth/login.ts renvoie 401 avant le hachage'`, and its remainder is
    `'renvoie 401 avant le hachage'`.
  - The explaining tail is `' mais la session expire après 15 minutes'`.
  - In the boundary test, `'src/auth/login.ts h'` becomes `'src/auth/login.ts x'`: `x` is in the normalised scenario
    (`connexion`) and `z` is not, so one character still decides both ways.
- Every other Vietnamese string in the file (lines 118, 122 and the `noteBlocks` block, lines 155 to 193) becomes
  English, with each expectation changed by the same substitution, for example `'run npm test'` and
  `'src/nope.ts and src/nope.ts'`.
- `packages/core/test/hash.test.ts` lines 66 to 69: `const fr = acHash([sc('ac-1', ['il voit le tableau de bord à jour'])])`
  and `stripped = acHash([sc('ac-1', ['il voit le tableau de bord a jour'])])`; `fr` replaces `vi` in both expects. The
  test title stays.

`packages/core/src/gate/refs.ts` lines 121 to 122, comment only: content in a language with diacritics, such as
French, is the expected case, and folding them would make `où` and `ou` the same word.

Renamed tests to report: the normalise test and the four tests of the CONTEXT describe.

Must not change: the code of `refs.ts`; every other test in both files, the `linear time` test included.

## Task 4: EARS keywords classify inside French prose, and the valid-build LOGIN-1 fixture moves to French
covers: D-03, D-04
files: packages/core/test/ears.test.ts, packages/core/test/snapshot.test.ts, packages/core/test/gate.test.ts, packages/core/test/write.test.ts, packages/core/src/model/snapshot.ts, packages/core/test/fixtures/valid-build/accord/tickets/LOGIN-1.md, packages/core/test/fixtures/valid-build/accord/tickets/LOGIN-1/verification.md, packages/core/test/fixtures/valid-build/accord/tickets/EPIC-1.md, packages/core/test/fixtures/valid-build/accord/product/glossary.md, packages/core/test/fixtures/lint-ears/accord/tickets/EARS.md, packages/core/test/__golden__/valid-build.snapshot.json, packages/core/test/__golden__/valid-build.lint.json, packages/core/test/__golden__/valid-build.LOGIN-1.ready.json, packages/core/test/__golden__/LOGIN-1.verified.md, packages/core/test/__golden__/LOGIN-1.ac_hash.md, packages/core/test/__golden__/lint-ears.snapshot.json
verify: packages/core/test/ears.test.ts#classifyEars-(D-61-to-D-64)->-risk:parsing-classifies-the-fixture-line-"WHEN-un-utilisateur-envoie-un-e-mail-et-un-mot-de-passe-valides-the-system-SHALL-donner-accès-au-tableau-de-bord"-as-event-driven, packages/core/test/ears.test.ts#classifyEars-(D-61-to-D-64)->-risk:parsing-classifies-the-fixture-line-"IF-le-mot-de-passe-est-erroné-THEN-the-system-SHALL-afficher-une-erreur"-as-unwanted-behaviour, packages/core/test/ears.test.ts#classifyEars-(D-61-to-D-64)->-risk:parsing-classifies-the-fixture-line-"WHEN-un-utilisateur-possède-un-compte-the-system-SHALL-permettre-la-connexion"-as-event-driven

Consumes: `classifyEars`, `loadSnapshot`, `gateReady`, `renderText` and `setFrontmatterKey` as they are. Produces:
the EARS trait in French (ac-4 trait five) and the French LOGIN-1 that the CLI tests copy through `makeRepo`.

The French lines, used verbatim everywhere below:
- E1 `WHEN un utilisateur envoie un e-mail et un mot de passe valides the system SHALL donner accès au tableau de bord`
- E2 `IF le mot de passe est erroné THEN the system SHALL afficher une erreur`
- E3 `WHEN un utilisateur possède un compte the system SHALL permettre la connexion`
- E4 `Après la connexion WHEN x the system shall y`

Tests first:
- `ears.test.ts`: the comment on line 17 says French content; the second `it.each` holds E1 as event-driven, E2 as
  unwanted-behaviour and E3 as event-driven, and its title becomes
  `'risk:parsing classifies the fixture line %j as %s'`. Its body gains, before the existing expect,
  `expect([...line].some((ch) => (ch.codePointAt(0) as number) > 0x7f)).toBe(true)`, so each line keeps a letter
  above U+007F. Line 31 becomes E4 with the same reason.
- `snapshot.test.ts` (the `fixture valid-build` assertions, lines 102 to 142): scenario names `'Connexion réussie'`
  and `'Mot de passe erroné'`; ac-1 steps `['Given un utilisateur déjà inscrit', 'When il envoie un e-mail et un mot de passe valides', 'Then il voit le tableau de bord']`;
  `second.steps[0]` is `'Given un utilisateur déjà inscrit'`; requirements E1 at line 25, E2 at line 26, and E3 at
  EPIC-1 line 12.
- `gate.test.ts` lines 173 to 174: the two scenario names above.
- `write.test.ts` line 36: `'title: Connexion par e-mail'`.

Fixtures, line for line:
- `LOGIN-1.md`: line 3 `title: Connexion par e-mail`; line 14 assumption text `L'utilisateur a déjà un compte`; lines
  20 to 21 the Intent in French (the user signs in with e-mail and password to reach the dashboard; social sign-in is
  not supported in this version); line 25 `- ` plus E1; line 26 `- ` plus E2; line 34 `    Given un utilisateur déjà inscrit`;
  line 37 `  Scenario: Connexion réussie`; line 38 `    When il envoie un e-mail et un mot de passe valides`; line 39
  `    Then il voit le tableau de bord`; line 42 `  Scenario: Mot de passe erroné`; line 43
  `    When il envoie un mot de passe erroné`; line 44 `    Then il voit une erreur`; line 48
  `- [x] Faut-il mémoriser la connexion ? Non, pas dans cette version.`
- `EPIC-1.md`: line 3 `title: Comptes et connexion`, line 9 the Intent in French, line 12 E3.
- `LOGIN-1/verification.md`: the scenario names in its headings become the two French names; other Vietnamese
  prose becomes English. `glossary.md`: English.
- `lint-ears/.../EARS.md`: lines 18 to 20 become `- ` plus E1, E2, E3; line 25 `- ` plus E4; the title, Intent,
  scenario and plan lines become English.
- `packages/core/src/model/snapshot.ts` line 61, comment only: `// 'Connexion réussie'`.

Goldens: `fixture valid-build` and `fixture lint-ears` (snapshot and lint), `gate case valid-build`, and
`npx vitest run packages/core/test/write.test.ts -u -t "setFrontmatterKey"`. Then run
`packages/cli/test/load.test.ts` (its `matches the core golden exactly` reads `valid-build.snapshot.json`) and
`packages/cli/test/status.test.ts`.

Renamed tests to report: the three fixture-line cases and the E4 diagnose case.

Must not change: the other `ears.test.ts` cases; every `line` and `rule` value in the goldens; the frontmatter key
order and comments of `LOGIN-1.md`, which the write goldens pin.

## Task 5: A title cut by code point, a non-ASCII ticket id and hostile titles move to French
covers: D-03
files: packages/cli/test/dashboard.test.ts, packages/cli/test/status.test.ts, packages/cli/test/tracker.test.ts, packages/core/test/panel.test.ts
verify: packages/cli/test/dashboard.test.ts#risk:security-a-title-cannot-inject-control-characters-or-overflow-its-cell, packages/core/test/panel.test.ts#risk:security-a-title-cannot-put-control-characters-into-the-pane

Consumes: `renderDashboard`, the panel host harness, `fetchIssues` and `accord status` as they are. Produces: ac-4
traits three (a title of single-code-point capitals with a diacritic cut by code point) and four (a ticket id holding
a non-ASCII letter). No test title changes.

Tests, each changed in place. Only the words change: every existing escape in these lines (the ESC escape and the
escapes of U+202E and U+2028), every space and every `[31m` keep their positions, and the expected string changes by
the same word substitution:
- `dashboard.test.ts` lines 120 to 132: row A-1's Vietnamese words become `Mot de`, `passe` and `oublié`, in that
  order, so the expected text is `'Mot de [31m passe oublié x'`. Row A-2's title is `'É'.repeat(70)` (U+00C9, one
  code point), expected to contain `'É'.repeat(57) + '...'` and not `'É'.repeat(58)`.
- `status.test.ts` lines 217 and 224 to 225: the comment says French diacritics; the tracker value is `"Été—█💩"`;
  the second ticket id is `'É█-1'`.
- `tracker.test.ts` line 191: `const hostile = 'Été\nnuméro\r' + String.fromCharCode(27) + '[31m   bad';`.
- `panel.test.ts` lines 497 and 501: the two Vietnamese words become `Réglé` and `à`, in that order, so the expected
  text is `'Réglé [31m à x y'`.

Must not change: what each test asserts beyond the text (the code-point bounds, the ASCII-only status output, the
cut at 57 code points); every other test in the four files.

## Task 6: The Gherkin dialect tests and the gherkin-shapes fixture move to French
covers: @ac-4, D-03
files: packages/core/test/gherkin.test.ts, packages/core/test/fixtures/gherkin-shapes/accord/tickets/VI.md, packages/core/test/fixtures/gherkin-shapes/accord/tickets/FR.md (new), packages/core/test/fixtures/gherkin-shapes/accord/tickets/TAGS.md, packages/core/test/fixtures/gherkin-shapes/accord/tickets/STEPS.md, packages/core/test/fixtures/gherkin-shapes/accord/tickets/PARSE-ERROR.md, packages/core/test/fixtures/gherkin-shapes/accord/tickets/OUTLINE.md, packages/core/test/fixtures/gherkin-shapes/accord/tickets/EMPTY-AC.md, packages/core/test/fixtures/gherkin-shapes/accord/tickets/RULE.md, packages/core/test/__golden__/gherkin-shapes.snapshot.json, packages/core/test/__golden__/gherkin-shapes.lint.json, packages/cli/test/show-approval.test.ts, packages/core/test/lint.test.ts
verify: packages/core/test/gherkin.test.ts#dialects-(D-50)->-ac-4-fr-keywords-normalise-to-English-keyword-values-and-step-keywords-stay-French (@ac-4), packages/core/test/gherkin.test.ts#dialects-(D-50)->-risk:parsing-a-fr-fence-without-a-feature-line-gets-a-Fonctionnalité:-line-prepended, packages/core/test/gherkin.test.ts#gherkin-shapes-fixture->-risk:parsing-FR:-English-keyword-values-and-French-step-keywords-with-Background-first-in-both, packages/cli/test/show-approval.test.ts#risk:parsing-approval-shares-only-steps-before-the-first-then-in-a-language-fr-fence

Consumes: the `fr` dialect of @cucumber/gherkin 42 (`node_modules/@cucumber/gherkin/dist/gherkin-languages.json:1344-1408`:
feature `Fonctionnalité`, background `Contexte`, scenario `Scénario`, outline `Plan du scénario`, examples
`Exemples`, given `Soit `, when `Quand `, then `Alors `, and `Et `), and `extractScenarios`, which prepends the
dialect's first feature keyword (`packages/core/src/load/gherkin.ts:71-76`). Produces: ac-4 trait one; this task
comes after Tasks 3 to 5, so all five traits are French once it passes.

Tests first, `packages/core/test/gherkin.test.ts`:
- `dialects (D-50)`, first test renamed `ac-4 fr keywords normalise to English keyword values and step keywords stay French`,
  fence `['# language: fr', 'Fonctionnalité: T', '@ac-1', 'Scénario: S', '  Soit a', '@ac-2', 'Plan du scénario: O', '  Soit <a>', '  Exemples:', '    | a |', '    | 1 |']`;
  expects no findings, keywords `['Scenario', 'Scenario Outline']`, `scenarios[0].steps` `['Soit a']`, line 14.
- Second test renamed `risk:parsing a fr fence without a feature line gets a Fonctionnalité: line prepended`, fence
  `['# language: fr', '@ac-1', 'Scénario: S', '  Soit a']`, expecting `{ keyword: 'Scenario', line: 13, acTag: 'ac-1', steps: ['Soit a'] }`.
- `gherkin-shapes fixture`: the VI test renamed
  `risk:parsing FR: English keyword values and French step keywords with Background first in both`, reading
  `scenarios('FR')`: `a` is `{ name: 'Connexion', keyword: 'Scenario', line: 17, tags: ['@ac-1'], acTag: 'ac-1', steps: ['Soit un utilisateur', 'Quand il se connecte', 'Alors il voit le tableau de bord'] }`
  and `b` matches `{ line: 22, acTag: 'ac-2', steps: ['Soit un utilisateur', 'Soit <a>', 'Examples: | a | | 1 |'] }`.
- OUTLINE's name (line 175) becomes `'Many values'`; RULE (line 203) asserts `not.toContain('Payment')`.
- `packages/core/test/lint.test.ts` line 388 (in `fixture gherkin-shapes: pinned lint values`, the TAGS test): the
  expected reason becomes `'@ac-1 is already used by scenario "Two tags"'`, the English name of TAGS.md line 17. Only
  this line of `lint.test.ts` changes in this task; lines 297 to 305 belong to Task 9.
- `packages/cli/test/show-approval.test.ts` lines 170 to 190: title
  `risk:parsing approval shares only steps before the first then in a language fr fence`; `sc` gives
  `['', `  @ac-${n}`, '  Scénario: t' + n, '    Soit un rapport', '    Quand le responsable exporte', '    Et choisit csv', '    Alors le fichier est écrit', '    Et le fichier est enregistré', `    Et ${last}`]`;
  the fence starts `['# language: fr', 'Fonctionnalité: X', ...]`; the expected block keeps its shape with
  `- Soit un rapport (ac-1, ac-2)`, `- Quand le responsable exporte (ac-1, ac-2)`, `- Et choisit csv (ac-1, ac-2)`,
  then under each scenario `- Alors le fichier est écrit`, `- Et le fichier est enregistré`, `- Et a` or `- Et b`.

Fixtures, line for line:
- Delete `VI.md` and create `FR.md` (ledger Ruling 19) with the same 28 lines: frontmatter `id: FR`, `title: t`,
  `type: story`, `status: open`; line 10 `# language: fr`; 11 `Fonctionnalité: FR`; 13 `Contexte:`; 14
  `  Soit un utilisateur`; 16 `@ac-1`; 17 `Scénario: Connexion`; 18 `  Quand il se connecte`; 19
  `  Alors il voit le tableau de bord`; 21 `@ac-2`; 22 `Plan du scénario: Plusieurs`; 23 `  Soit <a>`; 25
  `  Exemples:`; 26 `    | a |`; 27 `    | 1 |`.
- `RULE.md` line 15 `Rule: Payment`; OUTLINE's scenario name `Many values`; `TAGS.md` scenario names, line for
  line: line 13 `Scenario: No tag`, line 17 `Scenario: Two tags`, line 21 `Scenario: Third tag`, line 25
  `Scenario: Duplicate tag` (tags and steps unchanged); the Vietnamese prose of STEPS, PARSE-ERROR and EMPTY-AC becomes
  English.

Goldens: `fixture gherkin-shapes` (snapshot and lint); then run
`npx vitest run packages/core/test/lint.test.ts -t "fixture gherkin-shapes"`, which runs both the golden and the
pinned TAGS test and must pass. The VI entries leave and FR entries arrive in another sort
position, so for this fixture compare the `"line"` and `"rule"` values of the old VI entries with the new FR entries,
and require every other entry's values unchanged.

Renamed tests to report: the three in `gherkin.test.ts` and the one in `show-approval.test.ts`.

Must not change: the other `gherkin.test.ts` tests (parse errors, determinism, the remaining shapes); the
`show-approval` English test after it; every `lint.test.ts` line other than 388, and the rules, lines and levels the
TAGS test asserts (13, 17, 25).

## Task 7: The gate-done and gate-no-report fixtures move to English with their hashes recomputed
covers: D-04, D-05
files: packages/core/test/fixtures/gate-done/accord/tickets/BLOCKED.md, packages/core/test/fixtures/gate-done/accord/tickets/COMMIT.md, packages/core/test/fixtures/gate-done/accord/tickets/EMPTY.md, packages/core/test/fixtures/gate-done/accord/tickets/EVIDENCE.md, packages/core/test/fixtures/gate-done/accord/tickets/MACHINE.md, packages/core/test/fixtures/gate-done/accord/tickets/NOTES.md, packages/core/test/fixtures/gate-done/accord/tickets/NOVERIF.md, packages/core/test/fixtures/gate-done/accord/tickets/PASS.md, packages/core/test/fixtures/gate-done/accord/tickets/REVIEW.md, packages/core/test/fixtures/gate-done/accord/tickets/SETS.md, packages/core/test/fixtures/gate-done/accord/tickets/SOLO.md, packages/core/test/fixtures/gate-done/accord/tickets/STALE.md, packages/core/test/fixtures/gate-done/accord/tickets/TICKS.md, packages/core/test/fixtures/gate-done/accord/tickets/UINOTE.md, packages/core/test/fixtures/gate-done/accord/tickets/BLOCKED/verification.md, packages/core/test/fixtures/gate-done/accord/tickets/COMMIT/verification.md, packages/core/test/fixtures/gate-done/accord/tickets/EVIDENCE/verification.md, packages/core/test/fixtures/gate-done/accord/tickets/MACHINE/verification.md, packages/core/test/fixtures/gate-done/accord/tickets/NOTES/verification.md, packages/core/test/fixtures/gate-done/accord/tickets/PASS/verification.md, packages/core/test/fixtures/gate-done/accord/tickets/REVIEW/verification.md, packages/core/test/fixtures/gate-done/accord/tickets/SETS/verification.md, packages/core/test/fixtures/gate-done/accord/tickets/SOLO/verification.md, packages/core/test/fixtures/gate-done/accord/tickets/STALE/verification.md, packages/core/test/fixtures/gate-done/accord/tickets/TICKS/verification.md, packages/core/test/fixtures/gate-done/accord/tickets/UINOTE/verification.md, packages/core/test/fixtures/gate-no-report/accord/tickets/GONE.md, packages/core/test/fixtures/gate-no-report/accord/tickets/GONE/verification.md, packages/core/test/gate.test.ts, packages/core/test/__golden__/gate-done.snapshot.json, packages/core/test/__golden__/gate-done.lint.json, packages/core/test/__golden__/gate-done.BLOCKED.done.json, packages/core/test/__golden__/gate-done.COMMIT.done.json, packages/core/test/__golden__/gate-done.EVIDENCE.done.json, packages/core/test/__golden__/gate-done.MACHINE.done.json, packages/core/test/__golden__/gate-done.NOTES.done.json, packages/core/test/__golden__/gate-done.NOVERIF.done.json, packages/core/test/__golden__/gate-done.PASS.done.json, packages/core/test/__golden__/gate-done.PASS.noauthors.done.json, packages/core/test/__golden__/gate-done.PASS.ready.json, packages/core/test/__golden__/gate-done.REVIEW.done.json, packages/core/test/__golden__/gate-done.SETS.done.json, packages/core/test/__golden__/gate-done.SOLO.done.json, packages/core/test/__golden__/gate-done.STALE.done.json, packages/core/test/__golden__/gate-done.TICKS.done.json, packages/core/test/__golden__/gate-done.UINOTE.done.json, packages/core/test/__golden__/gate-no-report.snapshot.json, packages/core/test/__golden__/gate-no-report.GONE.done.json
verify: packages/core/test/gate.test.ts#gate-case-gate-done.STALE.done->-matches-its-golden, packages/core/test/gate.test.ts#gate-case-gate-done.PASS.done->-matches-its-golden, packages/core/test/gate.test.ts#gate-case-gate-done.NOTES.done->-matches-its-golden, packages/core/test/gate.test.ts#gate-case-gate-no-report.GONE.done->-matches-its-golden, packages/core/test/snapshot.test.ts#fixture-gate-done->-matches-the-golden, packages/core/test/lint.test.ts#fixture-gate-done->-matches-the-golden

Consumes: the preamble's line-for-line, wording and fixture-hash rules. Produces: English `gate-done` and
`gate-no-report` fixtures whose gate verdicts and rules are unchanged. This task writes no new test; its verify line
names the existing goldens that pin the two fixtures.

Test first: note the current `acHash` of STALE (today `fnv1a64:0e84e174c4cdc76b`, the value `gate.test.ts:395`
asserts). After translating, set line 395 to STALE's new `acHash` and see the STALE identity test pass.

Translate every fixture file on the `files:` line, line for line, into English. The `0e84e174c4cdc76b` group
(BLOCKED, COMMIT, EVIDENCE, PASS, REVIEW, SETS, SOLO, TICKS, STALE's scenarios, GONE) gets one identical English
scenario block, so all of them move to one new hash. MACHINE, NOTES and UINOTE get their own new hashes. Recompute
the recorded `ac_hash:` and `verified_hash:` values by the preamble rule; STALE keeps `deadbeefdeadbeef` on both
keys, and TICKS has no `verified_hash:` to add.

Goldens: `gate case gate-done`, `gate case gate-no-report`, `fixture gate-done` and `fixture gate-no-report`
(snapshot and lint), and `status case gate-done`. A hash string inside a `reason` may change; no `"rule":`,
`"level":`, `"line":` or `"verdict":` line may.

Must not change: every gate verdict and rule set; the `deadbeefdeadbeef` values; every `gate.test.ts` assertion other
than line 395.

## Task 8: The gate-ready and gate-maintain fixtures move to English
covers: D-04, D-05
files: packages/core/test/fixtures/gate-ready/accord/tickets/CLEAN.md, packages/core/test/fixtures/gate-ready/accord/tickets/HYGIENE.md, packages/core/test/fixtures/gate-ready/accord/tickets/NOUI.md, packages/core/test/fixtures/gate-ready/accord/tickets/SCHEMA.md, packages/core/test/fixtures/gate-ready/accord/tickets/THIN.md, packages/core/test/fixtures/gate-ready/accord/tickets/UINOREF.md, packages/core/test/fixtures/gate-maintain/accord/tickets/UILINK.md, packages/core/test/fixtures/gate-maintain/accord/tickets/UIPROTO.md, packages/cli/test/gate.test.ts, packages/core/test/__golden__/gate-ready.snapshot.json, packages/core/test/__golden__/gate-ready.lint.json, packages/core/test/__golden__/gate-ready.CLEAN.ready.json, packages/core/test/__golden__/gate-ready.CLEAN.done.json, packages/core/test/__golden__/gate-ready.HYGIENE.ready.json, packages/core/test/__golden__/gate-ready.NOUI.ready.json, packages/core/test/__golden__/gate-ready.SCHEMA.ready.json, packages/core/test/__golden__/gate-ready.THIN.ready.json, packages/core/test/__golden__/gate-ready.UINOREF.ready.json, packages/core/test/__golden__/gate-maintain.snapshot.json, packages/core/test/__golden__/gate-maintain.lint.json, packages/core/test/__golden__/gate-maintain.UILINK.ready.json, packages/core/test/__golden__/gate-maintain.UIPROTO.ready.json
verify: packages/core/test/gate.test.ts#gate-case-gate-ready.CLEAN.ready->-matches-its-golden, packages/core/test/gate.test.ts#gate-case-gate-ready.THIN.ready->-matches-its-golden, packages/core/test/gate.test.ts#gate-case-gate-maintain.UILINK.ready->-matches-its-golden, packages/core/test/snapshot.test.ts#fixture-gate-ready->-matches-the-golden, packages/core/test/lint.test.ts#fixture-gate-maintain->-matches-the-golden

Consumes: the preamble rules. Produces: English `gate-ready` and `gate-maintain` fixtures. No new test; the verify line
names the existing goldens.

Test first: `packages/cli/test/gate.test.ts:13` `CLEAN_HASH` is the `ac_hash` that `gate ready` writes for
gate-ready CLEAN, which is `acHash` of its scenarios. After translating CLEAN, set it to CLEAN's new `acHash`
(computed by the preamble's throwaway file) and run the CLI gate tests after `npm run build -w packages/core`.

Translate the eight fixture tickets line for line into English; the THIN scenario name that
`gate-ready.THIN.ready.json` quotes becomes English like the rest.

Goldens: `gate case gate-ready`, `gate case gate-maintain`, `fixture gate-ready`, `fixture gate-maintain` (snapshot
and lint), and `status case gate-ready`.

Must not change: every gate verdict and rule; every other assertion in `packages/cli/test/gate.test.ts`.

## Task 9: The lint fixtures, frontmatter-errors and the lint and render tests move to English
covers: D-04
files: packages/core/test/fixtures/lint-hygiene/accord/tickets/CLEAN.md, packages/core/test/fixtures/lint-hygiene/accord/tickets/EPIC.md, packages/core/test/fixtures/lint-hygiene/accord/tickets/HEADINGS.md, packages/core/test/fixtures/lint-hygiene/accord/tickets/HYGIENE.md, packages/core/test/fixtures/lint-hygiene/accord/tickets/NOTES.md, packages/core/test/fixtures/lint-hygiene/accord/tickets/PLAN-EMPTY.md, packages/core/test/fixtures/lint-hygiene/accord/tickets/SIZE.md, packages/core/test/fixtures/lint-gherkin/accord/tickets/ACTAGS.md, packages/core/test/fixtures/lint-gherkin/accord/tickets/NOSCEN.md, packages/core/test/fixtures/lint-gherkin/accord/tickets/STEPS.md, packages/core/test/fixtures/lint-gherkin/accord/tickets/TESTTAGS.md, packages/core/test/fixtures/lint-missing-files/accord/tickets/MISSING.md, packages/core/test/fixtures/lint-report/accord/tickets/REPORT.md, packages/core/test/fixtures/frontmatter-errors/accord/tickets/NOFM.md, packages/core/test/lint.test.ts, packages/core/test/render.test.ts, packages/core/test/__golden__/lint-hygiene.snapshot.json, packages/core/test/__golden__/lint-hygiene.lint.json, packages/core/test/__golden__/lint-gherkin.snapshot.json, packages/core/test/__golden__/lint-gherkin.lint.json, packages/core/test/__golden__/lint-missing-files.snapshot.json, packages/core/test/__golden__/lint-report.snapshot.json, packages/core/test/__golden__/frontmatter-errors.snapshot.json
verify: packages/core/test/lint.test.ts#fixture-lint-hygiene->-matches-the-golden, packages/core/test/lint.test.ts#fixture-lint-gherkin->-matches-the-golden, packages/core/test/snapshot.test.ts#fixture-lint-missing-files->-matches-the-golden, packages/core/test/snapshot.test.ts#fixture-lint-report->-matches-the-golden, packages/core/test/snapshot.test.ts#fixture-frontmatter-errors->-matches-the-golden

Consumes: the preamble rules. Produces: English lint fixtures. No new test; the verify line names the existing goldens.

Tests first, `packages/core/test/lint.test.ts` lines 297 to 305 only (line 388 was changed by Task 6): each scenario
name the assertions quote becomes its English translation (for example `"Two tags"` for the ACTAGS duplicate),
changed by the same substitution as the lint-gherkin fixtures. `packages/core/test/render.test.ts` lines 12 and 27: the reason string
becomes its English translation in both places and `accord/tickets/VI.md` becomes `accord/tickets/FR.md`.

Translate the fourteen fixture files line for line into English. SIZE and EPIC keep their exact counts of Intent
lines, EARS lines and scenarios, since `lint.test.ts:242-245` asserts the oversize findings and the count
`16 EARS lines`. Each EARS line keeps its classification: an English line that was a valid pattern stays valid, one
that drew a diagnosis draws the same diagnosis.

Goldens: `fixture lint-hygiene`, `fixture lint-gherkin`, `fixture lint-missing-files`, `fixture lint-report` and
`fixture frontmatter-errors` (snapshot and lint), and `status case frontmatter-errors`.

Must not change: every finding's file, line, level and rule; every other test in the two files.

## Task 10: The verification-edges fixture and the remaining core tests move to English
covers: D-04
files: packages/core/test/fixtures/verification-edges/accord/tickets/A.md, packages/core/test/fixtures/verification-edges/accord/tickets/B.md, packages/core/test/fixtures/verification-edges/accord/tickets/C.md, packages/core/test/fixtures/verification-edges/accord/tickets/A/verification.md, packages/core/test/fixtures/verification-edges/accord/tickets/ORPHAN/verification.md, packages/core/test/verification.test.ts, packages/core/test/sections.test.ts, packages/core/test/status.test.ts, packages/core/test/trailers.test.ts, packages/core/test/__golden__/verification-edges.snapshot.json, packages/core/test/__golden__/verification-edges.lint.json, packages/core/test/__golden__/verification-edges.A.done.json
verify: packages/core/test/trailers.test.ts#risk:parsing-a-forbidden-line-is-found-by-letter-case-and-leading-whitespace-and-never-in-the-subject, packages/core/test/snapshot.test.ts#fixture-verification-edges->-matches-the-golden, packages/core/test/gate.test.ts#gate-case-verification-edges.A.done->-matches-its-golden

Consumes: the preamble rules. Produces: English `verification-edges` and the last Vietnamese-free core tests.

Tests first:
- `verification.test.ts` lines 24 to 53: block names `'One'`, `'Two'`, `'Four'`; evidence
  `'line one\nline two\nline three'` and `'run npm test'`; the duplicate heading `"## @ac-1 One more time"`. The
  fixture `A/verification.md` changes by the same substitution, line for line.
- `sections.test.ts` line 137: `'@ac-1 One'` and `'@ac-1 One more time'`.
- `status.test.ts` lines 18 to 48 (`ARCHIVED_TICKET`): English, line for line; its EARS line stays one valid
  event-driven line.
- `trailers.test.ts` line 11: the quoted owner word becomes `"yes"`, so the line reads `Owner: "yes"`.

Translate A, B, C, `A/verification.md` and `ORPHAN/verification.md` line for line into English.

Goldens: `fixture verification-edges` (snapshot and lint), `gate case verification-edges`, and
`status case archived`.

Must not change: what each edited test asserts beyond the text; every finding's line, level and rule.

## Task 11: Every ticket keeps the stage it had on the base commit
covers: @ac-3, D-05
files: packages/core/test/stage-baseline.test.ts (new), packages/core/test/fixtures/st-ln-48/base-stages.json (new), packages/core/test/fixtures/st-ln-48/fingerprints.json (new)
verify: packages/core/test/stage-baseline.test.ts#ac-3-every-ticket-keeps-the-stage-it-had-on-the-base-commit (@ac-3)

Precondition: this task is built last, after Task 12 and after the last review round of Tasks 1 to 10 and 12, and the
main session has done Main session steps 2 and 3 (ticket records translated and reviewed, then `accord approve` and
`plan_hash` done). Its brief says so and lists the ids that Main session step 6 excludes (none when origin/main was
never merged). When the brief does not say so, stop and report it.

Consumes: `loadSnapshot` and `statusRows` from `../src/index.js`, `readDir` from `./helpers/fixture.js`, and
`createHash` from `node:crypto`. Produces: the pinned stage map of commit `d5db8c3`, the fingerprints of the cleaned
records, and the ac-3 test. The folder `fixtures/st-ln-48/` holds no `accord/` folder, so the fixture loops in
`snapshot.test.ts` and `lint.test.ts` skip it.

Interface, in the new test file:
- `accordInput(dir: URL): SnapshotInput`: `readDir(new URL('accord/', dir))`, every key prefixed with `accord/`,
  `tree` the sorted keys.
- `stagesOf(input): Record<string, string>`: `statusRows(loadSnapshot(input))`, keeping rows whose `stage` is defined
  and whose `id` is not `ST-LN-48`, as `{ [id]: stage }`. Core only: no claim branches or plan commit facts (ledger
  Ruling 22).
- `fingerprint(files, id): string`: SHA-256 hex over, for each path of `accord/tickets/<id>.md`,
  `accord/tickets/<id>/ledger.md`, `.../plan.md`, `.../review.md` and `.../verification.md` in that order,
  `path + '\n' + (files[path] ?? '').replace(/\r\n/g, '\n')` followed by one NUL character.

Test first:
- `it('ac-3 every ticket keeps the stage it had on the base commit')`:
  - `base` and `prints` are the two JSON files, read with `readFileSync` and `JSON.parse`.
  - `input = accordInput(new URL('../../../', import.meta.url))` and `now = stagesOf(input)`.
  - `compared = Object.keys(base).filter((id) => Object.hasOwn(prints, id) && prints[id] === fingerprint(input.files, id))`;
    `expect(compared.length).toBeGreaterThan(0)`.
  - `expect(compared.filter((id) => now[id] !== base[id]).map((id) => `${id}: ${base[id]} -> ${now[id]}`)).toEqual([])`.

Writing the two pinned files, with a throwaway `packages/core/test/zz-pin.test.ts` that holds copies of the three
functions and is deleted before the task ends:
- `base-stages.json`: run `git worktree add --detach <tmp> d5db8c3` into a folder under the OS temp folder, write
  `stagesOf(accordInput(pathToFileURL(<tmp> + '/')))` as JSON with sorted keys and two-space indent, then
  `git worktree remove --force <tmp>`.
- `fingerprints.json`: for every id of `base-stages.json` except the ids the brief lists as excluded by Main session
  step 6, `fingerprint(accordInput(<repository root>).files, id)`, sorted keys, two-space indent. `base-stages.json`
  is always taken at `d5db8c3`, merge or not.
- When the test then fails, a stage moved: stop and report the listed lines; do not edit a ticket record.

Must not change: every other test, fixture and helper.

## Task 12: No tracked file holds a Vietnamese-only letter, the HTML plan included
covers: @ac-1, D-01, D-07
files: packages/cli/test/no-vietnamese.test.ts (new), docs/plans/aidlc-vs-accord.html
verify: packages/cli/test/no-vietnamese.test.ts#ac-1-no-tracked-file-holds-a-Vietnamese-only-letter (@ac-1)

Precondition: Tasks 1 to 10 are done and the main session has done Main session steps 2 (ticket records translated)
and 4 (`accord/tests-baseline.txt`). Task 11 comes after this task.

Consumes: Task 1's `vietnameseLines`. Produces: the ac-1 test and the English HTML doc (D-07). Nothing rewrites git
history (D-01); the check reads the working tree only.

Test first, appended to `packages/cli/test/no-vietnamese.test.ts`:
- `it('ac-1 no tracked file holds a Vietnamese-only letter', ..., 60_000)`:
  `expect(vietnameseLines(fileURLToPath(new URL('../../../', import.meta.url)))).toEqual([])`. A failure lists every
  `path:line` left.

Then translate `docs/plans/aidlc-vs-accord.html` in place into English (D-07): every Vietnamese text node, attribute
value (`title`, `alt`, `aria-label`) and comment, accented or not; the `lang` attribute of `<html>` becomes `en` when
it names Vietnamese. Run the test. Any remaining `path:line` outside `accord/` is fixed under the preamble rules and
named in the report; one inside `accord/` is reported for the main session, not edited.

Must not change: the HTML's tags, classes, ids, styles, scripts, links and layout; Task 1's ac-2 test.

## Main session steps

These edit files under the top-level `accord/` folder, which no executor touches. Every record the main session
writes for ST-LN-48 (ledger, review, verification) names a letter of the check set by its code point, never the
letter.

1. Before Task 2: append one rule line to `accord/product/conventions.md` (D-02, ac-5), as its last rule line:
   `- Owner quotes in a ticket's Decisions and Corrections and in approval commit messages are written as a faithful English translation that keeps the owner's meaning and drops nothing, whatever language the owner used.`
2. Before Task 12: translate every Vietnamese line, line for line, into faithful English (ledger Rulings 13 and 17;
   an existing English gloss beside a quote becomes the quote) in: the ticket files ASK-1, BASE-1, BUG-LN-1 to
   BUG-LN-5, IDS-1, REFS-1, SHOW-1, STALE-1, TAGS-1, VID-1, ST-LN-1 to ST-LN-11, ST-LN-14, ST-LN-16 to ST-LN-32,
   ST-LN-34 to ST-LN-47 (each `accord/tickets/<id>.md` that exists); and `ST-LN-1/ledger.md`, `ST-LN-2/plan.md`,
   `ST-LN-2/review.md`, `ST-LN-3/plan.md`, `ST-LN-3/ledger.md`, `ST-LN-4/ledger.md`, `ST-LN-6/ledger.md`,
   `ST-LN-7/plan.md`, `ST-LN-7/plan-review.md`, `ST-LN-7/ledger.md`, `ST-LN-8/plan.md`, `ST-LN-14/ledger.md`,
   `ST-LN-14/debug.md`, `ST-LN-18/ledger.md`, `ST-LN-18/review.md`, `ST-LN-19/plan.md`, `ST-LN-19/ledger.md`,
   `ST-LN-20/plan-review.md`, `ST-LN-21/verification.md`, `ST-LN-27/ledger.md`, `ST-LN-27/verification.md`,
   `ST-LN-30/ledger.md`, `ST-LN-34/ledger.md`, `BUG-LN-3/ledger.md`, `IDS-1/plan.md`, `IDS-1/ledger.md`,
   `TAGS-1/ledger.md`, `STALE-1/review.md`, `STALE-1/ledger.md`, all under `accord/tickets/`. Read each file whole.
   Never change a line inside a ticket's `## Acceptance criteria` block, or a lane S ticket's `## Understood` and
   `## Done when` sections: they feed `ac_hash` and `verified_hash`, and none holds Vietnamese at `d5db8c3`; if one
   does, stop and ask the owner. Then run `npx vitest run packages/core/test/benchmark-compliance.test.ts`: its ac-4
   test reads `BUG-LN-3` and `ST-LN-7` `ledger.md` and `review.md` (line 23) and must stay green; when it fails, fix
   the translation, never the test.
3. After the last review round of Tasks 1 to 10 and 12, before Task 11 (D-05; the Approach runs `accord approve`
   last, at the verified commit). The base `B` of a ticket is `d5db8c3`, or the merged main commit for a ticket step 6
   names. With core, at `B` (a detached worktree) and on the branch, compute per ticket `approvedHash(ticket)`,
   `readyHash(ticket)`, `acHash(ticket.scenarios)` and the plan's `bodyHash`, and note at `B` which recorded key
   (`approved_hash`, `ac_hash`, `verified_hash`, `plan_hash`) equals its hash.
   - `readyHash` and `acHash` must be equal at `B` and on the branch for every ticket. Where one differs, an edit
     changed hashed criteria text by accident: restore that text to its form at `B` (D-05 keeps every tick bound to
     what the owner ticked). `ac_hash` and `verified_hash` of real tickets are never rewritten.
   - Run `accord approve <id>` only for a ticket on step 2's list whose `approved_hash` matched at `B` and whose
     `approvedHash` changed (ledger Ruling 15). A ticket not on step 2's list whose `approvedHash` changed is an error:
     restore its record to its form at `B`. A ticket whose `approved_hash` did not match at `B` is left as written.
   - Set `plan_hash` to the new `bodyHash` only for a plan on step 2's list whose `plan_hash` matched at `B` and whose
     `bodyHash` changed (ledger Ruling 16); every other `plan_hash` is left as written.
4. Before Task 12: replace each `old id -> new id` pair that Tasks 3, 4 and 6 report in place in
   `accord/tests-baseline.txt` (ledger Ruling 4).
5. After Task 11, at the verified commit, as verification evidence for ac-3: run the branch's
   `accord status --json --all` in a detached worktree of `d5db8c3` and on the branch, and compare `stage` for every
   ticket other than ST-LN-48; for a ticket step 6 names, compare against `accord status --json --all` run in a
   detached worktree of the merged main commit instead. A ticket record edited after Task 11 (a review fix) gets
   step 3 again and a fix task that rewrites `fingerprints.json` by Task 11's procedure.
6. Merging origin/main. The owner's standing rule merges origin/main into this branch whenever the branch is behind,
   at any step; `base-stages.json` stays pinned at `d5db8c3`, as the Approach states, and each merge is handled here.
   After every merge of origin/main: list the tickets whose records differ between `d5db8c3` and the merged main commit
   (`git diff --name-only d5db8c3 <merged main commit> -- accord/tickets/`); for each, run step 2 on its Vietnamese
   lines and step 3 with `B` the merged main commit; pass their ids to Task 11 (or to a fix task that reruns its
   fingerprint procedure) as excluded from `fingerprints.json`, so the ac-3 test skips them; and rerun step 5, which
   compares them against the merged main commit. Then run Task 12's ac-1 test again.
