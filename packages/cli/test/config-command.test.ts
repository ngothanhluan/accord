// ST-LN-50 D-11 (t2-ac-9, command half): `accord config get|set|unset|check` on real files. Every case runs in its
// own sandbox repository through runCli; a refusal must leave accord/config.yml byte-identical.
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { commitAll, gitRun, makeEmptyRepo, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, pinned } from '../../../test/helpers/lane.js';

const repos: string[] = [];
afterEach(() => {
  // no retries: nothing here holds a handle on the folder, and one that did would be a bug to see
  while (repos.length > 0) rmSync(repos.pop() as string, { recursive: true, force: true });
});

function sandbox(config: string = CONFIG): string {
  const repo = makeEmptyRepo();
  repos.push(repo);
  writeFiles(repo, { 'accord/config.yml': config });
  return repo;
}
const file = (repo: string): string => join(repo, 'accord', 'config.yml');
const text = (repo: string): string => readFileSync(file(repo), 'utf8');

it('risk:complex-branching accord config sets a value deterministically and refuses an invalid one (ST-LN-50 t2-ac-9)', async () => {
  const repo = sandbox();
  const first = await run(['config', 'set', 'git.merge', 'rebase'], repo);
  expect(first.code).toBe(0);
  expect(first.out).toBe('changed: git.merge unset -> rebase\n');
  expect(text(repo)).toBe(CONFIG + 'git:\n  merge: rebase\n');
  expect((await run(['lint'], repo)).code).toBe(0);

  // the same set again: the same bytes, reported as unchanged
  const bytes = text(repo);
  const second = await run(['config', 'set', 'git.merge', 'rebase'], repo);
  expect(second.code).toBe(0);
  expect(second.out).toBe('unchanged: git.merge\n');
  expect(text(repo)).toBe(bytes);

  // a value the schema refuses, and a key it does not have: exit 2, the reason, the file untouched
  const fast = await run(['config', 'set', 'git.merge', 'fast'], repo);
  expect(fast.code).toBe(2);
  expect(fast.err).toContain('git.merge');
  expect(fast.err).toContain('must be equal to one of the allowed values');
  expect(fast.err).toContain('accord/config.yml was not changed');
  expect(text(repo)).toBe(bytes);
  const none = await run(['config', 'set', 'nosuch.key', 'x'], repo);
  expect(none.code).toBe(2);
  expect(none.err).toContain('no config key nosuch.key');
  expect(none.err).toContain('config.schema.json');
  expect(text(repo)).toBe(bytes);
  // a whole-file refusal: a value that leaves some other part invalid still writes nothing
  const bad = await run(['config', 'set', 'roles', '[dev]'], repo);
  expect(bad.code).toBe(2);
  expect(bad.err).toContain('roles');
  expect(text(repo)).toBe(bytes);
  const broken = await run(['config', 'set', 'legacy_ids', '[A-1, B-2'], repo);
  expect(broken.code).toBe(2);
  expect(text(repo)).toBe(bytes);

  // get
  const got = await run(['config', 'get', 'git.merge'], repo);
  expect(got.code).toBe(0);
  expect(got.out).toBe('rebase\n');
  expect((await run(['config', 'get', 'git.sync'], repo)).out).toBe('unset\n');
  expect((await run(['config', 'get', 'roles'], repo)).out).toBe('[ba, dev]\n');
  expect((await run(['config', 'get', 'git.merge', '--json'], repo)).out).toBe('{\n  "key": "git.merge",\n  "value": "rebase"\n}\n');
  expect(JSON.parse((await run(['config', 'get', 'git.sync', '--json'], repo)).out)).toEqual({ key: 'git.sync', value: null });
  expect((await run(['config', 'get', 'nosuch.key'], repo)).code).toBe(2);

  // a list as a YAML flow collection
  const list = await run(['config', 'set', 'legacy_ids', '[A-1, B-2]'], repo);
  expect(list.code).toBe(0);
  expect(list.out).toBe('changed: legacy_ids unset -> [A-1, B-2]\n');
  expect(text(repo)).toBe(bytes + 'legacy_ids: [A-1, B-2]\n');
  const json = await run(['config', 'set', 'git.merge', 'squash', '--json'], repo);
  expect(JSON.parse(json.out)).toEqual({ key: 'git.merge', from: 'rebase', to: 'squash', consequences: [] });
  expect(text(repo)).toContain('merge: squash');

  // under a map keyed by anything the rest of the path is one key
  const person = await run(['config', 'set', 'people.dev@example.com', 'DV'], repo);
  expect(person.code).toBe(0);
  expect(person.out).toBe('changed: people.dev@example.com unset -> DV\n');
  expect(text(repo)).toContain('people:\n  dev@example.com: DV\n');
  expect((await run(['lint'], repo)).code).toBe(0);

  // unset: the key goes, and its parent when that is left empty
  const clean = sandbox();
  await run(['config', 'set', 'git.merge', 'rebase'], clean);
  const gone = await run(['config', 'unset', 'git.merge'], clean);
  expect(gone.code).toBe(0);
  expect(gone.out).toBe('changed: git.merge rebase -> unset\n');
  expect(text(clean)).toBe(CONFIG);
  const again = await run(['config', 'unset', 'git.merge'], clean);
  expect(again.out).toBe('unchanged: git.merge\n');
  expect(text(clean)).toBe(CONFIG);
  // a required key cannot be unset
  const req = await run(['config', 'unset', 'profile'], clean);
  expect(req.code).toBe(2);
  expect(req.err).toContain('profile');
  expect(req.err).toContain('accord/config.yml was not changed');
  expect(text(clean)).toBe(CONFIG);
});

