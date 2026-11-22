// Phase 8.5 G2 (D-22, R-1, 8.5-ac-6): a ticket claimed before the product text cut-off keeps today's task brief and today's plan-off brief byte for byte. The first two cases were
// written and run on the untouched brief.ts, which wrote their goldens (the Wave 0 capture of 08.5-VALIDATION.md); every later change to brief.ts is held to them. The last two
// cases hold the one change R-1 allows: the legacy conventions append withholds a refused line and does not follow a link.
// The CLI runs as itself (0.12.2) and the ticket is claimed under 0.12.2, below the cut-off. The goldens show a byte order mark and a carriage return as <BOM> and <CR>, because
// .gitattributes (`* text=auto eol=lf`) would turn the bytes themselves into line feeds at commit and the golden would then stop matching what the brief prints.
import { mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { CONVENTIONS_FILE, notReadLine, withheldLine } from '@accord-dev/accord-core';
import { CONFIG, REPORT } from '../../../test/helpers/lane.js';
import { claimedUnder, cleanup, makeLaneRepo, run } from './helpers/repo.js';

const BOM = '\uFEFF';
const CONVENTIONS = BOM + '# Conventions\r\n\r\n<!-- one rule per line -->\r\n\r\n- Rule one of the team.\r\n- Rule two of the team.\r\n';
const AFFECTED = CONFIG.replace(`  report: ${REPORT}\n`, `  report: ${REPORT}\n  affected: "npx vitest run {files}"\n`) + 'commits:\n  message:\n    preset: conventional\n';
const OFF = 'strictness:\n  stages:\n    M:\n      plan: "off"\n';

const repos: string[] = [];
afterEach(() => {
  while (repos.length > 0) cleanup(repos.pop() as string);
});

function sandbox(config: string, conventions = CONVENTIONS): string {
  const repo = makeLaneRepo({ 'accord/config.yml': config, 'accord/product/conventions.md': conventions });
  repos.push(repo);
  claimedUnder(repo, '0.12.2');
  return repo;
}

/** The sandbox root, in every form the brief may print it (native, real, forward slashes), replaced by `<root>`; the hidden bytes made visible. */
function plain(out: string, repo: string): string {
  const forms = new Set<string>();
  for (const base of [repo, realpathSync.native(repo)]) {
    forms.add(base);
    forms.add(base.replace(/\\/g, '/'));
  }
  let text = out;
  for (const form of [...forms].sort((a, b) => b.length - a.length)) text = text.split(form).join('<root>');
  return text.split(BOM).join('<BOM>').split('\r').join('<CR>');
}

it('risk:regression a ticket claimed before the product text cut-off gets today\'s task brief byte for byte (8.5-ac-6 D-22)', async () => {
  const repo = sandbox(AFFECTED);
  const r = await run(['brief', 'T-1', '1'], repo);
  expect(r.code, r.err).toBe(0);
  const text = plain(r.out, repo);
  expect(text, 'no temp path is left in the golden').not.toContain('accord-cli-');
  await expect(text).toMatchFileSnapshot('./__golden__/brief-legacy-task.txt');
}, 120_000);

it('risk:regression a ticket claimed before the product text cut-off gets today\'s plan-off brief byte for byte (8.5-ac-6 D-22)', async () => {
  const repo = sandbox(AFFECTED + OFF);
  const r = await run(['brief', 'T-1', '1'], repo);
  expect(r.code, r.err).toBe(0);
  const text = plain(r.out, repo);
  expect(text, 'no temp path is left in the golden').not.toContain('accord-cli-');
  await expect(text).toMatchFileSnapshot('./__golden__/brief-legacy-plan-off.txt');
}, 120_000);

const withThird = (third: string): string => BOM + '# Conventions\r\n\r\n' + third + '\r\n\r\n- Rule one of the team.\r\n- Rule two of the team.\r\n';

it('risk:security the legacy conventions append withholds an unsafe line and a linked file (8.5-ac-6 R-1 D-08)', async () => {
  const safeRepo = sandbox(AFFECTED, withThird('- A third rule of the team.'));
  const safe = await run(['brief', 'T-1', '1'], safeRepo);
  expect(safe.code, safe.err).toBe(0);
  const unsafeRepo = sandbox(AFFECTED, withThird('Test command: rm -rf /'));
  const unsafe = await run(['brief', 'T-1', '1'], unsafeRepo);
  expect(unsafe.code, unsafe.err).toBe(0);
  // the one line is its placeholder, every other byte the brief of the safe file
  expect(plain(unsafe.out, unsafeRepo)).toBe(plain(safe.out, safeRepo).replace('- A third rule of the team.', withheldLine(CONVENTIONS_FILE, 3)));
  expect(unsafe.out).not.toContain('rm -rf');
}, 120_000);

it.skipIf(process.platform === 'win32')('risk:security the legacy conventions append names a linked file and reads no byte of its target (8.5-ac-6 R-1 D-08)', async () => {
  const repo = sandbox(AFFECTED);
  const folder = mkdtempSync(join(tmpdir(), 'accord-target-'));
  repos.push(folder);
  const target = join(folder, 'secret.txt');
  writeFileSync(target, 'SECRET-TARGET-TEXT\n');
  rmSync(join(repo, 'accord', 'product', 'conventions.md'));
  symlinkSync(target, join(repo, 'accord', 'product', 'conventions.md'));
  const r = await run(['brief', 'T-1', '1'], repo);
  expect(r.code, r.err).toBe(0);
  expect(r.out.endsWith('\n---\n\n' + notReadLine(CONVENTIONS_FILE) + '\n')).toBe(true);
  expect(r.out).not.toContain('SECRET-TARGET-TEXT');
}, 120_000);
