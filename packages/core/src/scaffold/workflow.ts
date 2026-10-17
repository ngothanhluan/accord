// CLI-02: the GitHub Actions workflow `accord init` writes into a repository. The first artifact accord
// emits that something other than accord executes, so its shape is asserted by parsing it back
// (`core/test/scaffold.test.ts`) rather than trusted to review.
//
// Why a source literal and not a `packages/core/templates/*.yml` asset (A-08):
//   1. `templates.test.ts` forbids the two-brace sequence a GitHub Actions expression is written with in
//      any template, and this document needs one to read the pull request's base sha.
//   2. `gen-templates.mjs` only picks up `.md` and `.html`, so a `.yml` there would be silently absent
//      from the generated record and the drift test would compare two lists that already agree.
//   3. The text interpolates the package name and version, so it is a function of build facts.
//
// Two things this document deliberately does NOT carry, recorded here because saying so inside the emitted
// YAML would put the very tokens back into the file that the tests scan for their absence:
//   - no `paths` filter on the trigger (D-138). A job that skips itself leaves a required status check
//     pending forever, so the job always runs and the no-ticket case says so in one line and exits.
//   - no `gate ready` (D-140). That gate is what an agent passes before writing code; running it on a pull
//     request would fail every branch that is mid-implementation.
//
// One thing it does carry, and the reason is not obvious from the line (D-162): the checkout names an
// explicit `ref:`. Left to its default, `actions/checkout` lands on GitHub's synthetic merge commit — a
// commit no author ever wrote. `gate done` binds a tick to `git show -s --format=%H HEAD`
// (`cli/src/load/fs.ts`), so a `verified_commit` recorded on the branch never matches, and `tickStaleCommit`
// and `staleReview` both fail a review that is not stale. Stated positively, which is accord's actual rule:
// the review has to be of the code being gated, and what a fresh-context review read is the branch.
//
// `gate done` is skipped for a ticket only when the diff changes nothing outside `accord/` and the ticket is
// unapproved in both its HEAD and base versions, or dropped in HEAD. Any read the script cannot settle counts
// as approved, so a doubt gates. `.github/workflows/accord.yml` carries the same script and must be changed
// with it; `cli/test/workflow-script.test.ts` fails when the two drift.
//
// The script is written out as a block scalar rather than assembled from an object: a YAML serialiser
// round-trip would lose the comment and the block-scalar shape, which are what make this file readable in
// someone else's repository.

/**
 * The whole generated workflow document: LF, no BOM, one trailing newline, no backslash anywhere.
 *
 * `pkgName` and `version` arrive from the same `initFiles(pkg)` call that renders `config.yml`, which is
 * what makes D-135's "the workflow pin and the config pin are the same string" a structural fact rather
 * than a convention someone has to remember.
 *
 * T-07-11: every GitHub Actions expression in this document sits in `env:` or under `with:`, and none in a
 * `run:` body. An expression inside a `run:` body is substituted into the script text before the shell
 * parses it, which is the standard Actions script-injection vector — and `base.sha` and `head.sha` are both
 * attacker-influenced fields on a pull request from a fork. A `with:` value is a mapping the runner
 * evaluates, never shell source.
 */
