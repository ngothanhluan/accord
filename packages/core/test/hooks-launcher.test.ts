// Phase 08.9.2 D-01: accord's hooks run `node ${CLAUDE_PROJECT_DIR}/.claude/accord.mjs <version> hook <event>` in exec form,
// with no shell and no npx, and the launcher is a rendered, stamped target written for the claude runtime only.
import { describe, expect, it } from 'vitest';
import { hookEntries, hookText, isAccordHookCommand, markerHash, mergeHooksWithNotes, pluginTargets, runsAccordHook } from '../src/index.js';

const pkg = { name: '@accord-dev/accord', version: '9.9.9' };
const LAUNCHER = '${CLAUDE_PROJECT_DIR}/.claude/accord.mjs';

describe('the launcher form of the hooks', () => {
  // Phase 08.9.2 D-01 (Ruling-structural): no hook runs npx, every entry is exec form with the launcher and the pin.
  it('risk:security no accord hook command runs npx and every entry is exec form with the launcher and the pin (D-01)', () => {
    const e = hookEntries(pkg);
    const events: Record<string, string[]> = {
      SessionStart: ['session-start', 'session-resume'],
      SubagentStart: ['subagent-start'],
      UserPromptExpansion: ['prompt-expansion'],
      PreToolUse: ['pre-tool-use', 'pre-tool-use'],
    };
    let count = 0;
    for (const [event, subs] of Object.entries(events)) {
      const entries = e[event as keyof typeof e];
      expect(entries.map((x) => x.matcher).length).toBe(subs.length);
      entries.forEach((entry, i) => {
        for (const h of entry.hooks) {
          count++;
          expect(h.command).toBe('node');
          expect(h.args).toEqual([LAUNCHER, '9.9.9', 'hook', subs[i]]);
          expect([h.command, ...(h.args ?? [])].join(' ')).not.toContain('npx');
        }
      });
    }
    expect(count).toBe(8);
    expect(e.SessionStart.map((x) => x.hooks[0].timeout)).toEqual([600, 600]);
    const agent = e.PreToolUse.find((x) => x.matcher === 'Agent|Task');
    expect(agent?.hooks.length).toBe(1);
    expect(agent?.hooks[0]).not.toHaveProperty('if');
    const guard = e.PreToolUse.find((x) => x.matcher === 'Write|Edit|MultiEdit');
    expect(guard?.hooks.map((h) => h.if)).toEqual([
      'Write(**/accord/tickets/*/verification.md)',
      'Edit(**/accord/tickets/*/verification.md)',
      'MultiEdit(**/accord/tickets/*/verification.md)',
    ]);
  });

  // Phase 08.9.2 D-01: the launcher is rendered like the panel, stamped, with the package name filled in, for claude only.
  it('risk:regression the launcher renders as a stamped claude-only target with the package name filled in (D-01)', () => {
    const files = pluginTargets({ runtimes: ['claude'] }, pkg);
    const launcher = files.find((f) => f.path === '.claude/accord.mjs');
    expect(launcher).toBeDefined();
    const text = launcher?.text ?? '';
    expect(markerHash(text)).toMatch(/^fnv1a64:[0-9a-f]{16}$/);
    expect(text).toContain(pkg.name);
    expect(text).not.toContain('ACCORD_PACKAGE_NAME');
    expect(pluginTargets({ runtimes: ['codex'] }, pkg).some((f) => f.path === '.claude/accord.mjs')).toBe(false);
  });
});

const foreign = { matcher: 'startup', hooks: [{ type: 'command', command: 'echo hi' }] };

/** Today's shape: every hook of `hookEntries` as the `npx --yes <pkg>@<v> hook <event>` string, its timeout and `if` kept. */
function oldForm(v: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [event, groups] of Object.entries(hookEntries({ name: '@accord-dev/accord', version: v }))) {
    out[event] = groups.map((g) => ({
      matcher: g.matcher,
      hooks: g.hooks.map((h) => ({
        type: h.type,
        command: `npx --yes @accord-dev/accord@${v} hook ${h.args?.[3]}`,
        ...(h.timeout === undefined ? {} : { timeout: h.timeout }),
        ...(h.if === undefined ? {} : { if: h.if }),
      })),
    }));
  }
  return out;
}

