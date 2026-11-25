// Phase 08.9.2 D-01: `accord upgrade` and `accord init` move a repository to the launcher form. The old npx hooks are written literally here,
// because hookEntries now returns the new form; the setup lines follow upgrade.test.ts and init.test.ts, and nothing is imported from them.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { contentHash, initFiles, markerHash, withoutMarker } from '@accord-dev/accord-core';
import pkg from '../package.json' with { type: 'json' };
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { copyClone, makeTemplate } from './helpers/worktree.js';
import type { Clone } from './helpers/worktree.js';

const v = pkg.version;
const name = pkg.name;
const LAUNCHER = '.claude/accord.mjs';
const OLD = '0.0.9';

type Hook = { type: string; command: string; args?: string[]; timeout?: number; if?: string };
type Entry = { matcher?: string; hooks: Hook[] };
type Settings = { hooks: Record<string, Entry[]> };

/** The eight hooks accord 0.0.9 wrote, as the shell form they had before the launcher existed. */
const oldHooks = (): Settings => {
  const npx = (event: string): Hook => ({ type: 'command', command: `npx --yes ${name}@${OLD} hook ${event}` });
  return {
    hooks: {
      SessionStart: [
        { matcher: 'startup', hooks: [{ ...npx('session-start'), timeout: 600 }] },
        { matcher: 'resume|clear|compact', hooks: [{ ...npx('session-resume'), timeout: 600 }] },
      ],
      SubagentStart: [{ matcher: 'accord-.*', hooks: [npx('subagent-start')] }],
      UserPromptExpansion: [{ matcher: 'accord', hooks: [npx('prompt-expansion')] }],
      PreToolUse: [
        { matcher: 'Agent|Task', hooks: [npx('pre-tool-use')] },
        {
          matcher: 'Write|Edit|MultiEdit',
          hooks: ['Write', 'Edit', 'MultiEdit'].map((tool) => ({ ...npx('pre-tool-use'), if: `${tool}(**/accord/tickets/*/verification.md)` })),
        },
        // a hook the team wrote: it must survive the move untouched
        { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo foreign' }] },
      ],
    },
  };
};

const hooksOf = (s: Settings): Hook[] => Object.values(s.hooks).flatMap((es) => es.flatMap((e) => e.hooks));
const launched = (h: Hook): boolean => h.command === 'node' && h.args?.[0] === '${CLAUDE_PROJECT_DIR}/.claude/accord.mjs';
/** One accord hook per identity: event, matcher, subcommand and `if`. */
const identity = (event: string, e: Entry, h: Hook): string => [event, e.matcher ?? '', h.args?.[3] ?? '', h.if ?? ''].join('|');

let template: Clone;
let other: string;
const clones: Clone[] = [];
const dirs: string[] = [];
afterEach(() => {
  for (const c of clones.splice(0)) c.cleanupAll();
  for (const d of dirs.splice(0)) cleanup(d);
});

beforeAll(() => {
  template = makeTemplate();
  other = template.otherClone();
  gitRun(other, 'config', 'gc.auto', '0');
  const cfg = readFileSync(join(other, 'accord/config.yml'), 'utf8');
  writeFiles(other, {
    'accord/config.yml': cfg.replace(/^accord: .*$/m, `accord: "${OLD}"`),
    '.github/workflows/accord.yml': initFiles({ name, version: OLD }).find((f) => f.path === '.github/workflows/accord.yml')!.text,
    '.claude/settings.json': JSON.stringify(oldHooks(), null, 2) + '\n',
  });
  commitMsg(other, `pin ${OLD} with the npx hooks`);
  gitRun(other, 'push', '-q', 'origin', 'main');
}, 120_000);

afterAll(() => {
  template.cleanupAll();
});

// Phase 08.9.2 D-01 (T-08.9.2-10): upgrade moves old npx hooks to the exec form once, keeps a foreign hook, and adds the stamped launcher file.
it('risk:regression upgrade replaces the old npx hooks by the launcher form and adds the launcher file (D-01)', async () => {
  const c = copyClone(template, [other]);
  clones.push(c);
  const head = c.git('rev-parse', 'HEAD');
  const status = c.git('status', '--porcelain');

  const r = await run(['upgrade'], c.root);
  expect(r.code, r.err).toBe(0);
  expect(c.git('rev-parse', 'HEAD')).toBe(head);
  expect(c.git('status', '--porcelain')).toBe(status);
  expect(existsSync(join(c.root, '.claude'))).toBe(false);

  const p = c.otherClone();
  gitRun(p, 'switch', '-q', `upgrade/${v}`);
  const text = readFileSync(join(p, '.claude/settings.json'), 'utf8');
  const settings = JSON.parse(text) as Settings;
  expect(text).not.toContain('npx');

  const ours = hooksOf(settings).filter((h) => h.command !== 'echo foreign');
  expect(ours).toHaveLength(8);
  for (const h of ours) {
    expect(h.command).toBe('node');
    expect(h.args).toEqual(['${CLAUDE_PROJECT_DIR}/.claude/accord.mjs', v, 'hook', expect.stringMatching(/^[a-z-]+$/)]);
    expect(launched(h)).toBe(true);
  }
  // exactly one accord hook per identity, and the foreign hook is still there once
  const ids = Object.entries(settings.hooks).flatMap(([event, es]) => es.flatMap((e) => e.hooks.filter(launched).map((h) => identity(event, e, h))));
  expect(new Set(ids).size).toBe(ids.length);
  expect(hooksOf(settings).filter((h) => h.command === 'echo foreign')).toHaveLength(1);

  // a Windows checkout of the pushed branch may turn LF into CRLF; the hash covers the LF text the command wrote
  const launcher = readFileSync(join(p, LAUNCHER), 'utf8').replaceAll('\r\n', '\n');
  expect(launcher).toContain(name);
  expect(launcher).not.toContain('ACCORD_PACKAGE_NAME');
  expect(markerHash(launcher)).toBe(contentHash(withoutMarker(launcher)));
}, 120_000);

// Phase 08.9.2 D-01: a new repository starts on the launcher form, with no npx word anywhere in its settings.
it('risk:regression init writes the launcher and exec-form hooks (D-01)', async () => {
  const repo = makeEmptyRepo();
  dirs.push(repo);
  const r = await run(['init'], repo);
  expect(r.code, r.err).toBe(0);

  const launcher = readFileSync(join(repo, LAUNCHER), 'utf8');
  expect(launcher).toContain(name);
  expect(markerHash(launcher)).toBe(contentHash(withoutMarker(launcher)));

  const text = readFileSync(join(repo, '.claude/settings.json'), 'utf8');
  expect(text).not.toContain('npx');
  const hooks = hooksOf(JSON.parse(text) as Settings);
  expect(hooks).toHaveLength(8);
  for (const h of hooks) {
    expect(h.command).toBe('node');
    expect(h.args).toEqual(['${CLAUDE_PROJECT_DIR}/.claude/accord.mjs', v, 'hook', expect.stringMatching(/^[a-z-]+$/)]);
  }
});
