// ST-LN-36 (05-04): the default security patterns, the file that holds them and the reader that matches them against a package's diff text.
import { expect, it } from 'vitest';
import { DEFAULT_SECURITY, parseSecurityFile, securityTriggers, templates, triggerText } from '../src/index.js';

const DIFF = [
  'diff --git a/src/run.ts b/src/run.ts',
  'index 1111111..2222222 100644',
  '--- a/src/run.ts',
  '+++ b/src/run.ts',
  '@@ -1,3 +1,4 @@',
  " import { x } from './x.js';",
  ' const a = 1;',
  "+execFileSync('git', args);",
  ' export {};',
  'diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml',
  'index 3333333..4444444 100644',
  '--- a/.github/workflows/ci.yml',
  '+++ b/.github/workflows/ci.yml',
  '@@ -1,2 +1,2 @@',
  '-name: old',
  '+name: new',
  'diff --git a/package.json b/package.json',
  'index 5555555..6666666 100644',
  '--- a/package.json',
  '+++ b/package.json',
  '@@ -1,2 +1,2 @@',
  '-  "version": "1.0.0",',
  '+  "version": "1.0.1",',
  'diff --git a/README.md b/README.md',
  'index 7777777..8888888 100644',
  '--- a/README.md',
  '+++ b/README.md',
  '@@ -1,1 +1,2 @@',
  ' # title',
  '+keep the token secret',
].join('\n');

it('ac-1 the default patterns match added and removed lines and changed paths of a diff (ST-LN-36 36-ac-1)', () => {
  const changed = ['src/run.ts', '.github/workflows/ci.yml', 'package.json', 'README.md'];
  const triggers = securityTriggers(DEFAULT_SECURITY, DIFF, changed, { generated: [] });
  expect(triggers.map(triggerText)).toEqual([
    '.github/workflows/ci.yml: ci-workflow (CI workflow files)',
    'package.json: manifest (dependency manifests)',
    'src/run.ts:3: spawn (process spawn)',
  ]);
  expect(securityTriggers(DEFAULT_SECURITY, '', [], { generated: [] })).toEqual([]);
});

it('risk:parsing the default security file reads into six patterns and eight checklist items (ST-LN-36 36-ac-1)', () => {
  const text = templates['security.md'];
  const spec = parseSecurityFile(text);
  expect(spec.problems).toEqual([]);
  expect(spec.removed).toEqual([]);
  expect(spec.patterns.map((p) => p.id)).toEqual(['spawn', 'file-write', 'built-path', 'ci-workflow', 'manifest', 'secret-name']);
  for (const p of spec.patterns.filter((x) => x.kind === 'line')) {
    expect(() => new RegExp(p.source ?? '', p.flags ?? '')).not.toThrow();
    expect(p.flags === undefined || p.flags === '' || p.flags === 'i').toBe(true);
  }
  expect(spec.checklist.map((c) => c.id)).toEqual([
    'injection',
    'path-traversal',
    'secrets',
    'untrusted-input',
    'ci-permissions',
    'new-dependencies',
    'hook-commands',
    'authorisation',
  ]);
  const crlf = '﻿' + text.replace(/\n/g, '\r\n');
  expect(parseSecurityFile(crlf)).toEqual(spec);
  expect(DEFAULT_SECURITY).toEqual(spec);
});
