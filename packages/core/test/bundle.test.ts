// CORE-01 artifact proof: the built bundle is pure and the manifest is shaped for consumers.
// This file only reads packages/core/dist/; the only path it creates or removes is a temp dir.
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const distDir = fileURLToPath(new URL('../dist/', import.meta.url));
const coreDir = fileURLToPath(new URL('../', import.meta.url));

function assertBuilt(dir: string): void {
  const missing = ['index.js', 'index.d.ts'].filter((f) => !existsSync(join(dir, f)));
  if (missing.length > 0) {
    throw new Error(`run npm run build first: missing ${missing.join(', ')} in ${dir}`);
  }
}

const builtins =
  'fs|fs/promises|path|child_process|os|url|crypto|process|util|stream|events|buffer|module|worker_threads|net|http|https|tty|readline|zlib|assert';
const forbidden = [
  /from\s*["']node:/,
  /require\(\s*["']node:/,
  /import\(\s*["']node:/,
  new RegExp(`from\\s*["'](${builtins})["']`),
];

describe('built core bundle', () => {
  it('is built', () => {
    expect(() => assertBuilt(distDir)).not.toThrow();
  });

  it('names the missing build when dist is empty', () => {
    const empty = mkdtempSync(join(tmpdir(), 'accord-empty-dist-'));
    try {
      expect(() => assertBuilt(empty)).toThrow('run npm run build first');
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it('bundle imports no Node built-in', () => {
    const js = readFileSync(join(distDir, 'index.js'), 'utf8');
    for (const re of forbidden) expect(js).not.toMatch(re);
    // ajv, yaml, and gherkin stay external dependencies; inlining would hide their requires behind a shim.
    expect(js).toContain('ajv/dist/2020');
    expect(js).toMatch(/from\s*["']yaml["']/);
    expect(js).toMatch(/from\s*["']@cucumber\/gherkin["']/);
  });

  it('declarations expose the seam', () => {
    const dts = readFileSync(join(distDir, 'index.d.ts'), 'utf8');
    const names = [
      'validate', 'SchemaId', 'schemaIds', 'Finding', 'SchemaFinding',
      'loadSnapshot', 'RepoSnapshot', 'SnapshotInput', 'Ticket', 'ScenarioRef', 'Verification', 'AccordConfig',
      'setFrontmatterKey', 'FrontmatterValue',
    ];
    for (const name of names) expect(dts).toContain(name);
    // Only the exported surface matters; tsdown's `//#region src/validate/ajv.d.ts` comment is not a type.
    // D-55: the model is plain interfaces, so no gherkin AST or yaml Document type may leak.
    const exported = dts.split('\n').filter((line) => line.startsWith('export'));
    for (const line of exported) expect(line).not.toMatch(/ajv|@cucumber|yaml/i);
    expect(dts).not.toContain('ErrorObject');
  });

  it('manifest shape', () => {
    const pkg = JSON.parse(readFileSync(join(coreDir, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('@accord-dev/accord-core');
    expect(pkg.version).toBe('0.1.0');
    expect(pkg.type).toBe('module');
    expect(pkg.exports['.']).toEqual({ types: './dist/index.d.ts', default: './dist/index.js' });
    expect(pkg.exports['./schemas/*']).toBe('./schemas/*');
    expect(pkg.files).toEqual(expect.arrayContaining(['dist', 'schemas', 'templates']));
    for (const id of ['ticket', 'verification', 'config']) {
      expect(existsSync(join(coreDir, 'schemas', `${id}.schema.json`))).toBe(true);
    }
  });
});
