---
ticket: "README-1"
commit: "32d9c5a"
reviewed_on: "2026-09-21"
---

## @ac-1 The registry page carries the same description, and its links work

Result: fail

Evidence: The repository half is in place. `npx vitest run packages/cli/test/readme.test.ts`
(5 passed) runs the generator into a temp file and compares `packages/cli/README.md` byte for
byte, so the package page's text is the root README's text; `grep -on "](\([^)]*\))" README.md
packages/cli/README.md` shows the one link rewritten from `docs/design.md` to
`https://github.com/ngothanhluan/accord/blob/main/docs/design.md`, and `curl -sL -o /dev/null -w
"%{http_code}"` on that URL returns 200, so it opens the document it names with no visit to the
repository first.
The scenario's Given is a reader on the registry, and that reader does not see it.
`curl -s https://registry.npmjs.org/@accord-dev/accord` returns a `readme` field that is still the
pre-change text — "A team contract for AI-assisted software delivery", "**Status: design phase.**
Nothing is published yet", and the unrewritten `[docs/design.md](docs/design.md)`. The only
published versions are `0.0.0` and `0.1.0`, and `.github/workflows/publish.yml:80-84` exits the
publish step when `npm view "${PKG}@${VERSION}" version` already answers, so 0.1.0 cannot be
republished with this text. Today's registry reader sees a different description from the
repository reader, and its lone link resolves against npmjs.com, not GitHub. The criterion becomes
true at the next released version, not at this commit.

## @ac-2 The description matches who accord is for

Result: pass

Evidence: `README.md:7` (identical at `packages/cli/README.md:9`): "BA, designer, developer,
reviewer are four stages a ticket passes through, not four job titles. One person passes through
all four in turn; four people on a team divide them. No gate reads who anyone is, so the same
rules hold either way." — both halves stated, and the stages are named as stages.
The wording that presented them as people is gone: `git show b64926c -- README.md` removes "where
a business analyst, designer, and developer write down ... ; QA verifies against the same
acceptance criteria" and replaces it with a subjectless "are written down ... and verified against
those same acceptance criteria afterwards". Reading the whole file, the only remaining role words
are "(designer-owned prototypes)", which labels who owns a folder, and the ``ba``/``dev``/
``designer`` skill names, which name workflow files that exist (`packages/core/skills/{ba,dev,
designer}`) — neither asserts that four people must be present.

## @ac-3 The description does not deny its own release

Result: pass

Evidence: `README.md:9` reads "**Released:** `0.1.0`, as `@accord-dev/accord` on npm", and
`packages/cli/package.json` declares `"version": "0.1.0"`; the registry packument lists 0.1.0 as
published, so the version named is the one that is out. `grep -n "design phase\|Nothing is
published\|still being designed" README.md packages/cli/README.md` returns nothing — the older
claim is not merely outweighed, it is absent. The test
`pins the run instruction to the version the package declares` holds the npx line to the same
string; re-running its own matching logic against a substituted version (scratchpad
`pincheck.mjs`) reports `0.1.1 -> test fails: true`, so the pin is enforced rather than assumed.
The copy a registry reader sees is the previous release's; that lag is recorded once, under ac-1.

## @ac-4 The description names only parts that exist

Result: pass

Evidence: Read `packages/cli/README.md` end to end, opening line through the "Try it" block, then
checked every named part against the tree. Gone: `grep -rn "QA\|mcp\|MCP\|Claude Code\|Cursor\|
Copilot\|Codex" README.md packages/cli/README.md` returns nothing — the QA role, the "stateless
remote MCP server" sentence (`packages/mcp/` holds only a `package.json`), and the four named
runtimes are all removed. Still named, all present: `init`, `new`, `lint`, `gate`, `status`
(`packages/cli/src/commands/{init,new-ticket,lint,gate,status}.ts`); `accord/product/glossary.md`
and `business-rules.md` (`packages/core/src/scaffold/init.ts:87-88`, templates on disk);
`tickets/<id>/verification.md` (`packages/core/templates/verification.md`); the `github-issues`
tracker adapter (`packages/core/schemas/config.schema.json:16` enum, `packages/cli/src/tracker/
github-issues.ts`); the `ba`/`dev`/`designer` skill files (`packages/core/skills/`). The run
section's three claims hold too: `init` writes `accord/`, the skill files for the configured
runtimes (`skillTargets(snapshot.config)`), and `.github/workflows/accord.yml` pinned to the
CLI's own version (`packages/core/src/scaffold/init.ts:78`). "a future multi-repo hub" is named as
future, and is still a planned part, not a removed one.

## @ac-5 A reader can run it from what they just read

Result: pass

Evidence: Made an empty directory under the session scratchpad (`ls -a` showed only `.` and `..`,
no `package.json`, no `node_modules`) and ran the README's line verbatim:
`npx --yes @accord-dev/accord@0.1.0 --version`. Output: `0.1.0`. Nothing was installed first, and
the version it reports is the one the instruction names and the one `packages/cli/package.json`
declares. `README.md:13` states the one prerequisite, "Node 22.12 or newer", which matches
`"engines": { "node": ">=22.12.0" }`.

## Review

### finding — The version appears twice in the README and only one copy is checked
`packages/cli/test/readme.test.ts:56-63` builds ``@accord-dev/accord@([^\s`)]+)`` and compares each
hit to `package.json`'s version. In `README.md` that pattern hits exactly one place, the npx line
at `README.md:16` (confirmed by running the same matching logic: pins found `['0.1.0']`). The
version is written a second time at `README.md:9`, as ``**Released:** `0.1.0`, as
`@accord-dev/accord` on npm`` — backtick-delimited, not after an `@`, so the test never sees it.
Concrete failure: bump `packages/cli/package.json` to `0.1.1` for the next release. The suite goes
red on the npx line only. The developer changes that line to `@0.1.1`, re-runs `npm run gen`, and
the suite is green with a README that announces "**Released:** `0.1.0`" above a command that runs
0.1.1 — the state ac-3 exists to prevent, now shipped to the registry, and shipped precisely at
the release that finally carries the new text to registry readers (see ac-1). Matching the
`Released:` number too, or deriving one of the two from the other, closes it; the test already
loops over every hit, so only the pattern has to widen.
