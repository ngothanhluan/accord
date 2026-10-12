// `accord hook <event>` end to end, in-process through runCli, on a lane repo.
import { describe, expect, it } from 'vitest';
import { cleanup, commitAll, gitRun, makeLaneRepo, run } from './helpers/repo.js';

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
