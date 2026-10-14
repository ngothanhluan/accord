// CLI-04 `accord new ticket <id>` end to end, in-process through runCli with injected streams and an
// explicit cwd (STACK Decision 7). Two contracts carry the weight: what the command writes (the active
// profile's template, the id in both places, `type:`, and nothing else — D-104), and what it refuses to
// write (an existing ticket, an id that has no business reaching the filesystem, a repository whose pin
// does not match — D-95). Every case runs in its own mkdtemp sandbox, so no test can reach the fixture
// directory it was copied from.
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadSnapshot } from '@accord-dev/accord-core';
import { afterEach, describe, expect, it } from 'vitest';
import { loadFromFs } from '../src/load/fs.js';
import { cleanup, commitAll, gitRun, makeEmptyRepo, makeRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';

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
    // Matched on the key, not the version it currently holds: anchored on a literal, the next bump
    // makes this rewrite nothing, the pin then agrees, and the case fails on an exit code rather
    // than on the rule it tests. Which version it mismatches against is irrelevant.
    setConfig(repo, /^accord: .*$/m, 'accord: "9.9.9"');
    const { code, err } = await run(['new', 'ticket', 'TCK-1'], repo);
    expect(code).toBe(2);
    expect(err).toContain('config.yml pins accord 9.9.9');
    expect(existsSync(ticket(repo, 'TCK-1'))).toBe(false);
  });
});

/** Append the `people` table to the sandbox config.yml. */
function addPeople(repo: string): void {
  const file = join(repo, 'accord', 'config.yml');
  const text = readFileSync(file, 'utf8');
  writeFileSync(file, text + (text.endsWith('\n') ? '' : '\n') + 'people:\n  "an@example.com": AN\n');
}

it('ac-1 new ticket assigns the creators next number for its type', async () => {
  const repo = sandbox();
  addPeople(repo);
  writeFiles(repo, {
    'accord/tickets/ST-AN-1.md': laneTicket('ST-AN-1'),
    'accord/tickets/ST-LN-9.md': laneTicket('ST-LN-9'),
  });
  commitAll(repo);
  gitRun(repo, 'update-ref', 'refs/remotes/origin/t/ST-AN-3', 'HEAD');
  gitRun(repo, 'remote', 'add', 'origin', 'https://unreachable.invalid/accord.git');
  gitRun(repo, 'config', 'user.email', 'an@example.com');
  const { code, out } = await run(['new', 'ticket', '--type', 'story'], repo);
  expect(code).toBe(0);
  expect(out).toBe('accord/tickets/ST-AN-4.md\n');
  const text = readFileSync(ticket(repo, 'ST-AN-4'), 'utf8');
  expect(text).toContain('id: "ST-AN-4"');
  expect(text.split('\n').find((l) => l.startsWith('type:'))).toContain('"story"');
  expect(existsSync(ticket(repo, 'ST-AN-2'))).toBe(false);
});

it('risk:complex-branching without people and without an id new ticket exits 2 and writes nothing', async () => {
  const repo = sandbox();
  const before = listing(repo);
  const { code, err } = await run(['new', 'ticket'], repo);
  expect(code).toBe(2);
  expect(err).toContain('a ticket id is required');
  expect(listing(repo)).toEqual(before);
});

it('risk:complex-branching the first ticket in a repository with no commit gets number 1', async () => {
  const repo = makeEmptyRepo();
  repos.push(repo);
  writeFiles(repo, { 'accord/config.yml': CONFIG + 'people:\n  "an@example.com": AN\n' });
  gitRun(repo, 'config', 'user.email', 'an@example.com');
  const { code, out } = await run(['new', 'ticket', '--type', 'story'], repo);
  expect(code).toBe(0);
  expect(out).toBe('accord/tickets/ST-AN-1.md\n');
  expect(existsSync(ticket(repo, 'ST-AN-1'))).toBe(true);
});

