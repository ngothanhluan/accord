// ST-LN-22 D-08b: a ticket's title follows a rule that lives in config.yml (English, business language, a maximum
// length). The check is pure and deterministic: length, letters and the template's placeholder, never a model call.
import { describe, expect, it } from 'vitest';
import { titleProblem, titleRuleLine } from '../src/index.js';

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