describe("both hook forms are accord's own", () => {
  // Phase 08.9.2 D-01: a repository on the old npx hooks moves to the launcher form in one merge, a second merge changes nothing.
  it('risk:regression sync replaces old npx hooks with the launcher form once and a second merge changes nothing (D-01)', () => {
    const entries = hookEntries({ name: '@accord-dev/accord', version: '0.20.0' });
    const old = oldForm('0.19.0');
    const existing = { model: 'x', hooks: { ...old, SessionStart: [foreign, ...(old.SessionStart as unknown[])] } };
    const once = mergeHooksWithNotes(existing, entries);
    expect(once.notes).toEqual([]);
    expect(once.settings).toEqual({ model: 'x', hooks: { ...entries, SessionStart: [foreign, ...entries.SessionStart] } });
    expect(JSON.stringify(once.settings)).not.toContain('npx');
    const twice = mergeHooksWithNotes(once.settings, entries);
    expect(twice.notes).toEqual([]);
    expect(twice.settings).toEqual(once.settings);
  });

  // Phase 08.9.2 D-01: an owner's edit of the launcher hook is kept with one note and never doubled.
  it('risk:data-loss an owner-edited launcher hook is kept with one note and never doubled (D-01)', () => {
    const entries = hookEntries({ name: '@accord-dev/accord', version: '0.19.0' });
    const shell = { type: 'command', command: 'node ".claude/accord.mjs" 0.19.0 hook session-start' };
    const extended = { type: 'command', command: 'node', args: ['${CLAUDE_PROJECT_DIR}/.claude/accord.mjs', '0.19.0', 'hook', 'session-start', '--x'] };
    const existing = { hooks: { SessionStart: [{ matcher: 'startup', hooks: [shell] }, { matcher: 'startup', hooks: [extended] }] } };
    const { settings, notes } = mergeHooksWithNotes(existing, entries);
    expect(notes).toHaveLength(2);
    for (const n of notes) expect(n).toContain('session-start');
    const start = (settings.hooks as Record<string, { hooks: Record<string, unknown>[] }[]>).SessionStart;
    expect(start.slice(0, 2)).toEqual(existing.hooks.SessionStart);
    expect(start.slice(2)).toEqual(entries.SessionStart.slice(1)); // only the session-resume entry is added
    expect(mergeHooksWithNotes(settings, entries).settings).toEqual(settings);
  });

  // Phase 08.9.2 D-01: the words of command plus args are what sync and render health read.
  it('risk:parsing runsAccordHook reads the launcher form from the words of command and args (D-01)', () => {
    const exec = { command: 'node', args: ['${CLAUDE_PROJECT_DIR}/.claude/accord.mjs', '0.19.0', 'hook', 'pre-tool-use'] };
    expect(hookText(exec)).toBe('node ${CLAUDE_PROJECT_DIR}/.claude/accord.mjs 0.19.0 hook pre-tool-use');
    expect(runsAccordHook(hookText(exec))).toBe('pre-tool-use');
    const spaced = { command: 'node', args: ['C:/Users/A B/proj/.claude/accord.mjs', '0.19.0', 'hook', 'session-start'] };
    expect(hookText(spaced)).toBe('node "C:/Users/A B/proj/.claude/accord.mjs" 0.19.0 hook session-start');
    expect(runsAccordHook(hookText(spaced))).toBe('session-start');
    expect(runsAccordHook(hookText({ command: 'node "C:/Users/A B/proj/.claude/accord.mjs" 0.19.0 hook pre-tool-use' }))).toBe('pre-tool-use');
    expect(runsAccordHook(hookText({ command: 'node .claude/accord.mjs hook pre-tool-use' }))).toBe('pre-tool-use');
    expect(runsAccordHook(hookText({ command: 'node other.mjs 1.0.0 hook pre-tool-use' }))).toBeUndefined();
    const oldNpx = 'npx --yes @accord-dev/accord@0.19.0 hook session-start';
    const launcherText = 'node ${CLAUDE_PROJECT_DIR}/.claude/accord.mjs 0.19.0 hook session-start';
    expect(isAccordHookCommand(oldNpx)).toBe(true);
    expect(isAccordHookCommand(launcherText)).toBe(true);
    for (const other of [launcherText + ' --x', 'node .claude/accord.mjs 0.19.0 hook session-start', 'node ${CLAUDE_PROJECT_DIR}/.claude/accord.mjs hook session-start', 'echo hi']) {
      expect(isAccordHookCommand(other)).toBe(false);
    }
  });
});
