// Phase 08.8 D-14: the one folder check that `accord debug path` and the session hook's `Unfinished:` line share. The parser and the verdicts are pure and run on every OS;
// the Windows access list read from a real folder is proven by the `runIf` cases of debug-path.test.ts and hook.test.ts.
import { expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { Stats } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as folder from '../src/load/debug-folder.js';
import { checkDebugFolder, DEBUG_STATE_MAX, descriptorVerdict, folderVerdict, makePrivate, readDebugFile, sddlAces, windowsVerdict } from '../src/load/debug-folder.js';

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

// Phase 08.8 D-14 (IN-01, IN-02): off Windows the owner and the mode decide; a filesystem that stores no POSIX modes (WSL on /mnt/c) reads every folder 0777 and is accepted for its owner.
it('risk:security the POSIX verdict refuses another owner and an open folder unless the filesystem stores no modes (D-14)', () => {
  const own = { isLink: false, isDirectory: true, uid: 1000, userUid: 1000, mode: 0o700, madeNow: false };
  expect(folderVerdict(own)).toBeUndefined();
  expect(folderVerdict({ ...own, uid: 1001 })).toContain('another user');

  // a folder open to group or others is refused, with the state file absent or at 0600
  for (const mode of [0o755, 0o777]) {
    expect(folderVerdict({ ...own, mode }), String(mode)).toContain('open to group or others');
    expect(folderVerdict({ ...own, mode, fileMode: 0o600 }), String(mode)).toContain('open to group or others');
  }

  // no modes stored: a folder this run made reading exactly 0777, or a state file made at 0600 reading 0777 or 0666
  expect(folderVerdict({ ...own, mode: 0o777, madeNow: true })).toBeUndefined();
  expect(folderVerdict({ ...own, mode: 0o777, fileMode: 0o777, fileUid: 1000 })).toBeUndefined();
  expect(folderVerdict({ ...own, mode: 0o777, fileMode: 0o666, fileUid: 1000 })).toBeUndefined();
  // a folder made 0700 that reads 0755 stores modes, so it is open
  expect(folderVerdict({ ...own, mode: 0o755, madeNow: true })).toContain('open to group or others');
  // the owner is still checked
  expect(folderVerdict({ ...own, uid: 1001, mode: 0o777, madeNow: true })).toContain('another user');

  // a link or a file is never a folder of ours
  expect(folderVerdict({ ...own, isLink: true })).toContain('not a plain folder');
  expect(folderVerdict({ ...own, isDirectory: false })).toContain('not a plain folder');
});

// Phase 08.8 review CR-01: the owner of a Windows folder keeps READ_CONTROL and WRITE_DAC whatever its access list says, so a folder another account created and then
// narrowed to SYSTEM, Administrators and the person still belongs to that account. The owner (`O:` of the security descriptor) is judged beside the access list (`D:`).
it('risk:security on Windows a debug folder or state file owned by another account is refused (08.8 REVIEW CR-01)', () => {
  const OTHER = 'S-1-5-21-1-2-3-1002';
  const dacl = `D:PAI(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)(A;OICI;FA;;;${USER})`;
  const stat = (dir: boolean) => ({ isSymbolicLink: () => false, isDirectory: () => dir, isFile: () => !dir, mode: dir ? 0o40666 : 0o100666, size: 1, mtimeMs: 1 }) as unknown as Stats;
  const dir = 'C:/t/accord-debug-x';
  const file = dir + '/a.md';
  const deps = (owners: Record<string, string>) => ({
    platform: 'win32' as const,
    userSid: () => USER,
    lstat: (p: string) => stat(p === dir),
    sddl: (paths: readonly string[]) => paths.map((p) => `O:${owners[p] ?? USER}${dacl}`),
    read: () => 'x',
  });

  // the folder: the person's own SID, or SYSTEM or Administrators (the owner an elevated session gives), passes; another account is refused and named
  expect(checkDebugFolder(dir, deps({}))).toEqual({ state: 'ok' });
  expect(checkDebugFolder(dir, deps({ [dir]: 'BA' }))).toEqual({ state: 'ok' });
  const theirs = checkDebugFolder(dir, deps({ [dir]: OTHER }));
  expect(theirs).toEqual({ state: 'refused', reason: expect.stringContaining('owned by another account') });
  expect(JSON.stringify(theirs)).toContain(OTHER);
  // a descriptor with no owner cannot be judged: refused, never trusted
  expect(checkDebugFolder(dir, { ...deps({}), sddl: (paths: readonly string[]) => paths.map(() => dacl) })).toMatchObject({ state: 'refused' });

  // the state file inside a folder of the person's own: another owner, or an entry for another account, is refused and its text never read
  expect(checkDebugFolder(dir, { ...deps({ [file]: OTHER }), stateFile: file })).toEqual({ state: 'refused', reason: expect.stringContaining('owned by another account') });
  expect(readDebugFile(file, deps({ [file]: OTHER }))).toBeUndefined();
  const granted = { ...deps({}), sddl: (paths: readonly string[]) => paths.map((p) => `O:${USER}${dacl}` + (p === file ? `(A;;FA;;;${OTHER})` : '')) };
  expect(checkDebugFolder(dir, { ...granted, stateFile: file })).toEqual({ state: 'refused', reason: expect.stringContaining(OTHER) });
  expect(readDebugFile(file, deps({}))).toEqual({ text: 'x', mtimeMs: 1 });
});

// Windows reads the built-in Administrator account (RID 500, the account of the GitHub windows-latest runner) back from a security descriptor as the alias LA, never as its
// SID: the person's own entry, and the owner an elevated session gives, must not be taken for another account (found by the first windows.yml run, Phase 08.9.1 plan 01).
it('risk:security on Windows the built-in Administrator account is the person when the person is that account (08.9.1)', () => {
  const ADMIN = 'S-1-5-21-1-2-3-500';
  const dacl = 'D:PAI(A;OICI;FA;;;LA)(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)';
  expect(descriptorVerdict(`O:LAG:LA${dacl}`, ADMIN)).toBeUndefined();
  expect(descriptorVerdict(`O:BA${dacl}`, ADMIN)).toBeUndefined();
  // a person who is another account still gets the alias refused, and a domain's RID 500 does not make a different machine's person the Administrator
  expect(descriptorVerdict(`O:${USER}${dacl}`, USER)).toContain('LA');
  expect(descriptorVerdict(`O:LA${dacl}`, USER)).toContain('owned by another account');
  expect(descriptorVerdict(`O:LA${dacl}`, 'S-1-5-21-1-2-3-1500')).toContain('owned by another account');
});

// Phase 08.8 review CR-01: the descriptor is read from the real folder through a System32 program, owner included (icacls /save writes no owner). The folder is made private first,
// as accord does: a plain folder in a shared TEMP (D:\a\_temp on the GitHub runner) inherits the parent's list, which names the Users group.
it.runIf(process.platform === 'win32')('risk:security on Windows the security descriptor read from a real folder names its owner (08.8 REVIEW CR-01)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'p88-owner-'));
  try {
    makePrivate(dir);
    writeFileSync(join(dir, 'a.md'), 'x');
    const read = folder.securityDescriptors([dir, join(dir, 'a.md')]);
    expect(read).toHaveLength(2);
    for (const sddl of read) expect(sddl).toMatch(/^O:(?:[A-Z]{2}|S-1-[0-9-]+)(?:G:\S+?)?D:/);
    expect(checkDebugFolder(dir, { stateFile: join(dir, 'a.md') })).toEqual({ state: 'ok' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Phase 08.8 review WR-02: a state file reading 0666 or 0777 shows a filesystem that stores no modes only when it is the person's own file in a folder reading exactly 0777;
// another account's file, or a folder with real modes such as 0775, is never taken as that sign.
it('risk:security the no-modes sign counts only a state file of the person in a folder reading 0777 (08.8 REVIEW WR-02)', () => {
  const own = { isLink: false, isDirectory: true, uid: 1000, userUid: 1000, mode: 0o777, madeNow: false };
  expect(folderVerdict({ ...own, fileMode: 0o666, fileUid: 1000 })).toBeUndefined();
  expect(folderVerdict({ ...own, fileMode: 0o777, fileUid: 1000 })).toBeUndefined();
  expect(folderVerdict({ ...own, fileMode: 0o666, fileUid: 1001 })).toContain('open to group or others');
  expect(folderVerdict({ ...own, fileMode: 0o666 })).toContain('open to group or others');
  expect(folderVerdict({ ...own, mode: 0o775, fileMode: 0o666, fileUid: 1000 })).toContain('open to group or others');

  // through the read the hook makes: a world-writable folder holding another account's 0666 file gives nothing
  const stat = (p: string) =>
    (p.endsWith('.md') ? { isSymbolicLink: () => false, isDirectory: () => false, isFile: () => true, mode: 0o100666, uid: 1001, size: 1, mtimeMs: 1 } : { isSymbolicLink: () => false, isDirectory: () => true, isFile: () => false, mode: 0o40777, uid: 1000, size: 0, mtimeMs: 1 }) as unknown as Stats;
  expect(readDebugFile('/t/accord-debug-x/a.md', { platform: 'linux', userUid: 1000, lstat: stat, read: () => 'planted' })).toBeUndefined();
});

// Phase 08.8 D-14 (WR-02): the state file is data from whoever could write the folder, so the hook and `accord debug path` read it only up to a size limit.
it('risk:resource the state file is read only up to DEBUG_STATE_MAX (D-14)', () => {
  const stat = (size: number, folder: boolean) => ({ isSymbolicLink: () => false, isDirectory: () => folder, isFile: () => !folder, mode: folder ? 0o40700 : 0o100600, uid: 1000, size, mtimeMs: 1 }) as unknown as Stats;
  let reads = 0;
  const deps = (size: number) => ({ platform: 'linux' as const, userUid: 1000, lstat: (p: string) => stat(p.endsWith('.md') ? size : 0, !p.endsWith('.md')), read: () => (reads++, 'x') });
  expect(readDebugFile('/t/accord-debug-x/a.md', deps(DEBUG_STATE_MAX + 1))).toBeUndefined();
  expect(reads, 'an over-size file is not read').toBe(0);
  expect(readDebugFile('/t/accord-debug-x/a.md', deps(DEBUG_STATE_MAX))).toEqual({ text: 'x', mtimeMs: 1 });
  expect(reads).toBe(1);
});
