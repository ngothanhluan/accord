// Phase 8.1 D-04, D-05: `accord commit check <file>` judges a commit message file against `commits.message` with the one core function the gates use
// (`commitRuleProblem`), so an agent checks its own message before it commits; `accord commit message <id>` runs the team's script that builds the message
// (`commits.message.command`, only after `accord trust`) and judges what it printed the same way. The CLI installs no commit-msg hook (D-07).
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { commitRuleNotInForce, commitRuleOf, commitRuleProblem } from '@accord-dev/accord-core';
import type { CommitRule } from '@accord-dev/accord-core';
import { gitDefaultRef, UsageError } from '../load/fs.js';
import { scriptRefusal, shown } from '../load/script-trust.js';
import { runTeamCommand } from '../load/team-run.js';
import type { CommandContext } from '../run.js';
import { withNext } from './next-action.js';
import { git, ID } from './worktree.js';

/** The message script may run this long and print this much (Ruling "accord commit message"). */
const MESSAGE_TIMEOUT_MS = 60_000;
const MESSAGE_MAX_BUFFER = 1024 * 1024;

/** The one line a breaking message gets: the reason, then the fix with a message that passes. */
function breaking(rule: CommitRule, problem: string): string {
  return `${shown(problem)} - fix: reword the first line${rule.example === '' ? '' : ', e.g. ' + shown(rule.example)}\n`;
}

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
  ctx.stdout.write(breaking(rule, problem));
  return 1;
}

/**
 * Run `commits.message.command` in this checkout with the ticket only in the environment (ACCORD_TICKET, ACCORD_TICKET_FILE, ACCORD_BASE_REF, ACCORD_ROOT), write what it printed
 * (the first line the subject, the rest the body, CRLF read as LF) to `<git-path>/accord-commit-<id>.txt`, print `message-file: <path>`, then judge it like `accord commit check`.
 * An untrusted script never runs (exit 2, the refusal names `accord trust`); a non-zero exit, a timeout, too much output or an empty first line is exit 2 quoting the stderr tail
 * and writes no file.
 */
export function commitMessage(ctx: CommandContext, id: string): number {
  if (!ID.test(id)) throw new UsageError('not a valid ticket id: ' + id);
  if (!Object.hasOwn(ctx.snapshot.tickets, id)) throw new UsageError(`no ticket ${id} in accord/tickets/ - give the id of a ticket of this checkout`);
  const command = ctx.snapshot.config?.commits?.message?.command;
  if (command === undefined) {
    throw new UsageError('commits.message.command is not set in accord/config.yml - fix: write the message yourself and check it with accord commit check <file>, or set the command of the team script that builds it');
  }
  const rule = commitRuleOf(ctx.snapshot.config);
  if (rule === undefined || 'problem' in rule) throw new UsageError(commitRuleNotInForce(rule === undefined ? 'commits.message is not set' : rule.problem));
  // checked here, before anything runs: an untrusted script is branch content, so it is never run (T-08.1-01)
  const refusal = scriptRefusal(ctx.root, 'commits.message.command', command);
  if (refusal !== undefined) throw new UsageError(withNext('trust', `${refusal} - no commit message was built`));
  const r = runTeamCommand(command, {
    cwd: ctx.root,
    env: {
      ...process.env,
      ...ctx.env,
      ACCORD_TICKET: id,
      ACCORD_TICKET_FILE: ctx.snapshot.tickets[id].file,
      ACCORD_BASE_REF: gitDefaultRef(ctx.root) ?? '',
      ACCORD_ROOT: ctx.root,
    },
    timeoutMs: MESSAGE_TIMEOUT_MS,
    maxBuffer: MESSAGE_MAX_BUFFER,
  });
  const text = r.stdout.replace(/\r\n/g, '\n');
  let why: string | undefined;
  if (r.timedOut) why = `timed out after ${MESSAGE_TIMEOUT_MS / 1000} s`;
  else if (r.oversize) why = `printed more than ${MESSAGE_MAX_BUFFER / 1024 / 1024} MiB`;
  else if (r.code !== 0) why = r.code === null ? `was killed${r.signal === null ? '' : ' by ' + r.signal}` : `exited ${r.code}`;
  else if ((text.split('\n')[0] ?? '').trim() === '') why = 'printed no subject: its first line of output is empty';
  if (why !== undefined) {
    const said = (r.stderr.trim() !== '' ? r.stderr : r.stdout).trim();
    const tail = said === '' ? '' : ' - ' + said.split('\n').slice(-20).map((l) => shown(l.trimEnd())).join(' / ');
    throw new UsageError(`commits.message.command "${shown(command)}" ${why}${tail} - no commit message was built; fix the script, or write the message yourself and check it with accord commit check <file>`);
  }
  const file = resolve(ctx.root, git(ctx.root, ['rev-parse', '--git-path', `accord-commit-${id}.txt`]).trim());
  writeFileSync(file, text.endsWith('\n') ? text : text + '\n');
  ctx.stdout.write(`message-file: ${file.replaceAll('\\', '/')}\n`);
  const problem = commitRuleProblem(rule, text);
  if (problem === undefined) return 0;
  ctx.stdout.write(breaking(rule, problem));
  return 1;
}
