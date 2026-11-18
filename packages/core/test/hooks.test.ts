import { describe, expect, it } from 'vitest';
import { hookEntries, mergeHooks } from '../src/index.js';

const e = hookEntries({ name: '@accord-dev/accord', version: '0.2.0' });
const foreign = { matcher: 'startup', hooks: [{ type: 'command', command: 'echo hi' }] };

describe('mergeHooks', () => {
  it('writes the entries into an empty settings object', () => {
    expect(mergeHooks({}, e)).toEqual({ hooks: e });
  });
  it('keeps other keys, other events, and a foreign entry ahead of ours', () => {
    const existing = { model: 'x', hooks: { SessionStart: [foreign], PostToolUse: [{ matcher: 'Bash', hooks: [] }] } };
    const out = mergeHooks(existing, e) as { model: string; hooks: Record<string, unknown[]> };
    expect(out.model).toBe('x');
    expect(out.hooks.PostToolUse).toEqual(existing.hooks.PostToolUse);
    expect(out.hooks.SessionStart).toEqual([foreign, ...e.SessionStart]);
  });
  it('is idempotent', () => {
    const once = mergeHooks({ hooks: { SessionStart: [foreign] } }, e);
    expect(mergeHooks(once, e)).toEqual(once);
  });
  it('replaces an older accord command, and strips it from a mixed entry', () => {
    const old = { type: 'command', command: 'npx --yes @accord-dev/accord@0.0.9 hook session-start' };
    const out = mergeHooks({ hooks: { SessionStart: [{ matcher: 'startup', hooks: [old, foreign.hooks[0]] }] } }, e) as {
      hooks: { SessionStart: unknown[] };
    };
    expect(out.hooks.SessionStart).toEqual([{ matcher: 'startup', hooks: foreign.hooks }, ...e.SessionStart]);
  });
  it('throws on a non-object or a non-object hooks', () => {
    expect(() => mergeHooks([], e)).toThrow(TypeError);
    expect(() => mergeHooks({ hooks: 3 }, e)).toThrow(TypeError);
  });
  it('throws on a non-array value under a hook event, never replacing it', () => {
    expect(() => mergeHooks({ hooks: { SessionStart: { matcher: 'startup' } } }, e)).toThrow(TypeError);
    expect(() => mergeHooks({ hooks: { SubagentStart: 'x' } }, e)).toThrow(TypeError);
  });
  it('commands carry no shell syntax', () => {
    for (const list of Object.values(e)) {
      for (const entry of list) {
        for (const h of entry.hooks) expect(h.command).toMatch(/^npx --yes [@a-z0-9/._-]+@[0-9A-Za-z.-]+ hook [a-z-]+$/);
      }
    }
  });
});

it('ac-1 the session line and the hook matcher name the new commands (ST-LN-83 7-ac-1)', () => {
  const entries = hookEntries({ name: '@accord-dev/accord', version: '0.2.0' });
  expect(entries.UserPromptExpansion.map((x) => x.matcher)).toEqual(['accord|accord-new|accord-continue|accord-pickup']);
  // letters, digits, hyphen and a bar make an exact-name list in Claude Code, so no other name can match by substring
  const names = entries.UserPromptExpansion[0].matcher.split('|');
  expect(names).toEqual(['accord', 'accord-new', 'accord-continue', 'accord-pickup']);
  for (const other of ['accord-queue', 'accord-upgrade']) expect(names).not.toContain(other);
});

