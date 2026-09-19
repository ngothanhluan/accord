// CLI-04 `accord new ticket <id>` end to end, in-process through runCli with injected streams and an
// explicit cwd (STACK Decision 7). Two contracts carry the weight: what the command writes (the active
// profile's template, the id in both places, `type:`, and nothing else — D-104), and what it refuses to
// write (an existing ticket, an id that has no business reaching the filesystem, a repository whose pin
// does not match — D-95). Every case runs in its own mkdtemp sandbox, so no test can reach the fixture
// directory it was copied from.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadSnapshot } from '@accord-dev/accord-core';
import { afterEach, describe, expect, it } from 'vitest';
import { loadFromFs } from '../src/load/fs.js';
import { cleanup, makeRepo, run } from './helpers/repo.js';

const ticket = (repo: string, id: string): string => join(repo, 'accord', 'tickets', id + '.md');
const bytes = (file: string): string => readFileSync(file, 'latin1'); // byte-exact, no encoding fixups
const listing = (repo: string): string[] => readdirSync(join(repo, 'accord', 'tickets')).sort();

// Every case makes its own repository; this collects them so a failing assertion still cleans up.
const repos: string[] = [];
function sandbox(fixture = 'valid-build'): string {
  const repo = makeRepo(fixture);
  repos.push(repo);
  return repo;
}
afterEach(() => {
  while (repos.length > 0) cleanup(repos.pop() as string);
});

/** Rewrite the sandbox copy's config.yml; the shared fixture is never touched. */
function setConfig(repo: string, find: RegExp, replace: string): void {
  const file = join(repo, 'accord', 'config.yml');
  writeFileSync(file, readFileSync(file, 'utf8').replace(find, replace));
}

describe('accord new ticket — what it writes', () => {
  it('writes accord/tickets/<id>.md, prints the path, and exits 0', async () => {
    const repo = sandbox();
    const { code, out } = await run(['new', 'ticket', 'TCK-1'], repo);
    expect(code).toBe(0);
    expect(out).toBe('accord/tickets/TCK-1.md\n');
    expect(existsSync(ticket(repo, 'TCK-1'))).toBe(true);
  });

  it('substitutes the id in the frontmatter and on the Feature line, leaving no placeholder', async () => {
    const repo = sandbox();
    await run(['new', 'ticket', 'TCK-1'], repo);
    const text = readFileSync(ticket(repo, 'TCK-1'), 'utf8');
    expect(text).toContain('id: "TCK-1"');
    expect(text).toContain('Feature: TCK-1');
    expect(text).not.toContain('TICKET-ID');
  });

  it('sets type and keeps the trailing guidance comment on that line', async () => {
    const repo = sandbox();
    await run(['new', 'ticket', 'TCK-1', '--type', 'bug'], repo);
    const line = readFileSync(ticket(repo, 'TCK-1'), 'utf8')
      .split('\n')
      .find((l) => l.startsWith('type:')) as string;
    expect(line).toContain('"bug"');
    expect(line).toContain('# epic | story | bug');
  });

  it('carries the @ac-1 tag scaffolding, taken from the template rather than generated', async () => {
    const repo = sandbox();
    await run(['new', 'ticket', 'TCK-1'], repo);
    expect(readFileSync(ticket(repo, 'TCK-1'), 'utf8')).toContain('@ac-1');
  });

  it('fills in nothing a human is supposed to author (D-104)', async () => {
    const repo = sandbox();
    await run(['new', 'ticket', 'TCK-1'], repo);
    const text = readFileSync(ticket(repo, 'TCK-1'), 'utf8');
    // The placeholder title and every BA prompt survive verbatim: only `id` and `type` moved.
    expect(text).toContain('title: "Short title in business language"');
    expect(text).toContain('Scenario: <observable outcome>');
    expect(text).toContain('## Requirements');
    expect(text).toContain('## Open questions');
  });

  // The two profile templates differ in exactly one place a test can name: the Intent note tells the BA
  // which design reference Ready will demand.
  for (const type of ['story', 'bug'] as const) {
    it(`--type ${type} renders the build template under profile build`, async () => {
      const repo = sandbox();
      await run(['new', 'ticket', 'TCK-1', '--type', type], repo);
      const text = readFileSync(ticket(repo, 'TCK-1'), 'utf8');
      expect(text).toContain('Ready then requires a design link in design:');
      expect(text).not.toContain('prototype.html derived from');
    });

    it(`--type ${type} renders the maintain template under profile maintain`, async () => {
      const repo = sandbox();
      setConfig(repo, /^profile: build$/m, 'profile: maintain');
      await run(['new', 'ticket', 'TCK-1', '--type', type], repo);
      const text = readFileSync(ticket(repo, 'TCK-1'), 'utf8');
      expect(text).toContain('prototype.html derived from');
      expect(text).not.toContain('Ready then requires a design link in design:');
    });
  }

  it('--type epic renders the epic template, which has no Acceptance criteria section', async () => {
    const repo = sandbox();
    const { code } = await run(['new', 'ticket', 'EP-1', '--type', 'epic'], repo);
    expect(code).toBe(0);
    const text = readFileSync(ticket(repo, 'EP-1'), 'utf8');
    expect(text).toContain('type: "epic"');
    expect(text).not.toContain('## Acceptance criteria');
    expect(text).not.toContain('## Plan');
  });

  // Worth more than all the others: a scaffold that does not parse wasted the BA's time, and only a
  // round-trip through the real loader proves it parses.
  it('the created ticket loads back through loadSnapshot with no schema finding against it', async () => {
    const repo = sandbox();
    await run(['new', 'ticket', 'TCK-1'], repo);
    const snapshot = loadSnapshot(loadFromFs(repo));
    expect(snapshot.tickets['TCK-1']?.frontmatter?.id).toBe('TCK-1');
    const against = snapshot.errors.filter((f) => f.file === 'accord/tickets/TCK-1.md');
    expect(against).toEqual([]);
  });
});

