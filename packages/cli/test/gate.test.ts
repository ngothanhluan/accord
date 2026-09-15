// CLI-05 `accord gate ready|done <id>` end to end, in-process through runCli with injected streams and
// an explicit cwd (STACK Decision 7). Two contracts are under test: the 0/1 verdict exit (STACK
// Decision 1) and the three outcomes of the one write accord performs — it happened, it was already
// there, it failed (D-96, D-97). Every case runs against its own mkdtemp sandbox, so a write test can
// never reach the fixture directory it was copied from.
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, commitAll, makeRepo, run } from './helpers/repo.js';

const CLEAN_HASH = 'fnv1a64:8613b1c0604c6a56';
const ticket = (repo: string, id: string): string => join(repo, 'accord', 'tickets', id + '.md');
const bytes = (file: string): string => readFileSync(file, 'latin1'); // byte-exact: no BOM or encoding fixups

/**
 * The Done fixtures record the placeholder sha `1234567`, which core's tests inject as a host fact. A
 * sandbox has a real HEAD instead, so the tick and the review are re-pointed at it — otherwise every
 * `gate done` here fails on gate.commit-missing or gate.tick-stale-commit and the pass verdict, which
 * is the branch that proves Done performs no write, is unreachable.
 */
function bindToHead(repo: string, id: string): void {
  const sha = commitAll(repo);
  for (const file of [ticket(repo, id), join(repo, 'accord', 'tickets', id, 'verification.md')]) {
    writeFileSync(file, readFileSync(file, 'utf8').replaceAll('1234567', sha));
  }
}

/**
 * Can a read-only mode actually stop a write on this host? Windows honours the read-only attribute, but
 * a container running as root on POSIX ignores the mode — there the failure case is untestable and must
 * be skipped rather than reported as a false failure. A capability probe, never a platform string.
 */
function readOnlyBlocksWrites(): boolean {
  const dir = mkdtempSync(join(tmpdir(), 'accord-ro-'));
  const probe = join(dir, 'probe.txt');
  try {
    writeFileSync(probe, 'a');
    chmodSync(probe, 0o444);
    writeFileSync(probe, 'b');
    return false;
  } catch {
    return true;
  } finally {
    chmodSync(probe, 0o666);
    rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
  }
}
const readOnlyWorks = readOnlyBlocksWrites();

describe('accord gate — verdict, printer, exit code', () => {
  let ready: string;
  let done: string;

  beforeAll(() => {
    ready = makeRepo('gate-ready');
    done = makeRepo('gate-done');
    bindToHead(done, 'PASS');
  });
  afterAll(() => {
    cleanup(ready);
    cleanup(done);
  });

  it('gate ready on a passing ticket exits 0 and writes the renderText body', async () => {
    const { code, out } = await run(['gate', 'ready', 'CLEAN'], ready);
    expect(code).toBe(0);
    expect(out).toContain('accord/tickets/CLEAN.md:20: warning lint.test-tag-missing');
    expect(out).toMatch(/^\d+ errors, \d+ warnings$/m);
  });

  it('gate ready on a failing ticket exits 1', async () => {
    const { code, out } = await run(['gate', 'ready', 'SCHEMA'], ready);
    expect(code).toBe(1);
    expect(out).toContain('error ');
  });

  it('gate done on a failing ticket exits 1', async () => {
    const { code, out } = await run(['gate', 'done', 'BLOCKED'], done);
    expect(code).toBe(1);
    expect(out).toContain('error ');
  });

  it('gate ready --json writes the GateResult verbatim with gate: ready (D-98)', async () => {
    const { code, out } = await run(['gate', 'ready', 'CLEAN', '--json'], ready);
    expect(code).toBe(0);
    const parsed = JSON.parse(out) as Record<string, unknown>;
    const allowed = ['gate', 'ticket', 'verdict', 'findings', 'acHash'];
    expect(Object.keys(parsed).filter((k) => !allowed.includes(k))).toEqual([]);
    expect(parsed.gate).toBe('ready');
    expect(out.endsWith('\n')).toBe(true);
  });

  it('gate done --json writes a document whose gate value is done', async () => {
    const { code, out } = await run(['gate', 'done', 'PASS', '--json'], done);
    expect(code).toBe(0);
    expect((JSON.parse(out) as Record<string, unknown>).gate).toBe('done');
  });

  it('gate ready on an id with no ticket file exits 1 and names the unknown ticket', async () => {
    const { code, out } = await run(['gate', 'ready', 'NOSUCH'], ready);
    expect(code).toBe(1);
    expect(out).toContain('error gate.ticket-unknown no ticket NOSUCH in the snapshot');
  });

  it('gate ready with no id exits 2 with commander’s missing-argument message', async () => {
    const { code, err } = await run(['gate', 'ready'], ready);
    expect(code).toBe(2);
    expect(err).toContain('missing required argument');
  });
});

