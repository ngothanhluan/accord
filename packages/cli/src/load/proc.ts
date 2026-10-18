import { execFileSync, spawnSync } from 'node:child_process';
import { UsageError } from './fs.js';

export interface ProcRow {
  pid: number;
  ppid: number;
  start: string;
}

export interface Session {
  tool: 'Claude Code';
  marker: string;
  pid: number;
  start: string;
}

const WIN_SCRIPT =
  "[Console]::OutputEncoding = [Text.Encoding]::UTF8; " +
  "$r = @(Get-CimInstance Win32_Process | ForEach-Object { [pscustomobject]@{ pid = [int]$_.ProcessId; ppid = [int]$_.ParentProcessId; " +
  "start = $(if ($_.CreationDate) { $_.CreationDate.ToUniversalTime().ToString('o') } else { '' }) } }); " +
  "ConvertTo-Json -InputObject $r -Compress";

/** The OS process table. A failure throws: a hold is never judged on a guess. */
export function processTable(): ProcRow[] {
  const opts = { encoding: 'utf8' as const, stdio: ['ignore', 'pipe', 'pipe'] as ('ignore' | 'pipe')[], maxBuffer: 64 * 1024 * 1024 };
  try {
    if (process.platform === 'win32') {
      const parsed: unknown = JSON.parse(
        execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', WIN_SCRIPT], opts),
      );
      const rows = (Array.isArray(parsed) ? parsed : [parsed]) as ProcRow[];
      return rows.map((r) => ({ pid: r.pid, ppid: r.ppid, start: r.start }));
    }
    const out = execFileSync('ps', ['-A', '-o', 'pid=', '-o', 'ppid=', '-o', 'lstart='], {
      ...opts,
      env: { ...process.env, LC_ALL: 'C', TZ: 'UTC' },
    });
    return out
      .split('\n')
      .filter((l) => l.trim() !== '')
      .map((l) => {
        const f = l.trim().split(/\s+/);
        const row = { pid: Number(f[0]), ppid: Number(f[1]), start: f.slice(2, 7).join(' ') };
        if (f.length < 7 || !Number.isInteger(row.pid) || !Number.isInteger(row.ppid)) throw new Error('bad line: ' + l);
        return row;
      });
  } catch (e) {
    throw new UsageError('cannot read the process table: ' + (e instanceof Error ? e.message : String(e)));
  }
}

/** The Claude Code session variables, or undefined in another tool (D-17). */
export function claudeEnv(env: NodeJS.ProcessEnv): { marker: string; pid: number } | undefined {
  const marker = env.CLAUDE_CODE_SESSION_ID ?? '';
  const pid = env.CLAUDE_PID ?? '';
  if (marker !== '' && pid !== '') {
    if (!/^[1-9][0-9]*$/.test(pid)) throw new UsageError('CLAUDE_PID is not a process id: ' + pid);
    return { marker, pid: Number(pid) };
  }
  if (env.CLAUDECODE === '1') {
    const missing = [marker === '' && 'CLAUDE_CODE_SESSION_ID', pid === '' && 'CLAUDE_PID'].filter(Boolean);
    throw new UsageError(
      `this Claude Code session sets no ${missing.join(' or ')}, so its hold cannot be taken - update Claude Code`,
    );
  }
  return undefined;
}

/** The claude process among the parents of `self`; a table that does not show it is refused. */
export function sessionIn(claude: { marker: string; pid: number }, table: ProcRow[], self: number): Session {
  const rows = new Map(table.map((r) => [r.pid, r]));
  const c = rows.get(claude.pid);
  const accept = (): Session => {
    if (c === undefined || c.start === '') return refuse();
    return { tool: 'Claude Code', marker: claude.marker, pid: claude.pid, start: c.start };
  };
  const refuse = (): never => {
    throw new UsageError(
      `cannot see this Claude Code session (CLAUDE_PID ${claude.pid}) among the parents of this command in the process table, so no hold can be judged - run it outside a sandbox`,
    );
  };
  const seen = new Set<number>([self]);
  let cur = self;
  for (;;) {
    if (cur === claude.pid) return accept();
    const row = rows.get(cur);
    // shortcut: a parent id with no row is taken as the Windows gap of an exited msys bash, whatever it was
    if (row === undefined) return cur === self ? refuse() : accept();
    if (row.pid === 1 || row.ppid === 0 || seen.has(row.ppid)) return refuse();
    seen.add(row.ppid);
    cur = row.ppid;
  }
}

export function sameSession(
  a: { marker: string; pid: number; start: string },
  b: { marker: string; pid: number; start: string },
): boolean {
  return a.marker === b.marker || (a.pid === b.pid && a.start === b.start);
}

/** Never `process.kill(pid, 0)`: a reused pid has another start time. */
export function isLive(h: { pid: number; start: string }, table: ProcRow[]): boolean {
  return table.some((r) => r.pid === h.pid && r.start === h.start);
}

export function describeSession(h: { marker: string; pid: number }): string {
  return `Claude Code session ${h.marker} (pid ${h.pid})`;
}

/**
 * D-07: each `setup` command, in order, through the platform shell (`npm` is a `.cmd` shim on Windows).
 * The only shell site: `setup` is committed repository content, trusted as `tests.affected` is.
 * Output is shown only on failure; the first failing command stops the run.
 */
export function runSetup(
  commands: readonly string[],
  cwd: string,
): { failed?: { command: string; code: number | null; tail: string } } {
  for (const command of commands) {
    const r = spawnSync(command, { cwd, shell: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) {
      const text = (r.stderr.trim() !== '' ? r.stderr : r.stdout).trimEnd();
      return { failed: { command, code: r.status, tail: text.split('\n').slice(-20).join('\n') } };
    }
  }
  return {};
}
