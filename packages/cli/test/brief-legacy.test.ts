// Phase 8.5 G2 (D-22, R-1, 8.5-ac-6): a ticket claimed before the product text cut-off keeps today's task brief and today's plan-off brief byte for byte. These two cases were
// written and run on the untouched brief.ts, which wrote their goldens (the Wave 0 capture of 08.5-VALIDATION.md); every later change to brief.ts is held to them.
// The CLI runs as itself (0.12.2) and the ticket is claimed under 0.12.2, below the cut-off. The goldens show a byte order mark and a carriage return as <BOM> and <CR>, because
// .gitattributes (`* text=auto eol=lf`) would turn the bytes themselves into line feeds at commit and the golden would then stop matching what the brief prints.
import { realpathSync } from 'node:fs';
import { afterEach, expect, it } from 'vitest';
import { CONFIG, REPORT } from '../../../test/helpers/lane.js';
import { claimedUnder, cleanup, makeLaneRepo, run, writeFiles } from './helpers/repo.js';

const BOM = '\uFEFF';
const CONVENTIONS = BOM + '# Conventions\r\n\r\n<!-- one rule per line -->\r\n\r\n- Rule one of the team.\r\n- Rule two of the team.\r\n';
const AFFECTED = CONFIG.replace(`  report: ${REPORT}\n`, `  report: ${REPORT}\n  affected: "npx vitest run {files}"\n`) + 'commits:\n  message:\n    preset: conventional\n';
const OFF = 'strictness:\n  stages:\n    M:\n      plan: "off"\n';

const repos: string[] = [];
afterEach(() => {
  while (repos.length > 0) cleanup(repos.pop() as string);
});

function sandbox(config: string): string {
  const repo = makeLaneRepo({ 'accord/config.yml': config, 'accord/product/conventions.md': CONVENTIONS });
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
