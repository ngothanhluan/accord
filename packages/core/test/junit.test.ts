// D-72 test report: scanJUnit id shape (A2), status ranking (A7), garbage guard (A3), and the loader seam.
import { describe, expect, it } from 'vitest';
import { loadSnapshot } from '../src/index.js';
import { scanJUnit } from '../src/load/junit.js';
import { readFixture } from './helpers/fixture.js';

const xml = (...lines: string[]) => lines.join('\n') + '\n';

const CONFIG = [
  'accord: "0.1.0"',
  'profile: build',
  'tracker:',
  '  adapter: none',
  'design:',
  '  tokens: ""',
  'roles: [ba, dev]',
  'runtimes: [claude]',
  'tests:',
  '  report: reports/junit.xml',
].join('\n');

// vitest junit reporter shape: file-path classname, `&gt;` in name, multi-line attributes, empty pass.
const VITEST = xml(
  '<?xml version="1.0" encoding="UTF-8" ?>',
  '<testsuites name="vitest tests" tests="3" failures="1" errors="0" time="0.1">',
  '  <testsuite name="test/auth.spec.ts" tests="3">',
  '    <testcase classname="test/auth.spec.ts"',
  '              name="auth &gt; accepts a good password"',
  '              time="0.01">',
  '    </testcase>',
  '    <testcase classname="test/auth.spec.ts" name="auth &gt; rejects bad password" time="0.01">',
  '      <failure message="expected 401" type="AssertionError">',
  'AssertionError: expected 200 to be 401',
  '      </failure>',
  '    </testcase>',
  '    <testcase classname="test/auth.spec.ts" name="auth &gt; remembers me" time="0">',
  '      <skipped/>',
  '    </testcase>',
  '  </testsuite>',
  '</testsuites>',
);

describe('scanJUnit (D-72, A2, A7)', () => {
  it('file-path classname with &gt; in the name: passed, failed, skipped', () => {
    expect(scanJUnit(VITEST)).toEqual({
      'test/auth.spec.ts#auth->-accepts-a-good-password': 'passed',
      'test/auth.spec.ts#auth->-rejects-bad-password': 'failed',
      'test/auth.spec.ts#auth->-remembers-me': 'skipped',
    });
  });

  it('dotted classname, <skipped type> with text, <error> child, self-closing pass', () => {
    const text = xml(
      '<testsuite name="pytest" tests="3">',
      '  <testcase classname="tests.test_auth.TestLogin" name="test_good" time="0.001" />',
      '  <testcase classname="tests.test_auth.TestLogin" name="test_bad[1]" time="0.001">',
      '    <skipped type="pytest.skip" message="not today">tests/test_auth.py:12: not today</skipped>',
      '  </testcase>',
      '  <testcase classname="tests.test_auth.TestLogin" name="test_boom" time="0.001">',
      '    <error message="fixture failed">Traceback</error>',
      '  </testcase>',
      '</testsuite>',
    );
    expect(scanJUnit(text)).toEqual({
      'tests.test_auth.TestLogin#test_good': 'passed',
      'tests.test_auth.TestLogin#test_bad[1]': 'skipped',
      'tests.test_auth.TestLogin#test_boom': 'failed',
    });
  });

  it('package classname, subtest name, CDATA body with a fake testcase', () => {
    const text = xml(
      '<testsuites>',
      '  <testsuite name="github.com/org/repo/pkg">',
      '    <testcase classname="github.com/org/repo/pkg" name="TestLogin/bad_password" time="0.002">',
      '      <failure message="Failed" type=""><![CDATA[=== RUN TestLogin/bad_password',
      '<testcase name="fake"/>',
      '--- FAIL: TestLogin/bad_password]]></failure>',
      '    </testcase>',
      '    <testcase classname="github.com/org/repo/pkg" name="TestLogin/good_password" time="0.001"></testcase>',
      '  </testsuite>',
      '</testsuites>',
    );
    expect(scanJUnit(text)).toEqual({
      'github.com/org/repo/pkg#TestLogin/bad_password': 'failed',
      'github.com/org/repo/pkg#TestLogin/good_password': 'passed',
    });
  });

  it('single quotes, absent or empty classname, duplicates keep the worst status in any order', () => {
    const passed = "  <testcase name='login works' time='0.1'/>";
    const failed = "  <testcase classname='' name='login works'><failure message='x'>boom</failure></testcase>";
    const skipped = "  <testcase name='login works'><skipped/></testcase>";
    expect(scanJUnit(xml('<testsuite>', passed, failed, skipped, '</testsuite>'))).toEqual({
      'login-works': 'failed',
    });
    expect(scanJUnit(xml('<testsuite>', skipped, failed, passed, '</testsuite>'))).toEqual({
      'login-works': 'failed',
    });
    expect(scanJUnit(xml('<testsuite>', passed, passed, skipped, '</testsuite>'))).toEqual({
      'login-works': 'skipped',
    });
  });

  it('empty text, comments, and numeric entities', () => {
    expect(scanJUnit('')).toEqual({});
    expect(scanJUnit(xml('<testsuite>', '<!-- <testcase name="c"/> -->', '</testsuite>'))).toEqual({});
    expect(scanJUnit(xml('<testsuite>', '<testcase name="a &#x3C; b &#60; c"/>', '</testsuite>'))).toEqual({
      'a-<-b-<-c': 'passed',
    });
  });
});

