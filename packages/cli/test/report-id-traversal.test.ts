// T-04-12 (phase 4 security audit): `accord brief` and `accord task-done` build the report path and the ledger path from the ticket id. The loader key is the
// stem of `accord/tickets/<stem>.md`, so a committed `accord/tickets/...md` gives the key `..`; both commands refuse it as task-tree.ts does, before any file work.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { cleanup, commitAll, gitRun, makeLaneRepo, run } from './helpers/repo.js';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';

const OFF = 'strictness:\n  stages:\n    M:\n      plan: "off"\n';
const ROOT_TASK = 'a committed file at the repository root\n';
const LEDGER = '# a committed accord/ledger.md\n';

it.each([['brief'], ['task-done']])('risk:security accord %s refuses the ticket id .. and touches no file outside its ticket (T-04-12)', async (command) => {
  const repo = makeLaneRepo({
    'accord/config.yml': CONFIG + OFF,
    'accord/tickets/...md': laneTicket('X-1'),
    'task-1.md': ROOT_TASK,
    'accord/ledger.md': LEDGER,
  });
  try {
    mkdirSync(join(repo, '.accord-reports'), { recursive: true });
    writeFileSync(join(repo, '.accord-reports', '.gitignore'), '*\n');
    commitAll(repo, 'claim: X-1');
    const result = await run([command, '..', '1'], repo);
    expect(result.err).toContain('not a valid ticket id: ..');
    expect(result.code).toBe(2);
    expect(existsSync(join(repo, 'task-1.md'))).toBe(true);
    expect(readFileSync(join(repo, 'task-1.md'), 'utf8')).toBe(ROOT_TASK);
    expect(readFileSync(join(repo, 'accord', 'ledger.md'), 'utf8')).toBe(LEDGER);
    expect(gitRun(repo, 'status', '--porcelain')).toBe('');
  } finally {
    cleanup(repo);
  }
}, 120_000);
