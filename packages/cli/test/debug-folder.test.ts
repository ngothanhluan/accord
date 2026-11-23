// Phase 08.8 D-14: the one folder check that `accord debug path` and the session hook's `Unfinished:` line share. The parser and the verdicts are pure and run on every OS;
// the Windows access list read from a real folder is proven by the `runIf` cases of debug-path.test.ts and hook.test.ts.
import { expect, it } from 'vitest';
import { sddlAces, windowsVerdict } from '../src/load/debug-folder.js';

const USER = 'S-1-5-21-1-2-3-1001';

// Phase 08.8 D-14: icacls /save writes the folder's name on line 1 and its access list as SDDL on line 2.
it('risk:parsing sddlAces reads the allow entries of an icacls save file (D-14)', () => {
  const text = '﻿debug-folder\r\nD:AI(A;OICI;FA;;;SY)(A;OICIID;FA;;;BA)(A;OICI;FA;;;S-1-5-21-1-2-3-1001)\r\n';
  const read = sddlAces(text);
  expect(read).toEqual({
    aces: [
      { allow: true, inheritOnly: false, sid: 'SY' },
      { allow: true, inheritOnly: false, sid: 'BA' },
      { allow: true, inheritOnly: false, sid: USER },
    ],
  });

  // a deny entry is read as deny, an inherit-only entry as inherit-only
  expect(sddlAces('x\r\nD:PAI(D;;FA;;;WD)(A;OICIIO;FA;;;CO)\r\n')).toEqual({
    aces: [
      { allow: false, inheritOnly: false, sid: 'WD' },
      { allow: true, inheritOnly: true, sid: 'CO' },
    ],
  });

  // anything that is not an access list is an error, never an empty list
  for (const bad of ['', 'x\r\n', 'x\r\nO:BAG:SY\r\n', 'x\r\nD:AI(A;OICI;FA;;;)\r\n', 'x\r\nD:AI(A;OICI;FA)\r\n', 'x\r\nD:AI(Q;OICI;FA;;;SY)\r\n', 'x\r\nD:AI\r\n', 'x\r\nD:AI(A;OICI;FA;;;SY\r\n']) {
    const result = sddlAces(bad);
    expect(result, JSON.stringify(bad)).toHaveProperty('error');
  }
});

// Phase 08.8 D-14: a folder accord trusts grants no account other than SYSTEM, Administrators and the person running it.
it('risk:security the Windows verdict refuses an allow entry for any other account (D-14)', () => {
  const entry = (sid: string, inheritOnly = false) => ({ allow: true, inheritOnly, sid });
  const verdict = (...sids: string[]) => windowsVerdict(sids.map((sid) => entry(sid)), USER);

  expect(verdict('SY', 'BA', USER)).toBeUndefined();
  expect(verdict('S-1-5-18', 'S-1-5-32-544', USER)).toBeUndefined();

  // another account, a group everyone is in, or another person's own SID: refused, naming it
  for (const other of ['S-1-5-32-545', 'WD', 'AU', 'S-1-5-21-1-2-3-1002', 'S-1-1-0']) {
    expect(verdict('SY', 'BA', USER, other), other).toContain(other);
  }

  // the creator-owner entry that only children inherit is not an account; the same entry for anyone else is
  expect(windowsVerdict([entry('SY'), entry('CO', true)], USER)).toBeUndefined();
  expect(windowsVerdict([entry('SY'), entry('S-1-3-0', true)], USER)).toBeUndefined();
  expect(windowsVerdict([entry('SY'), entry('WD', true)], USER)).toContain('WD');

  // a deny entry takes access away and is never a reason to refuse
  expect(windowsVerdict([entry('SY'), { allow: false, inheritOnly: false, sid: 'WD' }], USER)).toBeUndefined();
});
