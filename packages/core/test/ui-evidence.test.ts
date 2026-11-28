// Phase 11 D-10, D-11, D-16 (11-ac-11): gate.ui-evidence-missing. Every `Result: pass` block of a `@ui` scenario of a `ui: true` lane ticket names its tier; command, verifier and manual need an evidence file in the
// ticket's own folder and `Evidence commit:` equal to the verified commit; `owner check` needs the owner's quoted words and a cited repository path. Real loader, real gate, in-memory files: only this rule is asserted.
import { describe, expect, it } from 'vitest';
import { gateDone, LOCKED, loadSnapshot, UI_EVIDENCE_FROM } from '../src/index.js';
import type { GateResult, RepoSnapshot } from '../src/index.js';
import { approved } from './helpers/approve.js';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';

const RULE = 'gate.ui-evidence-missing';
const FILE = 'accord/tickets/T-1/verification.md';
const FOLDER = 'accord/tickets/T-1/evidence/';
const SHA = 'e'.repeat(40);
const BODY = laneTicket('T-1').replace('@ac-1 @test:export#writes-csv', '@ac-1 @ui');
const text = (...blocks: string[][]): string => ['---', 'ticket: "T-1"', `commit: "${SHA}"`, 'reviewed_on: "2026-11-28"', '---', '', ...blocks.flat()].join('\n');
/** The `## @ac-1` block of the `@ui` scenario, then the `## @ac-2` block of the test-proved one. */
const ac1 = (...lines: string[]): string[] => ['## @ac-1 export writes a csv', ...lines, ''];
const ac2 = ['## @ac-2 commas', 'Result: pass', 'Evidence: src/export.ts', ''];
const SHOT = ['Result: pass', 'Tier: verifier', `Evidence commit: ${SHA.slice(0, 7)}`, 'Evidence: src/export.ts'];

interface Opts {
  verification?: string | null;
  ticket?: string;
  tree?: string[];
  claim?: { pin: string } | { error: string } | null;
  slice?: string[];
}
const done = ({ verification = text(ac1(...SHOT), ac2), ticket = BODY.replace('ui: false', 'ui: true'), tree = [], claim = { pin: UI_EVIDENCE_FROM }, slice }: Opts = {}): GateResult => {
  const files: Record<string, string> = approved(
    { 'accord/config.yml': CONFIG, 'accord/tickets/T-1.md': ticket, 'src/export.ts': 'export const w = 1;\n', 'src/form.tsx': 'export const f = 1;\n', ...(verification === null ? {} : { [FILE]: verification }) },
    'T-1',
  );
  const snapshot = loadSnapshot({ files, tree: [...Object.keys(files), ...tree].sort() });
  const extra: Partial<RepoSnapshot> = { ...(claim === null ? {} : { claimPins: { 'T-1': claim } }), ...(slice === undefined ? {} : { doneSlice: { 'T-1': slice } }) };
  return gateDone({ ...snapshot, ...extra }, 'T-1');
};
const ui = (r: GateResult) => r.findings.filter((f) => f.rule === RULE);

