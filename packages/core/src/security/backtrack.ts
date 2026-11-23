// 8-ac-3 (D-07): a static check for a team line pattern that can backtrack catastrophically in V8. Pure text in, a reason out; no import, no worker thread, no time limit, no dependency.
// Model: a position automaton, one position per character-set atom, whose follow edges COUNT the distinct structural routes (capped at 2) from one position to the next; lookarounds are
// side branches. A loop is a strongly connected part of the position graph.

type Range = [number, number];
type CharSet = Range[];
type Tree =
  | { kind: 'set'; set: CharSet }
  | { kind: 'assert' }
  | { kind: 'look'; inner: Tree }
  | { kind: 'group'; inner: Tree }
  | { kind: 'alt'; branches: Tree[] }
  | { kind: 'seq'; items: Tree[] }
  | { kind: 'q'; atom: Tree; min: number; max: number };

const MAX = 0xffff;
const K = 4; // an exact count up to K is written out
const CAP_POSITIONS = 4000;
const CAP_SCC_EDGES = 1024; // inside edges of a loop that needs a pair graph
const CAP_FOLLOW = 50000;
const CAP_LOOPS = 64;
const MAX_WAYS = 16; // most routes that may reach one position after reading one text

// ---------- character sets: sorted, merged [lo, hi] ranges over code units
const norm = (rs: CharSet): CharSet => {
  const sorted = rs.filter(([a, b]) => a <= b).sort((x, y) => x[0] - y[0]);
  const out: CharSet = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last !== undefined && a <= last[1] + 1) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
};
const comp = (rs: CharSet): CharSet => {
  const out: CharSet = [];
  let lo = 0;
  for (const [a, b] of norm(rs)) {
    if (a > lo) out.push([lo, a - 1]);
    lo = b + 1;
  }
  if (lo <= MAX) out.push([lo, MAX]);
  return out;
};
/** Do two sets share a character? */
const meet = (x: CharSet, y: CharSet): boolean => {
  let i = 0;
  let j = 0;
  while (i < x.length && j < y.length) {
    if (x[i][1] < y[j][0]) i++;
    else if (y[j][1] < x[i][0]) j++;
    else return true;
  }
  return false;
};
const inter = (x: CharSet, y: CharSet): CharSet => {
  const out: CharSet = [];
  for (const [a, b] of x) for (const [c, d] of y) if (Math.max(a, c) <= Math.min(b, d)) out.push([Math.max(a, c), Math.min(b, d)]);
  return norm(out);
};
const ch = (c: number): CharSet => [[c, c]];
const DIGIT: CharSet = [[48, 57]];
const WORD: CharSet = [[48, 57], [65, 90], [95, 95], [97, 122]];
const SPACE: CharSet = norm([[9, 13], [32, 32], [0xa0, 0xa0], [0x1680, 0x1680], [0x2000, 0x200a], [0x2028, 0x2029], [0x202f, 0x202f], [0x205f, 0x205f], [0x3000, 0x3000], [0xfeff, 0xfeff]]);
const DOT: CharSet = comp([[10, 10], [13, 13], [0x2028, 0x2029]]);
const ANY: CharSet = [[0, MAX]];

/** The flag `i` folds letter case into a set. A large range above the ASCII letters is widened to everything above 127 (an over-approximation). */
const fold = (rs: CharSet): CharSet => {
  const add: CharSet = [];
  for (const [a, b] of rs) {
    for (const [lo, hi, d] of [[65, 90, 32], [97, 122, -32]]) {
      const x = Math.max(a, lo);
      const y = Math.min(b, hi);
      if (x <= y) add.push([x + d, y + d]);
    }
    const x = Math.max(a, 128);
    if (x <= b) {
      if (b - x > 256) add.push([128, MAX]);
      else {
        for (let c = x; c <= b; c++) {
          for (const t of [String.fromCharCode(c).toLowerCase(), String.fromCharCode(c).toUpperCase()]) {
            if (t.length === 1) add.push([t.charCodeAt(0), t.charCodeAt(0)]);
          }
        }
      }
    }
  }
  return norm([...rs, ...add]);
};

