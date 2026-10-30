# Review: ST-LN-78

## Round 1

1. Should — intent — the whole-suite run in the Done when was shown with `scripts/test-linux.mjs run`, not with the configured `tests.affected` command, which is `related --run {files}` — accord/config.yml (tests.affected).
2. Should — quality — every run removes all labelled node_modules volumes of another key, so worktrees on different package-lock.json files reinstall each other's volumes, and a removal between another run's `volume create` and `docker run` leaves unlabelled volumes that are never cleaned — scripts/test-linux.mjs (volume cleanup in `main`).
3. Nice — quality — the fallback to the host for a working folder outside the checkout prints nothing, and a cwd that differs only in letter case from the script's path counts as outside — scripts/test-linux.mjs (`below`, `main`).
4. Nice — quality — images of an older DOCKERFILE are never removed — scripts/test-linux.mjs (image build in `main`).
5. Nice — quality — the first test pins the exact order of every mount, and the second test's name covers three behaviours — packages/core/test/test-linux.test.ts.

Not checked by the reviewer: whether the Docker VM's clock keeps the JUnit report's mtime at or after the last commit's time, which `accord task-done` compares.

## Round 2

Round 1's five findings are fixed.

1. Should — quality — a week-old volume set of another key can be half-removed while that key's run starts: docker recreates the removed node_modules volumes empty and unlabelled, the mounted `state` volume survives with `/state/installed`, and every later run of that key skips `npm ci` and fails on a missing vitest.mjs; the cutoff counts from creation, so the comment's "while they are worked" is wrong — scripts/test-linux.mjs (`removeOldVolumes`, `inside`).
2. Nice — quality — the main-module guard compares `fileURLToPath(import.meta.url)` with `path.resolve(process.argv[1])`, so a checkout reached through a junction or symlink runs nothing and exits 0 — scripts/test-linux.mjs (last line).
3. Nice — intent — the ledger's last Ruling says two `risk:parsing` tests; the file has five — accord/tickets/ST-LN-78/ledger.md.
