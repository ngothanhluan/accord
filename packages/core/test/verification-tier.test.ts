// Phase 11 D-10, D-11, D-16: the `Tier:`, `Evidence commit:` and `Owner:` labels of an `## @ac-n` block of verification.md, read as `Result:` is (the first matching line of the block).
import { describe, expect, it } from 'vitest';
import { parseVerification } from '../src/load/verification.js';

const FILE = 'accord/tickets/T-1/verification.md';
const text = (...block: string[]): string =>
  ['---', 'ticket: "T-1"', `commit: "${'e'.repeat(40)}"`, 'reviewed_on: "2026-11-28"', '---', '', '## @ac-1 one', 'Result: pass', ...block, ''].join('\n');
const read = (...block: string[]) => parseVerification('T-1', FILE, text(...block));

describe('the Tier, Evidence commit and Owner labels', () => {
  it('risk:parsing Tier: command reads into tier command, and each of the four names reads (11-ac-11, D-10)', () => {
    for (const tier of ['command', 'verifier', 'manual', 'owner check'] as const) {
      const { verification, findings } = read(`Tier: ${tier}`, 'Evidence: src/a.ts');
      expect(findings).toEqual([]);
      expect(verification.blocks[0].tier).toBe(tier);
    }
  });

  it('risk:parsing Tier: browser is a load.tier-invalid finding at its line, and the tier stays absent (11-ac-11, D-10)', () => {
    const { verification, findings } = read('Tier: browser', 'Evidence: src/a.ts');
    expect(findings).toEqual([{ file: FILE, line: 9, rule: 'load.tier-invalid', reason: 'Tier must be command, verifier, manual, or owner check' }]);
    expect(verification.blocks[0]).not.toHaveProperty('tier');
    // a wrong case is as invalid as Result: PASS
    expect(read('Tier: Command').findings.map((f) => f.rule)).toEqual(['load.tier-invalid']);
  });

  it('risk:parsing a second Tier: line in one block is a load.tier-invalid finding at its line and the first is used (11-ac-11, D-10)', () => {
    const { verification, findings } = read('Tier: manual', 'Tier: command');
    expect(findings.map((f) => [f.rule, f.line])).toEqual([['load.tier-invalid', 10]]);
    expect(verification.blocks[0].tier).toBe('manual');
  });

  it('risk:parsing Evidence commit: reads 7 to 40 hexadecimal characters, and anything else is a load finding at its line (11-ac-11, D-11)', () => {
    expect(read('Evidence commit: ABCDEF1').verification.blocks[0].evidenceCommit).toBe('ABCDEF1');
    expect(read(`Evidence commit: ${'a'.repeat(40)}`).verification.blocks[0].evidenceCommit).toBe('a'.repeat(40));
    for (const bad of ['xyz1234', 'abc12', `${'a'.repeat(41)}`, '']) {
      const { verification, findings } = read(`Evidence commit: ${bad}`);
      expect(findings.map((f) => [f.rule, f.line])).toEqual([['load.evidence-commit-invalid', 9]]);
      expect(verification.blocks[0]).not.toHaveProperty('evidenceCommit');
    }
  });

  it('risk:security Owner: reads only the words inside quotes, and the three labels are never part of the Evidence text (11-ac-11, D-16)', () => {
    const quoted = read('Tier: owner check', 'Owner: "it held on my phone"', 'Evidence: src/form.tsx:12', 'Owner: "second"');
    expect(quoted.verification.blocks[0].owner).toBe('it held on my phone');
    expect(quoted.verification.blocks[0].evidence).toBe('src/form.tsx:12');
    for (const bad of ['it held', '""', '"  "', '']) expect(read(`Owner: ${bad}`).verification.blocks[0]).not.toHaveProperty('owner');
    // the owner's words, written after Evidence:, are not evidence: a path in them cannot stand for a cited one
    const after = read('Evidence: it held', 'Owner: "see src/form.tsx"', 'Tier: owner check', 'Evidence commit: abcdef1');
    expect(after.verification.blocks[0].evidence).toBe('it held');
  });

  it('risk:parsing a block with none of the labels reads exactly as before, with none of the three keys (11-ac-11, D-10)', () => {
    const block = read('Evidence: src/a.ts').verification.blocks[0];
    expect(block).toEqual({ acTag: 'ac-1', name: 'one', line: 7, result: 'pass', evidence: 'src/a.ts' });
  });
});
