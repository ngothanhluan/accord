# Ledger

## Tasks
- task 1 done 003814fb1094

## Rulings
- Ruling: the preamble ends at the first `## Task n` heading in file order, so any non-task `##` section before it goes into the brief — the ticket says "text before `## Task 1`" — cost if wrong: briefs get longer.
- Ruling: the file-shape test runs on the part before the first `#` — a mistyped test id such as `test/login.spec.ts#okk` keeps warning — cost if wrong: one more warning in a rare case.
- Ruling: the "`## Context` above Task 1" risk test goes in `packages/core/test/work.test.ts`, not `refs.test.ts` as the Approach lists — that is where `parsePlan` is tested — cost if wrong: one test sits in a different file.
- Ruling: "a tree path lies under it" means `p.startsWith(head + '/')` or `p.includes('/' + head + '/')`, the same segment-boundary suffix rule as `resolves` — cost if wrong: a directory named only by its trailing part stays silent.
- Ruling: the blank line between the ticket and `---` stays, as ac-2 requires byte-identity with today's output, and the ac-1 test expects it too — cost if wrong: ac-1 and ac-2 read as contradicting each other.
- Ruling: the new `gate.test.ts` titles are worded apart from REFS-1's `ac-1`…`ac-4` titles so no report id repeats — cost if wrong: none.
- Ruling: the preamble slicing sits in a small `preamble()` helper in work.ts rather than inline in `parsePlan` — readability — cost if wrong: none.

## Deferred
- Executors that fix review or debug findings get the ticket plus the findings, not the plan's preamble (D-08); a later ticket.
- The `brief` help text in packages/cli/src/run.ts, packages/core/agents/executor.md and packages/core/agents/critic.md still describe the brief as ticket plus one task.
- `gate.reference-unknown` still warns on: a branch like `release/2.x`, a heading anchor on a real file, a cited gitignored file (the junit report), a dotted directory outside the tree, a URL without a scheme ending in a file name.