it('risk:data-loss a re-sync replaces an older prompt expansion hook and keeps a foreign one', () => {
  const entries = hookEntries({ name: '@accord-dev/accord', version: '0.2.0' });
  const fresh = { matcher: 'accord|accord-new|accord-continue|accord-pickup', hooks: [{ type: 'command', command: 'npx --yes @accord-dev/accord@0.2.0 hook prompt-expansion' }] };
  expect(entries.UserPromptExpansion).toEqual([fresh]);
  const old = { hooks: { UserPromptExpansion: [{ matcher: 'accord', hooks: [{ type: 'command', command: 'npx --yes @accord-dev/accord@0.0.9 hook prompt-expansion' }, { type: 'command', command: 'echo hi' }] }] } };
  const once = mergeHooks(old, entries);
  expect((once.hooks as Record<string, unknown>).UserPromptExpansion).toEqual([{ matcher: 'accord', hooks: [{ type: 'command', command: 'echo hi' }] }, fresh]);
  expect(mergeHooks(once, entries)).toEqual(once);
});

it('risk:regression the pre tool use hook entry matches the agent tool and a re-sync replaces an older one', () => {
  const entries = hookEntries({ name: '@accord-dev/accord', version: '0.2.0' });
  const fresh = { matcher: 'Agent|Task', hooks: [{ type: 'command', command: 'npx --yes @accord-dev/accord@0.2.0 hook pre-tool-use' }] };
  expect(entries.PreToolUse[0]).toEqual(fresh);
  const foreignHook = { type: 'command', command: 'echo hi' };
  const old = { hooks: { PreToolUse: [{ matcher: 'Agent|Task', hooks: [{ type: 'command', command: 'npx --yes @accord-dev/accord@0.0.9 hook pre-tool-use' }, foreignHook] }] } };
  const once = mergeHooks(old, entries);
  expect((once.hooks as Record<string, unknown>).PreToolUse).toEqual([{ matcher: 'Agent|Task', hooks: [foreignHook] }, ...entries.PreToolUse]);
  expect(mergeHooks(once, entries)).toEqual(once);
});

it('risk:regression both session start hooks carry a 600 second timeout and a re-sync adds it', () => {
  const entries = hookEntries({ name: '@accord-dev/accord', version: '0.2.0' });
  expect(entries.SessionStart.map((x) => x.hooks[0].timeout)).toEqual([600, 600]);
  for (const event of ['SubagentStart', 'UserPromptExpansion', 'PreToolUse'] as const) {
    for (const x of entries[event]) for (const h of x.hooks) expect(h).not.toHaveProperty('timeout');
  }
  const old = { hooks: { SessionStart: [{ matcher: 'startup', hooks: [{ type: 'command', command: 'npx --yes @accord-dev/accord@0.0.9 hook session-start' }] }] } };
  expect((mergeHooks(old, entries).hooks as Record<string, unknown>).SessionStart).toEqual(entries.SessionStart);
});

it('ac-1 the hook settings carry the write entry beside the dispatch entry and merge idempotently (ST-LN-39 39-ac-1)', () => {
  const entries = hookEntries({ name: '@accord-dev/accord', version: '0.2.0' });
  const command = 'npx --yes @accord-dev/accord@0.2.0 hook pre-tool-use';
  expect(entries.PreToolUse.map((x) => x.matcher)).toEqual(['Agent|Task', 'Write|Edit|MultiEdit']);
  const write = entries.PreToolUse[1];
  // The probe saw the if field honoured, so each tool has its own hook that spawns only for the record path.
  expect(write.hooks).toEqual(
    ['Write', 'Edit', 'MultiEdit'].map((tool) => ({ type: 'command', command, if: tool + '(**/accord/tickets/*/verification.md)' })),
  );
  const foreignHook = { type: 'command', command: 'echo hi' };
  const settings = { hooks: { PreToolUse: [{ matcher: 'Write|Edit|MultiEdit', hooks: [foreignHook] }] } };
  const once = mergeHooks(settings, entries);
  expect((once.hooks as Record<string, unknown>).PreToolUse).toEqual([{ matcher: 'Write|Edit|MultiEdit', hooks: [foreignHook] }, ...entries.PreToolUse]);
  expect(mergeHooks(once, entries)).toEqual(once);
  expect(mergeHooks(mergeHooks({}, entries), entries)).toEqual({ hooks: entries });
});
