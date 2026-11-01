---
ticket: "ST-LN-79"
commit: "839857a78921ce025f321440c5e02957e433bd64"
reviewed_on: "2026-11-01"
---

## @ac-1 The fixed context of the main session and of each accord agent is split by owner

Result: pass

Evidence: Exists: packages/core/test/benchmark-fixed.test.ts:904 (ac-1 test); implementation in scripts/benchmark.mjs (--fixed at :1146, fixedReport at :1523) and scripts/fixed-context.mjs. Substantive: the test builds jsonl and probe fixtures, asserts one row per row name with the call count (main 3, agent 2), asserts the owner parts sum to the fixed total (:925-927) and that unattributed equals the measured input less the named parts (:935). Wired: the test drives bench.fixedReport, the same function the CLI entry calls at scripts/benchmark.mjs:1149. Data flows: the first run exits 1 with pending probe commands and the second prints the table from fixture-derived sizes. node_modules/.cache/accord/junit.xml (Linux container run) shows this test passed, with 0 failures in the file. Committed report docs/benchmark/fixed-context.md:19-33 shows the same shape on real data: 11 rows, each with its call count, and parts that add up (main 2291+22659+2754+747+9387+8353+7736 = 53927).

## @ac-2 Every figure is given raw and cost-weighted

Result: pass

Evidence: Exists: test at packages/core/test/benchmark-fixed.test.ts:1040; weighting and ticket shares in scripts/fixed-context.mjs and scripts/benchmark.mjs:1499-1523 (done lane M tickets with a claim commit, from `claim: <id>` commits). Substantive: the test passed in junit.xml; docs/benchmark/fixed-context.md:35-51 gives a cost-weighted table next to the raw one, and states the weights (fresh 1, cache read 0.1, cache write 1.25, output 5) at :137 and :175. Wired: both tables and the shares section come out of fixedReport. Data flows: docs/benchmark/fixed-context.md:140-173 lists 32 done lane M tickets with claim date, call count and two shares (main and accord subagents). Output is an estimate at 4 characters a token, and the report says so (:175).

## @ac-3 The same transcripts give the same figures

Result: pass

Evidence: Exists: test at packages/core/test/benchmark-fixed.test.ts:975. It prints the report twice on the same fixtures and setup. junit.xml shows "ac-3 the report printed twice ..." passed. Wired and substantive: it calls the same fixedReport as the CLI path; there is no model call in the script.

## @ac-4 The committed report holds a real run and the cuts the owner could make

Result: pass

Evidence: Exists: test at packages/core/test/benchmark-fixed.test.ts:1187 reads docs/benchmark/fixed-context.md; junit.xml shows it passed. The report holds the date range and call count ("Transcripts: 53340 calls from 2026-10-12 to 2026-10-31", line 3), a call count per row, a setup-items table (docs/benchmark/fixed-context.md:53) listing the plugins, MCP servers (aws-mcp, the claude.ai connector), CLAUDE.md and memory files, and own skill sets, each with raw / cost-weighted tokens per row, and the exact line "Cursor, Codex and Copilot calls were not measured." (:17). It also names MCP servers it could not measure (:14-15), and the test checks the report holds no home path, email or secret. Data flows: the figures come from the real run, not placeholders (53,340 calls over 40 transcript folders).
