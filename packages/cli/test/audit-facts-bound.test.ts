// Phase 8.1 U-2: the config text `accord audit` reads is hostile input; a ruff `select` list is found in time linear in the file, however many `select=[` it repeats.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { machineFacts } from '../src/load/audit-facts.js';

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) rmSync(dirs.pop() as string, { recursive: true, force: true });
});

const sandbox = (name: string, text: string): string => {
  const dir = mkdtempSync(join(tmpdir(), 'accord-facts-'));
  dirs.push(dir);
  writeFileSync(join(dir, name), text);
  return dir;
};

it('risk:resource a 640 KB ruff config of repeated select=[ is read at once (U-2)', () => {
  const hostile = 'select=['.repeat(80_000);
  for (const text of [hostile, hostile + ']', '[tool.ruff]\n' + hostile]) {
    const name = text.startsWith('[tool.ruff]') ? 'pyproject.toml' : 'ruff.toml';
    const root = sandbox(name, text);
    const started = Date.now();
    const facts = machineFacts(root, [name]);
    expect(Date.now() - started, 'a quadratic scan took 20 s on this input').toBeLessThan(2000);
    expect(facts.linters.map((l) => l.tool)).toContain('ruff');
  }
});

it('risk:parsing the ruff select lists are still read, select and extend-select, one list at a time (U-2)', () => {
  const root = sandbox('ruff.toml', '[lint]\nselect = ["E", "F"]\nextend-select = [\n  "B",\n  "UP",\n]\nignore = ["E501"]\n');
  expect(machineFacts(root, ['ruff.toml']).rules).toEqual(['B', 'E', 'F', 'UP']);
});

const MIB = 1024 * 1024;
/** `unit` repeated to exactly 1 MiB of text. */
const fill = (unit: string): string => unit.repeat(Math.ceil(MIB / unit.length)).slice(0, MIB);

/** The hostile shapes of one pattern: each `text` is 1 MiB, run once as one line and once cut into lines. */
interface Case {
  pattern: string;
  file: string;
  shapes: Record<string, string>;
}
const CASES: Case[] = [
  {
    pattern: 'RULE (eslint rules)',
    file: 'eslint.config.js',
    shapes: {
      'repeated "rules": {': fill('"rules": {'),
      "repeated ': near-misses": fill("':"),
      "repeated 'a': with no value": fill("'a':"),
      'repeated "a" with spaces': fill('"a" '),
      'one unterminated quote and a long name': '"' + 'a'.repeat(MIB - 1),
      'a rule name then 1 MiB of spaces': '"a":' + ' '.repeat(MIB - 4),
      'repeated "a":[ with spaces': fill('"a":[ '),
    },
  },
  {
    pattern: 'DOTNET_RULE (editorconfig)',
    file: '.editorconfig',
    shapes: {
      'repeated dotnet_diagnostic.A': fill('dotnet_diagnostic.A'),
      'repeated .severity with no value': fill('dotnet_diagnostic.A.severity '),
      'repeated severity near-miss': fill('dotnet_diagnostic.A.severity = warnin'),
      'one unterminated rule id': 'dotnet_diagnostic.' + 'A'.repeat(MIB - 18),
      'a severity then 1 MiB of spaces': 'dotnet_diagnostic.A.severity' + ' '.repeat(MIB - 28),
    },
  },
  {
    pattern: 'tsconfig strict, extends, references',
    file: 'tsconfig.json',
    shapes: {
      'repeated "strict"': fill('"strict"'),
      'repeated "strict" with a space': fill('"strict" '),
      'repeated "strict": near-miss': fill('"strict":  tru '),
      'one "strict" then 1 MiB of spaces': '"strict"' + ' '.repeat(MIB - 8),
      'one "strict": then 1 MiB of spaces': '"strict":' + ' '.repeat(MIB - 9),
      'repeated "extends"': fill('"extends" '),
      'repeated "references"': fill('"references" '),
      'repeated "compilerOptions"': fill('"compilerOptions" '),
    },
  },
  {
    pattern: 'csproj Nullable',
    file: 'a.csproj',
    shapes: {
      'repeated <Nullable>': fill('<Nullable>'),
      'repeated <Nullable>a': fill('<Nullable>a'),
      'repeated <Nullable> then a space': fill('<Nullable> '),
      'one <Nullable> and a 1 MiB word': '<Nullable>' + 'a'.repeat(MIB - 10),
      'one <Nullable> and 1 MiB of spaces': '<Nullable>' + ' '.repeat(MIB - 10),
      'repeated unclosed closing tag': fill('<Nullable>enable</Nullable '),
    },
  },
  {
    pattern: 'props Nullable',
    file: 'Directory.Build.props',
    shapes: {
      'repeated <Nullable>': fill('<Nullable>'),
      'repeated <Nullable> then a space': fill('<Nullable> '),
      'one <Nullable> and 1 MiB of spaces': '<Nullable>' + ' '.repeat(MIB - 10),
      'repeated unclosed closing tag': fill('<Nullable>enable</Nullable '),
    },
  },
];

// Phase 08.8 D-16 (item 10): the audit's text patterns were measured linear (0.6 to 4.7 ms on 1 MiB, research); this holds them there. The bound is wide enough for the whole suite running in
// parallel and far below the minutes a quadratic run over 1 MiB takes.
it('risk:resource the audit rule, tsconfig and csproj patterns stay linear on hostile 1 MiB inputs (D-16)', () => {
  const BOUND_MS = 500;
  const slow: string[] = [];
  for (const { pattern, file, shapes } of CASES) {
    for (const [shape, text] of Object.entries(shapes)) {
      for (const [lines, body] of [['one line', text], ['many lines', text.replace(/(.{80})/g, '$1\n')]] as const) {
        const root = sandbox(file, body);
        const started = performance.now();
        machineFacts(root, [file]);
        const took = performance.now() - started;
        if (took >= BOUND_MS) slow.push(`${pattern}: ${shape} (${lines}) took ${Math.round(took)} ms`);
      }
    }
  }
  expect(slow, 'a pattern turned quadratic on a hostile 1 MiB file').toEqual([]);
});

// Phase 08.8 D-16 (IN-03): a root tsconfig that only lists `references` holds no compiler options, so it is not judged loose.
it('risk:regression a solution-style tsconfig is not judged loose (D-16)', () => {
  const root = mkdtempSync(join(tmpdir(), 'accord-facts-'));
  dirs.push(root);
  mkdirSync(join(root, 'packages', 'a'), { recursive: true });
  writeFileSync(join(root, 'tsconfig.json'), '{ "files": [], "references": [{ "path": "./packages/a" }] }\n');
  writeFileSync(join(root, 'packages', 'a', 'tsconfig.json'), '{ "compilerOptions": { "strict": true } }\n');
  const facts = machineFacts(root, ['tsconfig.json', 'packages/a/tsconfig.json']);
  expect(facts.typechecks.map((t) => `${t.file}: ${t.what}`)).toEqual(['packages/a/tsconfig.json: strict']);
  expect(facts.typechecks.filter((t) => !t.strict)).toEqual([]);
});