// ST-LN-92 D-05, D-06: the executor cap and the regenerate command are set, refused and read back through accord config like any dotted key.
it('risk:parsing build.parallel and build.regenerate are set and validated through accord config (ST-LN-92 92-ac-2)', async () => {
  const repo = makeLaneRepo();
  repos.push(repo);
  expect(text(repo)).toBe(CONFIG);
  expect((await run(['waves', 'T-1'], repo)).out).toBe('Parallel: 3\nWave 1: 1\nWave 2: 2\n');

  // the cap: stored as the string "2" (YAML numerics stay strings), and accord waves prints it
  const two = await run(['config', 'set', 'build.parallel', '2'], repo);
  expect(two.err).toBe('');
  expect(two.code).toBe(0);
  expect(two.out).toBe('changed: build.parallel unset -> "2"\n');
  expect(JSON.parse((await run(['config', 'get', 'build.parallel', '--json'], repo)).out)).toEqual({ key: 'build.parallel', value: '2' });
  expect(text(repo)).toBe(CONFIG + 'build:\n  parallel: "2"\n');
  expect((await run(['waves', 'T-1'], repo)).out).toBe('Parallel: 2\nWave 1: 1\nWave 2: 2\n');
  expect((await run(['lint'], repo)).code).toBe(0);
  const top = await run(['config', 'set', 'build.parallel', '99'], repo);
  expect(top.code).toBe(0);
  // get prints the value as YAML writes it: a string of digits quoted, so it reads back as the same string
  expect((await run(['config', 'get', 'build.parallel'], repo)).out).toBe('"99"\n');
  expect(JSON.parse((await run(['config', 'get', 'build.parallel', '--json'], repo)).out).value).toBe('99');
  expect((await run(['waves', 'T-1'], repo)).out).toMatch(/^Parallel: 99\n/);

  // 0, 100 and x: refused by the schema with exit 2, the file untouched
  const bytes = text(repo);
  for (const bad of ['0', '100', 'x']) {
    const r = await run(['config', 'set', 'build.parallel', bad], repo);
    expect(r.code, bad).toBe(2);
    expect(r.err, bad).toContain('build.parallel');
    expect(r.err, bad).toContain('accord/config.yml was not changed');
    expect(text(repo), bad).toBe(bytes);
  }

  // the regenerate command: a string with a space, stored and printed back as typed
  const gen = await run(['config', 'set', 'build.regenerate', 'npm run gen'], repo);
  expect(gen.err).toBe('');
  expect(gen.code).toBe(0);
  expect((await run(['config', 'get', 'build.regenerate'], repo)).out).toBe('npm run gen\n');
  expect(text(repo)).toContain('  regenerate: npm run gen\n');
  expect((await run(['config', 'get', 'build.parallel'], repo)).out).toBe('"99"\n');
  expect((await run(['lint'], repo)).code).toBe(0);
  // an empty command is refused
  const after = text(repo);
  const empty = await run(['config', 'set', 'build.regenerate', ''], repo);
  expect(empty.out).toBe('');
  expect(empty.code).toBe(2);
  expect(text(repo)).toBe(after);
});

it('risk:data-loss accord config keeps CRLF and comments in a real file (ST-LN-50 t2-ac-9)', async () => {
  const head = '# the team config\n' + CONFIG.replace('profile: build', 'profile: build # strict');
  const repo = sandbox((head + '# end\n').replace(/\n/g, '\r\n'));
  const r = await run(['config', 'set', 'git.merge', 'squash'], repo);
  expect(r.code).toBe(0);
  // the key goes before the comment that closes the file, and no other line moves
  expect(text(repo)).toBe((head + 'git:\n  merge: squash\n# end\n').replace(/\n/g, '\r\n'));
  expect(text(repo)).not.toMatch(/[^\r]\n/);
});

