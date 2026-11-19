## Files
- `packages/core/src/gate/task.ts` — the refusal reason, `packages/core/src/gate/task.ts:20`. The no-hash reason on line 19 also says "run accord gate plan ${id}".
- `packages/core/test/task.test.ts` — asserts the exact message, `packages/core/test/task.test.ts:71`.
- `packages/cli/test/lane-commands.test.ts` — asserts a substring of it, `packages/cli/test/lane-commands.test.ts:878`. The test name at `packages/cli/test/lane-commands.test.ts:863` says "until gate plan runs again".
- `packages/core/skills/build/SKILL.md` — the build skill's rule sits at `packages/core/skills/build/SKILL.md:48-52` (step 7). The task text puts it at line 46, but line 46 is step 6 and step 7 starts at line 48.

## Sensitive
`accord/config.yml:48-57` lists these `sensitive:` entries:
- `packages/cli/src/run.ts` (`accord/config.yml:50`)
- `packages/core/schemas/` (`accord/config.yml:51`)
- `packages/core/src/index.ts` (`accord/config.yml:52`)
- `packages/core/package.json` (`accord/config.yml:53`)
- `packages/cli/package.json` (`accord/config.yml:54`)
- `packages/cli/src/commands/drop.ts` (`accord/config.yml:56`)
- `packages/cli/src/commands/worktree.ts` (`accord/config.yml:57`)

None of these matches `packages/core/src/gate/task.ts`, `packages/core/test/task.test.ts` or `packages/cli/test/lane-commands.test.ts`: none.

## Other readings
- The build skill's copy is `.claude/skills/accord-build/SKILL.md:48-50`, and the bundled copy is in `packages/core/src/generated/skills.ts` (build skill, long line ~29, unconfirmed).
- No generated copy holds the refusal message. The only matches for `changed after accord gate plan` are the three files above and `docs/plans/2026-10-12-phase-2-skills.md:681`. That is a historical plan; it was not checked against the code.
- `packages/core/src/gate/task.ts:19` prints `plan.md has no plan_hash:; run accord gate plan ${id}`. This is the same kind of instruction, but for a plan that never passed the gate. `docs/plans/2026-10-12-phase-2-skills.md:681` quotes it.
- `packages/core/skills/plan/SKILL.md:54-55` says a plan changed after the gate "must pass `accord gate plan <id>` again before `accord task-done`". Its copy is `.claude/skills/accord-plan/SKILL.md:53-54`. This is the plan stage, which the build skill allows to run the gate.
- `packages/core/skills/build/SKILL.md:51` says `accord-plan` reviews an owner change with "critic, then `accord gate plan`", so the gate is run by `accord-plan`, not by build.
- Records that quote the refusal or the conflict:
  - `accord/tickets/BUG-LN-23.md:34`
  - `accord/research/2026-11-14-rule-enforcement.md:158` and `accord/research/2026-11-14-rule-enforcement.md:220`
- Searching `packages/cli/src` for `gate plan` found no other agent-facing "run accord gate plan again" text. The hits there are comments only: `packages/cli/src/load/fs.ts:244` and `packages/cli/src/load/fs.ts:323`.
- `packages/core/test/__golden__/rule-lines.txt:312` is a long line I could not read in full. A count for `changed after accord gate plan|run accord gate plan` in that file returned 0.

## Absent
| Claim | Pattern | Folders | Allowed hits |
|---|---|---|---|
| no generated or README copy of the refusal text | `changed after accord gate plan` | `.` (excluding node_modules, accord/tickets, .planning) | `packages/core/src/gate/task.ts`, `packages/core/test/task.test.ts`, `packages/cli/test/lane-commands.test.ts`, `docs/plans/2026-10-12-phase-2-skills.md` |
| no other CLI-source message with "run accord gate plan ... again" | `gate plan.{0,40}again` | `packages/cli/src` | none (search logged) |

I did not read `packages/core/src/generated/skills.ts` in full, so the claim about its build-skill copy is unconfirmed.

## New files
