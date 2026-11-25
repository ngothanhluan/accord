// Phase 08.9.2 D-01: accord's hooks run `node ${CLAUDE_PROJECT_DIR}/.claude/accord.mjs <version> hook <event>` in exec form,
// with no shell and no npx, and the launcher is a rendered, stamped target written for the claude runtime only.
import { describe, expect, it } from 'vitest';
import { hookEntries, markerHash, pluginTargets } from '../src/index.js';

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
