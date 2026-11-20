// Phase 8.1 G2 (D-01, 8.1-ac-2): `accord pr <id>` runs the team's `pr.command` only after `accord trust`; the script replaces the template entirely, and a failing, silent or untrusted one stops
// the step with no body file and no fallback. The marker a script writes lives in a folder of its own, outside the repository. Real files in tmp sandboxes.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { CONFIG } from '../../../test/helpers/lane.js';
import { cleanup, commitAll, commitMsg, gitRun, makeLaneRepo, run, trustAllow, writeFiles } from './helpers/repo.js';

const SCRIPT_CONFIG = CONFIG + 'pr:\n  command: node scripts/pr.mjs\n';
const TEMPLATE = ['## Description', '', '## Screenshots', ''].join('\n');

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) cleanup(dirs.pop() as string);
});

const posix = (p: string): string => p.replaceAll('\\', '/');

/** A repository whose committed script is scripts/pr.mjs next to a PR template, and a folder outside it holding the marker the script writes when it runs. */
function sandbox(script: (marker: string) => string): { repo: string; marker: string; base: string } {
  const folder = mkdtempSync(join(tmpdir(), 'accord-pr-script-'));
  dirs.push(folder);
  const marker = posix(join(folder, 'marker.txt'));
  const repo = makeLaneRepo({ 'accord/config.yml': SCRIPT_CONFIG, 'scripts/pr.mjs': script(marker), '.github/pull_request_template.md': TEMPLATE });
  dirs.push(repo);
  const base = commitAll(repo);
  gitRun(repo, 'update-ref', 'refs/remotes/origin/main', base);
  return { repo, marker, base };
}

/** A script that records that it ran, then prints `lines` and the four variables it was given. */
const printing = (lines: string) => (marker: string) =>
  `import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(marker)}, 'ran');\nconst e = process.env;\nprocess.stdout.write(${JSON.stringify(lines)} + e.ACCORD_TICKET + '|' + e.ACCORD_TICKET_FILE + '|' + e.ACCORD_BASE_REF + '|' + e.ACCORD_ROOT + '\\n');\n`;

const bodyFile = (repo: string): string => join(repo, '.git', 'accord-pr-T-1.md');

it('risk:security a trusted PR script prints the title and body and an untrusted one never runs (8.1-ac-2)', async () => {
  const { repo, marker } = sandbox(printing('ABC-12 Cart coupon\nBody line\n'));

  // untrusted: exit 2 naming accord trust, the script never ran, no body file
  const refused = await run(['pr', 'T-1'], repo);
  expect(refused.code, refused.out + refused.err).toBe(2);
  expect(refused.err).toContain('accord trust');
  expect(existsSync(marker), 'the script never ran').toBe(false);
  expect(existsSync(bodyFile(repo))).toBe(false);

  // trusted: the first line is the title, the rest the body, and the template is not used
  expect((await trustAllow(repo, ['pr.command'])).code).toBe(0);
  const ok = await run(['pr', 'T-1'], repo);
  expect(ok.code, ok.out + ok.err).toBe(0);
  expect(ok.out).toContain('title: ABC-12 Cart coupon\n');
  expect(ok.out).toContain('script: pr.command\n');
  expect(ok.out).not.toContain('template:');
  expect(ok.out).not.toContain('remaining:');
  expect(existsSync(marker)).toBe(true);
  const body = readFileSync(bodyFile(repo), 'utf8');
  expect(body.startsWith('Body line\n')).toBe(true);
  expect(body).not.toContain('## Description');
  // the ticket reaches the script through the environment only: its id, an absolute readable copy of the ticket file, the default ref and the root
  const [ticket, file, ref, root] = (body.trimEnd().split('\n').pop() ?? '').split('|');
  expect(ticket).toBe('T-1');
  expect(file).toMatch(/^(?:[A-Za-z]:)?\//);
  expect(file).not.toContain('\\');
  expect(readFileSync(file, 'utf8')).toContain('id: "T-1"');
  expect(ref).toMatch(/origin\/main$/);
  expect(root).toBeTruthy();

  // a trusted script that exits 3 is exit 2 quoting its stderr: no body file, no fallback to the template
  writeFileSync(join(repo, 'scripts', 'pr.mjs'), "process.stderr.write('boom from the script\\n');\nprocess.exit(3);\n");
  commitAll(repo, 'a failing script');
  expect((await run(['pr', 'T-1'], repo)).code, 'a changed script is not run until it is allowed again').toBe(2);
  expect((await trustAllow(repo, ['pr.command'])).code).toBe(0);
  rmSync(bodyFile(repo), { force: true });
  const failed = await run(['pr', 'T-1'], repo);
  expect(failed.code, failed.out + failed.err).toBe(2);
  expect(failed.err).toContain('boom from the script');
  expect(failed.err).toContain('exited 3');
  expect(existsSync(bodyFile(repo))).toBe(false);
}, 120_000);

it('risk:security a PR script with no title or an unsafe one stops the step with no body file (D-01)', async () => {
  const { repo } = sandbox(printing('\nA body without a title\n'));
  expect((await trustAllow(repo, ['pr.command'])).code).toBe(0);
  const silent = await run(['pr', 'T-1'], repo);
  expect(silent.code, silent.out + silent.err).toBe(2);
  expect(silent.err).toContain('title');
  expect(existsSync(bodyFile(repo))).toBe(false);

  writeFileSync(join(repo, 'scripts', 'pr.mjs'), "process.stdout.write('Say \"hi\"\\nBody\\n');\n");
  commitAll(repo, 'an unsafe title');
  expect((await trustAllow(repo, ['pr.command'])).code).toBe(0);
  const unsafe = await run(['pr', 'T-1'], repo);
  expect(unsafe.code, unsafe.out + unsafe.err).toBe(2);
  expect(unsafe.err).toContain('"');
  expect(existsSync(bodyFile(repo))).toBe(false);
}, 120_000);

it('risk:security the script of an epic queued on a backlog branch reads an absolute copy of the draft (D-01)', async () => {
  const { repo, base } = sandbox(printing('Epic title\nEpic body\n'));
  gitRun(repo, 'switch', '-q', '-c', 'backlog/E-1-2026-11-20', base);
  writeFiles(repo, { 'accord/tickets/E-1.md': ['---', 'id: "E-1"', 'title: "Reporting"', 'type: epic', 'status: draft', 'lane: L', 'ui: false', '---', '', '## Intent', 'Teams see every export.', ''].join('\n') });
  commitMsg(repo, 'backlog: queue E-1');
  gitRun(repo, 'switch', '-q', '-');
  expect((await trustAllow(repo, ['pr.command'])).code).toBe(0);
  const r = await run(['pr', 'E-1'], repo);
  expect(r.code, r.out + r.err).toBe(0);
  expect(r.out).toContain('title: Epic title\n');
  const [ticket, file] = (readFileSync(join(repo, '.git', 'accord-pr-E-1.md'), 'utf8').trimEnd().split('\n').pop() ?? '').split('|');
  expect(ticket).toBe('E-1');
  expect(file).not.toContain('\\');
  expect(file.endsWith('accord-pr-E-1-ticket.md')).toBe(true);
  expect(readFileSync(file, 'utf8')).toContain('Teams see every export.');
}, 120_000);