it('risk:complex-branching accord config check lists findings and writes nothing (ST-LN-50 t2-ac-9)', async () => {
  const ok = sandbox();
  const good = await run(['config', 'check'], ok);
  expect(good.code).toBe(0);
  expect(good.out).toBe('accord/config.yml: valid\n');
  expect(JSON.parse((await run(['config', 'check', '--json'], ok)).out)).toEqual({ findings: [] });

  const invalid = sandbox(CONFIG.replace('profile: build', 'profile: nope'));
  const before = text(invalid);
  const bad = await run(['config', 'check'], invalid);
  expect(bad.code).toBe(1);
  expect(bad.out).toContain('accord/config.yml:2');
  expect(bad.out).toContain('/profile');
  expect(bad.out).toContain('must be equal to one of the allowed values');
  const asJson = JSON.parse((await run(['config', 'check', '--json'], invalid)).out) as { findings: { rule: string; line: number }[] };
  expect(asJson.findings.map((f) => [f.rule, f.line])).toEqual([['schema.enum', 2]]);
  expect(text(invalid)).toBe(before);
  // a file that is already invalid is not made worse: a set that leaves it invalid is refused
  const set = await run(['config', 'set', 'git.merge', 'rebase'], invalid);
  expect(set.code).toBe(2);
  expect(text(invalid)).toBe(before);
});

it('risk:complex-branching accord config refuses under a pin mismatch like every repository-reading command (ST-LN-50 t2-ac-9)', async () => {
  const repo = sandbox(pinned('0.0.1'));
  const before = text(repo);
  for (const argv of [['get', 'git.merge'], ['set', 'git.merge', 'rebase'], ['unset', 'git.merge'], ['check']]) {
    const r = await run(['config', ...argv], repo);
    expect(r.code, argv.join(' ')).toBe(2);
    expect(r.err, argv.join(' ')).toContain('0.0.1');
    expect(r.out).toBe('');
  }
  expect(text(repo)).toBe(before);
});

it('risk:complex-branching accord config needs accord/config.yml (ST-LN-50 t2-ac-9)', async () => {
  const repo = makeEmptyRepo();
  repos.push(repo);
  writeFiles(repo, { 'accord/tickets/.gitkeep': '' });
  for (const argv of [['get', 'git.merge'], ['set', 'git.merge', 'rebase'], ['unset', 'git.merge'], ['check']]) {
    const r = await run(['config', ...argv], repo);
    expect(r.code, argv.join(' ')).toBe(2);
    expect(r.err, argv.join(' ')).toContain('accord/config.yml');
  }
  expect(existsSync(file(repo))).toBe(false);
});

const tickets = (repo: string): Record<string, string> =>
  Object.fromEntries(readdirSync(join(repo, 'accord', 'tickets')).sort().map((f) => [f, readFileSync(join(repo, 'accord', 'tickets', f), 'utf8')]));

it('risk:complex-branching changing the id pattern keeps every id and fills legacy_ids (ST-LN-50 t2-ac-2)', async () => {
  const repo = sandbox();
  // the clone's ids: ST-LN-1 on the checked-out branch, ST-LN-2 only on another branch
  expect((await run(['new', 'ticket', 'ST-LN-1', '--type', 'story'], repo)).code).toBe(0);
  commitAll(repo);
  const home = gitRun(repo, 'branch', '--show-current').trim();
  gitRun(repo, 'checkout', '-q', '-b', 'side');
  expect((await run(['new', 'ticket', 'ST-LN-2', '--type', 'story'], repo)).code).toBe(0);
  commitAll(repo);
  gitRun(repo, 'checkout', '-q', home);
  const before = tickets(repo);
  expect(Object.keys(before)).toEqual(['ST-LN-1.md']);

  const set = await run(['config', 'set', 'ids.pattern', 'FEAT-{n}'], repo);
  expect(set.code).toBe(0);
  expect(set.out).toMatch(/^changed: ids\.pattern unset -> "?FEAT-\{n\}"?\n/);
  expect(set.out.endsWith('legacy_ids +ST-LN-1\nlegacy_ids +ST-LN-2\n')).toBe(true);
  // one edit: the pattern and the legacy ids together, nothing else moved
  expect(text(repo).startsWith(CONFIG + 'ids:\n')).toBe(true);
  expect(text(repo).endsWith('legacy_ids: [ST-LN-1, ST-LN-2]\n')).toBe(true);
  // no ticket renamed or edited, and the pattern change left lint green
  expect(tickets(repo)).toEqual(before);
  expect(gitRun(repo, 'status', '--porcelain', '--', 'accord/tickets')).toBe('');
  const lint = await run(['lint'], repo);
  expect(lint.err + lint.out).not.toContain('lint.id-convention');
  expect(lint.code).toBe(0);
  // the next ticket follows the new pattern
  expect((await run(['new', 'ticket', '--type', 'story'], repo)).out).toBe('accord/tickets/FEAT-1.md\n');

  // a second change appends after the entries already there (never sorted among them, never dropped), and --json names them
  const bytes = text(repo);
  const next = await run(['config', 'set', 'ids.pattern', 'WORK-{n}', '--json'], repo);
  expect(next.code).toBe(0);
  expect(JSON.parse(next.out)).toEqual({ key: 'ids.pattern', from: 'FEAT-{n}', to: 'WORK-{n}', consequences: [{ key: 'legacy_ids', added: ['FEAT-1'] }] });
  expect(text(repo)).toContain('legacy_ids: [ST-LN-1, ST-LN-2, FEAT-1]\n');
  expect(text(repo)).not.toBe(bytes);
  expect(Object.keys(tickets(repo))).toEqual(['FEAT-1.md', 'ST-LN-1.md']);
  expect((await run(['lint'], repo)).code).toBe(0);

  // the same value again: unchanged, no consequence; a change that breaks no id adds none
  const again = await run(['config', 'set', 'ids.pattern', 'WORK-{n}'], repo);
  expect(again.out).toBe('unchanged: ids.pattern\n');
  const types = await run(['config', 'set', 'ids.types', '{ bug: DEFECT }'], repo);
  expect(types.code).toBe(0);
  expect(types.out).toMatch(/^changed: ids\.types unset -> \{bug: DEFECT\}\n$/);

  // a refused change writes nothing, legacy_ids included
  const kept = text(repo);
  const refused = await run(['config', 'set', 'ids.pattern', 'no number here'], repo);
  expect(refused.code).toBe(2);
  expect(text(repo)).toBe(kept);
});

