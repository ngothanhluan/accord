---
phase: 09-publish-and-dogfood
plan: 07
subsystem: scaffold
tags: [dogfood, init, npx, scaffold, generated-workflow]
status: complete

requires:
  - phase: 09-publish-and-dogfood
    provides: "09-06's @accord-dev/accord@0.1.0 on npm — PROJECT.md rules out dogfooding from a local build"
provides:
  - "accord's own contract installed in accord's own repository, by the published package"
  - ".github/workflows/accord.yml — the workflow ROADMAP criterion 2 is judged on, carrying the D-162 ref: proven to have shipped inside 0.1.0"
  - "the branch `readme-1`, which 09-08 adds the ticket to and pushes as the single pull request (D-155)"
affects: [09-08 which creates the ticket on this branch, 09-11 which moves all three version strings together]

actuals:
  tasks: 2
  commits: 1        # 8570852, the scaffold commit on readme-1, made after the owner reviewed the diff
  files_created: 5  # accord.yml, glossary.md, business-rules.md, AGENTS.md, CLAUDE.md
  branch: readme-1
  plan_head_before: cd1f514

tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .github/workflows/accord.yml
    - accord/product/glossary.md
    - accord/product/business-rules.md
    - AGENTS.md
    - CLAUDE.md
  modified: []

key-decisions:
  - "Run captured verbatim: `npx --yes @accord-dev/accord@0.1.0 init`. No local build was invoked at any point."
  - "The branch is named `readme-1` for the dogfood ticket rather than for this plan, because the scaffold and the ticket ship in one pull request (D-155)."
---

# 09-07: install the contract from the published package

```
$ npx --yes @accord-dev/accord@0.1.0 init
created   .github/workflows/accord.yml
skipped   accord/config.yml
created   accord/product/business-rules.md
created   accord/product/glossary.md
unchanged .claude/skills/accord-ba/SKILL.md
unchanged .claude/skills/accord-ba/ready.md
unchanged .claude/skills/accord-ba/setup.md
unchanged .claude/skills/accord-ba/story.md
unchanged .claude/skills/accord-dev/SKILL.md
unchanged .claude/skills/accord-dev/code-review.md
unchanged .claude/skills/accord-dev/debug.md
unchanged .claude/skills/accord-dev/prototype.md
unchanged .claude/skills/accord-dev/review.md
created   AGENTS.md
created   CLAUDE.md
```

Five files created, one skipped, nine unchanged. `accord/config.yml` came through byte-identical —
same md5 before and after, and `git diff -- accord/config.yml` is empty — so D-130 held on the one
path that already existed, and `runtimes: [claude]` survived. No directory was created for any
runtime other than `claude`.

## The generated workflow carries D-162, and that is the point of this plan

This is the only moment the fix can be checked against a file that actually shipped rather than
against the generator that wrote it:

```
keys  -> ["fetch-depth", "ref"]
depth -> 0
ref   -> ${{ github.event.pull_request.head.sha }}
on    -> ["pull_request"]
perms -> { contents: "read" }
```

Both `npx --yes` invocations in the emitted script pin `@accord-dev/accord@0.1.0`, the same string
`accord/config.yml`'s `accord:` key holds. D-135's "the workflow pin and the config pin are the same
string" is a structural fact here, observed rather than asserted. 09-11 moves all three together.

T-09-24 is closed by the same reading: the workflow triggers on `pull_request` only, declares
`permissions: { contents: read }`, and its `run:` body executes nothing from the checked-out tree.

## Expected, not a finding: one lint warning

```
$ npx --yes @accord-dev/accord@0.1.0 lint
accord/config.yml: warning lint.tokens-missing design.tokens "docs/tokens.css" is not in the
  snapshot; tokens are read from config.design.tokens only, so the token rule is skipped
0 errors, 1 warnings
```

Exit 0, so the generated workflow stays green. This repository ships a CLI and no interface, so
`docs/tokens.css` does not exist and is not meant to; `accord/config.yml`'s own comment says so. The
pull request's job log will show this line, and a reader taking that log as evidence for criterion 2
should not have to wonder about it. The real token measurement happens in another repository
entirely (D-153, D-154) and is 09-10's job.

## Deviation: the pointer block landed where D-144 says, not where the plan said

The plan's action text and artifact table both name `.claude/CLAUDE.md` as the file that receives
the CLI-03 pointer block, and one acceptance criterion asks for "exactly one appended pointer block"
in its diff. The shipped code does something different and deliberate: `POINTER_FILES` in
`packages/core/src/scaffold/pointer.ts` is the source literal `['AGENTS.md', 'CLAUDE.md']`, both at
the repository root, per D-144. Neither existed, so both were created whole rather than appended to,
and `.claude/CLAUDE.md` was not touched.

The plan was wrong about the path, not the code. Nothing was hand-edited to reconcile them. Two
consequences worth carrying forward:

- The dirty-tree precaution the plan opens with turned out to be unnecessary — `.claude/CLAUDE.md`
  had already been committed in `5a2eb4d`, and the files `init` actually writes were new.
- This repository now has a root `CLAUDE.md` beside the pre-existing `.claude/CLAUDE.md`. Both are
  read by the same runtime. That is what D-144 chose, and it is what a stranger's repository gets.

## Observation: the pointer names a directory this repository does not have

The block is fixed text and says skills are installed at `.claude/skills/accord-*` **and**
`.agents/skills/accord-*`. With `runtimes: [claude]`, only the first exists here; `.agents/` is
absent. D-144 states the reason in the source — the literal is deliberately not
`skillTargets(config)`, because ROADMAP criterion 3 names both files unconditionally — so this is a
recorded decision working as designed, not a defect, and no code was changed.

It is still true that an agent reading the block is pointed at a path that is not there. Recording
it here rather than acting on it: the fix would either interpolate config into a block T-07-20
deliberately keeps free of repository content, or drop a path the criterion names. Neither is this
plan's call.

## Self-Check

| Must-have | Verdict |
|---|---|
| Installed by the package on npm, not a local build | PASS — invocation captured verbatim |
| `accord/config.yml` byte-identical afterwards | PASS — md5 match, empty diff |
| `.github/workflows/accord.yml` exists and carries the D-162 `ref:` | PASS |
| Only `.claude/skills/` written, per `runtimes: [claude]` | PASS — nine files unchanged, no other runtime directory |
| `accord lint`: zero errors, one expected warning | PASS — exit 0, `0 errors, 1 warnings` |

The owner reviewed the diff and approved it; the scaffold is committed as `8570852` on `readme-1`,
on its own, with no README change and no ticket file. 09-08 adds the ticket to the same branch.

## Correction, added 2026-09-21 by 09-09

The `npx --yes @accord-dev/accord@0.1.0` invocations recorded above were run from this repository's
root, where `node_modules/.bin/accord` exists and points at `packages/cli/dist/cli.js`. npm resolves
`@accord-dev/accord@0.1.0` against the workspace tree, finds a local package of that name and version,
and declines to fetch. **They ran the local build, not the package on the registry.**

The reported behaviour is unaffected: the local `packages/cli/dist/cli.js` and the published tarball's
are byte-identical, `sha256 6f38f978...deb9e3`, checked by unpacking `npm pack @accord-dev/accord@0.1.0`.
The same bytes ran either way. What is wrong is the provenance claim, not the result.

This is FINDING F-6, and it is also why the generated workflow failed on pull request 1 with
`accord: not found`. See `09-VERIFICATION.md` section 3. The prose above is left as it was written.
