// Phase 8.1 G1 (D-04, 8.1-ac-7): `accord commit message <id>` runs the team's `commits.message.command` only after `accord trust`, and the final message is judged against the
// rule whether a script built it or not. The marker a script writes lives in a folder of its own, outside the repository. Real files in tmp sandboxes.
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { CONFIG } from '../../../test/helpers/lane.js';
import { cleanup, commitAll, makeLaneRepo, run, trustAllow } from './helpers/repo.js';

const SCRIPT_CONFIG = CONFIG + "commits:\n  message:\n    pattern: '^[A-Z]+-\\d+ '\n    example: 'ABC-12 fix cart'\n    command: node scripts/message.mjs\n";

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) cleanup(dirs.pop() as string);
});

const posix = (p: string): string => p.replaceAll('\\', '/');

/** A repository whose committed script is scripts/message.mjs, and a folder outside it holding the marker the script writes when it runs. */
function sandbox(script: (marker: string) => string): { repo: string; marker: string } {
  const folder = mkdtempSync(join(tmpdir(), 'accord-message-script-'));
  dirs.push(folder);
  const marker = posix(join(folder, 'marker.txt'));
  const repo = makeLaneRepo({ 'accord/config.yml': SCRIPT_CONFIG, 'scripts/message.mjs': script(marker) });
  dirs.push(repo);
  commitAll(repo);
  return { repo, marker };
}

const printing = (text: string) => (marker: string) =>
  `import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(marker)}, 'ran');\nprocess.stdout.write(${JSON.stringify(text)} + '\\n' + process.env.ACCORD_TICKET + ' ' + process.env.ACCORD_TICKET_FILE + '\\n');\n`;

const messageFile = (repo: string): string => join(repo, '.git', 'accord-commit-T-1.txt');

it('risk:security a trusted commit-message script builds a message the pattern then judges (8.1-ac-7)', async () => {
  const { repo, marker } = sandbox(printing('ABC-12 fix cart'));
  expect((await trustAllow(repo, ['commits.message.command'])).code).toBe(0);
  const ok = await run(['commit', 'message', 'T-1'], repo);
  expect(ok.code, ok.out + ok.err).toBe(0);
  const named = /^message-file: (.+)$/m.exec(ok.out);
  expect(named, ok.out).not.toBeNull();
  expect(named?.[1]).not.toContain('\\');
  // WR-03: the ticket file is an absolute, forward-slashed path that reads, as `accord pr` gives it, not a path relative to the root
  const written = readFileSync(named?.[1] ?? '', 'utf8').split('\n');
  expect(written[0]).toBe('ABC-12 fix cart');
  const [ticket, ticketFile] = (written[1] ?? '').split(' ');
  expect(ticket).toBe('T-1');
  expect(ticketFile, 'ACCORD_TICKET_FILE is absolute').toMatch(/^(?:[A-Za-z]:)?\//);
  expect(ticketFile).not.toContain('\\');
  expect(ticketFile).toMatch(/\/accord\/tickets\/T-1\.md$/);
  expect(readFileSync(ticketFile, 'utf8')).toContain('id: "T-1"');
  expect(existsSync(marker)).toBe(true);

  // the final message is judged whether a script built it or not: a file holding `fix cart` fails the same pattern
  const file = join(dirs[0], 'plain.txt');
  writeFileSync(file, 'fix cart\n');
  const bad = await run(['commit', 'check', file], repo);
  expect(bad.code, bad.out + bad.err).toBe(1);

  // a script whose output breaks the rule still writes the file, and the command exits 1 naming the rule
  writeFileSync(join(repo, 'scripts', 'message.mjs'), printing('fix cart')(marker));
  commitAll(repo, 'change the script');
  expect((await run(['commit', 'message', 'T-1'], repo)).code, 'a changed script is not run until it is allowed again').toBe(2);
  expect((await trustAllow(repo, ['commits.message.command'])).code).toBe(0);
  const broken = await run(['commit', 'message', 'T-1'], repo);
  expect(broken.code, broken.out + broken.err).toBe(1);
  expect(broken.out).toContain('message-file:');
  expect(broken.out).toContain('commits.message.pattern');
}, 120_000);

it('risk:security an untrusted commit-message script is never run and the refusal names accord trust (D-04)', async () => {
  const { repo, marker } = sandbox(printing('ABC-12 fix cart'));
  const refused = await run(['commit', 'message', 'T-1'], repo);
  expect(refused.code, refused.out + refused.err).toBe(2);
  expect(refused.err).toContain('accord trust');
  expect(existsSync(marker), 'the script never ran').toBe(false);
  expect(existsSync(messageFile(repo))).toBe(false);

  // a trusted script that fails exits 2 quoting its stderr, and no message file is written
  writeFileSync(join(repo, 'scripts', 'message.mjs'), "process.stderr.write('boom from the script\\n');\nprocess.exit(3);\n");
  commitAll(repo, 'a failing script');
  expect((await trustAllow(repo, ['commits.message.command'])).code).toBe(0);
  const failed = await run(['commit', 'message', 'T-1'], repo);
  expect(failed.code, failed.out + failed.err).toBe(2);
  expect(failed.err).toContain('boom from the script');
  expect(failed.err).toContain('exited 3');
  expect(existsSync(messageFile(repo))).toBe(false);
}, 120_000);
