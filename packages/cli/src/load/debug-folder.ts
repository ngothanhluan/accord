// Phase 08.8 D-14 (999.52 WR-01, WR-02): the one check of the outside-ticket debug folder that `accord debug path` and the session hook's `Unfinished:` line share.
// The threat is another account of a shared temp directory: the folder name is documented and predictable, so any account can create the folder first and then read what
// accord writes there or feed the hook a state file of its own. The folder is therefore trusted only when it is the person's own: a plain folder (no link) that no other account
// can use. Node reports no owner and mode 666 on Windows, so there the folder's security descriptor decides: its owner and its access list, read as SDDL (SIDs, so no language
// dependence). Phase 08.8 review CR-01: the owner keeps READ_CONTROL and WRITE_DAC whatever the list says, so `icacls /save` (which writes the list only) is not enough; the
// descriptor is read through Windows PowerShell's .NET access-control classes (no module is loaded), and the state file inside is judged the same way. Every program is called by
// its System32 path with an argument array, paths passed in the environment, never in the command text; any failure to read is a refusal (fail closed). Nothing here prints a
// state file's text.
import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync } from 'node:fs';
import type { Stats } from 'node:fs';
import { win32 } from 'node:path';

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
 * The entries of the line that starts `D:` (an access list in SDDL form, as `descriptorVerdict` passes it or as an `icacls /save` file holds it). An error, never an empty list,
 * for text with no access list, a malformed entry or a list with no entry. A SACL part (`S:`) after the entries is ignored.
 */
export function sddlAces(text: string): { aces: Ace[] } | { error: string } {
  const line = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).split(/\r?\n/).find((l) => l.startsWith('D:'));
  if (line === undefined) return { error: 'no access list (D:) in the security descriptor' };
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

/** SDDL writes well-known groups under their two-letter alias; the refusal also names the group and its SID so the person can find it. */
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

/** Whether an account (a SID, or the alias SDDL writes for it) is the person: the built-in Administrator account (RID 500) is read back from a descriptor as `LA`, never as its SID. */
const isPerson = (sid: string, userSid: string): boolean => sid.toUpperCase() === userSid.toUpperCase() || (sid === 'LA' && /^S-1-5-21(?:-\d+)+-500$/.test(userSid));
const CREATOR_OWNER = new Set(['CO', 'S-1-3-0']);

/**
 * Why the folder is not the person's own, or undefined. An allow entry for any account but SYSTEM, Administrators and `userSid` refuses (inherit-only included, since the state
 * file inherits it); the creator-owner placeholder passes only as inherit-only. A deny entry only takes access away and never refuses.
 */
export function windowsVerdict(aces: readonly Ace[], userSid: string): string | undefined {
  for (const ace of aces) {
    if (!ace.allow || OWN.has(ace.sid) || isPerson(ace.sid, userSid)) continue;
    if (ace.inheritOnly && CREATOR_OWNER.has(ace.sid)) continue;
    return `open to another account (${named(ace.sid)})`;
  }
  return undefined;
}

const named = (sid: string): string => (KNOWN[sid] === undefined ? sid : `${sid}, ${KNOWN[sid]}`);
const SDDL = /^O:([A-Z]{2}|S-1-\d+(?:-\d+)*)(?:G:(?:[A-Z]{2}|S-1-\d+(?:-\d+)*))?(D:.*)?$/;

/**
 * Why an object whose security descriptor is `sddl` (`O:<owner>[G:<group>]D:<list>`) is not the person's own, or undefined. Review CR-01: the owner is judged first, and only the
 * person, SYSTEM or Administrators may own it (an elevated session owns what it makes as Administrators); then the access list, as `windowsVerdict`. No owner, or no list, refuses.
 */
export function descriptorVerdict(sddl: string, userSid: string): string | undefined {
  const parts = SDDL.exec(sddl.trim());
  if (parts === null) return 'not checkable: no owner in the security descriptor';
  const owner = parts[1] as string;
  if (!OWN.has(owner) && !isPerson(owner, userSid)) return `owned by another account (${named(owner)})`;
  const read = sddlAces(parts[2] ?? '');
  if ('error' in read) return `not checkable: ${read.error}`;
  return windowsVerdict(read.aces, userSid);
}

/** A program under this host's System32 folder, or an error when `SystemRoot` is not set; never found through PATH (Git Bash puts coreutils `whoami` first). */
function system32(program: string): string {
  const root = process.env.SystemRoot ?? process.env.windir;
  if (root === undefined || root === '') throw new Error('SystemRoot is not set, so ' + program + ' cannot be found');
  return win32.join(root, 'System32', program);
}

function runSystem(program: string, args: string[], env?: NodeJS.ProcessEnv): string {
  try {
    return execFileSync(system32(program), args, { encoding: 'utf8', windowsHide: true, timeout: 15_000, stdio: ['ignore', 'pipe', 'pipe'], ...(env === undefined ? {} : { env }) });
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    throw new Error(code === 'ENOENT' ? `${program} was not found in the System32 folder` : `${program} failed: ${(e as Error).message.split('\n')[0]}`, { cause: e });
  }
}

