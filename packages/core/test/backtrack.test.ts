// 8-ac-3 (D-07): the static guard `backtrackProblem(source, flags)` refuses a team line pattern that can backtrack catastrophically. Every test asserts only the guard's verdict:
// a refused regex is never run on any input here (a hang would be the failure the guard exists to prevent).
import { expect, it } from 'vitest';
import { parseSecurityFile, securityTriggers } from '../src/index.js';
import { WAYS_REASON, backtrackProblem, overlapRepeats } from '../src/security/backtrack.js';

const r = String.raw;

// the four default line patterns (templates/security.md) and the 0.8.0 built-path source
const SPAWN = r`\b(spawn|spawnSync|exec|execSync|execFile|execFileSync|fork|child_process|subprocess|Popen|os\.system)\b`;
const FILE_WRITE = r`\b(writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream|rmSync|rmdirSync|unlink|unlinkSync|rename|renameSync|copyFile|copyFileSync|symlink|symlinkSync)\b`;
const SECRET = r`\b(secrets?|tokens?|passwords?|passwd|api[_-]?keys?|credentials?|private[_-]?keys?|auth|authn|authz|authenticat\w*|authori[sz]\w*)\b`;
const OLD_BUILT = r`\b(join|resolve|normalize)\s*\(.*\b(input|argv|args?|params?|query|body|req|request)\b`;

it('risk:security the guard refuses two routes through one loop and a backreference (8-ac-3)', () => {
  for (const source of [r`(a+)+$`, r`(a*)*`, r`(?:a+)+`, r`(a|b+)*`, r`^(\w+\s?)*$`, r`(a{1,3})+`, r`(a+){2,}`, r`(a+)\1`, r`(?<n>a+)\k<n>`]) {
    expect(backtrackProblem(source, ''), source).toEqual(expect.any(String));
  }
});

it('risk:security the guard accepts the defaults and the safe research sources (8-ac-3)', () => {
  for (const source of [SPAWN, FILE_WRITE, OLD_BUILT, r`\b(foo|bar)\b`, r`(ab)+`, r`(a+)?`, r`a+b+`, r`[(a+)+]`, r`\(a+\)+`, r`(a{2})+`, r`(?:x\s*y)`, r`(?=a+)b`]) {
    expect(backtrackProblem(source, ''), source).toBeUndefined();
  }
  expect(backtrackProblem(SECRET, 'i')).toBeUndefined();
});

// ---- the corpora of the whole guard (08-08 Task 2): every shape measured exponential or high-degree polynomial in V8 at planning, and what must stay readable ----
const NEW_BUILT = r`^(?:(?!\b(?:join|resolve|normalize)\s*\()[^])*\b(?:join|resolve|normalize)\s*\([^]*\b(?:input|argv|args?|params?|query|body|req|request)\b`;

const refuse: string[] = [
  // the research corpus
  r`(a+)+$`, r`(a*)*`, r`(?:a+)+`, r`(a|b+)*`, r`(.*a){20}`, r`(a+)\1`, r`^(\w+\s?)*$`, r`(x+x+)+y`,
  r`(a{1,3})+`, r`(?<n>a+)\k<n>`, r`(a+){2,}`,
  // measured exponential: alternatives that overlap under a repeat, optional parts under a repeat, and their siblings
  r`(a|a)*$`, r`(?:a|a)*$`, r`(a|a)+$`, r`(a|aa)+$`, r`(a*)*$`, r`(.*a){20}$`, r`(\w+\s?)*$`,
  r`(a?a?)*$`, r`(a?b?)*$`, r`(\w|\d)+$`, r`(a|b|ab)*$`, r`(\s|.)*x`, r`(?=(a|a)*$)`, r`(a|a){2,}$`,
  r`(a|a){1,50}$`, r`(.*a){5}$`, r`(.*a){10}$`, r`(.*a){3}$`,
  // measured high-degree polynomial: a run of three overlapping repeats
  r`a+a+a+$`, r`a*a*a*$`, r`.*.*.*=`, r`a+a+a+a+a+a+a+a+$`, 'a+'.repeat(20) + '$', '(?:a|b)+'.repeat(20) + '$',
  'a*'.repeat(20) + '$', '.*'.repeat(20) + '=', r`(?:(?=.*a.*b)c)*`,
];
const refuseI: [string, string][] = [[r`(A|a)*$`, 'i']];

