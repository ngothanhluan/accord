// Phase 08.8 D-14 (999.52 WR-01, WR-02): the one check of the outside-ticket debug folder that `accord debug path` and the session hook's `Unfinished:` line share.
// The threat is another account of a shared temp directory: the folder name is documented and predictable, so any account can create the folder first and then read what
// accord writes there or feed the hook a state file of its own. The folder is therefore trusted only when it is the person's own: a plain folder (no link) that no other account
// can use. Node reports no owner and mode 666 on Windows, so there the folder's access list decides, read as SDDL with `icacls /save` (SIDs, so no language dependence).
// Both programs are called by their System32 path with an argument array; any failure to read the list is a refusal (fail closed). Nothing here prints a state file's text.
import { execFileSync } from 'node:child_process';
import { lstatSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import type { Stats } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, win32 } from 'node:path';

/** One entry of an access list: allow or deny, whether it only reaches children, and the account's SID (or the two-letter SDDL alias). */
export interface Ace {
  allow: boolean;
  inheritOnly: boolean;
  sid: string;
}

const ALLOW_TYPES = new Set(['A', 'OA', 'XA', 'ZA']);
const DENY_TYPES = new Set(['D', 'OD', 'XD', 'ZD']);
const SID = /^(?:[A-Z]{2}|S-1-\d+(?:-\d+)*)$/;

/**
 * The entries of the `D:` line of an `icacls /save` file (line 1 is the name, line 2 the SDDL; the file is UTF-16LE, decoded by the caller). An error, never an empty list, for
 * text with no access list, a malformed entry or a list with no entry. A SACL part (`S:`) after the entries is ignored.
 */
export function sddlAces(text: string): { aces: Ace[] } | { error: string } {
  const line = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).split(/\r?\n/).find((l) => l.startsWith('D:'));
  if (line === undefined) return { error: 'no access list (D:) in the icacls output' };
  const body = /^D:[A-Z]*((?:\([^()]*\))*)(?:S:.*)?$/.exec(line.trimEnd());
  if (body === null) return { error: 'the access list is not in SDDL form' };
  const aces: Ace[] = [];
  for (const raw of (body[1] as string).matchAll(/\(([^()]*)\)/g)) {
    const fields = (raw[1] as string).split(';');
    const type = fields[0] as string;
    const sid = fields[5] ?? '';
    if (fields.length < 6 || !(ALLOW_TYPES.has(type) || DENY_TYPES.has(type))) return { error: `an entry of the access list is malformed: (${raw[1]})` };
    if (!SID.test(sid)) return { error: `an entry of the access list names no account: (${raw[1]})` };
    aces.push({ allow: ALLOW_TYPES.has(type), inheritOnly: (((fields[1] as string).match(/../g) ?? []) as string[]).includes('IO'), sid });
  }
  return aces.length === 0 ? { error: 'the access list holds no entry' } : { aces };
}

/** icacls saves well-known groups under their two-letter alias; the refusal also names the group and its SID so the person can find it. */
const KNOWN: Record<string, string> = {
  WD: 'Everyone, S-1-1-0',
  BU: 'the Users group, S-1-5-32-545',
  AU: 'Authenticated Users, S-1-5-11',
  IU: 'Interactive, S-1-5-4',
  NU: 'Network, S-1-5-2',
  BG: 'the Guests group, S-1-5-32-546',
  PU: 'Power Users, S-1-5-32-547',
  AN: 'Anonymous, S-1-5-7',
  CO: 'Creator Owner, S-1-3-0',
};

const OWN = new Set(['SY', 'S-1-5-18', 'BA', 'S-1-5-32-544']);
const CREATOR_OWNER = new Set(['CO', 'S-1-3-0']);

/**
 * Why the folder is not the person's own, or undefined. An allow entry for any account but SYSTEM, Administrators and `userSid` refuses (inherit-only included, since the state
 * file inherits it); the creator-owner placeholder passes only as inherit-only. A deny entry only takes access away and never refuses.
 */
export function windowsVerdict(aces: readonly Ace[], userSid: string): string | undefined {
  for (const ace of aces) {
    if (!ace.allow || OWN.has(ace.sid) || ace.sid.toUpperCase() === userSid.toUpperCase()) continue;
    if (ace.inheritOnly && CREATOR_OWNER.has(ace.sid)) continue;
    const known = KNOWN[ace.sid];
    return `open to another account (${known === undefined ? ace.sid : `${ace.sid}, ${known}`})`;
  }
  return undefined;
}

/** A System32 program of this host, or an error when `SystemRoot` is not set; never found through PATH (Git Bash puts coreutils `whoami` first). */
function system32(program: string): string {
  const root = process.env.SystemRoot ?? process.env.windir;
  if (root === undefined || root === '') throw new Error('SystemRoot is not set, so ' + program + ' cannot be found');
  return win32.join(root, 'System32', program);
}