export function workflowYml(pkgName: string, version: string): string {
  const accord = `npx --yes ${pkgName}@${version}`;
  return `name: accord
on:
  pull_request:
permissions:
  contents: read
jobs:
  accord:
    name: lint and gate the tickets this pull request touches
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          # Keep this. The script below diffs "$BASE"...HEAD, and the default shallow checkout does not
          # contain the base commit: the diff would fail or come back empty, every ticket would go ungated,
          # and the job would report green having gated nothing.
          fetch-depth: 0
          # Keep this too (D-162). Without it checkout lands on the synthetic merge commit, which nobody
          # wrote: the review you signed off names a commit on the branch, so the stale-tick and
          # stale-review rules both fail a review that is not stale. The rule is that the review must be of
          # the code being gated, and that is the branch, not a speculative merge.
          ref: \${{ github.event.pull_request.head.sha }}
      - uses: actions/setup-node@v7
        with:
          node-version: 24
      - name: lint and gate
        shell: bash
        env:
          BASE: \${{ github.event.pull_request.base.sha }}
        run: |
          # Deliberately not -e: a lint failure and a gate failure should both be reported on one push, so
          # the script accumulates an exit code instead of stopping at the first problem.
          set -uo pipefail
          code=0
          ${accord} lint || code=1
          # --diff-filter=d excludes deletions, so removing an obsolete ticket does not fail the pull
          # request that removes it. [^/]+ keeps accord/tickets/<id>/verification.md out while
          # accord/tickets/<id>.md stays in. || true keeps a zero-match grep from reading as a failure.
          tickets=$(git diff --name-only --diff-filter=d "$BASE"...HEAD | grep -E '^accord/tickets/[^/]+[.]md$' || true)
          if [ -z "$tickets" ]; then
            echo "no ticket file changed in this pull request - nothing to gate"
            exit $code
          fi
          # A pull request that changes anything outside accord/ gates every ticket it touches. One that
          # changes only accord/ skips a ticket that is unapproved or dropped, so a backlog can land. A failing
          # diff counts as code, and so does a deletion, so every doubt is resolved toward gating.
          has_code=0
          if ! changed=$(git -c core.quotePath=false diff --name-only --no-renames "$BASE"...HEAD); then
            has_code=1
          else
            outside=$(grep -v '^accord/' <<< "$changed" || true)
            [ -n "$outside" ] && has_code=1
          fi
          qc="['"'"]'
          # Frontmatter of $file at revision $1 into fm. Returns 0 when found, 1 when the file is absent at
          # that revision, 2 when the read cannot be settled (no opening or closing line, or a git error).
          # Read from a variable through a here-string, never a pipe: pipefail plus SIGPIPE returns 141.
          fm_at() {
            local listed text
            if ! listed=$(git ls-tree --name-only "$1" -- "$file"); then return 2; fi
            if [ -z "$listed" ]; then return 1; fi
            if ! text=$(git show "$1:$file"); then return 2; fi
            fm=$(awk 'NR==1 { if ($0 !~ /---[[:space:]]*$/) exit 3; next } /^---[[:space:]]*$/ { found=1; exit } { print } END { if (!found) exit 3 }' <<< "$text")
            local rc=$?
            if [ "$rc" -ne 0 ]; then return 2; fi
            return 0
          }
          # Approved means an approved_hash key in that version. An unsettled read counts as approved.
          approved_at() {
            fm_at "$1"
            local rc=$?
            if [ "$rc" -eq 1 ]; then return 1; fi
            if [ "$rc" -ne 0 ]; then return 0; fi
            grep -Eq "^[[:space:]]*\${qc}?approved_hash\${qc}?[[:space:]]*:" <<< "$fm"
          }
          is_dropped() {
            fm_at HEAD || return 1
            grep -Eq "^\${qc}?status\${qc}?[[:space:]]*:[[:space:]]*\${qc}?dropped\${qc}?[[:space:]]*(#.*)?$" <<< "$fm"
          }
          # A here-string, not a pipe: the loop body runs in this shell, so its assignment to code survives.
          while IFS= read -r file; do
            id=\${file#accord/tickets/}
            id=\${id%.md}
            if [ "$has_code" -eq 0 ]; then
              if is_dropped; then
                echo "not gating $id - dropped and this pull request changes nothing outside accord/"
                continue
              fi
              if ! approved_at HEAD && ! approved_at "$BASE"; then
                echo "not gating $id - not approved and this pull request changes nothing outside accord/"
                continue
              fi
            fi
            ${accord} gate done "$id" || code=1
          done <<< "$tickets"
          exit $code
`;
}