const accept: string[] = [
  // the research's safe sources, the defaults, and the built-path source of 0.8.0 with the linear one that replaces it
  r`\b(foo|bar)\b`, r`(ab)+`, r`(a+)?`, r`a+b+`, r`[(a+)+]`, r`\(a+\)+`, r`(a{2})+`, r`(?:x\s*y)`, r`(?=a+)b`,
  SPAWN, FILE_WRITE, NEW_BUILT, OLD_BUILT,
  // measured linear
  r`(ab|a)*$`, r`(ab|ac)+$`, r`(\w\s?)*$`, r`(a\s*)+$`, r`(a|a){2}$`, r`((a+)b)+`, r`a+a+$`, r`.*.*=`,
  r`\w+\s*=\s*\w+$`, r`^a+$`,
  // realistic hand-written security patterns
  r`\beval\s*\(`, r`\bnew\s+Function\s*\(`, r`\bdangerouslySetInnerHTML\b`, r`\.innerHTML\s*=`,
  r`password\s*[:=]\s*['"][^'"]+['"]`, r`\bAKIA[0-9A-Z]{16}\b`, r`-----BEGIN [A-Z ]+PRIVATE KEY-----`,
  r`https?:\/\/[^\s\/]+`, r`(?:\.\.[\\\/])+`, r`\bchild_process\b.*\bexec\b`, r`\b(?:md5|sha1)\s*\(`,
  r`(?:\\x[0-9a-fA-F]{2})+`, r`(?:\\x[0-9a-f]{2}|\\u[0-9a-f]{4})+`, r`\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b`,
  r`\bsql\s*\+\s*\w+`, r`\bSELECT\b.*\bFROM\b.*\+`, r`\b(?:GET|POST|PUT|DELETE)\s+\/\S*`, r`process\.env\.[A-Z_]+`,
  r`\brequire\(\s*['"]child_process['"]\s*\)`, r`\bfs\.(?:write|append)\w*\(`, r`\bexec(?:Sync)?\s*\(\s*` + '`',
  r`\b(?:curl|wget)\s+[^|]*\|\s*(?:sh|bash)\b`, r`\bchmod\s+[0-7]{3,4}\b`, r`(?:^|\s)sudo\s`,
  r`\b(?:TODO|FIXME)\b.*\bsecurity\b`, r`([0-9a-f]{2})+`, r`\bsetTimeout\s*\(\s*['"]`, r`\$\{[^}]*\}`,
];
const acceptI: [string, string][] = [[SECRET, 'i'], [r`\bpassword\b`, 'i']];

// loop-free blowups, exponential in the pattern's length: more than 16 routes for one text; and the small cases that stay
const manyRoutes: string[] = ['(?:a|a)'.repeat(20) + '$', '(?:a|a)'.repeat(24) + '$', 'a?'.repeat(30) + '$', 'a?'.repeat(20) + 'a'.repeat(20) + '$', r`(a?){30}$`, r`(a?){20}a{20}$`];
const fewRoutes: string[] = ['(?:a|a)'.repeat(4) + '$', r`a?a?a?$`, r`(a?){3}$`];

const alternatives = (k: number, at: (j: number) => string): string => Array.from({ length: k }, (_, j) => at(j)).join('|');
const compiles = (source: string, flags = ''): void => {
  // a source that does not compile would be refused for the wrong reason; compiling runs nothing
  expect(() => new RegExp(source, flags), source).not.toThrow();
};

it('risk:security the guard refuses every shape measured exponential and every run of three overlapping repeats (8-ac-3)', () => {
  expect(refuse.length + refuseI.length).toBe(39);
  for (const source of refuse) {
    compiles(source);
    expect(backtrackProblem(source, ''), source).toEqual(expect.any(String));
  }
  for (const [source, flags] of refuseI) {
    compiles(source, flags);
    expect(backtrackProblem(source, flags), source).toEqual(expect.any(String));
  }
});

it('risk:security the guard refuses more than 16 routes for one text and keeps small choices (8-ac-3)', () => {
  for (const source of manyRoutes) {
    compiles(source);
    expect(backtrackProblem(source, ''), source).toEqual(expect.any(String));
  }
  for (const source of fewRoutes) {
    compiles(source);
    expect(backtrackProblem(source, ''), source).toBeUndefined();
  }
});

