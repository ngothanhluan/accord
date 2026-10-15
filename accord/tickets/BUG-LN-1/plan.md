---
baseline: 4e2aff9d0fef0d85449bfbd1e6905e0824a5c4ea
plan_hash: "fnv1a64:8d8b8d423d11040c"
---

Review mode `outcome`: one branch, no slices. Each task below states every rule and definition it uses, so it can
be finished from its own section and the ticket.

## Task 1: A brief carries the plan's preamble
covers: @ac-1, @ac-2, D-01, D-04, D-05, D-08
files: packages/core/src/model/snapshot.ts, packages/core/src/load/work.ts, packages/cli/src/commands/brief.ts, packages/core/test/work.test.ts, packages/cli/test/lane-commands.test.ts
verify: packages/cli/test/lane-commands.test.ts#ac-1-a-brief-carries-the-plan-preamble (@ac-1), packages/cli/test/lane-commands.test.ts#ac-2-a-plan-with-no-preamble-gives-the-same-brief-as-before (@ac-2), packages/core/test/work.test.ts#risk:parsing-the-preamble-keeps-a-Context-section-and-a-title-above-Task-1

Rules for this task:
- Test ids: every test named on `verify:` is a top-level `it(...)` with no `describe` around it. Its report id is
  the test file's path, then `#`, then the `it` title with each whitespace run turned into `-`
  (`packages/core/src/load/junit.ts`). No test title holds `@`, `#` or a comma.
- CLI tests import core from `packages/core/dist`: after changing core source, run `npm run build -w
  packages/core` before running any CLI test.
- Helpers in `packages/cli/test/lane-commands.test.ts`, all already imported there: `makeLaneRepo(extra)`,
  `run(argv, cwd)` (gives `{ code, out, err }`), `cleanup(repo)` from `./helpers/repo.js`; `readFileSync` from
  `node:fs`; `join` from `node:path`. `makeLaneRepo(extra)` makes a git sandbox holding lane ticket `T-1`, its
  plan `accord/tickets/T-1/plan.md` (the helper `PLAN`, whose body starts with a `# Plan` line above
  `## Task 1: Writer csv mode` and `## Task 2: Escaping`), each overridden by the `extra` path-to-text map.

