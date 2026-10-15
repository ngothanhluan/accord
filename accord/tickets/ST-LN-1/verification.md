---
ticket: "ST-LN-1"
commit: "85f4f9c49f71d8e57b7c77b75217945f097918d1"
reviewed_on: "2026-10-15"
---

## @ac-1 The active ticket is found from a branch named by the template

Result: pass

Evidence: Exists: packages/cli/test/lane-commands.test.ts:1035-1048 (config `branch: "feature/{id}"`, checkout feature/ST-AN-2, `anchor` exit 0 with `# Anchor: ST-AN-2 "Export"`, and the session-resume hook prints the same). Substantive: packages/cli/src/load/fs.ts:257 `ticketOfBranch` matches the whole branch name against each template. Wired: packages/cli/src/commands/anchor.ts:27-30 `activeTicket` passes `snapshot.branchTemplates`; packages/cli/src/commands/hook.ts:22 calls it. Data flows: templates come from config via packages/core/src/load/snapshot.ts and the loader, not a constant. I ran vitest on lane-commands, stage-skills and schemas tests: 34 passed, 0 failed. junit.xml shows the ac-1 test passing.

## @ac-2 Branches named by the template and t/ branches both count as claims

Result: pass

Evidence: Exists: packages/cli/test/lane-commands.test.ts:1085-1116 builds origin/feature/ST-AN-2 (an@example.com) and origin/t/ST-AN-3 (bo@example.com) with `commit-tree`. It asserts status claimedBy and branch for each, and that next lists only ST-AN-4 with branch feature/ST-AN-4. Substantive and wired: gitClaims in packages/cli/src/load/fs.ts scans one pattern pair per template and keeps each claim's branch. packages/core/src/status/rows.ts and packages/core/src/status/branch.ts set `branch` on the rows. Data flows: branch and author come from real git refs created in the sandbox repo. Test passed in my run and in junit.xml. The extra risk tests (lane-commands.test.ts:1118-1155) also pass.

## @ac-3 Lint rejects an invalid template and other commands fall back to t/{id}

Result: pass

Evidence: Exists: packages/cli/test/lane-commands.test.ts:1157-1179 loops over "{id}", "feature/{id}/{id}", "feature/x", "feature {id}" and "feature/..{id}". For each, `lint --json` exits 1 with a `schema.*` finding at pointer /branch, and `anchor` on t/ST-AN-2 still anchors ST-AN-2. "feature/{id}" gives no /branch finding. Substantive: packages/core/schemas/config.schema.json adds `branch` as an allOf of 10 patterns (one {id}, a fixed character, the allowed character set, the `..`, `//`, `.lock` and `t/` rules). Wired: the schema is validated by lint, and the loader falls back to t/{id} when the template is invalid. packages/core/test/schemas.test.ts was updated and passes. Test passed in my run.

## @ac-4 Without the key nothing changes

Result: pass

Evidence: Exists: packages/cli/test/lane-commands.test.ts:1181-1195. With no `branch` key, local t/ST-AN-2 is checked out and origin/feature/ST-AN-3 exists. It asserts the anchor is ST-AN-2, ST-AN-2 has claimedBy, and ST-AN-3 has none. Substantive and wired: the default templates are `[DEFAULT_BRANCH_TEMPLATE]`, as used at packages/cli/src/commands/anchor.ts:30. Data flows: the refs are real git refs in the sandbox. Test passed in my run and in junit.xml.

## @ac-5 The /accord skill uses the template

Result: pass

Evidence: Exists: packages/core/test/stage-skills.test.ts:148-162 slices Continue, Pick up and New request (the M bullet) from the rendered .claude/skills/accord/SKILL.md. Substantive: I read .claude/skills/accord/SKILL.md. Continue (line 49) says "Switch to its `branch` from `accord status --json`". Pick up (line 67) says "Create its `branch` from `accord next --json`... push it". New request M (line 97) says to create the ticket's `branch` and push it. The test also asserts none of the three slices contains `t/` or `{id}`, so no step builds a name. Wired: source packages/core/skills/accord/SKILL.md is compiled into packages/core/src/generated/skills.ts, which the rendered copy comes from. The CLI side that supplies `branch` is covered by ac-2 (status and next rows). Test passed in my run.
