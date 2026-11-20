// 8-ac-3 (D-07): the static guard `backtrackProblem(source, flags)` refuses a team line pattern that can backtrack catastrophically. Every test asserts only the guard's verdict:
// a refused regex is never run on any input here (a hang would be the failure the guard exists to prevent).
import { expect, it } from 'vitest';
import { backtrackProblem } from '../src/security/backtrack.js';

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