Tests first (this is the bug's failing reproduction: ac-1 fails at the baseline).
- `packages/cli/test/lane-commands.test.ts`, top-level `it('ac-1 a brief carries the plan preamble')`:
  with `RULE = 'Shared rule: run the build first.'`,
  `makeLaneRepo({ 'accord/tickets/T-1/plan.md': '---\nbaseline: abc1234\n---\n\n' + RULE + '\n\n## Task 1: A\ncovers: @ac-1\n\n## Task 2: B\ncovers: @ac-2\n' })`.
  `ticket = readFileSync(join(repo, 'accord/tickets/T-1.md'), 'utf8')`. `run(['brief', 'T-1', '2'], repo)`: code 0
  and `out` equal to `ticket.replace(/\n*$/, '\n') + '\n---\n\n' + RULE + '\n\n## Task 2: B\ncovers: @ac-2\n'`;
  `out` does not contain `Task 1`. `cleanup` in `finally`.
- Top-level `it('ac-2 a plan with no preamble gives the same brief as before')`: the same, with the plan
  `'---\nbaseline: abc1234\n---\n\n  \n\n## Task 1: A\ncovers: @ac-1\n'` (blank lines and one whitespace-only line
  before Task 1) and `run(['brief', 'T-1', '1'], repo)`: code 0 and `out` equal to
  `ticket.replace(/\n*$/, '\n') + '\n---\n\n## Task 1: A\ncovers: @ac-1\n'`, which is today's formula. This case
  passes at the baseline and must still pass after the change; it is the byte-identity guard.
- `packages/core/test/work.test.ts`, top-level
  `it('risk:parsing the preamble keeps a Context section and a title above Task 1')`:
  with `F = '~~~'` (a tilde fence, so no backtick escaping is needed),
  `pre = '# Title\n\n## Context\nrule\n' + F + '\n## Task 9: fenced\n' + F + '\n\n'`:
  `parsePlan('p', '---\nbaseline: x\n---\n' + pre + '## Task 1: A\ncovers: @ac-1\n').plan.preamble` is `pre`
  (the fenced heading is not a task, so the preamble runs past it); `parsePlan('p', '## Task 1: A\n').plan.preamble`
  is `''`; a plan with no task at all, `parsePlan('p', 'only prose\n')`, has preamble `'only prose\n'`; the
  CRLF-and-BOM form of the first text (`'﻿' + text.replace(/\n/g, '\r\n')`) gives the same preamble.
- The existing case `prints the ticket verbatim, then the one task` in `describe('accord brief')` changes one
  assertion only: line 234's expected substring becomes `'\n---\n\n# Plan\n\n## Task 2: Escaping\ncovers: @ac-2\n'`,
  because the helper plan's `# Plan` line is now a preamble. Its title and every other line stay.

Interface:
- `Plan` in `packages/core/src/model/snapshot.ts` gains a required `preamble: string; // the plan body above the
  first '## Task n' heading, verbatim` placed after `tasks`.
- `parsePlan` in `packages/core/src/load/work.ts` consumes the `body` and `bodyOffset` it already has from
  `splitFrontmatter` and the `sections` from `scan`. The first section whose heading matches `TASK` (in file order,
  a duplicate included) has a 1-based Markdown `line`; `preamble` is `body.split('\n').slice(0, line - bodyOffset
  - 1).join('\n')` plus a trailing `'\n'` when that slice is non-empty, and the whole `body` when no task heading
  exists. `scan` already ignores headings inside fences. Update the function's doc comment to name `preamble`.
- `brief` in `packages/cli/src/commands/brief.ts`: from `plan.preamble`, drop leading and trailing lines whose
  `trim()` is empty; when nothing is left, the output is exactly today's
  `text.replace(/\n*$/, '\n') + '\n---\n\n' + section.replace(/\n*$/, '\n')`; otherwise the kept lines, joined
  with `'\n'`, followed by `'\n\n'`, go between `'\n---\n\n'` and the section. No heading or label is added
  (D-05). Update the header comment: the brief is the ticket, the plan's preamble, then task n.

Must not change: every other `parsePlan` case in `work.test.ts` (tasks, fields, `(new)`, `(@ac-n)` maps,
`bodyHash` and `plan_hash`, the duplicate-task finding, baseline handling); `bodyHash` still hashes the whole body;
the `brief` refusals (no plan, unknown task, ticket without lane, exit 2) and `brief keeps a fenced "## Task" line
inside its task and stops at the next real one`; `gate plan` and `task-done`, which never read `preamble`.

End by running `npm run build`, then the core and CLI test suites.

## Task 2: Only a file-shaped token draws gate.reference-unknown
covers: @ac-3, @ac-4, @ac-5, D-02, D-03, D-06, D-07
files: packages/core/src/gate/refs.ts, packages/core/test/gate.test.ts, packages/core/test/refs.test.ts
verify: packages/core/test/gate.test.ts#ac-3-evidence-tokens-that-are-not-files-draw-no-warning (@ac-3), packages/core/test/gate.test.ts#ac-4-a-mistyped-file-path-still-warns-once-per-token (@ac-4), packages/core/test/gate.test.ts#ac-5-the-error-gate-still-needs-a-file-or-a-test (@ac-5), packages/core/test/refs.test.ts#risk:parsing-a-dotted-directory-in-the-tree-draws-no-warning, packages/core/test/refs.test.ts#risk:parsing-a-line-anchor-on-a-real-file-draws-no-warning-and-a-heading-anchor-still-does, packages/core/test/refs.test.ts#risk:parsing-a-URL-with-a-scheme-draws-no-warning

Rules for this task:
- Test ids: every test named on `verify:` is a top-level `it(...)` with no `describe` around it. Its report id is
  the test file's path, then `#`, then the `it` title with each whitespace run turned into `-`
  (`packages/core/src/load/junit.ts`). No test title holds `@`, `#` or a comma.
- Helpers in `packages/core/test/gate.test.ts`, defined at its end: `citing(evidence, paths)` replaces the PASS
  ticket's `@ac-1` evidence `test/login.spec.ts#ok1` (a test id the fixture's report holds) with `evidence`, adds
  `paths` to the tree, and returns `gateDone`'s result; `onAc1(r, rule)` gives that result's findings of `rule` on
  `@ac-1`. In `packages/core/test/refs.test.ts`: `snap(tree, tests?)` builds a snapshot; `S` is
  `snap(['README.md', 'src/auth/login.ts', 'test/login.spec.ts'], { 'test/login.spec.ts#ok1': 'passed' })`.
- `gate.test.ts` already has top-level cases titled `ac-1 ...` to `ac-4 ...` from an earlier ticket; the new
  titles below differ from them, and those cases stay as they are.

Tests first.
- `packages/core/test/gate.test.ts`, top-level `it('ac-3 evidence tokens that are not files draw no warning')`:
  with `B = '\x60'` (a backtick) and `q = (s: string) => B + s + B`, call `citing(['ran test/login.spec.ts#ok1 on',
  q('feature/{id}'), q('origin/t/ST-AN-3'), q('refs/heads/t/'), '1/2', '//', 't/', '/branch',
  q('packages/core/skills/*/SKILL.md'), q('.claude/skills')].join(' '), ['.claude/skills/accord/SKILL.md'])`;
  `onAc1(r, 'gate.reference-unknown')` and `onAc1(r, 'gate.evidence-unresolved')` are both `[]`. Fails at the
  baseline. Define `B` and `q` once at module level beside `citing`; the next two cases use them too.