it('risk:security the guard accepts the defaults and realistic hand-written patterns (8-ac-3)', () => {
  expect(accept.length + acceptI.length).toBe(53);
  for (const source of accept) {
    compiles(source);
    expect(backtrackProblem(source, ''), source).toBeUndefined();
  }
  for (const [source, flags] of acceptI) {
    compiles(source, flags);
    expect(backtrackProblem(source, flags), source).toBeUndefined();
  }
});

it('risk:security the guard refuses a pattern too large to check and says to split it (8-ac-3)', () => {
  const tooLarge = [
    // 999 alternatives under a repeat make about a million follow entries, far over the 50,000 cap; 300 loops are over the 64-loop cap
    '(?:' + alternatives(999, (j) => String.fromCharCode(0x100 + j)) + ')*',
    r`\d*\s`.repeat(300),
  ];
  for (const source of tooLarge) {
    compiles(source);
    expect(backtrackProblem(source, ''), source.slice(0, 30)).toContain('split it into smaller patterns');
  }
});

it('risk:resource the guard itself stays fast on long patterns (8-ac-3)', () => {
  const long: [string, string][] = [
    ['big alternation', r`\b(?:` + alternatives(180, (j) => 'w' + j.toString(36) + 'x') + r`)\b`],
    ['big repeated alternation', '(?:' + alternatives(400, (j) => String.fromCharCode(0x100 + j)) + ')*'],
    ['many loops', r`\d*\s`.repeat(300)],
    ['nested exact counts', '((((((a{4}){4}){4}){4}){4}){4})'],
    ['overlap big loop', '(?:' + alternatives(300, () => 'ab') + ')*'],
    ['1000 one-character alternatives under *', '(?:' + alternatives(999, (j) => String.fromCharCode(0x100 + j)) + ')*'],
    ['60 identical alternatives under *', '(?:' + alternatives(60, () => 'a') + ')*'],
    ['30 identical alternatives under *', '(?:' + alternatives(30, () => 'a') + ')*'],
    ['a loop of 600 dots', '(?:' + '.'.repeat(600) + ')*'],
    ['250 overlapping two-character alternatives under *', '(?:' + alternatives(250, (j) => 'a' + String.fromCharCode(0x100 + j)) + ')*'],
    ['15 nested groups', '('.repeat(15) + 'a' + ')*'.repeat(15)],
    ['60 loops with no chain', r`(?:\d*\s)`.repeat(60)],
  ];
  for (const [name, source] of long) {
    compiles(source);
    expect(source.length, name).toBeLessThanOrEqual(2002);
    const start = performance.now();
    backtrackProblem(source, '');
    expect(performance.now() - start, name).toBeLessThan(500);
  }
});

it("risk:security the guard's realistic refusals name a rewrite it accepts (8-ac-3)", () => {
  const quoted = backtrackProblem(r`(["'])(?:(?!\1).)*\1`, '');
  const tag = backtrackProblem(r`<(\w+)>.*</\1>`, '');
  const digits = backtrackProblem(r`\d{1,3}\d{1,3}\d{1,3}`, '');
  const password = backtrackProblem(r`.*password.*=.*`, '');
  for (const reason of [quoted, tag, digits, password]) expect(reason).toEqual(expect.any(String));
  // the reasons name the rewrite
  expect(quoted).toContain(r`"[^"]*"|'[^']*'`);
  expect(tag).toContain(r`"[^"]*"|'[^']*'`);
  expect(digits).toContain(r`\d{3,9}`);
  expect(digits).toContain('leading or trailing .*');
  expect(password).toContain('leading or trailing .*');
  // and each rewrite is accepted
  for (const rewrite of [r`"[^"]*"|'[^']*'`, r`<(\w+)>.*</\w+>`, r`\d{3,9}`, r`password.*=`]) {
    compiles(rewrite);
    expect(backtrackProblem(rewrite, ''), rewrite).toBeUndefined();
  }
});

it('risk:security the guard refuses a modifier group it cannot read, so (?i:a+)+$ is not accepted unjudged (8-ac-3)', () => {
  for (const source of [r`(?i:a+)+$`, r`(?i:a|a)*$`, r`(?-i:a*)*b`, r`(?s:.*)*x`]) {
    expect(backtrackProblem(source, ''), source).toEqual(expect.stringContaining('modifiers'));
  }
  // the groups the guard does read stay accepted: non-capturing, lookahead, lookbehind, named
  for (const source of [r`(?:ab)+`, r`(?=a)b`, r`(?!a)b`, r`(?<=a)b`, r`(?<!a)b`, r`(?<n>ab)+`]) {
    expect(backtrackProblem(source, ''), source).toBeUndefined();
  }
});

