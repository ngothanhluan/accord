---
ticket: "BUG-LN-25"
commit: "5b0e396b6ed0a387835c32d83231fe02b473a4f8"
reviewed_on: "2026-11-19"
---

## @ac-1 A hand-edited accord copy is scanned

Result: pass

Evidence: Exists: test `ac-1 gate done scans a hand-edited accord panel copy on real git (BUG-LN-25)` at packages/cli/test/security-gate.test.ts:183 runs `accord skills sync` in a real git repo, appends a `spawnSync` line to `.claude/accord-panel/plugin/hooks/register.js`, records a round, runs `gate done`, and expects the refusal to contain `register.js:<line>: spawn`. Substantive: packages/core/src/security/match.ts:213-216 drops the four-folder prefix skip (`OWN_COPIES` has no remaining reference under packages/*/src); a path is skipped only when it is in `exempt`. packages/cli/src/load/security-facts.ts:67-80 `exemptCopies` exempts a path only when its head text equals the render after `normaliseText`, so the hand-edited copy is not exempt. Wired: packages/cli/src/commands/gate.ts:67-69 passes `renderedFiles(config)` into `withSecurityFacts` → `factsFor` → `exemptCopies` → `securityTriggers`. Data flows: the trigger text comes from the real `git diff` of the round package, not a fixed value. I ran `npx vitest run test/security-gate.test.ts` in packages/cli and 7 of 7 passed. `tsc --noEmit` is clean in core and cli.

## @ac-2 A file accord does not write in a copy folder is scanned

Result: pass

Evidence: Exists: test `ac-2 a file accord does not write in a copy folder is scanned (BUG-LN-25)` at packages/core/test/security.test.ts:537. Substantive: with the rendered paths passed as `exempt`, a new `.claude/skills/accord/helper.js` holding `spawn(1);` still yields `helper.js:1: spawn (process spawn)`, and `matchedHunks` prints the hunk. Only the exact path in `exempt` goes silent (packages/core/src/security/match.ts:213-216, exact `includes`). Wired: `securityTriggers` and `matchedHunks` both pass `exempt` into `contentSkipped` (match.ts:240, :293). The `exempt` option is optional and nothing is exempt when absent (match.ts:219-223, `options.exempt ?? []`). Data flows: the test feeds a real diff text through the parser. The core suite passed (37 of 37 with templates.test.ts).

## @ac-3 Copies freshly written by skills sync raise no trigger

Result: pass

Evidence: Exists: test `ac-3 copies freshly written by skills sync raise no trigger on real git (BUG-LN-25)` at packages/cli/test/security-gate.test.ts:224. The base commit holds the panel as written by 0.6.0 (`pluginTargets` with an older version), then a real `skills sync` rewrites it. The test asserts the changed paths are only copies and ticket files, and includes `register.js`. Substantive: `gate done --json` has no security finding. `withSecurityFacts` with the real render gives `{rounds:[{head,triggers:[]}]}`. With nothing exempt, the same fixture does raise a `panel-spec` trigger on `register.js`, so the test fails without the exemption (non-vacuous). Wired: the same exemption reaches all five call sites. gate.ts:69, round.ts:43-45, review-package.ts:30-33 (used at :83, :240, :243) and diff-package.ts:57 all call `exemptCopies` or the render getter. The test also checks `review-package --security --round 1` and `diff-package --security` print `(none: no pattern matched)`. Data flows: exemption is decided from the blob text at each package's head via `gitFilesAt` (security-facts.ts:75-79), not from the marker hash. A separate risk test covers CRLF equality, a hand-edited copy, a deleted copy, no git process when no `.claude/` or `.agents/` path changed, and the fail-closed paths. `.claude/settings.json` is not in `renderedFiles` (branch-fact.ts:9-11), so it is not exempted. The suite passed, 7 of 7.

## @ac-4 A change to agent configuration calls the security reviewer

Result: pass

Evidence: Exists: test `ac-4 a change to agent configuration raises agent-config under a team security file (BUG-LN-25)` at packages/core/test/security.test.ts:551. Substantive: packages/core/templates/security.md gains `- agent-config: path .claude/settings.json, .mcp.json — agent configuration that can start commands`. Packages/core/src/generated/templates.ts is regenerated, and the drift test in templates.test.ts passes. The test uses a team `security.md` that does not mention agent configuration. It asserts a trigger `agent-config (agent configuration that can start commands)` on add, edit and delete of `.claude/settings.json`, and on `.mcp.json` and `sub/.mcp.json`. It asserts none for `sub/.claude/settings.json`. It also covers the `Removed:` line (D-12), a team id collision as one problem with the default kept (D-14), and no new checklist item (D-13). Wired: `securitySpec` merges defaults into every spec, and `pathMatches` (match.ts:184-189) is used for all path patterns in `securityTriggers`. Data flows: the path trigger is computed from both `changed` and the diff-shown paths, so a deletion is caught. A further test covers case-insensitive path matching per the owner's ruling. The core suite passed.
