// Phase 8.1 D-04, D-05: `accord commit check <file>` judges a commit message file against `commits.message` with the one core function the gates use
// (`commitRuleProblem`), so an agent checks its own message before it commits. The CLI installs no commit-msg hook (D-07).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { commitRuleOf, commitRuleProblem } from '@accord-dev/accord-core';
import { UsageError } from '../load/fs.js';
import { shown } from '../load/script-trust.js';
import type { CommandContext } from '../run.js';

/**
 * Exit 0 when the first line of the file passes the rule, or when `commits.message` is not set; exit 1 with one line naming the rule and a passing example when it
 * breaks; exit 2 when the file cannot be read or the configured pattern is not in force (it names `accord lint`). `cwd` resolves a relative file name.
 */
export function commitCheck(ctx: CommandContext, file: string, cwd: string): number {
  const rule = commitRuleOf(ctx.snapshot.config);
  if (rule === undefined) {
    ctx.stdout.write('commits.message is not set; every message passes\n');
    return 0;
  }
  if ('problem' in rule) throw new UsageError(`${shown(rule.problem)} - fix: run accord lint, which names the pattern to change`);
  let text: string;
  try {
    text = readFileSync(resolve(cwd, file), 'utf8');
  } catch {
    throw new UsageError(`cannot read the message file ${shown(file)} - fix: write the message to a file and give accord commit check its path, the file git commit -F reads`);
  }
  const problem = commitRuleProblem(rule, text);
  if (problem === undefined) {
    ctx.stdout.write(`the first line passes ${rule.text}\n`);
    return 0;
  }
  ctx.stdout.write(`${shown(problem)} - fix: reword the first line${rule.example === '' ? '' : ', e.g. ' + shown(rule.example)}\n`);
  return 1;
}
