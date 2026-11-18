// ST-LN-22 D-08b: a ticket's title follows a rule that lives in config.yml (English, business language, a maximum
// length). The check is pure and deterministic: length, letters and the template's placeholder, never a model call.
import { describe, expect, it } from 'vitest';
import { gateReady, lintSnapshot, loadSnapshot, OVERRIDABLE, TITLE_RULE_FROM, titleProblem, titleRuleLine } from '../src/index.js';
import type { RepoSnapshot } from '../src/index.js';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';

describe('the title rule', () => {
  it('D-08b the title rule refuses a placeholder a long title and a letter outside English (ST-LN-22 D-08b)', () => {
    expect(titleProblem('Short title in business language', undefined)).toContain('placeholder');
    expect(titleProblem('x'.repeat(81), undefined)).toContain('81 characters, more than 80');
    expect(titleProblem('Xuất báo cáo', undefined)).toContain('a letter outside English');
    expect(titleProblem('Export reports to CSV — fast', undefined)).toBeUndefined();
    // the limit itself is allowed, and digits and punctuation are not letters
    expect(titleProblem('x'.repeat(80), undefined)).toBeUndefined();
    expect(titleProblem('Export 2026 reports (CSV), fast: 100%', undefined)).toBeUndefined();
    expect(titleRuleLine(undefined)).toBe(
      'title rule: English, in business language: what the reader gets, not how the code changes; at most 80 characters; English letters only',
    );
  });
});

describe('the title rule from config.yml', () => {
  it('D-08b the title rule comes from config.yml and is printed at creation (ST-LN-22 D-08b)', () => {
    const config = { titles: { max_length: '100', language: 'any' as const } };
    // the 81-character title and a letter outside English are fine under this team's rule
    expect(titleProblem('x'.repeat(81), config)).toBeUndefined();
    expect(titleProblem('Xuất báo cáo', config)).toBeUndefined();
    expect(titleProblem('x'.repeat(101), config)).toContain('101 characters, more than 100');
    // the placeholder is refused whatever the language
    expect(titleProblem('Short title in business language', config)).toContain('placeholder');
    // the line names 100 and has no English-letters clause
    expect(titleRuleLine(config)).toBe('title rule: English, in business language: what the reader gets, not how the code changes; at most 100 characters');
    // each key falls back on its own, and a rule of the team's own is printed as written
    expect(titleRuleLine({ titles: { rule: 'Plain words' } })).toBe('title rule: Plain words; at most 80 characters; English letters only');
  });
});

/** A lane M ticket T-1 with `title`, and the claim fact `claim` (absent: no fact, so the working-tree pin decides). */
function ticketWith(title: string, claim?: { pin: string } | { error: string }): RepoSnapshot {
  const files: Record<string, string> = {
    'accord/config.yml': CONFIG,
    'accord/tickets/T-1.md': laneTicket('T-1').replace('title: "Export"', `title: "${title}"`),
  };
  const snapshot = loadSnapshot({ files, tree: Object.keys(files).sort() });
  return claim === undefined ? snapshot : { ...snapshot, claimPins: { 'T-1': claim } };
}
const titleFindings = (snapshot: RepoSnapshot) => gateReady(snapshot, 'T-1').findings.filter((f) => f.rule === 'gate.ticket-title');

describe('gate ready and the title rule', () => {
  it('D-08b gate ready judges only titles of tickets claimed at or after the cut-off (ST-LN-22 D-08b)', () => {
    const LONG = 'x'.repeat(120);
    // claimed at the cut-off: a 120-character title and the placeholder are refused, with the reason and the rule line
    const found = titleFindings(ticketWith(LONG, { pin: TITLE_RULE_FROM }));
    expect(found).toHaveLength(1);
    expect(found[0].level).toBe('error');
    expect(found[0].file).toBe('accord/tickets/T-1.md');
    expect(found[0].pointer).toBe('/title');
    expect(found[0].reason).toContain('120 characters, more than 80');
    expect(found[0].reason.endsWith(titleRuleLine(undefined))).toBe(true);
    expect(gateReady(ticketWith(LONG, { pin: TITLE_RULE_FROM }), 'T-1').verdict).toBe('fail');
    expect(titleFindings(ticketWith('Short title in business language', { pin: TITLE_RULE_FROM }))[0].reason).toContain('placeholder');
    // a title that keeps the rule is not refused
    expect(titleFindings(ticketWith('Export reports to CSV', { pin: TITLE_RULE_FROM }))).toEqual([]);
    // claimed before the cut-off, or with no claim fact and a working-tree pin before it: not judged, whatever the title
    expect(titleFindings(ticketWith(LONG, { pin: '0.7.1' }))).toEqual([]);
    expect(titleFindings(ticketWith(LONG))).toEqual([]);
    // a failed claim read fails closed: the rule applies
    expect(titleFindings(ticketWith(LONG, { error: 'git failed' }))).toHaveLength(1);
    // a team may lower it
    expect(OVERRIDABLE).toContain('gate.ticket-title');
  });
});

/** A lane M ticket T-1 titled `title` whose frontmatter `ruleset` is `ruleset` (absent: none), through the whole lint. */
function lintTitle(title: string, ruleset?: string) {
  const files: Record<string, string> = {
    'accord/config.yml': CONFIG,
    'accord/tickets/T-1.md': laneTicket('T-1', { frontmatter: ruleset === undefined ? [] : [`ruleset: "${ruleset}"`] }).replace('title: "Export"', `title: "${title}"`),
  };
  return lintSnapshot(loadSnapshot({ files, tree: Object.keys(files).sort() })).findings.filter((f) => f.rule === 'lint.ticket-title');
}

describe('lint and the title rule', () => {
  it('D-08b lint judges only titles of tickets at or after the cut-off (ST-LN-22 D-08b)', () => {
    // a ticket whose ruleset is the cut-off: the placeholder is an error on /title, with the reason and the rule line
    const found = lintTitle('Short title in business language', TITLE_RULE_FROM);
    expect(found).toHaveLength(1);
    expect(found[0].level).toBe('error');
    expect(found[0].file).toBe('accord/tickets/T-1.md');
    expect(found[0].pointer).toBe('/title');
    expect(found[0].reason).toContain('placeholder');
    expect(found[0].reason.endsWith(titleRuleLine(undefined))).toBe(true);
    expect(lintTitle('x'.repeat(120), TITLE_RULE_FROM)[0].reason).toContain('120 characters, more than 80');
    expect(lintTitle('Export reports to CSV', TITLE_RULE_FROM)).toEqual([]);
    // an older ruleset or none (every ticket that exists when the rule ships): not judged, whatever the title
    expect(lintTitle('Short title in business language', '0.7.1')).toEqual([]);
    expect(lintTitle('Short title in business language')).toEqual([]);
    expect(lintTitle('x'.repeat(120), '0.5.0')).toEqual([]);
    // a team may lower it
    expect(OVERRIDABLE).toContain('lint.ticket-title');
  });
});
