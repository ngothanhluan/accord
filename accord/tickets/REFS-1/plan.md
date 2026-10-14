---
baseline: 982ad346b512c265185021eedd1445627b8e8cc2
plan_hash: "fnv1a64:47162a32ed9e959a"
---

Review mode `outcome`: one branch, no slices. Report case ids follow the JUnit id shape in
`packages/core/src/load/junit.ts`: `<file>#<test name>` with each whitespace run turned into `-`. Every new test
below is a top-level `it(...)` with no `describe` wrapper, whose name starts with its criterion (`ac-n`, no
leading `@`) when its verify id maps a scenario, and otherwise with `risk:<kind>`, the kind from the reviewer's
list. A test name never holds `@` or a comma. Agent sources render through `npm run gen`, then `npm run build`,
then `node packages/cli/dist/cli.js skills sync`.

## Task 1: Wiring: a leading dot that starts a path stays on the citation
covers: @ac-1, @ac-2, @ac-4, D-01, D-02, D-04, D-05, D-07, D-08
files: packages/core/src/gate/refs.ts, packages/core/test/gate.test.ts, packages/core/test/refs.test.ts
verify: packages/core/test/gate.test.ts#ac-1-a-citation-under-a-dot-led-directory-resolves (@ac-1), packages/core/test/gate.test.ts#ac-2-a-citation-starting-with-dot-slash-resolves (@ac-2), packages/core/test/gate.test.ts#ac-4-a-parent-directory-citation-is-reported-as-written (@ac-4), packages/core/test/refs.test.ts#risk:parsing-a-dot-extension-word-in-prose-is-not-a-candidate, packages/core/test/refs.test.ts#risk:parsing-a-run-of-three-dots-before-a-path-is-stripped, packages/core/test/refs.test.ts#risk:parsing-a-dot-before-a-quote-is-stripped-with-the-quote, packages/core/test/refs.test.ts#risk:parsing-a-backslash-parent-path-is-named-as-written

Tests first.

`packages/core/test/gate.test.ts`, at the end of the file, at module level (it already holds `input`, `GIT`,
`gateDone`, `loadSnapshot`, and the `GateResult` type):
- Helper `citing(evidence: string, paths: string[]): GateResult`: `raw = input('gate-done', GIT)`; push each of
  `paths` onto `raw.tree` and add nothing to `raw.files`, so the cited files exist in the tree with no content;
  in `raw.files['accord/tickets/PASS/verification.md']` replace `Evidence: test/login.spec.ts#ok1` with
  `Evidence: ` + `evidence`; return `gateDone(loadSnapshot(raw), 'PASS')`.
- Helper `onAc1(r: GateResult, rule: string)`: the findings of `rule` whose `reason` includes `"@ac-1"` (both
  rules name the block as `evidence block "@ac-1"`).
- `it('ac-1 a citation under a dot-led directory resolves')`: ``citing('the rule is in `.claude/skills/x.md` now', ['.claude/skills/x.md'])``
  (the citation wrapped in backticks inside the evidence text); `onAc1` for `gate.evidence-unresolved` and for
  `gate.reference-unknown` are both `[]`.
- `it('ac-2 a citation starting with dot slash resolves')`: `citing('see ./docs/x.md for the rule',
  ['docs/x.md'])`; the same two assertions.
- `it('ac-4 a parent directory citation is reported as written')`: `citing('docs/x.md holds it and ../x.md
  does not', ['docs/x.md'])`; `onAc1(r, 'gate.reference-unknown')` has length 1, level `warning`, and its reason
  contains `"../x.md"` with the quotes; `onAc1(r, 'gate.evidence-unresolved')` is `[]`.

`packages/core/test/refs.test.ts`, at the end of the file, using its `candidates`, `unresolvedRefs`, and `S`:
- `it('risk:parsing a dot extension word in prose is not a candidate')`: `candidates('the .md file and the .ts
  one', S)` is `[]`; positive control in the same test: `candidates('.eslintrc.json', S)` is
  `['.eslintrc.json']` (a dot-name keeps its dot).
- `it('risk:parsing a run of three dots before a path is stripped')`: `candidates('...packages/x.ts', S)` is
  `['packages/x.ts']`. A guard: it passes before and after the change.
- `it('risk:parsing a dot before a quote is stripped with the quote')`: `candidates('."packages/x.ts"', S)` is
  `['packages/x.ts']`. A guard as above.
- `it('risk:parsing a backslash parent path is named as written')`: `unresolvedRefs('..\\x.md', S)` is
  `['..\\x.md']` (the JavaScript literal; the text holds two dots, one backslash, `x.md`).