const backslashed = (path: string): string => path.replace(/\//g, '\\');

// One line of SDDL (owner and access list) per path of ACCORD_SDDL_PATHS (one per line; no Windows path holds a newline). A path that cannot be read stops the run with an error.
const SDDL_SCRIPT =
  "$ErrorActionPreference = 'Stop'; $s = [System.Security.AccessControl.AccessControlSections]'Owner, Access'; " +
  'foreach ($p in $env:ACCORD_SDDL_PATHS.Split([char]10)) { if ([System.IO.Directory]::Exists($p)) { [System.IO.Directory]::GetAccessControl($p, $s).GetSecurityDescriptorSddlForm($s) } ' +
  'else { [System.IO.File]::GetAccessControl($p, $s).GetSecurityDescriptorSddlForm($s) } }';

/** The security descriptor (owner and access list, SDDL) of each path, in order, read in one Windows PowerShell run. Throws when any cannot be read. */
export function securityDescriptors(paths: readonly string[]): string[] {
  const env = { ...process.env, ACCORD_SDDL_PATHS: paths.map(backslashed).join('\n') };
  const out = runSystem('WindowsPowerShell\\v1.0\\powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', SDDL_SCRIPT], env);
  const lines = out.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '');
  if (lines.length !== paths.length) throw new Error(`powershell.exe printed ${lines.length} security descriptors for ${paths.length} paths`);
  return lines;
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
  /** The state file's mode and owner, when it exists (accord creates it 0600). */
  fileMode?: number;
  fileUid?: number;
  /** False where modes mean nothing (Windows): the owner and the mode are then not judged. */
  modes?: boolean;
}

/**
 * Why the folder is not the person's own, or undefined (read as "<dir> is <reason>"). Link, plain folder, owner, then mode. A filesystem that stores no POSIX modes (WSL on /mnt/c)
 * reads everything 0777: a folder reading exactly 0777 that this run made 0700, or that holds the person's own state file (accord made it 0600) reading 0777 or 0666, shows that,
 * and the folder is then accepted for its owner; on a filesystem with modes a folder open to group or others is refused. Review WR-02: another account's file, or a folder reading
 * anything but 0777, is never that sign, since anyone can create a 0666 file in a folder opened to others.
 */
export function folderVerdict(f: FolderFacts): string | undefined {
  if (f.isLink || !f.isDirectory) return 'not a plain folder (a link or a file)';
  if (f.modes === false) return undefined;
  if (f.uid !== undefined && f.userUid !== undefined && f.uid !== f.userUid) return 'owned by another user';
  const mode = f.mode & 0o777;
  if ((mode & 0o077) === 0) return undefined;
  const ownFile = f.fileUid !== undefined && f.userUid !== undefined && f.fileUid === f.userUid && (f.fileMode === 0o777 || f.fileMode === 0o666);
  const storesNoModes = mode === 0o777 && (f.madeNow || ownFile);
  return storesNoModes ? undefined : 'open to group or others';
}

/** What a caller may inject to test without the real disk or a Windows host. */
export interface FolderDeps {
  platform?: NodeJS.Platform;
  /** The security descriptor (SDDL) of each path, in order (`securityDescriptors`). */
  sddl?: (paths: readonly string[]) => string[];
  userSid?: () => string;
  userUid?: number;
  lstat?: (path: string) => Stats | undefined;
  read?: (path: string) => string;
  /** This run created the folder. */
  madeNow?: boolean;
  /** The state file in the folder: when it is a regular file, its mode and owner tell a filesystem with no modes, and on Windows its own descriptor is judged too (review CR-01). */
  stateFile?: string;
}

const defaultLstat = (path: string): Stats | undefined => lstatSync(path, { throwIfNoEntry: false });

export type FolderCheck = { state: 'ok' } | { state: 'absent' } | { state: 'refused'; reason: string };

/**
 * `ok` when `dir` is a plain folder only the person can use (and `deps.stateFile`, when it is a regular file, too), `absent` when it does not exist, else `refused` with the reason
 * (read as "<dir> is <reason>"). Never creates or changes anything.
 */
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
  const file = deps.stateFile === undefined ? undefined : regularFile(deps.stateFile, deps);
  if (file !== undefined) {
    facts.fileMode = file.mode & 0o777;
    facts.fileUid = file.uid;
  }
  const why = folderVerdict(facts);
  if (why !== undefined) return refused(why);
  if (windows) {
    try {
      const paths = file === undefined ? [dir] : [dir, deps.stateFile as string];
      const read = (deps.sddl ?? securityDescriptors)(paths);
      if (read.length !== paths.length) return refused('not checkable: a security descriptor is missing');
      const userSid = (deps.userSid ?? currentSid)();
      const listed = descriptorVerdict(read[0] as string, userSid);
      if (listed !== undefined) return refused(listed);
      const held = file === undefined ? undefined : descriptorVerdict(read[1] as string, userSid);
      if (held !== undefined) return refused(`holding a state file that is ${held}`);
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

/** The state file's stats when it is a regular file, else undefined (absent, a link, a folder, unreadable). Never throws. */
function regularFile(path: string, deps: Pick<FolderDeps, 'lstat'>): Stats | undefined {
  try {
    const found = (deps.lstat ?? defaultLstat)(path);
    return found?.isFile() === true ? found : undefined;
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

/** The state file read only through the folder check, the file included: a folder that is absent or refused gives undefined. Never throws, never creates. */
export function readDebugFile(path: string, deps: FolderDeps = {}): { text: string; mtimeMs: number } | undefined {
  try {
    const folder = checkDebugFolder(folderOf(path), { ...deps, stateFile: path });
    return folder.state === 'ok' ? readStateFile(path, deps) : undefined;
  } catch {
    return undefined;
  }
}
