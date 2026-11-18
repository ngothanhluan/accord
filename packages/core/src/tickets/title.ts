// ST-LN-22 D-08b: the rule a ticket's title follows. It lives in config.yml (`titles`) so a team sets its own, and
// `accord new ticket` prints it when it creates a ticket from a given `--title`, so the model reads the rule at the
// moment it writes the title. The checks are deterministic - length, letters and the template's placeholder - and never
// a model call. Pure: no I/O.

/** The title every ticket template starts with; a ticket that still reads it was never given a title. */
export const TITLE_PLACEHOLDER = 'Short title in business language';

/** The rule with no `titles` in config.yml: one line of guidance, a length cap, and the language. */
export const DEFAULT_TITLE_RULE = {
  rule: 'English, in business language: what the reader gets, not how the code changes',
  max_length: '80',
  language: 'english',
} as const;

export interface TitleRule {
  /** one line of guidance the model reads */
  rule: string;
  /** the longest title, in characters */
  maxLength: number;
  /** `english` refuses a letter outside A-Z and a-z; `any` allows every letter */
  language: 'english' | 'any';
}

/** The config a rule is read from; until config.yml holds a `titles` key (ST-LN-22 D-08b, 07-13 task 2) it reads nothing from it. */
type ConfigLike = object | undefined;

/** The rule in force: for now the default. */
export function titleRuleOf(config: ConfigLike): TitleRule {
  void config; // read nothing yet: the `titles` key arrives with task 2
  return {
    rule: DEFAULT_TITLE_RULE.rule,
    maxLength: Number(DEFAULT_TITLE_RULE.max_length),
    language: DEFAULT_TITLE_RULE.language,
  };
}

/** `title rule: <rule>; at most <n> characters[; English letters only]` - the line accord prints beside a title. */
export function titleRuleLine(config: ConfigLike): string {
  const r = titleRuleOf(config);
  return 'title rule: ' + r.rule + '; at most ' + r.maxLength + ' characters' + (r.language === 'english' ? '; English letters only' : '');
}

/** Why `title` breaks the rule in force, or undefined when it keeps it. Length is counted in characters, not UTF-16 units. */
export function titleProblem(title: string, config: ConfigLike): string | undefined {
  const r = titleRuleOf(config);
  const text = title.trim();
  if (text === '') return 'the title is blank';
  if (text.toLowerCase() === TITLE_PLACEHOLDER.toLowerCase()) return 'the title is still the template\'s placeholder "' + TITLE_PLACEHOLDER + '"';
  const length = [...text].length;
  if (length > r.maxLength) return 'the title is ' + length + ' characters, more than ' + r.maxLength;
  if (r.language === 'english') {
    const letter = [...text].find((c) => /\p{L}/u.test(c) && !/[A-Za-z]/.test(c));
    if (letter !== undefined) return 'the title holds "' + letter + '", a letter outside English';
  }
  return undefined;
}
