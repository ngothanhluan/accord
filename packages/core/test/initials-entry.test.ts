// G-07-2 (A-1, A-2): the two pure helpers behind "the queue commits the person's people entry" and "new ticket reads initials from
// other branches". Text in, text out; no git here.
import { expect, it } from 'vitest';
import { addPersonEntry, initialsOnRefs, loadConfig, peopleOf } from '../src/index.js';

const BOM = String.fromCharCode(0xfeff);
const crlf = (s: string): string => s.replace(/\n/g, '\r\n');
const DEF = 'refs/remotes/origin/main';
const A = 'refs/remotes/origin/side-a';
const B = 'refs/remotes/origin/side-b';

const BASE = [
  '# top comment',
  'accord: "1.0.0" # pinned',
  'profile: build',
  'people:',
  '  "an@example.com": AN # the first',
  '  "bo@example.com": BO',
  '# before roles',
  'roles: [ba, dev]',
  '',
].join('\n');

it('risk:complex-branching 7-ac-4 G-07-2 the default branch entry wins over another branch', () => {
  const byRef = { [DEF]: { 'New@X.io': 'NW' }, [A]: { 'new@x.io': 'NX' } };
  expect(initialsOnRefs('new@x.io', byRef, DEF)).toEqual({ key: 'New@X.io', initials: 'NW', ref: DEF });
});

it('risk:complex-branching 7-ac-4 G-07-2 branches that agree give the first one in sorted order', () => {
  const byRef = { [B]: { 'NEW@x.io': 'NW' }, [A]: { 'new@x.io': 'NW' }, [DEF]: { 'other@x.io': 'OT' } };
  expect(initialsOnRefs('new@x.io', byRef, DEF)).toEqual({ key: 'new@x.io', initials: 'NW', ref: A });
  expect(initialsOnRefs('new@x.io', { [B]: byRef[B], [A]: byRef[A] }, undefined)).toEqual({ key: 'new@x.io', initials: 'NW', ref: A });
});

it('risk:complex-branching 7-ac-4 G-07-2 branches that disagree give a conflict sorted by ref', () => {
  const byRef = { [B]: { 'new@x.io': 'NX' }, [A]: { 'new@x.io': 'NW' } };
  expect(initialsOnRefs('new@x.io', byRef, DEF)).toEqual({
    conflict: [
      { ref: A, initials: 'NW' },
      { ref: B, initials: 'NX' },
    ],
  });
});

it('risk:security 7-ac-4 G-07-2 an entry with lowercase or long initials or a key without an at sign does not count', () => {
  expect(initialsOnRefs('new@x.io', { [A]: { 'new@x.io': 'nw' } }, undefined)).toBeUndefined();
  expect(initialsOnRefs('new@x.io', { [A]: { 'new@x.io': 'TOOLONG' } }, undefined)).toBeUndefined();
  expect(initialsOnRefs('new', { [A]: { new: 'NW' } }, undefined)).toBeUndefined();
  // a default entry that does not count lets another branch's valid entry stand
  expect(initialsOnRefs('new@x.io', { [DEF]: { 'new@x.io': 'nw' }, [A]: { 'new@x.io': 'NW' } }, DEF)).toEqual({ key: 'new@x.io', initials: 'NW', ref: A });
});

it('risk:data-loss 7-ac-4 G-07-2 no branch listing the email gives undefined', () => {
  expect(initialsOnRefs('new@x.io', { [DEF]: { 'an@x.io': 'AN' } }, DEF)).toBeUndefined();
  expect(initialsOnRefs('new@x.io', {}, undefined)).toBeUndefined();
});

it('risk:data-loss 7-ac-4 G-07-2 addPersonEntry adds one quoted line after the last entry and keeps every other line', () => {
  const out = addPersonEntry(BASE, 'new@x.io', 'NW');
  expect(out).toBe(BASE.replace('  "bo@example.com": BO\n', '  "bo@example.com": BO\n  "new@x.io": NW\n'));
  expect(peopleOf(out as string)).toEqual({ 'an@example.com': 'AN', 'bo@example.com': 'BO', 'new@x.io': 'NW' });
});

it('risk:data-loss 7-ac-4 G-07-2 addPersonEntry turns an empty flow map into a block', () => {
  const text = 'accord: "1.0.0"\npeople: {}\nroles: [ba]\n';
  expect(addPersonEntry(text, 'new@x.io', 'NW')).toBe('accord: "1.0.0"\npeople:\n  "new@x.io": NW\nroles: [ba]\n');
});

it('risk:data-loss 7-ac-4 G-07-2 addPersonEntry keeps CRLF and a leading BOM', () => {
  const out = addPersonEntry(BOM + crlf(BASE), 'new@x.io', 'NW');
  expect(out).toBe(BOM + crlf(BASE.replace('  "bo@example.com": BO\n', '  "bo@example.com": BO\n  "new@x.io": NW\n')));
});

it('risk:parsing 7-ac-4 G-07-2 addPersonEntry gives undefined without a people map and for text that does not parse', () => {
  expect(addPersonEntry('accord: "1.0.0"\nprofile: build\n', 'new@x.io', 'NW')).toBeUndefined();
  expect(addPersonEntry('people: [AB]\n', 'new@x.io', 'NW')).toBeUndefined();
  expect(addPersonEntry('people: [\n  bad', 'new@x.io', 'NW')).toBeUndefined();
});

it('risk:data-loss 7-ac-4 G-07-2 addPersonEntry leaves the text as it was when the email is listed in another case', () => {
  expect(addPersonEntry(BASE, 'AN@Example.com', 'AX')).toBe(BASE);
});

it('risk:parsing 7-ac-4 G-07-2 addPersonEntry quotes initials that read as a boolean so the config still loads', () => {
  const base = 'accord: "1.0.0"\nprofile: build\ntracker:\n  adapter: none\ndesign:\n  tokens: ""\nroles: [ba, dev]\nruntimes: [claude]\npeople:\n  "an@example.com": AN\n';
  const out = addPersonEntry(base, 'new@x.io', 'NO') as string;
  expect(peopleOf(out)).toEqual({ 'an@example.com': 'AN', 'new@x.io': 'NO' });
  expect(loadConfig('accord/config.yml', out).findings).toEqual([]);
});
