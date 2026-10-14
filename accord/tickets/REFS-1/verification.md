---
ticket: "REFS-1"
commit: "835b72ce9a4f4293914b575d5df50ed03cd5bea1"
reviewed_on: "2026-10-14"
---

## @ac-1 a citation under a dot-led directory resolves

Result: pass

Evidence: Exists: packages/core/test/gate.test.ts:948-952 builds a verification.md with `.claude/skills/x.md` in backticks and the path in the tree. Substantive: packages/core/src/gate/refs.ts:34-52 `token()` keeps a single leading dot followed by a non-punctuation, non-separator character (line 48), so `.claude/skills/x.md` is no longer trimmed. Wired: `candidates` (refs.ts:66) calls `token`; `evidenceUnresolved` and `referenceUnknown` (refs.ts:164, 178) call `candidates` and `resolves`, reached through gateDone in the test. Data flows: ran `npx vitest run packages/core/test/gate.test.ts packages/core/test/agents.test.ts packages/core/test/refs.test.ts`, 188 passed. The test asserts both rules return no finding for the block, from real snapshot loading.

## @ac-2 a citation starting with ./ resolves

Result: pass

Evidence: Exists: packages/core/test/gate.test.ts:954-958 cites `./docs/x.md` as a bare token. Substantive: refs.ts:48 keeps a run of one or two dots followed by `/`; `normaliseKey` (imported at refs.ts:9, used at refs.ts:87) strips `./`, so the key matches the tree path. Wired: resolves, called from `cites` and `unresolvedRefs`, is reached through gateDone. Data flows: the same vitest run passed, and neither gate.evidence-unresolved nor gate.reference-unknown fires.

## @ac-3 a citation with a line range resolves

Result: pass

Evidence: Exists: packages/core/test/gate.test.ts:969-973 cites `packages/core/src/x.ts:9000-9001`, a range far beyond any real file length. Substantive: refs.ts:23 `POSITION = /:\d+(?:[:-]\d+)?$/` removes the `:n-m` suffix inside `token()` at refs.ts:51. Wired: `token` feeds `candidates`, which feeds the gate rules. Data flows: the vitest run passed. Core holds no source text (the snapshot has only the tree), and `resolves` only tests membership at refs.ts:87-88, so no line count is read.

## @ac-4 a citation starting with ../ is still reported, as written

Result: pass

Evidence: Exists: packages/core/test/gate.test.ts:960-967 cites `docs/x.md` and `../x.md`. Substantive: refs.ts:48 keeps a run of two dots followed by `/`, so the token stays `../x.md`. `resolves` does not match it, because `normaliseKey` strips only `./`. The warning at refs.ts:185 prints the token as written. Wired: referenceUnknown is reached through gateDone. Data flows: the test asserts exactly one warning, that its reason contains `"../x.md"`, and that there is no gate.evidence-unresolved finding for the block. The vitest run passed.

## @ac-5 the verifier states how to cite a file

Result: pass

Evidence: Exists: packages/core/test/agents.test.ts:46-50 asserts the verbatim sentence over the rendered `.claude/agents/accord-verifier.md` text. Substantive: grep found the exact sentence at packages/core/agents/verifier.md:38, the source, and at .claude/agents/accord-verifier.md:40, the installed copy. Wired: the test renders through `agentTargets(config())`, the same path used to produce installed agents. Data flows: the vitest run passed, and the test fails on a render without the sentence because it uses `toContain` on the rendered text.
