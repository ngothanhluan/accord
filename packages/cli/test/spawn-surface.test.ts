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
// `ps` and `powershell` read the process table for the hold (D-17); `taskkill` ends a timed-out team command's whole process tree on Windows (ST-LN-96).
// `/bin/sh` runs the POSIX guard of a team command (WR-04): a fixed script whose only argument is the numeric id of the command's process group, so no repository content reaches it.
const ALLOWED = ['git', 'gh', 'ps', 'powershell', 'taskkill', '/bin/sh'];
const SPAWN = /\b(?:execFileSync|execFile|spawnSync|spawn)\s*\(/g;
// Phase 08.8 D-14: the debug folder check runs `icacls.exe`, `whoami.exe` and (review CR-01, for the owner) `WindowsPowerShell\v1.0\powershell.exe` by their path under `%SystemRoot%\System32` and never by name (Git Bash puts coreutils `whoami` first on PATH). It is
// one call site in load/debug-folder.ts whose first argument is `system32(program)`, with an argument array and no shell; the test below pins exactly that shape.
const SYSTEM32_FILE = 'load/debug-folder.ts';
const SYSTEM32_FIRST_ARG = /^\s*system32\(\w+\)\s*,/;
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
});

it('risk:security only git gh ps powershell taskkill and /bin/sh are spawned by name and the setup and team-command sites use the shell', () => {
  const sites = spawnSites();
  const system32 = sites.filter((s) => s.where.startsWith(SYSTEM32_FILE + ':') && SYSTEM32_FIRST_ARG.test(s.args));
  const unnamed = sites.filter((s) => {
    if (system32.includes(s)) return false;
    const m = FIRST_ARG.exec(s.args);
    return m === null || !ALLOWED.includes(m[2]);
  });
  expect(unnamed.map((s) => s.where.split(':')[0])).toEqual(['load/proc.ts', 'load/team-run.ts']);
  for (const s of unnamed) expect(s.args).toContain('shell: true');
  // D-14: the System32 exception is one site, takes an argument array, and never a shell
  expect(system32).toHaveLength(1);
  expect(sites.filter((s) => s.where.startsWith(SYSTEM32_FILE + ':'))).toHaveLength(1);
  expect(system32[0].args).not.toMatch(/\bshell\s*:/);
  expect(sites.filter((s) => /\bshell\s*:/.test(s.args)).map((s) => s.where)).toEqual(unnamed.map((s) => s.where));
});

it('risk:git-config every git log and git show passes the flags that keep log.showSignature out of its output', () => {
  const sites: string[] = [];
  const offenders: string[] = [];
  for (const d of readdirSync(srcDir, { recursive: true, withFileTypes: true })) {
    if (!d.isFile() || !d.name.endsWith('.ts')) continue;
    const text = stripCommentLines(readFileSync(join(d.parentPath, d.name), 'utf8'));
    for (const m of text.matchAll(/['"](?:log|show)['"]/g)) {
      const where = `${relative(srcDir, join(d.parentPath, d.name)).split(sep).join('/')}:${text.slice(0, m.index).split('\n').length}`;
      sites.push(where);
      const flagged = text.slice(0, m.index).endsWith("'-c', 'log.showSignature=false', ") && text.startsWith(", '--no-show-signature',", m.index + m[0].length);
      if (!flagged) offenders.push(where);
    }
  }
  // A silently empty scan would make the assertion below vacuous.
  expect(sites.length).toBeGreaterThan(0);
  expect(offenders).toEqual([]);
});

// ST-LN-37 37-ac-3 (T-05-04): no accord command changes a GitHub setting. Every `gh` spawn passes an argument
// array, and none of them may hold a word that reads or writes the API, a ruleset or branch protection, or sets
// an HTTP method. The only `gh` call today is `gh auth token`.
const GH_WRITE_WORDS = ['api', 'ruleset', 'rulesets', 'protection', '--method', '-X', 'PUT', 'POST', 'PATCH', 'DELETE'];

/** The `gh` spawn argument lists of one file's text that hold a word from GH_WRITE_WORDS, as `line: args`. */
function ghWrites(text: string): string[] {
  const stripped = stripCommentLines(text);
  const found: string[] = [];
  for (const m of stripped.matchAll(SPAWN)) {
    const args = callArgs(stripped, m.index + m[0].length - 1);
    const first = FIRST_ARG.exec(args);
    if (first === null || first[2] !== 'gh') continue;
    const words = [...args.matchAll(/(['"])([^'"]*)\1/g)].map((w) => w[2]);
    if (words.some((w) => GH_WRITE_WORDS.includes(w))) found.push(`${stripped.slice(0, m.index).split('\n').length}: ${args}`);
  }
  return found;
}

it('risk:security no accord command writes a GitHub setting (ST-LN-37 37-ac-3)', () => {
  const files = readdirSync(srcDir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.ts'))
    .map((d) => join(d.parentPath, d.name));
  expect(files.length).toBeGreaterThan(0);
  const offenders = files.flatMap((f) => ghWrites(readFileSync(f, 'utf8')).map((o) => `${relative(srcDir, f).split(sep).join('/')}:${o}`));
  expect(offenders).toEqual([]);
  // Guard the guard: the scan reports a write spawn, so an empty answer above means something.
  const fixture = "execFileSync('gh', ['api', '-X', 'PUT', 'repos/o/r/branches/main/protection'])";
  expect(ghWrites(fixture)).toHaveLength(1);
  expect(ghWrites("execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' })")).toEqual([]);
  expect(ghWrites("execFileSync('git', ['api'])")).toEqual([]);
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
    // The second writing command. `valid-build` declares every runtime, so it prints a path under both
    // target directories; the guard is one of them.
    { name: 'skills sync', argv: ['skills', 'sync'], guard: '.claude/skills/accord/SKILL.md' },
    // The third writing command, and the widest: it prints a line per scaffold path and a line per skill
    // copy, so it covers both path sources in one run. `valid-build` already holds accord/config.yml, so
    // this is the D-132 branch — every scaffold path skipped, every skill copy written.
    { name: 'init', argv: ['init'], guard: 'accord/config.yml' },
    // The phase 1 commands. `valid-build` has no lane ticket, so most reach the no-lane refusal, which
    // names the ticket file. `next` and `anchor` print no path there and are left out: an unguarded entry
    // asserts nothing.
    { name: 'gate plan', argv: ['gate', 'plan', 'LOGIN-1'], guard: 'accord/tickets/LOGIN-1.md' },
    { name: 'approve (refusal)', argv: ['approve', 'LOGIN-1'], guard: 'accord/tickets/LOGIN-1.md' },
    { name: 'task-done (refusal)', argv: ['task-done', 'LOGIN-1', '1'], guard: 'accord/tickets/LOGIN-1.md' },
    { name: 'brief (refusal)', argv: ['brief', 'LOGIN-1', '1'], guard: 'accord/tickets/LOGIN-1.md' },
    { name: 'review-package (refusal)', argv: ['review-package', 'LOGIN-1'], guard: 'accord/tickets/LOGIN-1.md' },
    { name: 'tests baseline (refusal)', argv: ['tests', 'baseline'], guard: 'accord/config.yml' },
    { name: 'new ticket --lane', argv: ['new', 'ticket', 'TCK-2', '--lane', 'M', '--no-dup-check'], guard: 'accord/tickets/TCK-2.md' },
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