Show ac-1, ac-2, ac-4 and the first and fourth risk tests failing (the dot is trimmed today), and the two guards
passing.

Code, `packages/core/src/gate/refs.ts` only:
- `token(raw: string): string` keeps its signature. The end trim is unchanged (every PUNCT character, `.`
  included). The start trim loops: skip every PUNCT character that is not `.`; at a `.`, measure the run of dots
  starting there and read the character after it (`next`, or none when the run reaches the end of the trimmed
  range). Keep the run, ending the start trim, when it is one or two dots and `next` is `/` or `\`, or when it
  is one dot and `next` exists and is neither in PUNCT nor `.`, `/`, `\`. Any other run is skipped whole and
  the loop continues. Then `POSITION` is removed as today.
- `shaped(t, snapshot)`: first line returns `false` when `t` starts with `.` and `EXT.has(t.slice(1))`, so a
  bare `.md` or `.ts` is not a candidate; the `/`, extension, and test-id arms follow unchanged.
- `resolves` and `normaliseKey` are not touched: `./docs/x.md` becomes `docs/x.md` there; `../x.md` and
  `..\x.md` stay unresolved and the warning names the token as written.
- The header comment above `token()` says a leading dot run is kept only where it starts a path (D-08).

Must not change: every existing case in `refs.test.ts` and `gate.test.ts`, every golden under
`packages/core/test/__golden__/`, `resolves('.\\src\\auth\\login.ts', S)` staying true, a trailing `.` still
trimmed, and the exported signatures of `candidates`, `resolves`, `unresolvedRefs`, `stripRefs`.

## Task 2: A line range after a path is read as a position
covers: @ac-3, D-01, D-04, D-05, D-06
files: packages/core/src/gate/refs.ts, packages/core/test/gate.test.ts, packages/core/test/refs.test.ts
verify: packages/core/test/gate.test.ts#ac-3-a-citation-with-a-line-range-resolves (@ac-3)

Consumes the `citing` and `onAc1` helpers from Task 1. Test first, in `packages/core/test/gate.test.ts` after
the Task 1 tests: `it('ac-3 a citation with a line range resolves')`: `citing('packages/core/src/x.ts:9000-9001
holds the branch', ['packages/core/src/x.ts'])`; `onAc1` for `gate.evidence-unresolved` and for
`gate.reference-unknown` are both `[]`. The file is in the tree with no content and far fewer than 9000 lines
is never checked, which is what "no line count is read" means for a core that holds no source text (D-06).
Show it failing.

Code: `POSITION` in `packages/core/src/gate/refs.ts` becomes `/:\d+(?:[:-]\d+)?$/`, its comment naming
`path:42`, `path:42:7`, and `path:12-14`. In `packages/core/test/refs.test.ts`, the existing case
`strips an editor-style :line and :line:col suffix` gains one line: `candidates('src/auth/login.ts:12-14', S)`
is `['src/auth/login.ts']`. Show both passing.

Must not change: `:n` and `:n:m` stripping; the Task 1 tests; every golden.

## Task 3: The verifier states how to cite a file
covers: @ac-5, D-01, D-03, D-04, D-07
files: packages/core/agents/verifier.md, packages/core/src/generated/agents.ts, .claude/agents/accord-verifier.md, packages/core/test/agents.test.ts
verify: packages/core/test/agents.test.ts#ac-5-the-verifier-states-how-to-cite-a-file (@ac-5)

Test first, in `packages/core/test/agents.test.ts`, top level, after the existing top-level `ac-5` test about
the planner and the executor: `it('ac-5 the verifier states how to cite a file')`. The text of
`.claude/agents/accord-verifier.md` in `agentTargets(config())` is non-empty and contains
``Cite a file by its path from the repository root, with `:n` or `:n-m` after it for a line or a range of lines.``
verbatim. Show it failing.

Then:
- `packages/core/agents/verifier.md`: in the paragraph after the format block, directly after the sentence
  ``The evidence names the command, the path, or the output, for each of the four levels.``, add the sentence
  above, kept whole on one source line so the render holds it verbatim.
- `npm run gen`, `npm run build`, `node packages/cli/dist/cli.js skills sync`, in that order, which rewrite
  `packages/core/src/generated/agents.ts` and `.claude/agents/accord-verifier.md`. Read the committed
  `.claude/agents/accord-verifier.md` and show it holds the sentence. Show the test passing.

Must not change: every phrase `AGENT_REQUIRED` pins for `verifier`; the body stays within 60 lines
(`names no other tool and stays short`); the drift test `generated module matches agents/ (drift)` passes; no
other agent file changes; `docs/design.md` is not edited.