describe('the tier of a ui pass, and the screenshot files of a screenshot tier (D-10, D-11)', () => {
  it('risk:regression the rule is an error of the independent-verification floor and a ui pass with its file at the verified commit raises nothing (11-ac-11, D-10)', () => {
    expect([...LOCKED]).toContain(RULE);
    expect(ui(done({ tree: [`${FOLDER}ac-1-empty.png`] }))).toEqual([]);
    const refused = ui(done());
    expect(refused).toHaveLength(1);
    expect(refused[0]).toMatchObject({ level: 'error', file: FILE, line: 7 });
  });

  it('risk:regression a pass block of a ui scenario with no Tier: line is refused naming the four tiers (11-ac-11, D-10)', () => {
    const r = ui(done({ verification: text(ac1('Result: pass', 'Evidence: src/export.ts'), ac2), tree: [`${FOLDER}ac-1-empty.png`] }));
    expect(r).toHaveLength(1);
    expect(r[0].reason).toContain('@ac-1');
    expect(r[0].reason).toContain('command, verifier, manual, owner check');
  });

  it('risk:regression a screenshot tier with a file but no Evidence commit:, or one that is not the verified commit, is refused naming both shas (11-ac-11, D-11)', () => {
    const tree = [`${FOLDER}ac-1-empty.png`];
    for (const tier of ['verifier', 'manual', 'command']) {
      const none = ui(done({ verification: text(ac1('Result: pass', `Tier: ${tier}`, 'Evidence: src/export.ts'), ac2), tree }));
      expect(none).toHaveLength(1);
      expect(none[0].reason).toContain('not recorded');
      expect(none[0].reason).toContain(SHA);
      const other = ui(done({ verification: text(ac1('Result: pass', `Tier: ${tier}`, `Evidence commit: ${'a'.repeat(40)}`, 'Evidence: src/export.ts'), ac2), tree }));
      expect(other).toHaveLength(1);
      expect(other[0].reason).toContain('a'.repeat(40));
      expect(other[0].reason).toContain(SHA);
    }
    // a prefix of the verified commit, short or full, is the same commit
    const full = ui(done({ verification: text(ac1('Result: pass', 'Tier: manual', `Evidence commit: ${SHA}`, 'Evidence: src/export.ts'), ac2), tree }));
    expect(full).toEqual([]);
    expect(ui(done({ tree }))).toEqual([]);
  });

  it("risk:security only a file directly in the ticket's evidence folder, named ac-<n>-<state> with a lower-case state, counts, and no path with a backslash is printed (11-ac-11, D-10, T-11-28)", () => {
    const count = (...tree: string[]): number => ui(done({ tree })).length;
    expect(count(`${FOLDER}ac-1-empty.png`)).toBe(0);
    expect(count(`${FOLDER}ac-1-error.webp`, `${FOLDER}ac-1-x.jpg`)).toBe(0);
    expect(count(`${FOLDER}ac-1-x.jpeg`)).toBe(0);
    // none of these is a screenshot of @ac-1
    const bad = [`${FOLDER}ac-10-x.png`, `${FOLDER}ac-1.png`, `${FOLDER}ac-1-Empty.png`, `${FOLDER}ac-1--x.png`, `${FOLDER}sub/ac-1-x.png`, `${FOLDER}ac-1-x.gif`, `${FOLDER}ac-1-x.PNG`, 'accord/tickets/T-2/evidence/ac-1-x.png', 'evidence/ac-1-x.png', `${FOLDER}..\\T-2\\ac-1-x.png`];
    for (const path of bad) expect(count(path), path).toBe(1);
    for (const f of ui(done({ tree: bad }))) expect(f.reason).not.toContain('\\');
  });

  it('risk:regression a scenario of another number is judged by its own files: two states satisfy @ac-2, ac-20-x.png does not (11-ac-11, D-10)', () => {
    const body = BODY.replace('@ac-2 @test:export#escapes-commas', '@ac-2 @ui').replace('ui: false', 'ui: true');
    const v = text(ac1(...SHOT), ['## @ac-2 commas', ...SHOT, '']);
    const r = ui(done({ ticket: body, verification: v, tree: [`${FOLDER}ac-1-x.png`, `${FOLDER}ac-20-x.png`] }));
    expect(r).toHaveLength(1);
    expect(r[0].reason).toContain('@ac-2');
    expect(ui(done({ ticket: body, verification: v, tree: [`${FOLDER}ac-1-x.png`, `${FOLDER}ac-2-empty.png`, `${FOLDER}ac-2-error.webp`] }))).toEqual([]);
  });
});