// CR-02 (round 2): the value written is the value typed. A command whose quotes keep a path together, or whose backslashes are a Windows path, must not be
// rewritten by `config set` into another command (a JSON unwrap turned a quoted backslash path into a TAB and a BACKSPACE, and exited 0).
it('risk:data-loss accord config set stores a quoted command and a backslash path unchanged (CR-02)', async () => {
  const repo = sandbox();
  for (const [key, value] of [
    ['git.sync', '"./my scripts/sync.sh"'],
    ['git.sync', String.raw`"C:\tools\build.cmd"`],
  ] as const) {
    const set = await run(['config', 'set', key, value], repo);
    expect(set.err, value).toBe('');
    expect(set.code, value).toBe(0);
    expect(JSON.parse((await run(['config', 'get', key, '--json'], repo)).out), value).toEqual({ key, value });
    await run(['config', 'unset', key], repo);
  }
});

// ST-LN-83 D-03: `queue.merge` decides whether /accord-queue merges its pull request at once; it is edited through accord config
// like any dotted key, and a value other than owner or at-once is refused with the file untouched.
it('ac-4 queue merge follows config (ST-LN-83 7-ac-4)', async () => {
  const repo = sandbox();
  const set = await run(['config', 'set', 'queue.merge', 'at-once'], repo);
  expect(set.err).toBe('');
  expect(set.code).toBe(0);
  expect(set.out).toBe('changed: queue.merge unset -> at-once\n');
  expect(text(repo)).toBe(CONFIG + 'queue:\n  merge: at-once\n');
  expect((await run(['config', 'get', 'queue.merge'], repo)).out).toBe('at-once\n');
  expect(JSON.parse((await run(['config', 'get', 'queue.merge', '--json'], repo)).out)).toEqual({ key: 'queue.merge', value: 'at-once' });
  expect((await run(['lint'], repo)).code).toBe(0);

  // any other value: exit 2, the reason, nothing written
  const bytes = text(repo);
  for (const bad of ['sometimes', 'admin', 'At-Once', '']) {
    const r = await run(['config', 'set', 'queue.merge', bad], repo);
    expect(r.code, bad).toBe(2);
    expect(r.err, bad).toContain('queue.merge');
    expect(r.err, bad).toContain('accord/config.yml was not changed');
    expect(text(repo), bad).toBe(bytes);
  }
  // a second key under queue is refused too
  const extra = await run(['config', 'set', 'queue.admin', 'true'], repo);
  expect(extra.code).toBe(2);
  expect(text(repo)).toBe(bytes);

  // owner is the other value, and unset returns to the shipped default
  expect((await run(['config', 'set', 'queue.merge', 'owner'], repo)).code).toBe(0);
  expect((await run(['config', 'get', 'queue.merge'], repo)).out).toBe('owner\n');
  expect((await run(['config', 'unset', 'queue.merge'], repo)).code).toBe(0);
  expect((await run(['lint'], repo)).code).toBe(0);
});
