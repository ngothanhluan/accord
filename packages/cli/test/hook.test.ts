// `accord hook <event>` end to end, in-process through runCli, on a lane repo.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { cleanup, commitAll, gitRun, makeLaneRepo, run } from './helpers/repo.js';
import { makeClone } from './helpers/worktree.js';

const SESSION_LINE = /accord: \d+ in progress, \d+ ready to pick up · type \/accord\n$/;

describe('accord hook', () => {
  it('session-start prints the ruleset then the session line', async () => {
    const repo = makeLaneRepo();
    try {
      const r = await run(['hook', 'session-start'], repo);
      expect(r.code).toBe(0);
      expect(r.out.startsWith('# accord rules\n')).toBe(true);
      expect(r.out).toMatch(SESSION_LINE);
      expect(r.out).not.toContain('{{');
      expect(r.out).toMatch(/Run accord as `npx --yes @accord-dev\/accord@[^`]+` when/);
    } finally {
      cleanup(repo);
    }
  });

  it('session-resume on t/<id> prints the ticket anchor', async () => {
    const repo = makeLaneRepo();
    try {
      commitAll(repo);
      gitRun(repo, 'checkout', '-b', 't/T-1');
      const r = await run(['hook', 'session-resume'], repo);
      expect(r.code).toBe(0);
      expect(r.out.startsWith('# accord rules\n')).toBe(true);
      expect(r.out).toContain('Owners can export their report as CSV.');
    } finally {
      cleanup(repo);
    }
  });

  it('session-resume on another branch ends with the session line', async () => {
    const repo = makeLaneRepo();
    try {
      commitAll(repo);
      const r = await run(['hook', 'session-resume'], repo);
      expect(r.code).toBe(0);
      expect(r.out).toMatch(SESSION_LINE);
    } finally {
      cleanup(repo);
    }
  });

  it('subagent-start prints the ruleset as additionalContext JSON', async () => {
    const repo = makeLaneRepo();
    try {
      const r = await run(['hook', 'subagent-start'], repo);
      expect(r.code).toBe(0);
      const out = JSON.parse(r.out) as { hookSpecificOutput: { hookEventName: string; additionalContext: string } };
      expect(out.hookSpecificOutput.hookEventName).toBe('SubagentStart');
      expect(out.hookSpecificOutput.additionalContext.startsWith('# accord rules')).toBe(true);
    } finally {
      cleanup(repo);
    }
  });

  it('an unknown event exits 2', async () => {
    const repo = makeLaneRepo();
    try {
      const r = await run(['hook', 'nope'], repo);
      expect(r.code).toBe(2);
      expect(r.err).toContain('unknown hook event nope');
    } finally {
      cleanup(repo);
    }
  });
});

const input = (o: Record<string, string>) => JSON.stringify({ session_id: 'sess-S', command_name: 'accord', ...o });

it('risk:security the prompt expansion hook blocks every accord text but the dashboard and continue of the worked ticket', async () => {
  const c = makeClone({ tickets: ['ST-9', 'ST-10'] });
  try {
    c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main');
    mkdirSync(`${c.sibling('ST-9')}/sub`);
    const hook = (o: Record<string, string>) => run(['hook', 'prompt-expansion'], c.root, {}, input(o));
    const wt = c.sibling('ST-9');
    for (const a of ['', '  ', 'continue ST-9']) {
      const r = await hook({ cwd: wt, command_args: a });
      expect(r.code).toBe(0);
      expect(JSON.parse(r.out)).toEqual({});
    }
    const blocked = async (o: Record<string, string>) => {
      const r = await hook(o);
      expect(r.code).toBe(0);
      expect(r.out.trimEnd().split('\n')).toHaveLength(1);
      const j = JSON.parse(r.out);
      expect(j.decision).toBe('block');
      expect(j.reason).toContain('this session works ST-9');
      expect(j.reason).toContain('open a new session in the main checkout');
      expect(j.reason).toContain('without "/accord"');
    };
    for (const a of ['continue ST-10', 'pick-up ST-10', 'pick-up ST-9', 'fix the typo in README', 'continue the refactor', 'explain ST-9']) {
      await blocked({ cwd: wt, command_args: a });
    }
    await blocked({ cwd: `${wt}/sub`, command_args: 'pick-up ST-10' });
    mkdirSync(`${c.root}/.git/accord`, { recursive: true });
    writeFileSync(`${c.root}/.git/accord/holds`, JSON.stringify({ 'ST-9': { tool: 'Claude Code', marker: 'sess-S', pid: 1, start: 'x', taken: 't' } }));
    await blocked({ cwd: c.root, command_args: 'pick-up ST-10' });
    const other = await hook({ session_id: 'other', cwd: c.root, command_args: 'pick-up ST-10' });
    expect(JSON.parse(other.out)).toEqual({});
  } finally {
    c.cleanupAll();
  }
});

it('risk:complex-branching the prompt expansion hook allows with one stderr line when its input holds or git cannot be read', async () => {
  const c = makeClone({ tickets: ['ST-9', 'ST-10'] });
  const plain = mkdtempSync(`${tmpdir()}/accord-nogit-`);
  try {
    const ok = async (root: string, stdin: string) => {
      const r = await run(['hook', 'prompt-expansion'], root, {}, stdin);
      expect(r.code).toBe(0);
      expect(JSON.parse(r.out)).toEqual({});
      expect(r.err.endsWith('\n')).toBe(true);
      expect(r.err.trim().split('\n')).toHaveLength(1);
      expect(r.err.trim()).not.toBe('');
      expect(r.err).not.toContain('\\');
    };
    await ok(c.root, 'not json');
    await ok(c.root, JSON.stringify({ command_name: 'accord' }));
    mkdirSync(`${c.root}/.git/accord`, { recursive: true });
    writeFileSync(`${c.root}/.git/accord/holds`, '[]');
    await ok(c.root, input({ cwd: c.root, command_args: 'pick-up ST-10' }));
    await ok(c.root, input({ cwd: plain.replace(/\//g, '\\'), command_args: 'pick-up ST-10' }));
    const pinned = makeClone();
    try {
      const cfg = `${pinned.root}/accord/config.yml`;
      writeFileSync(cfg, readFileSync(cfg, 'utf8').replace(/^accord: .*/m, 'accord: "0.0.9"'));
      pinned.git('commit', '-q', '-am', 'pin');
      await ok(pinned.root, input({ cwd: pinned.root, command_args: 'pick-up ST-10' }));
    } finally {
      pinned.cleanupAll();
    }
    const x = await run(['hook', 'prompt-expansion'], c.root, {}, input({ command_name: 'accord-x', command_args: 'pick-up ST-10' }));
    expect(JSON.parse(x.out)).toEqual({});
    expect(x.err).toBe('');
  } finally {
    c.cleanupAll();
    cleanup(plain);
  }
});