describe('the owner check (D-16)', () => {
  const OWNER = ['Result: pass', 'Tier: owner check', 'Owner: "it held on my phone"', 'Evidence: src/form.tsx:12'];
  const refused = (...lines: string[]) => ui(done({ verification: text(ac1(...lines), ac2) }));

  it("risk:security an owner check with the owner's quoted words and a cited repository path passes with no file (11-ac-11, D-16) an owner check needs the owner's words", () => {
    expect(refused(...OWNER)).toEqual([]);
  });

  it("risk:security an owner check needs the owner's words: no Owner: line, an unquoted or an empty one is refused naming what is missing (11-ac-11, D-16)", () => {
    for (const owner of [undefined, 'Owner: it held on my phone', 'Owner: ""', 'Owner:']) {
      const r = refused('Result: pass', 'Tier: owner check', ...(owner === undefined ? [] : [owner]), 'Evidence: src/form.tsx:12');
      expect(r, String(owner)).toHaveLength(1);
      expect(r[0].reason).toContain('Owner:');
      expect(r[0].reason).not.toContain('cites a repository path');
    }
  });

  it("risk:security an owner check needs an Evidence that cites a repository path; the owner's own words cannot stand for one (11-ac-11, D-16)", () => {
    const none = refused('Result: pass', 'Tier: owner check', 'Owner: "it held"', 'Evidence: it looked right');
    expect(none).toHaveLength(1);
    expect(none[0].reason).toContain('cites a repository path');
    // a path in the owner's words, written after Evidence:, is not a cited path
    const inWords = refused('Result: pass', 'Tier: owner check', 'Evidence: it looked right', 'Owner: "I opened src/form.tsx"');
    expect(inWords).toHaveLength(1);
    expect(inWords[0].reason).toContain('cites a repository path');
    // a path that is not in the repository is not one either
    expect(refused('Result: pass', 'Tier: owner check', 'Owner: "it held"', 'Evidence: src/missing.tsx:3')).toHaveLength(1);
    // both missing: one finding names both
    const both = refused('Result: pass', 'Tier: owner check', 'Evidence: nothing');
    expect(both).toHaveLength(1);
    expect(both[0].reason).toContain('Owner:');
    expect(both[0].reason).toContain('cites a repository path');
  });

  it("risk:security a block with screenshots from no tier stays blocked, refused by gate.result-not-pass alone, and the owner's no is Result: fail (11-ac-11, D-16)", () => {
    for (const result of ['blocked', 'fail']) {
      const r = done({ verification: text(ac1(`Result: ${result}`, 'Tier: owner check', 'Evidence: nothing'), ac2) });
      expect(ui(r)).toEqual([]);
      expect(r.findings.filter((f) => f.rule === 'gate.result-not-pass')).toHaveLength(1);
    }
  });
});

describe('what is asked and of whom (D-10, 11-ac-11)', () => {
  it('risk:regression a ui scenario outside the slice gate done --slice judges is not asked, one inside is (11-ac-11, D-10)', () => {
    expect(ui(done({ slice: ['ac-2'] }))).toEqual([]);
    expect(ui(done({ slice: ['ac-1'] }))).toHaveLength(1);
  });

  it('risk:regression a scenario that is not @ui and a ui: false ticket are never asked (11-ac-11, D-10)', () => {
    // @ac-2 is proved by a test and records no tier
    expect(ui(done({ tree: [`${FOLDER}ac-1-x.png`] }))).toEqual([]);
    expect(ui(done({ ticket: BODY }))).toEqual([]);
  });

  it('risk:regression a ticket claimed before 0.23.0 is not asked, and a failed claim read applies the rule (11-ac-11, D-10)', () => {
    expect(UI_EVIDENCE_FROM).toBe('0.23.0');
    expect(ui(done({ claim: { pin: '0.22.0' } }))).toEqual([]);
    expect(ui(done({ claim: { pin: '0.22.9' } }))).toEqual([]);
    expect(ui(done({ claim: { pin: '0.23.0' } }))).toHaveLength(1);
    expect(ui(done({ claim: { error: 'git failed' } }))).toHaveLength(1);
  });

  it('risk:regression a ticket with no verification.md raises no ui finding, gate.verification-missing owns it (11-ac-11, D-10)', () => {
    expect(ui(done({ verification: null }))).toEqual([]);
  });
});