describe('accord new ticket — what it refuses', () => {
  it('refuses an existing ticket with exit 2, names the path, and leaves the bytes identical', async () => {
    const repo = sandbox();
    const before = bytes(ticket(repo, 'LOGIN-1'));
    const { code, err, out } = await run(['new', 'ticket', 'LOGIN-1'], repo);
    expect(code).toBe(2);
    expect(err).toContain('accord/tickets/LOGIN-1.md already exists');
    expect(err).not.toContain('\\');
    expect(out).toBe('');
    expect(bytes(ticket(repo, 'LOGIN-1'))).toBe(before);
  });

  // T-05-14: each of these would reach a path the BA never asked for if the guard were missing. The
  // directory listing is asserted unchanged, because an exit code alone does not prove nothing was
  // written.
  for (const [name, id] of [
    ['a slash', '../escaped'],
    ['a backslash', '..\\escaped'],
    ['a leading dot', '.hidden'],
    ['a space', 'TCK 1'],
    ['nothing at all', ''],
  ] as const) {
    it(`refuses an id containing ${name} with exit 2 and writes no file`, async () => {
      const repo = sandbox();
      const before = listing(repo);
      const { code, err } = await run(['new', 'ticket', id], repo);
      expect(code).toBe(2);
      expect(err).toContain('not a valid ticket id');
      expect(listing(repo)).toEqual(before);
    });
  }

  it('refuses an unknown --type value with exit 2 and writes no file', async () => {
    const repo = sandbox();
    const before = listing(repo);
    const { code } = await run(['new', 'ticket', 'TCK-1', '--type', 'spike'], repo);
    expect(code).toBe(2);
    expect(listing(repo)).toEqual(before);
  });

  // D-95: the pin stops this command before any path is constructed. `new ticket` is not exempt,
  // because the ticket template changes between versions.
  it('a mismatched pin stops it with exit 2 and writes no file (D-95)', async () => {
    const repo = sandbox();
    setConfig(repo, /^accord: "0\.1\.0"$/m, 'accord: "9.9.9"');
    const { code, err } = await run(['new', 'ticket', 'TCK-1'], repo);
    expect(code).toBe(2);
    expect(err).toContain('config.yml pins accord 9.9.9');
    expect(existsSync(ticket(repo, 'TCK-1'))).toBe(false);
  });
});
