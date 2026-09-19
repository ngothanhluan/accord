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
 * T-07-11: the one GitHub Actions expression in this document sits in `env:` and nowhere else. An
 * expression inside a `run:` body is substituted into the script text before the shell parses it, which is
 * the standard Actions script-injection vector — and `base.sha` is an attacker-influenced field on a pull
 * request from a fork.
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
          # A here-string, not a pipe: the loop body runs in this shell, so its assignment to code survives.
          while IFS= read -r file; do
            id=\${file#accord/tickets/}
            id=\${id%.md}
            ${accord} gate done "$id" || code=1
          done <<< "$tickets"
          exit $code
`;
}