describe('loadSnapshot tests.report (D-72, A3)', () => {
  const base = { 'accord/config.yml': CONFIG };

  it('stores the report text in files and the scanned record in tests', () => {
    const snap = loadSnapshot({ files: { ...base, 'reports/junit.xml': VITEST }, tree: [] });
    expect(snap.tests).toEqual({
      'test/auth.spec.ts#auth->-accepts-a-good-password': 'passed',
      'test/auth.spec.ts#auth->-rejects-bad-password': 'failed',
      'test/auth.spec.ts#auth->-remembers-me': 'skipped',
    });
    expect(snap.files['reports/junit.xml']).toBe(VITEST);
    expect(snap.errors).toEqual([]);
  });

  it('a report key absent from the input leaves tests absent and reports nothing', () => {
    const snap = loadSnapshot({ files: base, tree: [] });
    expect('tests' in snap).toBe(false);
    expect(snap.errors.filter((f) => f.rule === 'load.report-invalid')).toEqual([]);
  });

  it('a report without any suite or case element is load.report-invalid at line 1 with tests {}', () => {
    const snap = loadSnapshot({ files: { ...base, 'reports/junit.xml': 'not xml at all\n' }, tree: [] });
    expect(snap.errors).toEqual([
      {
        file: 'reports/junit.xml',
        line: 1,
        rule: 'load.report-invalid',
        reason: 'report has no <testsuite> or <testcase> element',
      },
    ]);
    expect(snap.tests).toEqual({});
  });
});

describe('fixture lint-report: pinned values', () => {
  it('the reference report round-trips into tests with the documented ids', () => {
    const snap = loadSnapshot(readFixture('lint-report'));
    expect(snap.tests).toEqual({
      'test/auth.spec.ts#auth->-accepts-a-good-password': 'passed',
      'test/auth.spec.ts#auth->-rejects-bad-password': 'failed',
      'test/auth.spec.ts#auth->-remembers-me': 'skipped',
    });
    expect(snap.files['reports/junit.xml']).not.toContain('\r');
    expect(snap.errors).toEqual([]);
  });
});

// A test named after an Object.prototype member used to vanish: `id in out` was true before the
// first write, so the id was never recorded, and lint's `id in tests` reported it as known (UAT 03, test 3).
describe('prototype-chain ids', () => {
  it('keeps testcases named after Object.prototype members, and lint still flags an unknown id', () => {
    const report = xml(
      '<testsuite name="s">',
      '  <testcase name="constructor"/>',
      '  <testcase name="toString"/>',
      '  <testcase name="real one"/>',
      '</testsuite>',
    );
    expect(Object.keys(scanJUnit(report)).sort()).toEqual(['constructor', 'real-one', 'toString']);

    const snap = loadSnapshot({
      files: { 'accord/config.yml': CONFIG, 'reports/junit.xml': report },
      tree: [],
    });
    expect(snap.tests?.['toString']).toBe('passed');
  });
});
