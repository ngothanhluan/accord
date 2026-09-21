import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import { deniedNames } from '../../../test/helpers/denied.js';

const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));

describe('accord bin', () => {
  it('is built', () => {
    expect(existsSync(cli), 'run npm run build first').toBe(true);
  });

  it('starts with a shebang', () => {
    const firstLine = readFileSync(cli, 'utf8').split('\n')[0];
    expect(firstLine).toBe('#!/usr/bin/env node');
  });

  // CLI-07: the built binary is started by absolute path under process.execPath — no shell, no
  // `accord.cmd` shim, and no package manager. `--help` is answered by commander before any action
  // runs, so this stays true as later plans in this phase register more commands.
  it('runs under process.execPath and lists the lint command', () => {
    const out = execFileSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
    expect(out).toContain('lint');
  });

  // Read from the manifest, not written as a literal: the version moves every release, and a
  // literal here turns a routine bump into a red test in a file that has nothing to do with it.
  it('--version prints the version', () => {
    const out = execFileSync(process.execPath, [cli, '--version'], { encoding: 'utf8' });
    expect(out.trim()).toBe(pkg.version);
  });

  // D-164: bundling under D-150 removes the import, not the declaration. A dependency on a package
  // that is never published sends every `npx --yes` install to the registry for a name that 404s,
  // and `npm publish --dry-run` says nothing about it, because the failure happens at install time
  // on someone else's machine. The engines floor is read for the same reason: widening it would
  // publish a package that installs onto a runtime commander 15 and vitest 5 both refuse (OPS-03).
  it('declares exactly one runtime dependency and the OPS-03 engines floor (D-164)', () => {
    expect(Object.keys(pkg.dependencies)).toEqual(['commander']);
    expect(pkg.engines.node).toBe('>=22.12.0');
  });

  // The other half of the same failure, one layer down: a future edit that un-bundles core leaves a
  // manifest that installs and a binary that cannot resolve its own import. Matched on the import
  // specifier rather than a bare substring — an ordinary comment naming the package would defeat a
  // substring search, and core's own strings inside the bundle would fire it.
  it('the bundle inlines core rather than importing it (D-150)', () => {
    const text = readFileSync(cli, 'utf8');
    expect(text).not.toMatch(/from ['"]@accord-dev\/accord-core['"]/);
  });

  // The CLAUDE.md hard constraint over the one artifact npm uploads: `package.json` declares
  // `files: ["dist", "README.md"]`, so this bundle is the whole of the code a consumer receives, and
  // tsdown preserves block comments — a JSDoc crosses here from developer-only text into a published
  // byte. Every other call site of this list scans an INPUT to the build (the templates record, the
  // rendered skill bodies, the scaffold text, the emitted workflow); this one scans its OUTPUT.
  //
  // The honest ceiling: no test can prove `dist` matches `src`. A bundle that is present but older
  // than its source passes this case. Freshness comes from `npm run build` preceding `npm test` — in
  // both CI jobs and in the verify commands — and not from anything asserted below.
  it('the published bundle names no other tool, plugin, harness, or planning system (CLAUDE.md)', () => {
    expect(existsSync(cli), 'run npm run build first').toBe(true);
    const text = readFileSync(cli, 'utf8');
    // Guard the guard, twice, before the assertion that matters, the same shape as
    // `packages/core/test/templates.test.ts`: a truncated or placeholder bundle would be scanned as
    // near-empty text, and a scan that had silently stopped matching would read as a pass. The probe's
    // name is split like `DENIED`'s own entries so this file does not carry the name it forbids.
    expect(text.length).toBeGreaterThan(1000);
    const probe = [{ path: 'probe.js', text: 'first\nbuilt with ' + 'Fig' + 'ma\n' }];
    expect(deniedNames(probe)).toEqual(['probe.js:2: ' + 'Fig' + 'ma']);
    expect(deniedNames([{ path: 'packages/cli/dist/cli.js', text }])).toEqual([]);
  });
});