- Top-level `it('ac-4 a mistyped file path still warns once per token')`:
  `citing('test/login.spec.ts#ok1 passes but ' + q('src/nope.ts') + ' and ../x.md are not here', [])`;
  `onAc1(r, 'gate.reference-unknown').map((f) => f.reason)` equals
  `['evidence block "@ac-1" names "src/nope.ts", which is not in the snapshot', 'evidence block "@ac-1" names
  "../x.md", which is not in the snapshot']` (each one string), and every one of those findings has level
  `warning`. A guard: it passes at the baseline and must still pass after the change.
- Top-level `it('ac-5 the error gate still needs a file or a test')`:
  `citing('the skills live in ' + q('.claude/skills') + ' on ' + q('feature/{id}'), ['.claude/skills/accord/SKILL.md'])`;
  `onAc1(r, 'gate.evidence-unresolved')` has length 1 with level `error`, and `r.verdict` is `'fail'`. A guard:
  its red step is a mutation check: make `cites` accept a candidate that the new filter drops, see this case fail,
  restore it.
- `packages/core/test/refs.test.ts`, top-level `it('risk:parsing a dotted directory in the tree draws no warning')`:
  `unresolvedRefs('config/app.d and src/nope.ts', snap(['config/app.d/x.conf']))` is `['src/nope.ts']`.
- Top-level `it('risk:parsing a line anchor on a real file draws no warning and a heading anchor still does')`:
  `unresolvedRefs('src/auth/login.ts#L12 src/auth/login.ts#L3-L9 src/auth/login.ts#intro src/nope.ts#L3', S)` is
  `['src/auth/login.ts#intro', 'src/nope.ts#L3']`.
- Top-level `it('risk:parsing a URL with a scheme draws no warning')`:
  `unresolvedRefs('https://example.com/docs/x.md', snap([]))` is `[]`; `unresolvedRefs('example.com/docs/x.md',
  snap([]))` is `['example.com/docs/x.md']` (no scheme still warns).

Interface: `unresolvedRefs(text, snapshot)` in `packages/core/src/gate/refs.ts` keeps its signature and becomes
`candidates(text, snapshot).filter((c) => !resolves(c, snapshot) && fileShaped(c, snapshot))`, with a new
non-exported `fileShaped(c: string, snapshot: RepoSnapshot): boolean`. With `hash = c.indexOf('#')`, `head =
normaliseKey(hash < 0 ? c : c.slice(0, hash))` (`normaliseKey` is already imported: `\` to `/`, a leading `./`
dropped), and `last` the part of `head` after its last `/`, it returns false when any of these holds, else true:
1. `head` contains `://`;
2. `head` contains a glob character, `/[*?[\]{}]/`;
3. `last` contains `..`, or does not match `/\.[A-Za-z][A-Za-z0-9]*$/`;
4. a tree path lies under `head`: `snapshot.tree.some((p) => p.startsWith(head + '/') || p.includes('/' + head + '/'))`;
5. `hash >= 0`, the part after `#` matches `/^L\d+(?:-L\d+)?$/`, and `resolves(head, snapshot)`.
The returned token is the candidate as written, so `..\x.md` is still named with its backslash. Update the
doc comment of `unresolvedRefs` to say a candidate warns only when it is shaped like a file path (D-02).

Must not change: `candidates`, `token`, `shaped`, `resolves`, `stripRefs`, `cites`, `evidenceUnresolved` and the
`gate.note-*` rules (D-03); every existing case in `refs.test.ts` (including `risk:parsing a backslash parent path
is named as written` and the 200 kB linear-time case) and in `gate.test.ts` (including `EVIDENCE: a block citing
nothing real fails; a mistyped path only warns`); the golden `packages/core/test/__golden__/gate-done.EVIDENCE.done.json`
(its one warning, `src/nope.ts`, stays). One warning per unknown token, as today (D-06).

End by running `npm run build`, the core test suite, and `node packages/cli/dist/cli.js gate done ST-LN-1 --json`
from the repository root. To prove the gate actually ran, it must exit 0 or 1, never 2 (a version-pin or usage
refusal exits 2 and evaluates nothing), and its JSON must hold a `verdict` and a `findings` array. That array must
hold no finding whose `rule` is `gate.reference-unknown`. Run the same command at the baseline first and record
the count of those findings it shows, so the drop is visible.
