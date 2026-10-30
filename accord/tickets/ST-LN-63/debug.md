# Debug: ST-LN-63

## Episode 1

Symptom: CI run 41017154660 (workflow `ci`) on 729f57b, the first push after the merge of origin/main f772645 (BUG-LN-13) at verify, fails all four `check` jobs (ubuntu-latest and windows-latest, Node 22 and 24) with the same three tests in packages/cli/test/git-count.test.ts:
- risk:complex-branching the default ref resolves in one git process from a symbolic plain or dangling origin HEAD and falls back to the local main
- risk:complex-branching lane S gate done reads the review commit once and fails closed without one
- risk:complex-branching gate plan and gate done read baseline history for the gated ticket alone and the read commands read none

Test Files 1 failed | 94 passed (95) on each job. The merge executor reported git-count.test.ts passing locally on Windows at d3676df.