it('risk:complex-branching a ticket added and deleted on a merged and deleted branch keeps its number', async () => {
  const repo = sandbox();
  addPeople(repo);
  gitRun(repo, 'config', 'user.email', 'an@example.com');
  commitAll(repo);
  const main = gitRun(repo, 'branch', '--show-current').trim();
  gitRun(repo, 'checkout', '-q', '-b', 'side');
  writeFiles(repo, { 'accord/tickets/ST-AN-2.md': laneTicket('ST-AN-2') });
  commitAll(repo);
  rmSync(ticket(repo, 'ST-AN-2'));
  commitAll(repo);
  gitRun(repo, 'checkout', '-q', main);
  gitRun(repo, '-c', 'user.email=fixture@example.invalid', '-c', 'user.name=fixture', '-c', 'commit.gpgsign=false', 'merge', '-q', '--no-ff', '--no-edit', '--no-verify', 'side');
  gitRun(repo, 'branch', '-D', 'side');
  const { code, out } = await run(['new', 'ticket', '--type', 'story'], repo);
  expect(code).toBe(0);
  expect(out).toBe('accord/tickets/ST-AN-3.md\n');
});

function addPeopleRaw(repo: string, entry: string): void {
  const file = join(repo, 'accord', 'config.yml');
  const text = readFileSync(file, 'utf8');
  writeFileSync(file, text + (text.endsWith('\n') ? '' : '\n') + 'people:\n  ' + entry + '\n');
}

it('ac-2 new ticket refuses an unregistered email and a hand-typed id', async () => {
  const repo = sandbox();
  addPeople(repo);
  const before = listing(repo);
  gitRun(repo, 'config', 'user.email', 'bo@example.com');
  const first = await run(['new', 'ticket', '--type', 'bug'], repo);
  expect(first.code).toBe(2);
  expect(first.err).toContain('bo@example.com');
  expect(first.err).toContain('people');
  expect(first.err).toContain('accord/config.yml');
  expect(listing(repo)).toEqual(before);
  gitRun(repo, 'config', 'user.email', 'an@example.com');
  const second = await run(['new', 'ticket', 'ST-AN-9'], repo);
  expect(second.code).toBe(2);
  expect(second.err).toContain('ST-AN-9');
  expect(second.err).toContain('accord assigns ids');
  expect(existsSync(ticket(repo, 'ST-AN-9'))).toBe(false);
});

it('risk:complex-branching an invalid config.yml stops new ticket naming the schema finding', async () => {
  const repo = sandbox();
  addPeopleRaw(repo, '"an@example.com": an');
  const before = listing(repo);
  const a = await run(['new', 'ticket', 'TCK-1'], repo);
  expect(a.code).toBe(2);
  expect(a.err).toContain('accord/config.yml');
  expect(a.err).toContain('/people');
  expect(existsSync(ticket(repo, 'TCK-1'))).toBe(false);
  const b = await run(['new', 'ticket', '--type', 'story'], repo);
  expect(b.code).toBe(2);
  expect(b.err).toContain('/people');
  expect(b.err).not.toContain('a ticket id is required');
  expect(listing(repo)).toEqual(before);
  const other = sandbox();
  setConfig(other, /^profile: build$/m, 'profile: other');
  const c = await run(['new', 'ticket', 'TCK-1'], other);
  expect(c.code).toBe(0);
  expect(existsSync(ticket(other, 'TCK-1'))).toBe(true);
});

it('risk:parsing new ticket reads people on every ref and refuses initials another email holds', async () => {
  const repo = sandbox();
  addPeopleRaw(repo, '"bo@example.com": AN');
  commitAll(repo);
  gitRun(repo, 'update-ref', 'refs/remotes/origin/feature', 'HEAD');
  const file = join(repo, 'accord', 'config.yml');
  writeFileSync(file, readFileSync(file, 'utf8').replace('bo@example.com', 'an@example.com'));
  commitAll(repo);
  gitRun(repo, 'config', 'user.email', 'an@example.com');
  const before = listing(repo);
  const { code, err } = await run(['new', 'ticket'], repo);
  expect(code).toBe(2);
  expect(err).toContain('AN');
  expect(err).toContain('bo@example.com');
  expect(listing(repo)).toEqual(before);
});
