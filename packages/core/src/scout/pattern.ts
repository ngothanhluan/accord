// Phase 08.4 security T-08.4-27: the shape a `## Absent` row's pattern may have. `scoutCheck` runs each pattern as a JavaScript
// regular expression over every tracked line, and a backtracking engine takes exponential time on a pattern such as `([a-z]*)*!`
// or `(a|aa)+!` and polynomial time on `.*.*.*!`. Core cannot bound the run (no worker, no vm, no timer that interrupts a
// synchronous match), so the pattern is read here, without running it, and refused unless its cost is bounded by its own text.
// Pure string rules: no node import (core purity).

/** The longest pattern accepted, in characters. The longest pattern in this repository's saved scout replies is under 40. */
export const PATTERN_CAP = 200;
/** A counted range `{n}`, `{n,m}` or `{n,}` may name no number above this. */
export const RANGE_CAP = 100;
/** The most ways a pattern may match at one start position: optional parts, counted ranges and alternations multiply, so this is 2^8. */
export const WAYS_CAP = 256;
/** The same bound for a pattern that also holds an unbounded quantifier, which multiplies it by the length of the line. */
export const WAYS_CAP_UNBOUNDED = 4;
/**
 * A line longer than this is not searched by a pattern with an unbounded quantifier (`*`, `+`, `{n,}`): that quantifier can rescan
 * the rest of the line from every start, so a line costs up to the square of its length. A pattern without one costs at most its own
 * fixed bound per character, so it is run over a line of any length.
 */
export const LINE_CAP = 2000;

export interface PatternShape {
  /** Why the pattern is refused, in words that follow "its pattern is refused: "; undefined when it is accepted. */
  problem?: string;
  /** Whether the pattern holds an unbounded quantifier, so a line over LINE_CAP is not run through it. */
  unbounded: boolean;
}

/** What a stretch of pattern text holds, for the rules that look inside a group. */
interface Part {
  ways: number; // how many ways it can match at one position
  quantified: boolean; // holds a quantifier at any depth
  alternated: boolean; // has more than one alternative at its own level
  grouped: boolean; // holds a group at any depth
}

class Refused extends Error {}

const COUNT = /^\{(\d+)(?:(,)(\d*))?\}/;

/**
 * Whether a pattern is cheap to run, decided from its text alone, and whether it holds an unbounded quantifier. The caller has
 * already compiled it, so its syntax is valid. Refused: a pattern over PATTERN_CAP characters; a backreference or a lookaround;
 * a repeated group (`*`, `+`, or a count above 1) that holds a quantifier, an alternation or another group, which is how
 * `(a+)+` and `(a|aa)+` backtrack exponentially; more than one unbounded quantifier, which is how `.*.*x` costs a power of the
 * line length; a counted range over RANGE_CAP; and a pattern that can match in more than WAYS_CAP ways at one position (more than
 * WAYS_CAP_UNBOUNDED beside an unbounded quantifier), which is how `a?a?a?a?a?a?a?a?a?x` and `(a|a)(a|a)(a|a)...x` backtrack.
 */
export function patternShape(pattern: string): PatternShape {
  if (pattern.length > PATTERN_CAP) return { problem: 'it is ' + pattern.length + ' characters, over the ' + PATTERN_CAP + '-character limit', unbounded: false };
  let i = 0;
  let unbounded = 0;

  const after = (ch: string): number => {
    const at = pattern.indexOf(ch, i);
    return at < 0 ? pattern.length : at + 1;
  };

  const alternatives = (): Part => {
    const branches: number[] = [];
    let ways = 1;
    let quantified = false;
    let grouped = false;
    for (;;) {
      const c = pattern[i];
      if (c === undefined || c === ')') break;
      if (c === '|') {
        branches.push(ways);
        ways = 1;
        i++;
        continue;
      }
      let inner: Part | undefined; // set when the atom is a group
      if (c === '\\') {
        const n = pattern[i + 1] ?? '';
        if ((n >= '1' && n <= '9') || n === 'k') throw new Refused('a backreference');
        i += 2;
      } else if (c === '[') {
        let j = i + 1;
        if (pattern[j] === '^') j++;
        while (j < pattern.length && pattern[j] !== ']') j += pattern[j] === '\\' ? 2 : 1;
        i = j + 1;
      } else if (c === '(') {
        if (/^\(\?<?[=!]/.test(pattern.slice(i, i + 4))) throw new Refused('a lookaround');
        // `(?:`, `(?<name>` and a plain `(` open a group; the head is skipped so the inside reads as a pattern
        i = pattern.startsWith('(?<', i) ? after('>') : pattern.startsWith('(?', i) ? after(':') : i + 1;
        inner = alternatives();
        i++; // the closing paren
        grouped = true;
        if (inner.quantified) quantified = true;
      } else {
        i++;
      }

      let min = 1;
      let max = 1;
      let open = false;
      let used = 0;
      const q = pattern[i];
      if (q === '*') [min, open, used] = [0, true, 1];
      else if (q === '+') [min, open, used] = [1, true, 1];
      else if (q === '?') [min, max, used] = [0, 1, 1];
      else if (q === '{') {
        const m = COUNT.exec(pattern.slice(i));
        if (m !== null) {
          const low = Number(m[1]);
          const high = m[2] === undefined ? low : m[3] === '' ? undefined : Number(m[3]);
          if (low > RANGE_CAP || (high !== undefined && high > RANGE_CAP)) throw new Refused('a counted range over ' + RANGE_CAP);
          used = m[0].length;
          min = low;
          if (high === undefined) open = true;
          else max = high;
        }
      }
      const base = inner?.ways ?? 1;
      if (used === 0) {
        ways *= base;
      } else {
        i += used;
        if (pattern[i] === '?') i++; // lazy
        quantified = true;
        if (inner !== undefined && (open || max > 1)) {
          // a repeated group is cheap only when its inside is plain atoms: anything else backtracks exponentially
          if (inner.quantified) throw new Refused('a quantifier sits inside a quantified group');
          if (inner.alternated) throw new Refused('an alternation sits inside a quantified group');
          if (inner.grouped) throw new Refused('a group sits inside a quantified group');
        }
        if (open) {
          unbounded++;
          if (unbounded > 1) throw new Refused('more than one unbounded quantifier (* + or {n,})');
          ways *= base;
        } else if (max > 1) ways *= base * (max - min + 1);
        else if (max === 1 && min === 0) ways *= base + 1;
        else if (max === 1) ways *= base;
      }
      if (ways > WAYS_CAP) throw new Refused('it can match in more than ' + WAYS_CAP + ' ways');
    }
    branches.push(ways);
    return { ways: branches.reduce((a, b) => a + b, 0), quantified, alternated: branches.length > 1, grouped };
  };

  try {
    const whole = alternatives();
    if (unbounded > 0 && whole.ways > WAYS_CAP_UNBOUNDED) throw new Refused('it can match in more than ' + WAYS_CAP_UNBOUNDED + ' ways beside its unbounded quantifier');
  } catch (err) {
    if (err instanceof Refused) return { problem: err.message, unbounded: unbounded > 0 };
    throw err;
  }
  return { unbounded: unbounded > 0 };
}
