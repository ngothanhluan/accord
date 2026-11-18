// ST-LN-70 6-ac-4 rule extractor and diff; test-only, pure (no file, no clock).

/** A rule word, as a whole word, case-insensitive (06-CONTEXT Ruling "Rule line definition"). */
export const RULE_WORD = /\b(never|always|only|must|refuse[sd]?|stops?)\b/i;

/** The golden's own path, named by every message that is about the golden file itself. */
export const RULE_GOLDEN_PATH = 'packages/core/test/__golden__/rule-lines.txt';

export interface RuleLine {
  line: number;
  end: number;
  text: string;
}

export interface RuleSource {
  path: string;
  text: string;
  numbered: boolean;
}

export function ruleLines(_text: string, _numbered = false): RuleLine[] {
  return [];
}

export function ruleSources(): RuleSource[] {
  return [];
}

export function ruleGolden(_sources: readonly RuleSource[]): string {
  return '';
}

export function ruleDiff(_golden: string, _sources: readonly RuleSource[]): string[] {
  return [];
}
