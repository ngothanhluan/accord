// 95-ac-4: the metrics scripts are repo-internal. scripts/metrics.mjs may spawn `git` by name with a literal
// argument array and nothing else; scripts/metrics-count.mjs imports nothing; the published CLI package names
// neither. The allowlist follows packages/cli/test/spawn-surface.test.ts.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const scripts = fileURLToPath(new URL('../../../scripts/', import.meta.url));
const cli = fileURLToPath(new URL('../../cli/', import.meta.url));
// A bare call, not a method: `RECORD.exec(p)` is a regex, `cp.exec(...)` is caught by the import rule below.
const SPAWN = /(?<![\w$.])(?:execFileSync|execFile|execSync|exec|spawnSync|spawn|fork)\s*\(/g;
const FIRST_ARG = /^\s*(['"])([^'"]*)\1\s*[,)]/;

/** Blank whole-line comments rather than delete them, so a reported line number stays right. */
const stripCommentLines = (text: string) =>
  text
    .split('\n')
    .map((line) => (/^\s*(\/\/|\/\*|\*)/.test(line) ? '' : line))
    .join('\n');

it('risk:regression the metrics scripts spawn only git and ship nowhere (ST-LN-95 ac-4)', () => {
  const entry = stripCommentLines(readFileSync(join(scripts, 'metrics.mjs'), 'utf8'));
  const sites = [...entry.matchAll(SPAWN)].map((m) => ({
    line: entry.slice(0, m.index).split('\n').length,
    first: FIRST_ARG.exec(entry.slice(m.index + m[0].length))?.[2],
  }));
  expect(sites.length).toBeGreaterThan(0);
  expect(sites.filter((s) => s.first !== 'git')).toEqual([]);
  // the only way to child_process is the named execFileSync import; no namespace, default, require or dynamic import
  const childImports = entry.split('\n').filter((l) => /child_process/.test(l));
  expect(childImports).toEqual(["import { execFileSync } from 'node:child_process';"]);
  expect(entry).not.toMatch(/\brequire\s*\(/);
  // ST-LN-93 D-05: the one dynamic import is core's own built entry (--plan-size), as benchmark.mjs imports it; no other.
  expect(entry.split('\n').filter((l) => /\bimport\s*\(/.test(l))).toEqual(['    core = await import(pathToFileURL(coreFile).href);']);

  const pure = readFileSync(join(scripts, 'metrics-count.mjs'), 'utf8');
  expect(pure).not.toMatch(/^\s*import\b|\bimport\s*\(|\brequire\s*\(/m);

  const pkg = JSON.parse(readFileSync(join(cli, 'package.json'), 'utf8')) as { files?: string[]; bin?: Record<string, string> | string };
  const shipped = [...(pkg.files ?? []), ...Object.values(typeof pkg.bin === 'string' ? { accord: pkg.bin } : (pkg.bin ?? {}))];
  expect(shipped.filter((p) => /(^|\/)scripts(\/|$)|metrics/.test(p.replace(/^\.\//, '')))).toEqual([]);
  const src = join(cli, 'src');
  const naming = readdirSync(src, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => join(d.parentPath, d.name))
    .filter((file) => /metrics(-count)?\.mjs/.test(readFileSync(file, 'utf8')));
  expect(naming).toEqual([]);
});

// ST-LN-91 ac-5: the round-2 replica harness reads transcripts and git and prints dispatch rows; it never starts a model
// run, so the one thing it spawns is `git`, with a literal first argument, and the published package names it nowhere.
it('risk:regression the round-2 replica harness spawns only git and starts no model run (ST-LN-91 ac-5)', () => {
  const entry = stripCommentLines(readFileSync(join(scripts, 'round2-replica.mjs'), 'utf8'));
  const sites = [...entry.matchAll(SPAWN)].map((m) => ({
    line: entry.slice(0, m.index).split('\n').length,
    first: FIRST_ARG.exec(entry.slice(m.index + m[0].length))?.[2],
  }));
  expect(sites.length).toBeGreaterThan(0);
  expect(sites.filter((s) => s.first !== 'git')).toEqual([]);
  const childImports = entry.split('\n').filter((l) => /child_process/.test(l));
  expect(childImports).toEqual(["import { execFileSync } from 'node:child_process';"]);
  expect(entry).not.toMatch(/\brequire\s*\(|\bimport\s*\(/);
  expect(entry).not.toMatch(/\bshell\s*:/);
  const pkg = JSON.parse(readFileSync(join(cli, 'package.json'), 'utf8')) as { files?: string[] };
  expect((pkg.files ?? []).filter((p) => /round2-replica/.test(p))).toEqual([]);
  const naming = readdirSync(join(cli, 'src'), { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => join(d.parentPath, d.name))
    .filter((file) => /round2-replica/.test(readFileSync(file, 'utf8')));
  expect(naming).toEqual([]);
});
