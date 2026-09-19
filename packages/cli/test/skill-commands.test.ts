// SKILL-08 / D-110: a rendered skill may not name an `accord` command the CLI does not register — in
// `SKILL.md` and in every bundled reference file alike, because a wrong command in `debug.md` sends an
// agent at a name that was renamed three phases ago just as surely as one in `SKILL.md`.
//
// The real command paths are read off `buildProgram()` — the same object `runCli` parses with
// (RESEARCH.md Pitfall 2, Option A). A literal list here is what the requirement forbids: a command
// added in a later phase would simply not be in it, and the scan would go on passing while it stopped
// proving anything. A flat regex over `.command('...')` literals in `run.ts` has the same defect from
// the other side — it recovers `ready` but not `gate ready`, so it cannot tell a real path from a leaf
// name detached from its parent.
import { skillTargets } from '@accord-dev/accord-core';
import type { AccordConfig, SkillFile } from '@accord-dev/accord-core';
import type { Command } from 'commander';
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { buildProgram } from '../src/run.js';

const config = (over: Partial<AccordConfig> = {}): AccordConfig => ({
  accord: '0.1.0',
  profile: 'build',
  tracker: { adapter: 'none' },
  design: { tokens: 'src/styles/tokens.css' },
  roles: ['ba', 'dev', 'designer'],
  runtimes: ['claude', 'codex'],
  ...over,
});

/**
 * Every full command path the CLI actually registers, `lint` and `gate ready` alike. A node that has
 * subcommands is a namespace and not a path of its own: `accord gate` on its own prints help and runs
 * nothing, so a skill naming it is naming something a reader cannot run.
 */
function commandPaths(node: Command, prefix = ''): string[] {
  const out: string[] = [];
  for (const child of node.commands) {
    const path = (prefix + ' ' + child.name()).trim();
    if (child.commands.length > 0) out.push(...commandPaths(child, path));
    else out.push(path);
  }
  return out.sort();
}

const REAL = commandPaths(
  buildProgram({ cwd: '.', stdout: new PassThrough(), stderr: new PassThrough() }, () => {}),
);

/**
 * Blank whole lines rather than delete them, so reported line numbers stay accurate
 * (`spawn-surface.test.ts:21-27`). Here it is fenced code blocks that are kept and prose that is
 * dropped, one line at a time.
 */
const FENCE = /^\s*```/;
const SPAN = /`([^`]+)`/g;
/**
 * A command mention is a run of lowercase words after `accord ` inside code formatting — an inline
 * span or a fenced block. Prose is deliberately not scanned: `shared/prototype.md` says "the header
 * accord ships", which is English and not a command, and every real invocation in every definition is
 * already inside backticks because that is how a command is written in Markdown.
 */
const MENTION = /\baccord((?:\s+[a-z][a-z-]*)+)/g;

interface Mention {
  where: string; // '.claude/skills/accord-dev/SKILL.md:16'
  command: string; // 'gate ready'
}

function mentions(files: SkillFile[]): Mention[] {
  const found: Mention[] = [];
  for (const { path, text } of files) {
    let fenced = false;
    text.split('\n').forEach((line, i) => {
      if (FENCE.test(line)) {
        fenced = !fenced;
        return;
      }
      const code = fenced ? [line] : [...line.matchAll(SPAN)].map((m) => m[1]);
      for (const chunk of code) {
        for (const m of chunk.matchAll(MENTION)) {
          // The trailing `<id>`, `--json`, or `--type story` is an argument, not part of the path, and
          // the word run above already stops at the first character that is not lowercase or a hyphen.
          found.push({ where: `${path}:${i + 1}`, command: m[1].trim().replace(/\s+/g, ' ') });
        }
      }
    });
  }
  return found;
}

describe('the commands a skill may name (SKILL-08, D-110)', () => {
  it('reads the real paths off the commander tree the CLI runs', () => {
    expect(REAL).toEqual(['gate done', 'gate ready', 'init', 'lint', 'new ticket', 'skills sync', 'status']);
  });

  it('treats a namespace with no action of its own as not a command', () => {
    for (const parent of ['gate', 'new', 'skills']) expect(REAL, parent).not.toContain(parent);
  });

  // Both rosters: the full one, and the one this repository's own accord/config.yml declares. A role
  // with no definition yet contributes nothing, so this is safe before every workflow is authored.
  for (const roles of [['ba', 'dev', 'designer'], ['ba', 'dev']] as AccordConfig['roles'][]) {
    const files = skillTargets(config({ roles }));
    const found = mentions(files);

    describe(`roles: [${roles.join(', ')}]`, () => {
      // Guard the guard, twice. An empty render output and a regex that matches nothing each pass the
      // assertion below for free, and D-110's widening to every bundled reference makes a silently
      // empty scan easier to introduce, not harder.
      it('has files to scan', () => {
        expect(files.length).toBeGreaterThan(0);
      });

      it('found at least one command mention', () => {
        expect(found.length).toBeGreaterThan(0);
      });

      it('names no command the CLI does not register', () => {
        const offenders = found
          .filter((m) => !REAL.includes(m.command))
          .map((m) => `${m.where}: accord ${m.command}`)
          .sort();
        expect(offenders).toEqual([]);
      });
    });
  }
});
