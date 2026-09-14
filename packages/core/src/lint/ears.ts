// D-61 case- and whitespace-insensitive, D-62 subject `the system shall`, D-63 English keywords around
// content in any language, D-64 one fixed diagnosis and no nearest-pattern guess. A1: WHILE / WHEN / WHERE
// clauses may come in any order; only THEN must be last. Whitespace tokens are compared; no regex word
// boundary, which is ASCII-only and misfires next to Vietnamese letters (Pitfall 2).
import type { Rule } from './rules.js';

const KEYWORDS = ['WHILE', 'WHEN', 'IF', 'THEN', 'WHERE'];
const VERBS = ['SHOULD', 'MUST', 'WILL', 'CAN', 'MAY'];
const part: Record<string, string> = { WHILE: 'state', WHEN: 'trigger', IF: 'condition', WHERE: 'feature' };
const names: Record<string, string> = {
  WHILE: 'state-driven',
  WHEN: 'event-driven',
  IF: 'unwanted-behaviour',
  WHERE: 'optional-feature',
};
const tokens = (line: string) => line.replace(/[,;.]+(\s|$)/g, ' ').replace(/\s+/g, ' ').trim().split(' ');

export function classifyEars(text: string): { pattern: string } | { reason: string } {
  const t = tokens(text);
  const up = t.map((w) => w.toUpperCase());
  let subj = -1;
  for (let i = 0; i + 2 < up.length; i++) {
    if (up[i] === 'THE' && up[i + 1] === 'SYSTEM' && up[i + 2] === 'SHALL') {
      subj = i;
      break;
    }
  }
  const kw = up.find((w) => KEYWORDS.includes(w));
  if (subj < 0) {
    for (let i = 0; i + 2 < up.length; i++) {
      if (up[i] === 'THE' && up[i + 1] === 'SYSTEM' && VERBS.includes(up[i + 2])) {
        return { reason: `has 'the system ${t[i + 2]}' but the verb must be 'shall'` };
      }
    }
    return { reason: kw ? `has ${kw} but no 'the system shall'` : `no EARS keyword and no 'the system shall'` };
  }
  if (subj + 3 >= up.length) return { reason: "has 'the system shall' but no response after it" };
  const pre = up.slice(0, subj);
  if (pre.length === 0) return { pattern: 'ubiquitous' };
  if (!KEYWORDS.includes(pre[0])) return { reason: "has 'the system shall' but the line starts with prose and no keyword" };
  const clauses: { kw: string; words: number }[] = [];
  for (const w of pre) {
    if (KEYWORDS.includes(w)) {
      if (clauses.some((c) => c.kw === w)) return { reason: `has ${w} twice` };
      clauses.push({ kw: w, words: 0 });
    } else clauses[clauses.length - 1].words++;
  }
  for (const c of clauses) {
    if (c.kw !== 'THEN' && c.words === 0) return { reason: `has ${c.kw} but no ${part[c.kw]} before 'the system shall'` };
  }
  const hasIf = clauses.some((c) => c.kw === 'IF');
  const hasThen = clauses.some((c) => c.kw === 'THEN');
  if (hasIf && !hasThen) return { reason: "has IF but no THEN before 'the system shall'" };
  if (hasThen && !hasIf) return { reason: 'has THEN but no IF' };
  if (hasThen && clauses[clauses.length - 1].kw !== 'THEN') return { reason: "THEN must come last before 'the system shall'" };
  const main = clauses.filter((c) => c.kw !== 'THEN');
  return { pattern: main.length === 1 ? names[main[0].kw] : 'complex' };
}

/** LINT-02: one warning per requirement line that is none of the six patterns, at its Markdown line. */
export const earsUnclassified: Rule['check'] = (snapshot) =>
  Object.values(snapshot.tickets).flatMap((t) =>
    t.requirements.flatMap((l) => {
      const r = classifyEars(l.text);
      return 'reason' in r ? [{ file: t.file, line: l.line, reason: r.reason }] : [];
    }),
  );
