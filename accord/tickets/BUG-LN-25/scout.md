## Files
- `packages/core/src/security/match.ts` — `OWN_COPIES` at :175 and `contentSkipped` at :215-216 (a `startsWith` on the four prefixes). `contentSkipped` is called at :240 (`securityTriggers`) and :293 (`matchedHunks`). Both functions take `options: { generated, unreadable? }`, so they get no sync-path list or core-original text.
- `packages/core/src/skills/targets.ts` — `skillTargets(config)` at :67-86 returns the sorted `{path, text}` list for `.claude/skills/…` and `.agents/skills/…`. `SkillFile` is the element type.
- `packages/core/src/skills/agents.ts` — `agentDir = '.claude/agents'` at :13 and `agentTargets` at :79. `isIntactRender` at :38-42 compares the stored marker hash with `contentHash(withoutMarker(text))`.
- `packages/core/src/skills/plugin.ts` — `pluginDir = '.claude/accord-panel'` at :8 and `pluginTargets(config, pkg)` at :14-35. It returns five files and `[]` unless the claude runtime is declared. It needs `pkg {name, version}`; the version is stamped into `plugin.json` at :26 and into `register.js` at :30.
- `packages/core/src/skills/render.ts` — `contentHash` at :46, `withoutMarker` at :57, and the hash/marker stamp at :111. `markerHash` is exported from `packages/core/src/index.ts:161`.
- `packages/cli/src/commands/skills.ts` — `skills()` at :231 builds `[...skillTargets, ...agentTargets, ...pluginTargets]` at :240 and calls `writeSkillFiles` at :248. `writeSkillFiles` at :60-85 reads each on-disk file and decides `intact` from the marker at :72-74. It rewrites the file when the text differs from the render (:81-82). `writeHooks` at :139 and `SETTINGS = '.claude/settings.json'` at :87. `removeRetired` is called at :250. `RETIRED_FILES` is at `packages/core/src/skills/agents.ts:32`.
- `packages/cli/src/commands/branch-fact.ts` — another caller of the same three target functions, at `packages/cli/src/commands/branch-fact.ts:11`.
- `packages/cli/src/commands/init.ts` — another caller of the same three target functions, at `packages/cli/src/commands/init.ts:67` and `packages/cli/src/commands/init.ts:90`.
- `packages/cli/src/commands/upgrade.ts` — another caller of the same three target functions, at `packages/cli/src/commands/upgrade.ts:102`.
- `packages/cli/src/load/security-facts.ts` — `factsFor` at :67. It reads `generated` from `snapshot.config` at :72, gets the diff from `packageDiff` at :79, and calls `securityTriggers` at :83.
- `packages/cli/src/commands/review-package.ts` — calls `securityTriggers` at :31 and `matchedHunks` at :40.
- `packages/core/src/index.ts` — exports at :120-122 `DEFAULT_SECURITY`, `parseSecurityFile`, `securitySpec`, `diffFiles`, `matchedHunks`, `securityTriggers` and `triggerText`.
- `packages/core/templates/security.md` — the default patterns at :7-13. Path patterns are `ci-workflow` :10, `manifest` :11 and `security-config` :13; the rules comment is at :3. There is no pattern for `.claude/settings.json` or `.mcp.json`.
- `packages/core/src/security/spec.ts` — `parseSecurityFile` at :62. `DEFAULT_SECURITY` at :157 is parsed from `templates['security.md']`. `securitySpec` merge at :227. `EARLIER_ENTRIES` at :166 covers old `security-config` entries.
- `packages/core/src/scaffold/init.ts` — `init` writes `accord/product/security.md` from the template, at `packages/core/src/scaffold/init.ts:101`. `accord/product/security.md` does not exist in this repo.
- `packages/core/test/security.test.ts` — the skip test at :188-198; `.claude/skills/accord/x.ts` is listed as skipped at :194 and :197. Other `securityTriggers` calls are at :46 and :90.
- `packages/cli/test/review-package-security.test.ts` — calls `securityTriggers` with `generated: []` at :374, :408 and :451.
- `packages/cli/test/security-gate.test.ts` — no `.claude/` or `skills sync` reference.
- `packages/cli/test/skills-sync.test.ts` — the sync tests; it imports `skillTargets`, `agentTargets`, `pluginTargets` and `contentHash` at :9.
- `packages/core/test/skills.test.ts` — marker-hash test at `packages/core/test/skills.test.ts:305`.
- `packages/core/test/agents.test.ts` — marker-hash test at `packages/core/test/agents.test.ts:272`.
- `packages/core/test/panel.test.ts` — marker-hash test at `packages/core/test/panel.test.ts:204`.
- `packages/core/test/security-record.test.ts` — other security test.
- `packages/core/test/security-skill.test.ts` — other security test.
- `packages/cli/test/security-round.test.ts` — other security test.
- `packages/core/skills/review/security.md` — the security skill text. No other restatement of the skip rule was found.