function runSystem(program: string, args: string[]): string {
  try {
    return execFileSync(system32(program), args, { encoding: 'utf8', windowsHide: true, timeout: 15_000, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    throw new Error(code === 'ENOENT' ? `${program} was not found in the System32 folder` : `${program} failed: ${(e as Error).message.split('\n')[0]}`, { cause: e });
  }
}

const backslashed = (path: string): string => path.replace(/\//g, '\\');

/** The saved access list of `dir`, written by icacls into a fresh folder of its own that is removed again. */
function savedAcl(dir: string): string {
  const work = mkdtempSync(join(tmpdir(), 'accord-acl-'));
  try {
    const file = join(work, 'acl.txt');
    runSystem('icacls.exe', [backslashed(dir), '/save', file]);
    return readFileSync(file).toString('utf16le');
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** The SID of the person running accord (`whoami /user`, second field of the CSV row). */
function currentSid(): string {
  const sid = /,"(S-1-[0-9-]+)"/.exec(runSystem('whoami.exe', ['/user', '/fo', 'csv', '/nh']))?.[1];
  if (sid === undefined) throw new Error('whoami.exe did not print the current user');
  return sid;
}

/** What a caller may inject to test without a Windows host. */
export interface FolderDeps {
  platform?: NodeJS.Platform;
  /** The text `icacls /save` wrote for the folder. */
  acl?: (dir: string) => string;
  userSid?: () => string;
}

export type FolderCheck = { state: 'ok' } | { state: 'absent' } | { state: 'refused'; reason: string };

/** `ok` when `dir` is a plain folder only the person can use, `absent` when it does not exist, else `refused` with the reason (read as "<dir> is <reason>"). Never creates or changes anything. */
export function checkDebugFolder(dir: string, deps: FolderDeps = {}): FolderCheck {
  const refused = (reason: string): FolderCheck => ({ state: 'refused', reason });
  let found: Stats | undefined;
  try {
    found = lstatSync(dir, { throwIfNoEntry: false });
  } catch (e) {
    return refused(`unreadable (${(e as NodeJS.ErrnoException).code ?? 'error'})`);
  }
  if (found === undefined) return { state: 'absent' };
  if (found.isSymbolicLink() || !found.isDirectory()) return refused('not a plain folder (a link or a file)');
  if ((deps.platform ?? process.platform) === 'win32') {
    try {
      const read = sddlAces((deps.acl ?? savedAcl)(dir));
      if ('error' in read) return refused(`not checkable: ${read.error}`);
      const why = windowsVerdict(read.aces, (deps.userSid ?? currentSid)());
      if (why !== undefined) return refused(why);
    } catch (e) {
      return refused(`not checkable: ${(e as Error).message}`);
    }
  }
  return { state: 'ok' };
}

/**
 * The Windows counterpart of `mkdir 0700`: a folder made in a shared TEMP inherits the parent's broad list, so the list is set to SYSTEM, Administrators and the person alone.
 * A no-op elsewhere. Throws when icacls cannot do it (the caller removes the empty folder and refuses).
 */
export function makePrivate(dir: string, deps: { platform?: NodeJS.Platform; userSid?: () => string; run?: (program: string, args: string[]) => string } = {}): void {
  if ((deps.platform ?? process.platform) !== 'win32') return;
  const sid = (deps.userSid ?? currentSid)();
  (deps.run ?? runSystem)('icacls.exe', [backslashed(dir), '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`, '*S-1-5-18:(OI)(CI)F', '*S-1-5-32-544:(OI)(CI)F']);
}

/** The folder part of a state path (forward or back slashes). */
export function folderOf(path: string): string {
  return path.slice(0, Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')));
}

/** The state file's text and last write time when it is a regular file; anything else (absent, a link, a folder, unreadable) is undefined. Never throws; the folder is not checked here. */
export function readStateFile(path: string): { text: string; mtimeMs: number } | undefined {
  try {
    const found = lstatSync(path, { throwIfNoEntry: false });
    return found !== undefined && found.isFile() ? { text: readFileSync(path, 'utf8'), mtimeMs: found.mtimeMs } : undefined;
  } catch {
    return undefined;
  }
}

/** The state file read only through the folder check: a folder that is absent or refused gives undefined. Never throws, never creates. */
export function readDebugFile(path: string, deps: FolderDeps = {}): { text: string; mtimeMs: number } | undefined {
  try {
    return checkDebugFolder(folderOf(path), deps).state === 'ok' ? readStateFile(path) : undefined;
  } catch {
    return undefined;
  }
}
