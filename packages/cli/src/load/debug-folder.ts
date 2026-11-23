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

/** A state file larger than this is data nobody investigating by hand wrote: the hook gives no line and `accord debug path` refuses it. */
export const DEBUG_STATE_MAX = 1024 * 1024;

/** The session hook stops announcing an episode whose state file was last written more than this many days ago (`accord debug path` still reports it open). */
export const DEBUG_EPISODE_DAYS = 7;

/** What is known about a folder; `folderVerdict` judges it without touching the disk. */
export interface FolderFacts {
  isLink: boolean;
  isDirectory: boolean;
  /** The folder's owner and the person's id, where the OS has them (never on Windows). */
  uid?: number;
  userUid?: number;
  mode: number;
  /** True when this run created the folder (with mode 0700). */
  madeNow: boolean;
  /** The state file's mode, when it exists (accord creates it 0600). */
  fileMode?: number;
  /** False where modes mean nothing (Windows): the owner and the mode are then not judged. */
  modes?: boolean;
}

/**
 * Why the folder is not the person's own, or undefined (read as "<dir> is <reason>"). Link, plain folder, owner, then mode. A filesystem that stores no POSIX modes (WSL on /mnt/c)
 * reads everything 0777: a folder this run made 0700 that reads exactly 0777, or a state file accord made 0600 that reads 0777 or 0666, shows that, and the folder is then accepted
 * for its owner; on a filesystem with modes a folder open to group or others is refused.
 */
export function folderVerdict(f: FolderFacts): string | undefined {
  if (f.isLink || !f.isDirectory) return 'not a plain folder (a link or a file)';
  if (f.modes === false) return undefined;
  if (f.uid !== undefined && f.userUid !== undefined && f.uid !== f.userUid) return 'owned by another user';
  const mode = f.mode & 0o777;
  if ((mode & 0o077) === 0) return undefined;
  const storesNoModes = (f.madeNow && mode === 0o777) || f.fileMode === 0o777 || f.fileMode === 0o666;
  return storesNoModes ? undefined : 'open to group or others';
}

/** What a caller may inject to test without the real disk or a Windows host. */
export interface FolderDeps {
  platform?: NodeJS.Platform;
  /** The text `icacls /save` wrote for the folder. */
  acl?: (dir: string) => string;
  userSid?: () => string;
  userUid?: number;
  lstat?: (path: string) => Stats | undefined;
  read?: (path: string) => string;
  /** This run created the folder. */
  madeNow?: boolean;
  /** The state file's mode, when it exists. */
  fileMode?: number;
}

const defaultLstat = (path: string): Stats | undefined => lstatSync(path, { throwIfNoEntry: false });

export type FolderCheck = { state: 'ok' } | { state: 'absent' } | { state: 'refused'; reason: string };

/** `ok` when `dir` is a plain folder only the person can use, `absent` when it does not exist, else `refused` with the reason (read as "<dir> is <reason>"). Never creates or changes anything. */
export function checkDebugFolder(dir: string, deps: FolderDeps = {}): FolderCheck {
  const refused = (reason: string): FolderCheck => ({ state: 'refused', reason });
  const windows = (deps.platform ?? process.platform) === 'win32';
  let found: Stats | undefined;
  try {
    found = (deps.lstat ?? defaultLstat)(dir);
  } catch (e) {
    return refused(`unreadable (${(e as NodeJS.ErrnoException).code ?? 'error'})`);
  }
  if (found === undefined) return { state: 'absent' };
  const facts: FolderFacts = { isLink: found.isSymbolicLink(), isDirectory: found.isDirectory(), mode: found.mode, madeNow: deps.madeNow === true, modes: !windows };
  if (!windows) {
    facts.uid = found.uid;
    const userUid = deps.userUid ?? (typeof process.getuid === 'function' ? process.getuid() : undefined);
    if (userUid !== undefined) facts.userUid = userUid;
  }
  if (deps.fileMode !== undefined) facts.fileMode = deps.fileMode;
  const why = folderVerdict(facts);
  if (why !== undefined) return refused(why);
  if (windows) {
    try {
      const read = sddlAces((deps.acl ?? savedAcl)(dir));
      if ('error' in read) return refused(`not checkable: ${read.error}`);
      const listed = windowsVerdict(read.aces, (deps.userSid ?? currentSid)());
      if (listed !== undefined) return refused(listed);
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

/** The mode (permission bits) of the state file when it is a regular file, else undefined; the folder check reads it to tell a filesystem that stores no modes. Never throws. */
export function fileModeOf(path: string, deps: Pick<FolderDeps, 'lstat'> = {}): number | undefined {
  try {
    const found = (deps.lstat ?? defaultLstat)(path);
    return found?.isFile() === true ? found.mode & 0o777 : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The state file's text and last write time when it is a regular file of at most `DEBUG_STATE_MAX` bytes; anything else (absent, a link, a folder, too large, unreadable) is
 * undefined, and a file over the limit is not read. Never throws; the folder is not checked here.
 */
export function readStateFile(path: string, deps: Pick<FolderDeps, 'lstat' | 'read'> = {}): { text: string; mtimeMs: number } | undefined {
  try {
    const found = (deps.lstat ?? defaultLstat)(path);
    if (found === undefined || !found.isFile() || found.size > DEBUG_STATE_MAX) return undefined;
    return { text: (deps.read ?? ((p: string) => readFileSync(p, 'utf8')))(path), mtimeMs: found.mtimeMs };
  } catch {
    return undefined;
  }
}

/** The state file read only through the folder check: a folder that is absent or refused gives undefined. Never throws, never creates. */
export function readDebugFile(path: string, deps: FolderDeps = {}): { text: string; mtimeMs: number } | undefined {
  try {
    const fileMode = fileModeOf(path, deps);
    const folder = checkDebugFolder(folderOf(path), fileMode === undefined ? deps : { ...deps, fileMode });
    return folder.state === 'ok' ? readStateFile(path, deps) : undefined;
  } catch {
    return undefined;
  }
}
