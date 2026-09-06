// CORE-01 proof: both purity layers (ESLint rule, `types: []`) go red on impure input.
// This file writes nothing; the tsc probe compiles a committed fixture outside src/.
import { ESLint } from 'eslint';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const coreDir = join(repoRoot, 'packages', 'core');
const srcProbe = join(coreDir, 'src', '__eslint_probe__.ts');
const eslint = new ESLint({ cwd: repoRoot });

async function ruleIds(code: string, filePath = srcProbe): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  const ignored = result.messages.find((m) => m.ruleId === null && /ignored/i.test(m.message));
  if (ignored) throw new Error(`ESLint ignored ${filePath}: ${ignored.message}`);
  return result.messages.filter((m) => m.severity === 2).map((m) => m.ruleId ?? '');
}

const purityRule = '@typescript-eslint/no-restricted-imports';
const seamRule = 'no-restricted-imports';
const ajvSnippet = "import { Ajv2020 } from 'ajv/dist/2020.js'; export const a = Ajv2020;";

describe('layer A: ESLint rejects Node built-ins in core src', () => {
  it('node:fs (prefixed)', async () => {
    const ids = await ruleIds("import { readFileSync } from 'node:fs'; export const x = readFileSync;");
    expect(ids).toEqual([purityRule]);
  });

  it('path (bare)', async () => {
    const ids = await ruleIds("import path from 'path'; export const p = path;");
    expect(ids).toEqual([purityRule]);
  });

  it('fs/promises (bare subpath)', async () => {
    const ids = await ruleIds("import { readFile } from 'fs/promises'; export const r = readFile;");
    expect(ids).toEqual([purityRule]);
  });

  it('ajv outside the seam (D-20)', async () => {
    const ids = await ruleIds(ajvSnippet, join(coreDir, 'src', 'model', '__eslint_probe__.ts'));
    expect(ids).toEqual([seamRule]);
  });

  it('ajv inside validate/ajv.ts is exempt', async () => {
    const ids = await ruleIds(ajvSnippet, join(coreDir, 'src', 'validate', 'ajv.ts'));
    expect(ids).not.toContain(seamRule);
  });

  it('clean code passes', async () => {
    expect(await ruleIds('export const ok = 1;')).toEqual([]);
  });
});

describe('layer B: tsc rejects Node built-ins under core tsconfig', () => {
  const fixture = 'packages/core/test/fixtures/purity';

  it(
    'probe fixture fails with TS2307',
    () => {
      const tscBin = join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
      let stdout = '';
      expect(() => {
        try {
          execFileSync(process.execPath, [tscBin, '-p', fixture], {
            cwd: repoRoot,
            encoding: 'utf8',
            stdio: 'pipe',
          });
        } catch (err) {
          stdout = String((err as { stdout?: string }).stdout ?? '');
          throw err;
        }
      }).toThrow();
      expect(stdout).toContain('TS2307');
      expect(stdout).toContain('node:fs');
    },
    60_000,
  );

  it('fixture wiring is pinned', () => {
    const dir = join(repoRoot, fixture);
    const config = JSON.parse(readFileSync(join(dir, 'tsconfig.json'), 'utf8'));
    expect(config.extends).toBe('../../../tsconfig.json');
    expect(config.include).toEqual(['probe.ts']);
    expect(readFileSync(join(dir, 'probe.ts'), 'utf8')).toContain("'node:fs'");
  });

  it('core tsconfig has types: [] and no @types/node', () => {
    const tsconfig = JSON.parse(readFileSync(join(coreDir, 'tsconfig.json'), 'utf8'));
    expect(tsconfig.compilerOptions.types).toEqual([]);
    const pkg = JSON.parse(readFileSync(join(coreDir, 'package.json'), 'utf8'));
    for (const block of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      expect(pkg[block] ?? {}).not.toHaveProperty('@types/node');
    }
  });
});
