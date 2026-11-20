Round record: 1

## Round 1 (whole)
1. Nice — the approach does not say where the copy read sits relative to the `try` in `securitySections` for review-package and diff-package; a `cat-file` failure outside it ends the command with exit 2 instead of `(cannot tell: …)` — deferred
2. Nice — gate done already renders every copy for the branch fact; the approach adds a second eager `renderedFiles(config)` in gate done and one on every `accord round`, even when no round changed a copy — deferred
