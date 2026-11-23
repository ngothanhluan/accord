import { describe, expect, it } from 'vitest';
import { hookEntries, mergeHooks, mergeHooksWithNotes, runsAccordHook } from '../src/index.js';

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

it('risk:regression the session line and the hook matcher name the new commands (ST-LN-83 7-ac-1)', () => {
  const entries = hookEntries({ name: '@accord-dev/accord', version: '0.2.0' });
  expect(entries.UserPromptExpansion.map((x) => x.matcher)).toEqual(['accord']);
  // letters, digits, hyphen and a bar make an exact-name list in Claude Code, so no other name can match by substring
  const names = entries.UserPromptExpansion[0].matcher.split('|');
  expect(names).toEqual(['accord']);
  for (const other of ['accord-new', 'accord-continue', 'accord-pickup', 'accord-queue', 'accord-upgrade']) expect(names).not.toContain(other);
});

it('risk:data-loss a re-sync replaces an older prompt expansion hook and keeps a foreign one', () => {
  const entries = hookEntries({ name: '@accord-dev/accord', version: '0.2.0' });
  const fresh = { matcher: 'accord', hooks: [{ type: 'command', command: 'npx --yes @accord-dev/accord@0.2.0 hook prompt-expansion' }] };
  expect(entries.UserPromptExpansion).toEqual([fresh]);
  const old = { hooks: { UserPromptExpansion: [{ matcher: 'accord', hooks: [{ type: 'command', command: 'npx --yes @accord-dev/accord@0.0.9 hook prompt-expansion' }, { type: 'command', command: 'echo hi' }] }] } };
  const once = mergeHooks(old, entries);
  expect((once.hooks as Record<string, unknown>).UserPromptExpansion).toEqual([{ matcher: 'accord', hooks: [{ type: 'command', command: 'echo hi' }] }, fresh]);
  expect(mergeHooks(once, entries)).toEqual(once);
});

