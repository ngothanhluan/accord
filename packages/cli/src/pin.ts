// D-94 version pin: `config.yml`'s `accord` key must equal the running CLI's own version, exactly.
// Comparison is `===` on two strings — no semver library, no range, no tolerance, no case folding —
// because the pin exists to stop a stale `npx` cache running yesterday's rules against today's
// repository (PITFALLS section 11). Pure and host-free, so the Phase 8 host reuses it unchanged; the
// caller decides how to refuse. `versionOnDisk` is the one host read, kept apart from `pinMessage`.
import { readFileSync } from 'node:fs';
import pkg from '../package.json' with { type: 'json' };

/**
 * The refusal message when the pin and the running version differ, else undefined.
 *
 * `running` is a parameter rather than a read of `pkg.version` so a test can drive a mismatch without
 * rewriting package.json. The message names both versions and the command that fixes it (CLI-06).
 * `onDisk` is the version in the package.json beside the build: when it differs from `running`, the
 * build is stale (a clone of accord after a release), and npx would only run that same build (BUG-LN-10).
 */
export function pinMessage(pinned: string | undefined, running: string, onDisk?: string): string | undefined {
  if (pinned === undefined || pinned === running) return undefined;
  if (onDisk !== undefined && onDisk !== running) {
    return `config.yml pins accord ${pinned}, running ${running} - this build is stale, its package.json says ${onDisk} - run: npm run build`;
  }
  return `config.yml pins accord ${pinned}, running ${running} - run: npx --yes ${pkg.name}@${pinned}`;
}

/**
 * The version in the package.json beside this module, read at run time, or undefined when it cannot be
 * read. The bundle bakes `pkg.version` in at build time, so the two differ only when the source moved on
 * after the last build; `../package.json` resolves the same from `src/` and from `dist/`.
 */
export function versionOnDisk(): string | undefined {
  try {
    const version: unknown = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version?: unknown }).version;
    return typeof version === 'string' ? version : undefined;
  } catch {
    return undefined;
  }
}
