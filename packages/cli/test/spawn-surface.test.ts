// CLI-07 / PITFALLS section 12: the CLI may spawn `git` and `gh` by name with a literal argument
// array, and nothing else — never `npm`, never `npx`, never a Windows `.cmd` shim, never through a
// shell. This is written as a positive allowlist rather than a denylist, because a denylist can be
// defeated by a spelling it never anticipated, and the source files are enumerated from disk so a new
// CLI file is covered the moment it is added.
//
// The second case is the D-51 path invariant: no `\` may appear in printed output on any host. It runs
// against real runCli stdout, so it fails on Windows CI the moment a `path.join` replaces a
// `path.posix` join in a printed value.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cleanup, makeRepo, run } from './helpers/repo.js';

const srcDir = fileURLToPath(new URL('../src/', import.meta.url));
const ALLOWED = ['git', 'gh'];
const SPAWN = /\b(?:execFileSync|execFile|spawnSync|spawn)\s*\(/g;
const FIRST_ARG = /^\s*(['"])([^'"]*)\1\s*[,)]/;

/** Blank whole-line comments rather than delete them, so reported line numbers stay accurate. */
function stripCommentLines(text: string): string {
  return text
    .split('\n')
    .map((line) => (/^\s*(\/\/|\/\*|\*)/.test(line) ? '' : line))
    .join('\n');
}

/** The text between a call's parentheses, balanced. */
function callArgs(text: string, open: number): string {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return text.slice(open + 1, i);
  }
  return text.slice(open + 1);
}

interface Site {
  where: string; // 'load/fs.ts:22'
  args: string;
}

function spawnSites(): Site[] {
  const sites: Site[] = [];
  const files = readdirSync(srcDir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.ts'))
    .map((d) => join(d.parentPath, d.name));
  for (const file of files) {
    const text = stripCommentLines(readFileSync(file, 'utf8'));
    for (const m of text.matchAll(SPAWN)) {
      const at = m.index;
      const rel = relative(srcDir, file).split(sep).join('/');
      sites.push({
        where: `${rel}:${text.slice(0, at).split('\n').length}`,
        args: callArgs(text, at + m[0].length - 1),
      });
    }
  }
  return sites;
}

describe('spawn surface', () => {
  const sites = spawnSites();

  it('has spawn sites to check', () => {
    // A silently empty scan would make both assertions below vacuous.
    expect(sites.length).toBeGreaterThan(0);
  });

  it('spawns only git and gh, named as a string literal (T-05-01)', () => {
    const offenders = sites
      .filter((s) => {
        const m = FIRST_ARG.exec(s.args);
        return m === null || !ALLOWED.includes(m[2]);
      })
      .map((s) => `${s.where}: ${s.args.split('\n')[0].trim()}`);
    expect(offenders).toEqual([]);
  });

  it('passes no shell option to any spawn site', () => {
    const offenders = sites.filter((s) => /\bshell\s*:/.test(s.args)).map((s) => s.where);
    expect(offenders).toEqual([]);
  });
});

describe('printed paths', () => {
  // Every repository-reading command shipped so far. A single command would leave the next one free to
  // print a `path.join` result; this is the assertion that fails on Windows CI the moment one does.
  const COMMANDS: { name: string; argv: string[]; guard?: string }[] = [
    // Guard the guard: an output with no path in it would pass the backslash check for free.
    { name: 'lint', argv: ['lint'], guard: 'accord/tickets/' },
    { name: 'gate ready', argv: ['gate', 'ready', 'LOGIN-1'], guard: 'accord/tickets/' },
    { name: 'gate done', argv: ['gate', 'done', 'LOGIN-1'], guard: 'accord/tickets/' },
    { name: 'status', argv: ['status'], guard: 'LOGIN-1' },
    // The one command that writes: it prints the path it created, and — on the refusal branch, which
    // LOGIN-1 already in the fixture reaches — the path it declined to overwrite. Both are printed
    // paths, so both belong here.
    { name: 'new ticket', argv: ['new', 'ticket', 'TCK-1'], guard: 'accord/tickets/TCK-1.md' },
    { name: 'new ticket (refusal)', argv: ['new', 'ticket', 'LOGIN-1'], guard: 'accord/tickets/LOGIN-1.md' },
    // The second writing command. `valid-build` rosters `dev` and every runtime, so it prints a path
    // under both target directories; the guard is one of them.
    { name: 'skills sync', argv: ['skills', 'sync'], guard: '.claude/skills/accord-dev/SKILL.md' },
    // The third writing command, and the widest: it prints a line per scaffold path and a line per skill
    // copy, so it covers both path sources in one run. `valid-build` already holds accord/config.yml, so
    // this is the D-132 branch — every scaffold path skipped, every skill copy written.
    { name: 'init', argv: ['init'], guard: 'accord/config.yml' },
  ];

  for (const { name, argv, guard } of COMMANDS) {
    it(`accord ${name} prints no backslash on any host (D-51, PITFALLS section 12)`, async () => {
      const repo = makeRepo('valid-build');
      try {
        const { out, err } = await run(argv, repo);
        // Either stream: a refusal prints its path to stderr, and both streams are checked below.
        if (guard !== undefined) expect(out + err).toContain(guard);
        for (const [stream, text] of [
          ['stdout', out],
          ['stderr', err],
        ] as const) {
          // Report the offending line, not a bare boolean: this fails on a host the author does not have.
          const offender = text.split('\n').find((line) => line.includes('\\'));
          expect(offender, `accord ${name} ${stream}: ${offender}`).toBeUndefined();
        }
      } finally {
        cleanup(repo);
      }
    });
  }
});
