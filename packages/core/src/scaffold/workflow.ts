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
// A deleted ticket approved or done at the base fails the check unless its base version is dropped (BUG-LN-4).
// `gate done` is skipped for a ticket only when the diff changes nothing outside `accord/` and the ticket is
// unapproved in both its HEAD and base versions (a lane S ticket: no `ac_hash` in either), or dropped in HEAD. Any read the script cannot settle counts
// as approved, so a doubt gates. `.github/workflows/accord.yml` carries the same script and must be changed
// with it; `cli/test/workflow-script.test.ts` fails when the two drift.
//
// `accord upgrade` finds the step by its name `lint and gate` (`refreshLintStep` in `scaffold/repin.ts`) and
// replaces it with the step this function writes, so renaming the step stops upgrades from refreshing the
// script in every repository that ran `accord init`.
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
          # GitHub starts this script with -e and the next line undoes it: a lint failure and a gate failure
          # should both be reported on one push, so the script accumulates an exit code instead of stopping.
          set +e
          set -uo pipefail
          code=0
          ${accord} lint || code=1
          # --diff-filter=d leaves deleted tickets out of the tickets to gate; the deletion check below decides
          # whether a deletion may land. [^/]+ keeps accord/tickets/<id>/verification.md out while
          # accord/tickets/<id>.md stays in. || true keeps a zero-match grep from reading as a failure.
          tickets=$(git diff --name-only --diff-filter=d "$BASE"...HEAD | grep -E '^accord/tickets/[^/]+[.]md$' || true)
          # A pull request that changes anything outside accord/ gates every ticket it touches. One that
          # changes only accord/ skips a ticket that is unapproved or dropped, so a backlog can land. A failing
          # diff counts as code, and so does a deletion, so every doubt is resolved toward gating. Below, the
          # deletion or rename-away of an approved ticket turns an accord-only pull request into one with code.
          has_code=0
          if ! changed=$(git -c core.quotePath=false diff --name-only --no-renames "$BASE"...HEAD); then
            has_code=1
          else
            outside=$(grep -v '^accord/' <<< "$changed" || true)
            [ -n "$outside" ] && has_code=1
          fi
          qc="['"'"]'
          # Frontmatter of path $2 at revision $1 into fm. Returns 0 when found, 1 when the file is absent at
          # that revision, 2 when the read cannot be settled (no opening or closing line, or a git error).
          # Read from a variable through a here-string, never a pipe: pipefail plus SIGPIPE returns 141.
          fm_at() {
            local listed text
            if ! listed=$(git ls-tree --name-only "$1" -- "$2"); then return 2; fi
            if [ -z "$listed" ]; then return 1; fi
            if ! text=$(git show "$1:$2"); then return 2; fi
            fm=$(awk 'NR==1 { if ($0 !~ /---[[:space:]]*$/) exit 3; next } /^---[[:space:]]*$/ { found=1; exit } { print } END { if (!found) exit 3 }' <<< "$text")
            local rc=$?
            if [ "$rc" -ne 0 ]; then return 2; fi
            # Settled only when every column-0 line is blank, a comment, a sequence item or a plain key line, and
            # the first content line is not indented; any other YAML (flow, tag, anchor, explicit key) is unsettled.
            first=$(grep -m1 -Ev '^[[:space:]]*(#|$)' <<< "$fm")
            if grep -Eq '^[[:space:]]' <<< "$first"; then return 2; fi
            if grep -Evq "^([[:space:]]|#|-([[:space:]]|$)|\${qc}?[[:alnum:]_-]+\${qc}?[[:space:]]*:([[:space:]]|#|$)|$)" <<< "$fm"; then return 2; fi
            return 0
          }
          # Approved means an approved_hash key in that version of path $2, or, on a lane S ticket, an ac_hash key, since
          # a lane S ticket needs no approval. An unsettled read counts as approved.
          approved_at() {
            fm_at "$1" "$2"
            local rc=$?
            if [ "$rc" -eq 1 ]; then return 1; fi
            if [ "$rc" -ne 0 ]; then return 0; fi
            grep -Eq "^[[:space:]]*\${qc}?approved_hash\${qc}?[[:space:]]*:" <<< "$fm" && return 0
            grep -Eq "^\${qc}?lane\${qc}?[[:space:]]*:[[:space:]]*\${qc}?S\${qc}?[[:space:]]*(#.*)?$" <<< "$fm" && grep -Eq "^[[:space:]]*\${qc}?ac_hash\${qc}?[[:space:]]*:" <<< "$fm"
          }
          # Protected at revision $1 means deleting path $2 needs a drop first (D-01, D-04): an approved_hash key; a
          # verified key whose value is not []; an ac_hash key on lane S, with no lane key, or with a lane key whose
          # value is not on its key line. An unsettled read counts as protected.
          protected_at() {
            fm_at "$1" "$2"
            local rc=$?
            if [ "$rc" -eq 1 ]; then return 1; fi
            if [ "$rc" -ne 0 ]; then return 0; fi
            grep -Eq "^[[:space:]]*\${qc}?approved_hash\${qc}?[[:space:]]*:" <<< "$fm" && return 0
            if grep -Eq "^\${qc}?verified\${qc}?[[:space:]]*:" <<< "$fm" && ! grep -Eq "^\${qc}?verified\${qc}?[[:space:]]*:[[:space:]]*[[][[:space:]]*[]][[:space:]]*(#.*)?$" <<< "$fm"; then return 0; fi
            grep -Eq "^[[:space:]]*\${qc}?ac_hash\${qc}?[[:space:]]*:" <<< "$fm" || return 1
            grep -Eq "^\${qc}?lane\${qc}?[[:space:]]*:[[:space:]]*([|>][^#]*)?(#.*)?$" <<< "$fm" && return 0
            grep -Eq "^\${qc}?lane\${qc}?[[:space:]]*:" <<< "$fm" || return 0
            grep -Eq "^\${qc}?lane\${qc}?[[:space:]]*:[[:space:]]*\${qc}?S\${qc}?[[:space:]]*(#.*)?$" <<< "$fm"
          }
          # Dropped needs status: dropped and a reason under ## Dropped, as lint reads it. Where this reading
          # cannot match lint (a comment spanning lines, a stray fence) the answer is not dropped: fail closed.
          is_dropped() {
            local text
            fm_at "$1" "$2" || return 1
            grep -Eq "^\${qc}?status\${qc}?[[:space:]]*:[[:space:]]*\${qc}?dropped\${qc}?[[:space:]]*(#.*)?$" <<< "$fm" || return 1
            text=$(git show "$1:$2") || return 2
            awk '{ sub(/[[:space:]]+$/, "") } d < 2 { if (NR == 1) d = 1; else if ($0 == "---") d = 2; next } { if (fc == "") { if ($0 ~ /^(\`\`\`|~~~)/) fc = substr($0, 1, 1); else if (!s && tolower($0) ~ /^##[[:space:]]+dropped$/) { s = 1; next } else if (s && $0 ~ /^##[[:space:]]/) exit } else if (substr($0, 1, 3) == fc fc fc) fc = "" } s { t = $0; gsub(/<!--[^>]*-->/, "", t); if (t ~ /<!--|-->/) bad = 1; if (t ~ /[^[:space:]]/) said = 1 } END { exit (said && !bad) ? 0 : 3 }' <<< "$text" || return 2
          }
          # A ticket that may be lane S at HEAD dropped its lane after approval (ST-LN-58 D-06) when an approved_hash
          # key is in its version at the base or at any commit this pull request adds (git rev-list "$BASE..HEAD",
          # merge sides included), or when it was lane L or P at the base. At HEAD, only no lane key, or lane keys
          # that each hold a plain M, L or P on the key line, rule lane S out: a value off its key line or behind a
          # tag may still read as S. A lane M ticket never approved may move to lane S in place. An unsettled read
          # at HEAD is gated, since approved_at counts it as approved; at the base or at a commit of this pull
          # request, an unsettled read or a failing rev-list fails closed. An absent file is skipped.
          lane_dropped() {
            local rc revs rev lanes
            fm_at HEAD "$file" || return 1
            lanes=$(grep -E "^\${qc}?lane\${qc}?[[:space:]]*:" <<< "$fm") || return 1
            grep -Evq "^\${qc}?lane\${qc}?[[:space:]]*:[[:space:]]*\${qc}?[MLP]\${qc}?[[:space:]]*(#.*)?$" <<< "$lanes" || return 1
            fm_at "$BASE" "$file"
            rc=$?
            if [ "$rc" -eq 2 ]; then return 0; fi
            if [ "$rc" -eq 0 ]; then
              grep -Eq "^[[:space:]]*\${qc}?approved_hash\${qc}?[[:space:]]*:" <<< "$fm" && return 0
              grep -Eq "^\${qc}?lane\${qc}?[[:space:]]*:[[:space:]]*\${qc}?[LP]\${qc}?[[:space:]]*(#.*)?$" <<< "$fm" && return 0
            fi
            if ! revs=$(git rev-list "$BASE..HEAD"); then return 0; fi
            while IFS= read -r rev; do
              [ -n "$rev" ] || continue
              fm_at "$rev" "$file"
              rc=$?
              if [ "$rc" -eq 1 ]; then continue; fi
              if [ "$rc" -ne 0 ]; then return 0; fi
              grep -Eq "^[[:space:]]*\${qc}?approved_hash\${qc}?[[:space:]]*:" <<< "$fm" && return 0
            done <<< "$revs"
            return 1
          }
          # An approved ticket deleted or renamed away counts as code, whether or not git pairs the rename, so
          # a rename that drops approved_hash cannot skip the gate. A failing diff counts as code too. A ticket
          # protected at the base (protected_at) that is deleted or renamed away fails the check unless it is
          # dropped at the base, while any other may be deleted (D-01, D-02, D-04).
          deletion_failed=0
          if ! gone=$(git -c core.quotePath=false diff --name-only --no-renames --diff-filter=D "$BASE"...HEAD); then
            has_code=1
            echo "could not list the files this pull request deletes - the check fails rather than let an approved ticket go unchecked"
            deletion_failed=1
            code=1
          else
            while IFS= read -r old; do
              [[ "$old" =~ ^accord/tickets/[^/]+[.]md$ ]] || continue
              if approved_at "$BASE" "$old"; then has_code=1; fi
              protected_at "$BASE" "$old" || continue
              gone_id=\${old#accord/tickets/}
              gone_id=\${gone_id%.md}
              rc=0
              is_dropped "$BASE" "$old" || rc=$?
              if [ "$rc" -eq 2 ]; then
                echo "$gone_id: dropped at the base but its ## Dropped reason cannot be read - fix the ## Dropped reason on the default branch, then merge the default branch into this branch and push"
                deletion_failed=1
                code=1
              elif [ "$rc" -ne 0 ]; then
                echo "$gone_id: an approved or done ticket cannot be deleted before it is dropped - restore the file if this is the ticket's own branch, run accord drop $gone_id, merge the pull request of the drop/$gone_id branch it pushes, merge the default branch into this branch and push"
                deletion_failed=1
                code=1
              fi
            done <<< "$gone"
          fi
          if [ -z "$tickets" ]; then
            if [ "$deletion_failed" -eq 0 ]; then
              echo "no ticket file changed in this pull request - nothing to gate"
            fi
            exit $code
          fi
          # A here-string, not a pipe: the loop body runs in this shell, so its assignment to code survives.
          while IFS= read -r file; do
            id=\${file#accord/tickets/}
            id=\${id%.md}
            if lane_dropped; then
              echo "$id: its lane cannot drop after approval (lane S at HEAD, or a lane that is not a plain M, L or P there; approved at the base or in a commit of this pull request, or lane L or P at the base)"
              code=1
              continue
            fi
            if [ "$has_code" -eq 0 ]; then
              if is_dropped HEAD "$file"; then
                echo "not gating $id - dropped and this pull request changes nothing outside accord/"
                continue
              fi
              if ! approved_at HEAD "$file" && ! approved_at "$BASE" "$file"; then
                echo "not gating $id - not approved and this pull request changes nothing outside accord/"
                continue
              fi
            fi
            ${accord} gate done "$id" || code=1
          done <<< "$tickets"
          exit $code
`;
}