// ---------- parser (non-unicode syntax with its Annex B leniency; the source has already compiled)
class Refuse extends Error {}

function parse(src: string): Tree {
  let i = 0;
  const named = /\(\?<(?![=!])/.test(src);
  const escapeAtom = (inClass: boolean): { set?: CharSet; assert?: true } => {
    const c = src[i++];
    if (c === undefined) return { set: ch(92) };
    if (c === 'd') return { set: DIGIT };
    if (c === 'D') return { set: comp(DIGIT) };
    if (c === 'w') return { set: WORD };
    if (c === 'W') return { set: comp(WORD) };
    if (c === 's') return { set: SPACE };
    if (c === 'S') return { set: comp(SPACE) };
    if (c === 'b') return inClass ? { set: ch(8) } : { assert: true };
    if (c === 'B') return inClass ? { set: ch(66) } : { assert: true };
    if (!inClass && /[1-9]/.test(c)) throw new Refuse('backreference');
    if (!inClass && c === 'k' && named) throw new Refuse('backreference');
    if (c === 'n') return { set: ch(10) };
    if (c === 'r') return { set: ch(13) };
    if (c === 't') return { set: ch(9) };
    if (c === 'v') return { set: ch(11) };
    if (c === 'f') return { set: ch(12) };
    if (c === 'x' && /^[0-9a-fA-F]{2}/.test(src.slice(i))) {
      const v = parseInt(src.slice(i, i + 2), 16);
      i += 2;
      return { set: ch(v) };
    }
    if (c === 'u' && /^[0-9a-fA-F]{4}/.test(src.slice(i))) {
      const v = parseInt(src.slice(i, i + 4), 16);
      i += 4;
      return { set: ch(v) };
    }
    if (c === '0' || c === 'c' || /[0-9]/.test(c)) {
      if (c === 'c' && /[a-zA-Z]/.test(src[i] ?? '')) i++;
      return { set: ANY }; // an octal escape or \c: over-approximated
    }
    return { set: ch(c.charCodeAt(0)) };
  };
  const single = (s: CharSet): boolean => s.length === 1 && s[0][0] === s[0][1];
  const classAtom = (): { set: CharSet } => {
    let neg = false;
    if (src[i] === '^') {
      neg = true;
      i++;
    }
    const parts: CharSet = [];
    const member = (): CharSet => {
      if (src[i] === '\\') {
        i++;
        return escapeAtom(true).set ?? [];
      }
      return ch(src.charCodeAt(i++));
    };
    while (i < src.length && src[i] !== ']') {
      const a = member();
      if (src[i] === '-' && src[i + 1] !== undefined && src[i + 1] !== ']' && single(a)) {
        i++;
        const b = member();
        if (single(b)) parts.push([a[0][0], b[0][0]]);
        else parts.push(...a, [45, 45], ...b);
      } else parts.push(...a);
    }
    i++; // ]
    const set = norm(parts);
    return { set: neg ? comp(set) : set };
  };
  const quant = (): [number, number] | undefined => {
    const c = src[i];
    let q: [number, number];
    if (c === '*') q = [0, Infinity];
    else if (c === '+') q = [1, Infinity];
    else if (c === '?') q = [0, 1];
    else if (c === '{') {
      const m = /^\{(\d+)(?:(,)(\d*))?\}/.exec(src.slice(i));
      if (m === null) return undefined;
      const lo = Number(m[1]);
      const hi = m[2] === undefined ? lo : m[3] === '' ? Infinity : Number(m[3]);
      i += m[0].length - 1;
      q = [lo, hi];
    } else return undefined;
    i++;
    if (src[i] === '?') i++; // lazy
    return q;
  };
  const alt = (): Tree => {
    const branches = [seq()];
    while (src[i] === '|') {
      i++;
      branches.push(seq());
    }
    return { kind: 'alt', branches };
  };
  const seq = (): Tree => {
    const items: Tree[] = [];
    while (i < src.length && src[i] !== '|' && src[i] !== ')') {
      let atom: Tree;
      const c = src[i];
      if (c === '(') {
        i++;
        let look = false;
        if (src.startsWith('?:', i)) i += 2;
        else if (src.startsWith('?=', i) || src.startsWith('?!', i)) {
          i += 2;
          look = true;
        } else if (src.startsWith('?<=', i) || src.startsWith('?<!', i)) {
          i += 3;
          look = true;
        } else if (src.startsWith('?<', i)) i = src.indexOf('>', i) + 1;
        else if (src[i] === '?') throw new Refuse('syntax'); // a modifier group such as (?i:...) is not read here, so it is not judged: refuse it
        const inner = alt();
        i++; // )
        atom = look ? { kind: 'look', inner } : { kind: 'group', inner };
      } else if (c === '[') {
        i++;
        atom = { kind: 'set', ...classAtom() };
      } else if (c === '.') {
        i++;
        atom = { kind: 'set', set: DOT };
      } else if (c === '^' || c === '$') {
        i++;
        atom = { kind: 'assert' };
      } else if (c === '\\') {
        i++;
        const e = escapeAtom(false);
        atom = e.set === undefined ? { kind: 'assert' } : { kind: 'set', set: e.set };
      } else {
        i++;
        atom = { kind: 'set', set: ch(c.charCodeAt(0)) };
      }
      const q = quant();
      items.push(q === undefined ? atom : { kind: 'q', atom, min: q[0], max: q[1] });
    }
    return { kind: 'seq', items };
  };
  return alt();
}

// ---------- the position automaton with route counts
interface Piece {
  first: Map<number, number>;
  last: Map<number, number>;
  nul: number;
}
interface Automaton {
  sets: CharSet[];
  follow: Map<number, number>[];
  start: Map<number, number>;
}

function build(tree: Tree, ignoreCase: boolean): Automaton {
  const sets: CharSet[] = [];
  const follow: Map<number, number>[] = [];
  let entries = 0;
  const add = (m: Map<number, number>, k: number, v: number): void => {
    if (!m.has(k) && ++entries > CAP_FOLLOW) throw new Refuse('size');
    m.set(k, Math.min(2, (m.get(k) ?? 0) + v));
  };
  const pos = (set: CharSet): number => {
    if (sets.length >= CAP_POSITIONS) throw new Refuse('size');
    sets.push(ignoreCase ? fold(set) : set);
    follow.push(new Map());
    return sets.length - 1;
  };
  const eps = (): Piece => ({ first: new Map(), last: new Map(), nul: 1 });
  const cat = (a: Piece, b: Piece): Piece => {
    for (const [p, m] of a.last) for (const [q, c] of b.first) add(follow[p], q, m * c);
    const first = new Map(a.first);
    if (a.nul > 0) for (const [q, c] of b.first) add(first, q, a.nul * c);
    const last = new Map(b.last);
    if (b.nul > 0) for (const [p, m] of a.last) add(last, p, b.nul * m);
    return { first, last, nul: Math.min(2, a.nul * b.nul) };
  };
  // An iteration that matches nothing is rejected once the minimum is met, but the mandatory ones may be empty: a body that can match nothing adds routes at the entry
  // (min >= 1) and on the back edge (min >= 2).
  const loop = (atom: Tree, min: number): Piece => {
    const r = node(atom);
    const back = r.nul > 0 && min >= 2 ? 2 : 1;
    for (const [p, m] of r.last) for (const [q, c] of r.first) add(follow[p], q, m * c * back);
    const first = new Map(r.first);
    if (r.nul > 0 && min >= 1) for (const q of first.keys()) first.set(q, 2);
    return { first, last: r.last, nul: min === 0 ? 1 : r.nul };
  };
  const node = (n: Tree): Piece => {
    switch (n.kind) {
      case 'set': {
        const p = pos(n.set);
        return { first: new Map([[p, 1]]), last: new Map([[p, 1]]), nul: 0 };
      }
      case 'assert':
        return eps();
      case 'look': {
        // the inside hangs off as a side branch: edges go in and none come out
        const r = node(n.inner);
        return { first: r.first, last: new Map(), nul: 1 };
      }
      case 'group':
        return node(n.inner);
      case 'alt': {
        const first = new Map<number, number>();
        const last = new Map<number, number>();
        let nul = 0;
        for (const b of n.branches) {
          const r = node(b);
          for (const [q, c] of r.first) add(first, q, c);
          for (const [q, c] of r.last) add(last, q, c);
          nul = Math.min(2, nul + r.nul);
        }
        return { first, last, nul };
      }
      case 'seq':
        return n.items.reduce((acc, it) => cat(acc, node(it)), eps());
      case 'q': {
        const { atom, min, max } = n;
        if (atom.kind === 'assert' || atom.kind === 'look') return node(atom);
        if (max === 0) return eps();
        if (min === 0 && max === 1) {
          const r = node(atom);
          return { first: r.first, last: r.last, nul: 1 };
        }
        if (min === max) {
          if (min <= K) {
            let acc = node(atom);
            for (let k = 1; k < min; k++) acc = cat(acc, node(atom));
            return acc;
          }
          return cat(node(atom), loop(atom, min - 1));
        }
        return loop(atom, min);
      }
    }
  };
  const top = node(tree);
  return { sets, follow, start: top.first };
}

/** Strongly connected parts of a graph (Tarjan, iterative), in reverse topological order: sinks first. */
function tarjan(count: number, next: (v: number) => number[]): number[][] {
  const index = new Array<number>(count).fill(-1);
  const low = new Array<number>(count).fill(0);
  const on = new Array<boolean>(count).fill(false);
  const stack: number[] = [];
  const comps: number[][] = [];
  let idx = 0;
  for (let s = 0; s < count; s++) {
    if (index[s] !== -1) continue;
    const work: [number, number, number[]][] = [[s, 0, next(s)]];
    index[s] = low[s] = idx++;
    stack.push(s);
    on[s] = true;
    while (work.length > 0) {
      const top = work[work.length - 1];
      const v = top[0];
      const ns = top[2];
      if (top[1] < ns.length) {
        const w = ns[top[1]++];
        if (index[w] === -1) {
          index[w] = low[w] = idx++;
          stack.push(w);
          on[w] = true;
          work.push([w, 0, next(w)]);
        } else if (on[w]) low[v] = Math.min(low[v], index[w]);
      } else {
        work.pop();
        if (work.length > 0) {
          const parent = work[work.length - 1][0];
          low[parent] = Math.min(low[parent], low[v]);
        }
        if (low[v] === index[v]) {
          const members: number[] = [];
          let w: number;
          do {
            w = stack.pop() as number;
            on[w] = false;
            members.push(w);
          } while (w !== v);
          comps.push(members);
        }
      }
    }
  }
  return comps;
}

const BACKREFERENCE_REASON =
  'a backreference (\\1..\\9 or \\k<name>) can take exponential time; rewrite it without one, writing out each choice, as "[^"]*"|\'[^\']*\' for a quoted string or <(\\w+)>.*</\\w+> for a tag pair ' +
  '(an octal escape such as \\1 with no group reads the same way: write \\x01)';
const SYNTAX_REASON =
  'a group with modifiers such as (?i:...) is not read by the slow-match check, so it cannot be judged; give the whole pattern the i flag, or write it without the modifier group';
const SIZE_REASON = 'it is too large to check for slow matching; split it into smaller patterns';
const EXPONENTIAL_REASON =
  'a repeated part can match the same text in more than one way, so a failing line can take exponential time; give each repeat one way to match (a+ for (a+)+, a* for (a|a)*, (?:ab?)* for (a?b?)*)';
const WAYS_REASON =
  'it can reach one place by more than 16 routes that read the same text (optional parts or alternatives in a row that can match alike, such as a?a?a?a?a? or (a|a)(a|a)(a|a)(a|a)(a|a)), so one line can take very long; make each choice match different text';
const CHAIN_REASON =
  'three or more repeats in a row can match the same text, so a long line can take minutes; merge them into one repeat (\\d{3,9} for \\d{1,3}\\d{1,3}\\d{1,3}), drop a leading or trailing .* ' +
  '(it adds nothing to whether a line matches), or put text between them that they cannot match';

/**
 * Why a line regex can backtrack catastrophically, with how to rewrite it; undefined when the guard finds nothing. `source` has already compiled, `flags` is '' or 'i'.
 * Not a proof: it refuses every shape measured exponential in V8 and every run of three overlapping repeats, and accepts every default and every pattern measured linear.
 * What it accepts is at most two overlapping repeats in a row and at most 16 routes, which the scan bounds per changed line (SCAN_LINE_LIMIT).
 * Every caller must bound the text the same way: the commit rule fails a first line over SCAN_LINE_LIMIT before it matches (commits/rule.ts).
 */
export function backtrackProblem(source: string, flags: string): string | undefined {
  return check(source, flags);
}

/**
 * Phase 08.8 D-12: how many repeats in a row of an ACCEPTED pattern can match the same text: 2 for `.*a.*b` and `a*a*b`, 1 for one repeat, 0 for none. The scans give a pattern with two a budget
 * of total cost per package (SCAN_OVERLAP_BUDGET), because its cost on one line grows with the square of the line's length. It is the longest run the chain check below computes. A pattern the guard
 * refuses never reaches a scan, so it counts 0 here, and so does one that does not parse: this never throws.
 */
export function overlapRepeats(source: string, flags: string): number {
  const seen = { chain: 0 };
  try {
    if (check(source, flags, seen) !== undefined) return 0;
  } catch {
    return 0;
  }
  return seen.chain;
}

function check(source: string, flags: string, seen?: { chain: number }): string | undefined {
  let auto: Automaton;
  try {
    auto = build(parse(source), flags.includes('i'));
  } catch (e) {
    if (e instanceof Refuse) return e.message === 'backreference' ? BACKREFERENCE_REASON : e.message === 'syntax' ? SYNTAX_REASON : SIZE_REASON;
    throw e;
  }
  const { sets, follow, start } = auto;
  const n = sets.length;
  // do two different positions' sets share a character? sort and sweep over the ranges
  const overlapAny = (qs: number[]): boolean => {
    const rs: [number, number, number][] = [];
    for (const q of qs) for (const [lo, hi] of sets[q]) rs.push([lo, hi, q]);
    rs.sort((x, y) => x[0] - y[0]);
    let maxHi = -1;
    let owner = -1;
    for (const [lo, hi, q] of rs) {
      if (lo <= maxHi && owner !== q) return true;
      if (hi > maxHi) {
        maxHi = hi;
        owner = q;
      }
    }
    return false;
  };
  const comps = tarjan(n, (p) => [...follow[p].keys()]);
  const compOf = new Array<number>(n);
  comps.forEach((c, k) => c.forEach((p) => (compOf[p] = k)));
  const cyclic = comps.map((c, k) => ({ c, k })).filter(({ c }) => c.length > 1 || follow[c[0]].has(c[0]));
  if (cyclic.length > CAP_LOOPS) return SIZE_REASON;

  // (2) exponential: two ways through one loop. Two routes from one position to the same position of the loop, or, in the loop's pair graph, one strongly connected part holding both
  // a pair (p, p) and a pair (p, q) with p and q different.
  for (const { c, k } of cyclic) {
    let deterministic = true;
    let edges = 0;
    for (const p of c) {
      const inside = [...follow[p]].filter(([q]) => compOf[q] === k);
      edges += inside.length;
      if (inside.some(([, count]) => count >= 2)) return EXPONENTIAL_REASON;
      if (deterministic && overlapAny(inside.map(([q]) => q))) deterministic = false;
    }
    if (deterministic) continue;
    if (edges > CAP_SCC_EDGES) return SIZE_REASON;
    const index = new Map(c.map((p, j) => [p, j] as const));
    const m = c.length;
    const insideNext = c.map((p) => [...follow[p].keys()].filter((q) => compOf[q] === k).map((q) => index.get(q) as number));
    const pairNext = (v: number): number[] => {
      const a = Math.floor(v / m);
      const b = v % m;
      const out: number[] = [];
      for (const x of insideNext[a]) for (const y of insideNext[b]) if (meet(sets[c[x]], sets[c[y]])) out.push(x * m + y);
      return out;
    };
    // only the pairs reachable from the diagonal matter
    const seen = new Set<number>();
    const queue: number[] = [];
    for (let j = 0; j < m; j++) {
      seen.add(j * m + j);
      queue.push(j * m + j);
    }
    while (queue.length > 0) {
      for (const w of pairNext(queue.pop() as number)) {
        if (!seen.has(w)) {
          seen.add(w);
          queue.push(w);
        }
      }
    }
    const nodes = [...seen];
    const at = new Map(nodes.map((v, j) => [v, j] as const));
    for (const part of tarjan(nodes.length, (j) => pairNext(nodes[j]).map((w) => at.get(w) as number))) {
      const vs = part.map((j) => nodes[j]);
      const diagonal = vs.some((v) => Math.floor(v / m) === v % m);
      const off = vs.some((v) => Math.floor(v / m) !== v % m);
      if (diagonal && off) return EXPONENTIAL_REASON;
    }
  }

  // (4) finite but large: how many routes can reach one position after reading the same text. Routes into q come from predecessors that read the same previous character, so only
  // predecessors whose sets share a character add up (an over-count).
  const heaviest = (weighted: [number, number][]): number => {
    const events: [number, number][] = [];
    for (const [p, weight] of weighted) for (const [lo, hi] of sets[p]) events.push([lo, weight], [hi + 1, -weight]);
    events.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    let current = 0;
    let best = 0;
    for (const [, delta] of events) best = Math.max(best, (current += delta));
    return best;
  };
  // In a loop that passed (2), routes that entered at different positions never meet again, so the loop carries the largest count of any one of its entry positions.
  const into: [number, number][][] = Array.from({ length: n }, () => []);
  for (let p = 0; p < n; p++) for (const [q, count] of follow[p]) if (compOf[q] !== compOf[p]) into[q].push([p, count]);
  const ways = new Array<number>(comps.length).fill(0);
  let most = 1;
  for (let k = comps.length - 1; k >= 0; k--) {
    let w = 0;
    for (const q of comps[k]) {
      const fromPredecessors = heaviest(into[q].map(([p, count]) => [p, ways[compOf[p]] * count]));
      w = Math.max(w, start.get(q) ?? 0, fromPredecessors);
    }
    ways[k] = Math.min(1e9, w);
    most = Math.max(most, ways[k]);
  }
  if (most > MAX_WAYS) return WAYS_REASON;

  // (3) polynomial: a run of three loops that can pump the same characters. Loop S comes before loop T, X is what both can read, and S chains to T when T is reachable from S
  // through positions whose sets meet X.
  const charsOf = (c: number[]): CharSet => norm(c.flatMap((p) => sets[p]));
  const loops = cyclic.map(({ c, k }) => ({ k, chars: charsOf(c), members: c }));
  const chainable = (s: { k: number; members: number[]; chars: CharSet }, t: { k: number; chars: CharSet }): boolean => {
    const x = inter(s.chars, t.chars);
    if (x.length === 0) return false;
    const seen = new Set(s.members);
    const queue = [...s.members];
    while (queue.length > 0) {
      const p = queue.pop() as number;
      for (const q of follow[p].keys()) {
        if (seen.has(q)) continue;
        if (compOf[q] === t.k) return true;
        if (compOf[q] === s.k || meet(sets[q], x)) {
          seen.add(q);
          queue.push(q);
        }
      }
    }
    return false;
  };
  // components come in reverse topological order: a larger k is earlier in the pattern
  const order = [...loops].sort((a, b) => b.k - a.k);
  const run = new Map<number, number>();
  for (const t of order) {
    let best = 1;
    for (const s of order) {
      if (s === t || s.k <= t.k) continue;
      if (chainable(s, t)) best = Math.max(best, (run.get(s.k) ?? 1) + 1);
    }
    run.set(t.k, best);
    if (seen !== undefined) seen.chain = Math.max(seen.chain, best);
    if (best >= 3) return CHAIN_REASON;
  }
  return undefined;
}
