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