it('risk:data-loss a sync replaces the 0.10.0 prompt expansion matcher and keeps no second prompt expansion hook (D-03)', () => {
  const entries = hookEntries({ name: '@accord-dev/accord', version: '0.11.0' });
  const foreign = { type: 'command', command: 'echo hi' };
  const old = {
    hooks: {
      UserPromptExpansion: [
        { matcher: 'accord|accord-new|accord-continue|accord-pickup', hooks: [{ type: 'command', command: 'npx --yes @accord-dev/accord@0.10.0 hook prompt-expansion' }, foreign] },
      ],
    },
  };
  const once = mergeHooks(old, entries);
  const list = (once.hooks as Record<string, { matcher: string; hooks: { command: string }[] }[]>).UserPromptExpansion;
  // the owner's own hook keeps its entry; the one accord wrote leaves it, and the new entry carries the new matcher
  expect(list).toEqual([{ matcher: 'accord|accord-new|accord-continue|accord-pickup', hooks: [foreign] }, ...entries.UserPromptExpansion]);
  expect(entries.UserPromptExpansion.map((x) => x.matcher)).toEqual(['accord']);
  const ours = list.flatMap((x) => x.hooks.map((h) => h.command)).filter((c) => c.endsWith('hook prompt-expansion'));
  expect(ours).toEqual(['npx --yes @accord-dev/accord@0.11.0 hook prompt-expansion']);
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

it('risk:data-loss the hook settings carry the write entry beside the dispatch entry and merge idempotently (ST-LN-39 39-ac-1)', () => {
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

// D-16: a hook the owner edited into another form of `accord hook <event>` is kept, named once and never doubled.
type Listed = { matcher: string; hooks: { command: string; if?: string }[] };
const identities = (settings: Record<string, unknown>): Record<string, number> => {
  const count: Record<string, number> = {};
  for (const [event, list] of Object.entries(settings.hooks as Record<string, Listed[]>)) {
    for (const entry of list) {
      for (const h of entry.hooks) {
        const sub = runsAccordHook(h.command);
        if (sub === undefined) continue;
        const id = event + '|' + sub + '|' + (h.if ?? '');
        count[id] = (count[id] ?? 0) + 1;
      }
    }
  }
  return count;
};

it('risk:data-loss mergeHooks keeps an accord hook the owner edited and adds no second one (8-ac-10)', () => {
  const forms: [string, string, string, string][] = [
    ['SessionStart', 'startup', 'session-start', 'accord hook session-start'],
    ['SessionStart', 'startup', 'session-start', 'node ./packages/cli/dist/cli.js hook session-start'],
    ['SessionStart', 'startup', 'session-start', 'npx --yes @accord-dev/accord@0.7.1 hook session-start --verbose'],
    ['PreToolUse', 'Agent|Task', 'pre-tool-use', 'npx @accord-dev/accord hook pre-tool-use'],
  ];
  const expected = identities({ hooks: e });
  for (const [event, matcher, sub, command] of forms) {
    const owner = { matcher, hooks: [{ type: 'command', command }] };
    const merged = mergeHooksWithNotes({ hooks: { [event]: [owner] } }, e);
    const count = identities(merged.settings);
    // exactly one hook per event, subcommand and `if`, the same set accord writes into an empty file
    expect(count, command).toEqual(expected);
    const list = (merged.settings.hooks as Record<string, Listed[]>)[event];
    expect(list[0], command).toEqual(owner);
    expect(list.flatMap((x) => x.hooks).filter((h) => h.command === command)).toHaveLength(1);
    expect(merged.notes, command).toEqual([
      `kept ${event} hook "${command}": it runs accord hook ${sub} in a form sync did not write, so sync left it; edit or remove it to get accord's`,
    ]);
    // every other event gets accord's hooks
    for (const other of Object.keys(e)) if (other !== event) expect(merged.settings.hooks).toHaveProperty(other, (e as Record<string, unknown>)[other]);
    // merging twice gives the same settings and the same note
    const again = mergeHooksWithNotes(merged.settings, e);
    expect(again.settings, command).toEqual(merged.settings);
    expect(again.notes, command).toEqual(merged.notes);
  }
});

it('risk:data-loss an accord hook in the shape sync wrote is replaced with no note, and a foreign hook is never taken for one (8-ac-10)', () => {
  const old = { type: 'command', command: 'npx --yes @accord-dev/accord@0.0.9 hook session-start' };
  const out = mergeHooksWithNotes({ hooks: { SessionStart: [{ matcher: 'startup', hooks: [old, foreign.hooks[0]] }] } }, e);
  expect(out.notes).toEqual([]);
  expect((out.settings.hooks as Record<string, unknown>).SessionStart).toEqual([{ matcher: 'startup', hooks: foreign.hooks }, ...e.SessionStart]);
  for (const c of ['echo hook session-start', 'accord status', 'node build.js hook session-start', 'accord hook unknown-event', 'accord hook']) expect(runsAccordHook(c), c).toBeUndefined();
  expect(runsAccordHook('accord hook pre-tool-use')).toBe('pre-tool-use');
  expect(runsAccordHook('"C:/tools/accord.cmd" hook session-resume --x')).toBe('session-resume');
});

// Phase 08.8 D-10: a program path in quotes may hold a space; the tokens are read the way a shell reads them.
it('risk:regression runsAccordHook reads a quoted program path that holds a space (D-10)', () => {
  expect(runsAccordHook('node "C:\\Users\\A B\\cli.js" hook session-start')).toBe('session-start');
  expect(runsAccordHook('"C:\\Program Files\\nodejs\\node.exe" "C:\\Users\\A B\\cli.js" hook subagent-start')).toBe('subagent-start');
  expect(runsAccordHook("node '/home/a b/cli.js' hook pre-tool-use")).toBe('pre-tool-use');
  expect(runsAccordHook('node "C:\\x\\other.js" hook session-start')).toBeUndefined();
  expect(runsAccordHook('node "C:\\Users\\A B\\cli.js" hook unknown-event')).toBeUndefined();
});