// Phase 08.8 D-12: the scans budget the patterns the guard accepts with two overlapping repeats, so the guard says how many a pattern has.
it('risk:resource overlapRepeats is two for an accepted overlapping pattern and below two for a linear one (D-12)', () => {
  expect(overlapRepeats(r`.*a.*b`, '')).toBe(2);
  expect(overlapRepeats(r`a*a*b`, '')).toBe(2);
  for (const source of [r`a+b+`, r`\bfoo\b`, r`(ab)+`, r`a`]) expect(overlapRepeats(source, ''), source).toBeLessThan(2);
});

// Phase 08.8 D-12: a refusal text that quotes a pattern as refused must be right. The three lists are the quotes of EXPONENTIAL_REASON, WAYS_REASON and CHAIN_REASON, by hand (a new quote is added here);
// the reason of each list is what its first pattern is refused with.
it('risk:parsing each refusal reason quotes only patterns the guard refuses with that reason (D-12)', () => {
  const quotes: [string, string[]][] = [
    [r`(a+)+`, [r`(a+)+`, r`(a|a)*`, r`(a?b?)*`]],
    [r`[ab]?[ab]?[ab]?[ab]?[ab]?[ab]?[ab]?`, [r`[ab]?[ab]?[ab]?[ab]?[ab]?[ab]?[ab]?`, r`(a|a)(a|a)(a|a)(a|a)(a|a)(a|a)`]],
    [r`\d{1,3}\d{1,3}\d{1,3}`, [r`\d{1,3}\d{1,3}\d{1,3}`]],
  ];
  for (const [anchor, examples] of quotes) {
    const reason = backtrackProblem(anchor, '');
    expect(reason, anchor).toEqual(expect.any(String));
    for (const example of examples) {
      expect(reason, example).toContain(example);
      expect(backtrackProblem(example, ''), example).toBe(reason);
    }
  }
});

// Phase 08.8 D-12: nested fixed counts are one way to match, and a bounded IPv4 pattern has dots between its repeats; both run in linear time on hostile lines of 1000 characters.
it('risk:security nested fixed counts and a bounded IPv4 are accepted and stay fast on hostile lines (D-12)', () => {
  const shapes = [r`(?:a{5}){5}`, r`\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b`, r`(?:ab){10}`, r`(?:a|b){6}c`];
  const lines = ['a'.repeat(1000), '9'.repeat(1000), '1.1.1.'.repeat(166) + '1', '255.255.255.255.'.repeat(62) + 'x', 'ab'.repeat(500), '1'.repeat(24) + 'b'];
  for (const source of shapes) {
    expect(backtrackProblem(source, ''), source).toBeUndefined();
    const re = new RegExp(source);
    const start = performance.now();
    for (const line of lines) re.test(line);
    expect(performance.now() - start, source).toBeLessThan(500);
  }
});

// Phase 08.9.1 D-08 (backlog 999.65): a range-checked IPv4 pattern is readable when each octet's 0-255 check is a negative lookahead: the guard counts fewer than two overlapping repeats, so no scan budget is needed.
// The textbook alternation per octet is refused by the route count (MAX_WAYS), not by the overlap-repeat budget; the guard and the scan are unchanged.
const IPV4 = r`\b(?!25[6-9]|2[6-9][0-9]|[3-9][0-9]{2})[0-9]{1,3}(?:\.(?!25[6-9]|2[6-9][0-9]|[3-9][0-9]{2})[0-9]{1,3}){3}\b`;
const IPV4_ALTERNATION = r`\b(?:25[0-5]|2[0-4][0-9]|1?[0-9]{1,2})(?:\.(?:25[0-5]|2[0-4][0-9]|1?[0-9]{1,2})){3}\b`;

/** A diff of one file `src/net.ts` that adds one line. */
const addLineDiff = (line: string): string =>
  ['diff --git a/src/net.ts b/src/net.ts', 'index 1111111..2222222 100644', '--- a/src/net.ts', '+++ b/src/net.ts', '@@ -1,1 +1,2 @@', ' export {};', `+${line}`].join('\n');

