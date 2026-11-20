// Phase 8.1 G3a (D-08, D-09, D-10, D-11): `accord audit` reports what a machine can see about a repository's conventions. It reads files only, spends no model call, and exits 0
// whenever it ran, whatever it found: it is a report, and no gate runs it (D-10, D-12). The notice the dashboard and `accord new ticket` print names it once when the conventions file is empty.
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { auditLines, CONVENTIONS_THIN, conventionLines, conventionsEmpty, commitRuleOf, findTemplate, subjectRuleProblems } from '@accord-dev/accord-core';
import type { AuditFact, AuditGap } from '@accord-dev/accord-core';
import { gitTracked } from '../load/fs.js';
import { machineFacts } from '../load/audit-facts.js';
import { auditHealth, NOT_CHECKED } from '../load/audit-health.js';
import type { Found } from '../load/audit-facts.js';
import { printable } from '../load/detect.js';
import { shown } from '../load/script-trust.js';
import type { CommandContext } from '../run.js';

const CONVENTIONS = 'accord/product/conventions.md';

/** The line D-11 puts on the dashboard and on `accord new ticket` while the conventions file exists and holds no convention line. */
export const CONVENTIONS_NOTICE = `conventions: ${CONVENTIONS} has no convention line; /accord-audit drafts them from the code (optional)`;

/** The text of the conventions file when it is a regular file, else undefined (absent, a link, unreadable). */
function conventionsText(root: string): string | undefined {
  const path = join(root, 'accord', 'product', 'conventions.md');
  try {
    if (!existsSync(path) || !lstatSync(path).isFile()) return undefined;
    return readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
}

/** The notice line, or undefined: printed only when the file exists and is empty (an absent file prints nothing); never a refusal. */
export function conventionsNotice(root: string): string | undefined {
  const text = conventionsText(root);
  return text !== undefined && conventionsEmpty(text) ? CONVENTIONS_NOTICE : undefined;
}

const tools = (found: readonly Found[]): string => found.map((f) => `${f.tool} (${printable(f.file)})`).join(', ');
const FIX_QUEUE = (what: string): string => `queue a draft ticket with /accord-queue to ${what}; the audit never changes code or configuration`;

export function audit(ctx: CommandContext): number {
  const config = ctx.snapshot.config;
  const tracked = gitTracked(ctx.root);
  const m = machineFacts(ctx.root, tracked);
  const facts: AuditFact[] = [];
  const gaps: AuditGap[] = [];
  const fact = (name: string, value: string): void => {
    facts.push({ name, value: shown(value) });
  };
  const gap = (id: string, text: string, fix: string): void => {
    gaps.push({ id, text: shown(text), fix: shown(fix) });
  };

  fact('languages', m.languages);
  fact('layout', m.layout);

  fact('linter', m.linters.length === 0 ? 'none' : tools(m.linters));
  if (m.linters.length > 0) fact('linter-rules', m.rules.length === 0 ? 'none found in the config text' : m.rules.map(printable).join(', '));
  fact('formatter', m.formatters.length === 0 ? 'none' : tools(m.formatters));
  fact('typecheck', m.typechecks.length === 0 ? 'none found' : m.typechecks.map((t) => `${printable(t.file)} ${t.what}`).join(', '));
  fact('tests', m.tests.length === 0 ? 'none found' : m.tests.join(', '));

  // D-01 (plan check W1): a set pr.command replaces the template entirely, so it leaves no PR-template gap; an unreadable config cannot say.
  const found = findTemplate(tracked, config?.pr?.template);
  const where = found === undefined ? 'none' : printable(found.path) + (found.count !== undefined && found.count > 1 ? ` (first of ${found.count}; set pr.template to choose)` : '');
  if (config === undefined) fact('pr-template', `${where}; pr.command not checked (${NOT_CHECKED})`);
  else if (found === undefined && config.pr?.command !== undefined) fact('pr-template', 'none; pr.command builds the title and body');
  else fact('pr-template', where);

  const rule = commitRuleOf(config);
  if (config === undefined) fact('commit-rule', `not checked (${NOT_CHECKED})`);
  else if (rule === undefined) fact('commit-rule', 'not set');
  else if ('problem' in rule) fact('commit-rule', `commits.message is set but not in force: ${rule.problem}`);
  else fact('commit-rule', rule.text);

  const text = conventionsText(ctx.root);
  const lines = text === undefined ? 0 : conventionLines(text).length;
  fact('conventions', text === undefined ? 'no file' : `${lines} convention ${lines === 1 ? 'line' : 'lines'}`);

  // gaps, in the order the Ruling lists their ids
  if (text === undefined) gap('conventions-empty', CONVENTIONS + ' does not exist', '/accord-audit drafts conventions from the code, and you accept the lines you want');
  else if (lines === 0) gap('conventions-empty', CONVENTIONS + ' has no convention line', '/accord-audit drafts conventions from the code, and you accept the lines you want');
  else if (lines < CONVENTIONS_THIN) gap('conventions-thin', `${CONVENTIONS} has ${lines} convention ${lines === 1 ? 'line' : 'lines'}, fewer than ${CONVENTIONS_THIN}`, '/accord-audit drafts more from the code, and you accept the lines you want');
  if (m.linters.length === 0) gap('no-linter', 'no linter configuration is tracked', FIX_QUEUE('add a linter'));
  if (m.formatters.length === 0) gap('no-formatter', 'no formatter configuration is tracked', FIX_QUEUE('add a formatter'));
  for (const t of m.typechecks.filter((x) => !x.strict)) gap('typecheck-loose', `${printable(t.file)} does not turn strict type checking on (${t.what})`, FIX_QUEUE('turn strict type checking on'));
  if (config !== undefined && found === undefined && config.pr?.command === undefined) gap('no-pr-template', 'no pull request template is tracked and pr.command is not set', 'add .github/pull_request_template.md, or set pr.command (accord config set pr.command <script>)');
  if (config !== undefined && rule === undefined) gap('commit-rule-unset', 'commits.message is not set, so no commit rule is checked', 'accord config set commits.message.preset conventional (or set commits.message.pattern and commits.message.example)');
  if (rule !== undefined && !('problem' in rule)) {
    for (const p of subjectRuleProblems(ctx.snapshot, rule)) gap('subject-breaks-rule', `commits.subjects.${p.name} renders "${p.subject}", which breaks the commit rule: ${p.problem}`, p.fix);
  }

  // group 2 (D-08, D-18): accord's own setup, after group 1
  const health = auditHealth(ctx);
  for (const f of health.facts) fact(f.name, f.value);
  for (const g of health.gaps) gap(g.id, g.text, g.fix);

  ctx.stdout.write(auditLines(facts, gaps));
  return 0;
}
