// Phase 8 D-26 (8-ac-18, T-08-27): a file name or a config value is a key of the loader's maps, so `__proto__` and `constructor` must reach own keys only, never an object's prototype.
import { expect, it } from 'vitest';
import { lintSnapshot, loadSnapshot } from '../src/index.js';
import { CONFIG, laneTicket, REPORT } from '../../../test/helpers/lane.js';

it('risk:security a ticket file named __proto__ loads as an own ticket and is linted (8-ac-18)', () => {
  const file = 'accord/tickets/__proto__.md';
  const snapshot = loadSnapshot({ files: { 'accord/config.yml': CONFIG, [file]: laneTicket('__proto__') }, tree: [file] });
  expect(Object.keys(snapshot.tickets)).toContain('__proto__');
  expect(Object.hasOwn(snapshot.tickets, '__proto__')).toBe(true);
  expect(Object.getPrototypeOf(snapshot.tickets)).toBeNull();
  expect(snapshot.tickets['__proto__'].file).toBe(file);
  // linted like any ticket: its id fails the id pattern, a finding at its own file (the ticket is not dropped from the lint)
  const own = lintSnapshot(snapshot).findings.filter((f) => f.file === file);
  expect(own.map((f) => f.rule)).toContain('schema.pattern');
  // a verification record under that name is an own key too
  const withRecord = loadSnapshot({ files: { 'accord/config.yml': CONFIG, [file]: laneTicket('__proto__'), 'accord/tickets/__proto__/verification.md': '---\nverdict: pass\n---\n' }, tree: [] });
  expect(Object.keys(withRecord.verifications)).toContain('__proto__');
  expect(Object.getPrototypeOf(withRecord.verifications)).toBeNull();
});

it('risk:security tests.report and design.tokens named constructor load without a crash and read as missing files (8-ac-18)', () => {
  const config = CONFIG.replace(`report: ${REPORT}`, 'report: constructor').replace('tokens: ""', 'tokens: constructor');
  expect(config).toContain('report: constructor');
  expect(config).toContain('tokens: constructor');
  const snapshot = loadSnapshot({ files: { 'accord/config.yml': config }, tree: [] });
  expect(Object.getPrototypeOf(snapshot.files)).toBeNull();
  expect(Object.hasOwn(snapshot.files, 'constructor')).toBe(false);
  expect(snapshot.tests).toBeUndefined();
  const reasons = lintSnapshot(snapshot).findings.map((f) => f.reason);
  expect(reasons).toContain('tests.report "constructor" is not in the snapshot');
  expect(reasons.some((r) => r.startsWith('design.tokens "constructor" is not in the snapshot'))).toBe(true);
});
