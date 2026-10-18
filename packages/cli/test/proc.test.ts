import { expect, it } from 'vitest';
import { UsageError } from '../src/load/fs.js';
import { claudeEnv, isLive, processTable, sameSession, sessionIn } from '../src/load/proc.js';

it('risk:parsing the real process table holds this process and its parent with a stable start time', () => {
  const table = processTable();
  expect(table.length).toBeGreaterThan(1);
  const me = table.find((r) => r.pid === process.pid);
  expect(me?.ppid).toBe(process.ppid);
  expect(me?.start).not.toBe('');
  expect(table.some((r) => r.pid === process.ppid)).toBe(true);
  expect(processTable().find((r) => r.pid === process.pid)?.start).toBe(me?.start);
  const claude = claudeEnv(process.env);
  if (claude !== undefined) {
    const s = sessionIn(claude, table, process.pid);
    expect(s.pid).toBe(Number(process.env.CLAUDE_PID));
    expect(s.start).not.toBe('');
  }
});

it('risk:complex-branching a claude code session is its marker or its process and a partial table is refused', () => {
  const table = [
    { pid: 10, ppid: 20, start: 's10' },
    { pid: 20, ppid: 30, start: 's20' },
    { pid: 30, ppid: 1, start: 's30' },
  ];
  expect(claudeEnv({})).toBeUndefined();
  expect(() => claudeEnv({ CLAUDECODE: '1' })).toThrow(UsageError);
  expect(() => claudeEnv({ CLAUDECODE: '1' })).toThrow('CLAUDE_CODE_SESSION_ID');
  expect(() => claudeEnv({ CLAUDE_CODE_SESSION_ID: 'm', CLAUDE_PID: 'abc' })).toThrow('CLAUDE_PID');
  expect(claudeEnv({ CLAUDE_CODE_SESSION_ID: 'm', CLAUDE_PID: '30' })).toEqual({ marker: 'm', pid: 30 });

  expect(sessionIn({ marker: 'm', pid: 30 }, table, 10)).toEqual({
    tool: 'Claude Code', marker: 'm', pid: 30, start: 's30',
  });
  // a parent id with no row (Windows: an exited msys bash) is accepted when the claude row exists
  const gap = table.map((r) => (r.pid === 20 ? { ...r, ppid: 55 } : r));
  expect(sessionIn({ marker: 'm', pid: 30 }, gap, 10)).toEqual({ tool: 'Claude Code', marker: 'm', pid: 30, start: 's30' });
  const refused = (claude: { marker: string; pid: number }, tbl: typeof table, self: number): void => {
    expect(() => sessionIn(claude, tbl, self)).toThrow(UsageError);
    expect(() => sessionIn(claude, tbl, self)).toThrow('cannot see this Claude Code session');
  };
  const root = [...table.map((r) => (r.pid === 20 ? { ...r, ppid: 1 } : r)), { pid: 1, ppid: 0, start: 's1' }];
  refused({ marker: 'm', pid: 30 }, root, 10);
  refused({ marker: 'm', pid: 99 }, table, 10);
  refused({ marker: 'm', pid: 30 }, table.map((r) => (r.pid === 30 ? { ...r, start: '' } : r)), 10);
  refused({ marker: 'm', pid: 30 }, table, 77);
  refused({ marker: 'm', pid: 30 }, table.map((r) => (r.pid === 20 ? { ...r, ppid: 10 } : r)), 10);

  const a = { marker: 'm', pid: 30, start: 's30' };
  expect(sameSession(a, { marker: 'm', pid: 31, start: 'x' })).toBe(true);
  expect(sameSession(a, { marker: 'n', pid: 30, start: 's30' })).toBe(true);
  expect(sameSession(a, { marker: 'n', pid: 31, start: 'x' })).toBe(false);
  expect(sameSession(a, { marker: 'n', pid: 30, start: 'other' })).toBe(false);

  expect(isLive({ pid: 30, start: 's30' }, table)).toBe(true);
  expect(isLive({ pid: 30, start: 'old' }, table)).toBe(false);
});