describe('accord gate ready — the ac_hash write (D-96, D-97)', () => {
  it('a pass verdict writes the hash into the ticket and names it on stderr', async () => {
    const repo = makeRepo('gate-ready');
    try {
      const file = ticket(repo, 'CLEAN');
      const before = bytes(file);
      const { code, err } = await run(['gate', 'ready', 'CLEAN'], repo);
      expect(code).toBe(0);
      const after = bytes(file);
      expect(after).not.toBe(before);
      expect(after).toContain('ac_hash: "' + CLEAN_HASH + '"');
      // Removing the one added line must restore the file exactly, so a quoting or comment
      // round-trip regression in setFrontmatterKey is visible here and not only in core's own tests.
      expect(after.replace(/^ac_hash: .*\n/m, '')).toBe(before);
      expect(err).toContain(CLEAN_HASH);
      expect(err).toContain('accord/tickets/CLEAN.md');
    } finally {
      cleanup(repo);
    }
  });

  it('a second consecutive run leaves the bytes and the mtime untouched', async () => {
    const repo = makeRepo('gate-ready');
    try {
      const file = ticket(repo, 'CLEAN');
      await run(['gate', 'ready', 'CLEAN'], repo);
      const after = bytes(file);
      const mtime = statSync(file).mtimeMs;
      const { code, err } = await run(['gate', 'ready', 'CLEAN'], repo);
      expect(code).toBe(0);
      expect(bytes(file)).toBe(after);
      expect(statSync(file).mtimeMs).toBe(mtime);
      expect(err).toBe('');
    } finally {
      cleanup(repo);
    }
  });

  // Core normalises to LF and strips the BOM for a consumer with no filesystem. On the one write
  // accord makes to a human-owned document that would turn a one-key change into a whole-file diff,
  // so the CLI restores the file's own shape. These three pin that and the replaced-hash notice.
  it("restores the ticket's own CRLF endings, so the write stays a one-line diff", async () => {
    const repo = makeRepo('gate-ready');
    try {
      const file = ticket(repo, 'CLEAN');
      writeFileSync(file, readFileSync(file, 'utf8').replace(/\r?\n/g, '\r\n'));
      const before = bytes(file);
      const { code } = await run(['gate', 'ready', 'CLEAN'], repo);
      expect(code).toBe(0);
      const after = bytes(file);
      expect(after).toContain('ac_hash: "' + CLEAN_HASH + '"\r\n');
      expect(after).not.toMatch(/[^\r]\n/); // no bare LF survived anywhere
      expect(after.replace(/^ac_hash: .*\r\n/m, '')).toBe(before);
    } finally {
      cleanup(repo);
    }
  });

  it('keeps a BOM the author’s file carries', async () => {
    const repo = makeRepo('gate-ready');
    try {
      const file = ticket(repo, 'CLEAN');
      writeFileSync(file, '﻿' + readFileSync(file, 'utf8'));
      const { code } = await run(['gate', 'ready', 'CLEAN'], repo);
      expect(code).toBe(0);
      expect(readFileSync(file, 'utf8').startsWith('﻿')).toBe(true);
      expect(bytes(file)).toContain('ac_hash: "' + CLEAN_HASH + '"');
    } finally {
      cleanup(repo);
    }
  });

  it('names the replaced value when a differing ac_hash is already recorded', async () => {
    const repo = makeRepo('gate-ready');
    try {
      const file = ticket(repo, 'CLEAN');
      writeFileSync(file, readFileSync(file, 'utf8').replace(/^id: /m, 'ac_hash: "stale0000"\nid: '));
      const { code, err } = await run(['gate', 'ready', 'CLEAN'], repo);
      expect(code).toBe(0);
      expect(err).toContain('updated ac_hash stale0000 -> ' + CLEAN_HASH);
      expect(err).not.toContain('wrote ac_hash');
    } finally {
      cleanup(repo);
    }
  });

  it('a fail verdict leaves the ticket file untouched', async () => {
    const repo = makeRepo('gate-ready');
    try {
      const file = ticket(repo, 'SCHEMA');
      const before = bytes(file);
      const { code, err } = await run(['gate', 'ready', 'SCHEMA'], repo);
      expect(code).toBe(1);
      expect(bytes(file)).toBe(before);
      expect(err).toBe('');
    } finally {
      cleanup(repo);
    }
  });

  it('gate done leaves the ticket file untouched on a pass verdict', async () => {
    const repo = makeRepo('gate-done');
    try {
      bindToHead(repo, 'PASS');
      const file = ticket(repo, 'PASS');
      const before = bytes(file);
      const { code, err } = await run(['gate', 'done', 'PASS'], repo);
      expect(code).toBe(0);
      expect(bytes(file)).toBe(before);
      expect(err).toBe('');
    } finally {
      cleanup(repo);
    }
  });

  it('gate done leaves the ticket file untouched on a fail verdict', async () => {
    const repo = makeRepo('gate-done');
    try {
      const file = ticket(repo, 'BLOCKED');
      const before = bytes(file);
      const { code } = await run(['gate', 'done', 'BLOCKED'], repo);
      expect(code).toBe(1);
      expect(bytes(file)).toBe(before);
    } finally {
      cleanup(repo);
    }
  });

  it('a pass verdict whose acHash is undefined writes nothing', async () => {
    const repo = makeRepo('gate-done');
    try {
      const file = ticket(repo, 'EMPTY');
      const before = bytes(file);
      const { code, out, err } = await run(['gate', 'ready', 'EMPTY', '--json'], repo);
      expect(code).toBe(0);
      expect((JSON.parse(out) as Record<string, unknown>).acHash).toBeUndefined();
      expect(bytes(file)).toBe(before);
      expect(err).toBe('');
    } finally {
      cleanup(repo);
    }
  });

  it.skipIf(!readOnlyWorks)(
    'an unwritable ticket still reports the verdict on stdout, the failure on stderr, and exits 2',
    async () => {
      const repo = makeRepo('gate-ready');
      const file = ticket(repo, 'CLEAN');
      try {
        chmodSync(file, 0o444);
        const { code, out, err } = await run(['gate', 'ready', 'CLEAN', '--json'], repo);
        expect(code).toBe(2);
        const parsed = JSON.parse(out) as Record<string, unknown>;
        expect(parsed.verdict).toBe('pass');
        expect(parsed.acHash).toBe(CLEAN_HASH);
        expect(err).toContain('cannot write ac_hash');
        expect(err).toContain('accord/tickets/CLEAN.md');
      } finally {
        chmodSync(file, 0o666); // rmSync cannot remove a read-only file on Windows
        cleanup(repo);
      }
    },
  );
});