## Absent
| Claim | Pattern | Folders | Allowed hits |
|---|---|---|---|
| No `.mcp.json` pattern or reference in security code or templates | `mcp\.json` | `packages/core/src/security/`, `packages/core/templates/` | none |
| No other user of `OWN_COPIES` | `OWN_COPIES` | `.` (ts files) | `packages/core/src/security/match.ts` |
| security-gate test does not touch skills paths | `\.claude/\|skills sync` | `packages/cli/test/security-gate.test.ts` | none |

## Facts
- Item 2, `sensitive:` entries in `accord/config.yml`: it is at :48-57 and holds `packages/cli/src/run.ts` :50, `packages/core/schemas/` :51, `packages/core/src/index.ts` :52, `packages/core/package.json` :53, `packages/cli/package.json` :54, `packages/cli/src/commands/drop.ts` :56 and `packages/cli/src/commands/worktree.ts` :57. None of these match `packages/core/src/security/match.ts`, `packages/core/templates/security.md`, `packages/cli/src/commands/skills.ts`, `packages/core/src/skills/*.ts`, `packages/cli/src/load/security-facts.ts` or `packages/cli/src/commands/review-package.ts`. One entry does match `packages/core/src/index.ts`, if an export is added there (:52). `generated:` at :59-61 lists `packages/core/src/generated/` and `packages/cli/README.md`.
- `sensitive:` is read by `configLists` at `packages/core/src/load/config.ts:22`. It is matched in `packages/core/src/scout/check.ts:116-117` through `matches` (`packages/core/src/gate/scope.ts`).
- `matches` is imported by `packages/core/src/security/match.ts:3` and is used by both `pathMatches` (`packages/core/src/security/match.ts:184-186`) and the `generated` skip.
- Item 3, hash header versus comparing to core originals:
  - `isIntactRender` (`packages/core/src/skills/agents.ts:38`) and `writeSkillFiles` (`packages/cli/src/commands/skills.ts:72-74`) check only that the marker hash equals the hash of the file's own text. They do not compare to a fresh render; that happens separately at `packages/cli/src/commands/skills.ts:75`.
  - `contentHash` is a hash of the text, so a hand-edited body with a re-stamped marker still passes `isIntactRender`.
- Item 3, accord-panel files: they are written by `skills sync` through `pluginTargets` (`packages/cli/src/commands/skills.ts:240`), and also by `init` (`packages/cli/src/commands/init.ts:90`) and `upgrade` (`packages/cli/src/commands/upgrade.ts:102`).
- Item 3, `.claude/settings.json`: `skills sync` merges hooks and panel keys into it via `writeHooks` (`packages/cli/src/commands/skills.ts:139`, `SETTINGS` at `packages/cli/src/commands/skills.ts:87`). It is not in `skillTargets`, `agentTargets` or `pluginTargets`, and there is no marker line in it.
- Item 3, accord-panel marker form: its JSON files carry the marker through `stamp(..., 'json')` (`packages/core/src/skills/plugin.ts:11`) and its JS files through `stamp(..., 'js')` (`packages/core/src/skills/plugin.ts:30,32`).
- Item 3, `.agents/skills/` paths: they come from `skillTargets` (`packages/core/src/skills/targets.ts:79-84`, via `skillDirs(config)`). In this repo the `.claude/agents/*.md` and `.claude/skills/*` copies carry a marker line (e.g. `.claude/agents/accord-scout.md:8`).
- Item 3, no `skillTargets` in core without `config`: the sync path set depends on `AccordConfig` (`roles` and `runtimes`) and, for the panel, on `pkg {name, version}`. The gate path in `packages/cli/src/load/security-facts.ts:67-83` has `snapshot.config` (:72) but no `pkg`. `packages/cli/src/commands/skills.ts:32` imports `pkg` from `packages/cli/package.json`. Core is pure (no `node:fs`), so the sync paths and texts can be computed in core only from `config` plus `pkg` passed in as an argument.
- `matches` at `packages/core/src/gate/scope.ts` is used for path entries ending in `/` or containing `/` (`packages/core/src/security/match.ts:185`). A bare file name such as `.mcp.json` matches at any depth (`packages/core/src/security/match.ts:186`).

Not checked: whether any test passes `.mcp.json` or `.claude/settings.json` through the security gate. The `mcp\.json` search found no hit in security code or templates. I re-verified only some of the cited lines, so the rest keep the original report's numbers. `packages/core/src/security/match.ts:216` held the `contentSkipped` body when I looked, and `packages/core/src/skills/targets.ts:68` now holds the `skillDirs(config)` call, so `:79-84` may have drifted.

## New files
