// D-94 version pin: `config.yml`'s `accord` key must equal the running CLI's own version, exactly.
// Comparison is `===` on two strings — no semver library, no range, no tolerance, no case folding —
// because the pin exists to stop a stale `npx` cache running yesterday's rules against today's
// repository (PITFALLS section 11). Pure and host-free, so the Phase 8 host reuses it unchanged; the
// caller decides how to refuse.
import pkg from '../package.json' with { type: 'json' };

/**
 * The refusal message when the pin and the running version differ, else undefined.
 *
 * `running` is a parameter rather than a read of `pkg.version` so a test can drive a mismatch without
 * rewriting package.json. The message names both versions and the command that fixes it (CLI-06).
 */
export function pinMessage(pinned: string | undefined, running: string): string | undefined {
  if (pinned === undefined || pinned === running) return undefined;
  return `config.yml pins accord ${pinned}, running ${running} - run: npx --yes ${pkg.name}@${pinned}`;
}