/** The reference: at some word boundary, four groups of 1 to 3 digits (value 0 to 255, leading zeros allowed) joined by single dots, ending at a word boundary; every split is tried. */
function referenceIpv4(s: string): boolean {
  const isWord = (c: string | undefined): boolean => c !== undefined && /\w/.test(c);
  const boundary = (i: number): boolean => isWord(s[i - 1]) !== isWord(s[i]);
  const group = (p: number, k: number): boolean => {
    for (let len = 1; len <= 3; len++) {
      const digits = s.slice(p, p + len);
      if (digits.length < len || !/^[0-9]+$/.test(digits) || Number(digits) > 255) continue;
      const end = p + len;
      if (k === 3 ? boundary(end) : s[end] === '.' && group(end + 1, k + 1)) return true;
    }
    return false;
  };
  for (let i = 0; i < s.length; i++) if (boundary(i) && group(i, 0)) return true;
  return false;
}

it('risk:security a range-checked IPv4 pattern with a lookahead per octet is read, scans fast and matches only 0-255 quads (08.9.1 D-08)', () => {
  // (a) the team's security.md line is read with no problem
  const spec = parseSecurityFile(`## Patterns\n\n- ipv4: line /${IPV4}/ — a hard-coded IPv4 address\n`);
  expect(spec.problems).toEqual([]);
  expect(spec.patterns.map((p) => p.id)).toEqual(['ipv4']);

  // (b) it triggers on a changed line holding a valid address and not on one holding 256.1.1.1
  const hit = securityTriggers(spec, addLineDiff("const host = '10.0.0.1';"), ['src/net.ts'], { generated: [] });
  expect(hit.map((t) => t.pattern)).toEqual(['ipv4']);
  expect(securityTriggers(spec, addLineDiff("const v = '256.1.1.1';"), ['src/net.ts'], { generated: [] })).toEqual([]);

  // (c) the guard accepts it with fewer than two overlapping repeats, so the scan budget never applies
  expect(backtrackProblem(IPV4, '')).toBeUndefined();
  expect(overlapRepeats(IPV4, '')).toBeLessThan(2);

  // (d) hostile lines of 1000 characters scan fast
  const lines = ['a'.repeat(1000), '9'.repeat(1000), '1'.repeat(1000), '1.1.1.'.repeat(166) + '1', '255.255.255.255.'.repeat(62) + 'x', 'ab'.repeat(500), '1'.repeat(24) + 'b'];
  const re = new RegExp(IPV4);
  const start = performance.now();
  for (const line of lines) re.test(line);
  expect(performance.now() - start).toBeLessThan(500);

  // (e) it agrees with the reference on a fixed list and on 2000 strings of a seeded generator
  const fixed = ['0.0.0.0', '10.0.0.1', '192.168.1.255', '255.255.255.255', 'host=1.2.3.4;', '1.2.3.4.5', '256.1.1.1', '1.2.3.256', '999.1.1.1', '1.2.3', 'a1.2.3.4', '1.2.3.4a', '2510.0.0.1', '007.1.1.1'];
  const tokens = ['0', '1', '2', '5', '9', '.', '.', '.', ' ', 'a', '_', '=', '255', '256', '25', '300', '007', '1.2.3.4', '10.0.0.1', '256.1.1.1', '1.2.3.256'];
  let seed = 12345;
  const next = (n: number): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor((seed / 2 ** 32) * n);
  };
  const generated: string[] = [];
  for (let i = 0; i < 2000; i++) {
    let s = '';
    for (let k = 1 + next(12); k > 0; k--) s += tokens[next(tokens.length)];
    generated.push(s);
  }
  const matching = generated.filter(referenceIpv4).length;
  expect(matching, 'the generated set holds matches and non-matches').toBeGreaterThan(0);
  expect(matching).toBeLessThan(generated.length);
  const mismatches = [...fixed, ...generated].filter((s) => new RegExp(IPV4).test(s) !== referenceIpv4(s));
  expect(mismatches).toEqual([]);
});

it('risk:security the alternation form of a range-checked IPv4 stays refused with the routes reason (08.9.1 D-08)', () => {
  expect(backtrackProblem(IPV4_ALTERNATION, '')).toBe(WAYS_REASON);
});
