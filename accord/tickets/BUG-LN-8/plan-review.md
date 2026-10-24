# Plan review

## Round 1 (whole)
1. Should — the not-refreshed warning is lost when the push fails (security lens): append it to the push-failure UsageError message on a refusal, and test a failing push — open
2. Should — tests read the upgraded workflow from a checkout, which autocrlf turns CRLF on Windows; read it with `git show upgrade/<v>:.github/workflows/accord.yml` in every case — open
3. Should — no test reaches the whole-document guard: add a step with `env: &base` reused as `*base` by a team step to Task 3's risk test, expecting only the repin and the warning — open
4. Nice — Task 1's `expected === fresh` assertion cannot fail; drop it and record in the ledger whether 0.1.0's lines before the step match today's — deferred
