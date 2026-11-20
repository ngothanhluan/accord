// Phase 8.1 G3a (D-09 step 4) `accord conventions write <file>`: put the convention lines the owner accepted, and only those, on a new branch conventions/<date> made from origin's default
// branch, in a temporary worktree, and push it. The skill opens the pull request and never merges it: these lines become what every executor brief carries, so they reach the default
// branch only after the owner reads them. Nothing of the checkout the command runs in is written (queue.ts's pattern: no checkout, a worktree removed in `finally`, no `git worktree prune`).
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { renderSubject, templates } from '@accord-dev/accord-core';
import { gitDefaultRef, gitFilesAt, UsageError } from '../load/fs.js';
import { shown } from '../load/script-trust.js';
import type { CommandContext } from '../run.js';
import { forgetRegistration, utcDate } from './queue.js';
import { git, gitNoPrompt, gitOk } from './worktree.js';

const NOTHING = ' - nothing was written or pushed';
const CONVENTIONS = 'accord/product/conventions.md';
/** The one shape a line takes (D-09, D-13): `- <convention> — enforced by: <rule id or prose>`, a rule id being what the linter config calls the rule. */
const LINE = /^- (.+) — enforced by: ([A-Za-z0-9@/._:-]+)$/u;
const MAX_LINE = 300;
const BOM = new RegExp('^' + String.fromCharCode(0xfeff));
const UNPRINTABLE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
const FORMAT_FIX = 'write each accepted line as "- <convention> — enforced by: <rule id or prose>", on one line of at most 300 characters, with no comment marker';

const firstLine = (err: unknown): string => String((err as { stderr?: string }).stderr ?? err).trim().split('\n')[0];

/** The accepted lines of the file with their 1-based line numbers; a line that cannot be read stops the run, naming it and the fix. */
function acceptedLines(text: string, name: string): { n: number; line: string }[] {
  const out: { n: number; line: string }[] = [];
  const lines = text.replace(BOM, '').replace(/\r\n?/g, '\n').split('\n');
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (line.trim() === '') return;
    const where = `line ${i + 1} of ${shown(name)}`;
    const refuse = (why: string): never => {
      throw new UsageError(`${where} ${why} (${shown(line.slice(0, 80))}) - fix: ${FORMAT_FIX}${NOTHING}`);
    };
    if (line.length > MAX_LINE) refuse(`is over ${MAX_LINE} characters`);
    if (UNPRINTABLE.test(line)) refuse('holds a control or invisible character');
    if (line.includes('<!--') || line.includes('-->')) refuse('holds an HTML comment marker');
    if (!LINE.test(line)) refuse('does not read "- <convention> — enforced by: <rule id or prose>"');
    out.push({ n: i + 1, line });
  });
  return out;
}

export function conventionsWrite(ctx: CommandContext, file: string, cwd: string): number {
  const root = ctx.root;
  let text: string;
  try {
    text = readFileSync(resolve(cwd, file), 'utf8');
  } catch {
    throw new UsageError(`cannot read ${shown(file)} - fix: write the accepted lines to a file outside the repository and give accord conventions write its path${NOTHING}`);
  }
  const wanted = acceptedLines(text, file);
  if (wanted.length === 0) throw new UsageError(`${shown(file)} holds no accepted line - fix: write the lines the owner said yes to, one per line${NOTHING}`);

  if (!gitOk(root, ['remote', 'get-url', 'origin'])) throw new UsageError('no origin remote - accord conventions write pushes its branch there' + NOTHING);
  try {
    gitNoPrompt(root, ['fetch', '--no-prune', 'origin'], undefined, ctx.ssh);
  } catch (err) {
    throw new UsageError('fetch from origin failed: ' + firstLine(err) + NOTHING);
  }
  const ref = gitDefaultRef(root);
  if (ref === undefined) throw new UsageError('no origin/main in this clone - run git fetch origin, then try again' + NOTHING);
  const short = ref.replace('refs/remotes/origin/', '');
  const base = git(root, ['rev-parse', ref]).trim();
  const date = utcDate();
  const branch = 'conventions/' + date;
  if (!gitOk(root, ['check-ref-format', '--branch', branch])) throw new UsageError(`${branch} is not a valid branch name` + NOTHING);
  let onOrigin: string;
  try {
    onOrigin = gitNoPrompt(root, ['ls-remote', 'origin', 'refs/heads/' + branch], undefined, ctx.ssh).trim();
  } catch (err) {
    throw new UsageError('could not read the branches of origin: ' + firstLine(err) + NOTHING);
  }
  if (onOrigin !== '') {
    throw new UsageError(`${branch} already exists on origin - merge or close that pull request first, or delete the branch with git push origin --delete ${branch}, then try again` + NOTHING);
  }
  if (gitOk(root, ['rev-parse', '--verify', '-q', 'refs/heads/' + branch])) {
    throw new UsageError(`${branch} already exists in this clone - delete it with git branch -D ${branch}, then try again` + NOTHING);
  }

  // the file as the default branch has it (the template when the default branch has none), never this checkout's copy
  const onDefault = gitFilesAt(root, ref, [CONVENTIONS])[CONVENTIONS];
  const current = onDefault ?? templates['conventions.md'];
  const have = new Set(current.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()));
  const added: string[] = [];
  for (const { line } of wanted) {
    if (have.has(line)) {
      ctx.stdout.write(`skipped: ${shown(line)} (already in ${CONVENTIONS})\n`);
      continue;
    }
    have.add(line);
    added.push(line);
  }
  if (added.length === 0) throw new UsageError(`every accepted line is already in ${CONVENTIONS} on ${short}${NOTHING}`);
  const eol = current.includes('\r\n') ? '\r\n' : '\n';
  const body = (current === '' || /\n$/.test(current) ? current : current + eol) + added.map((l) => l + eol).join('');

  const subject = renderSubject(ctx.snapshot.config, 'conventions', date);
  // the real path: git records the long form of a Windows short path, and forgetRegistration compares paths
  const folder = realpathSync.native(mkdtempSync(join(tmpdir(), 'accord-conventions-')));
  const wt = join(folder, 'wt');
  let sha: string;
  try {
    git(root, ['worktree', 'add', '--detach', wt, base]);
    const target = join(wt, ...CONVENTIONS.split('/'));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, body);
    git(wt, ['add', '--', CONVENTIONS]);
    // no hook: the repository's own commit hook has no installed dependencies in a throwaway folder
    git(wt, ['commit', '-q', '--no-verify', '-m', subject]);
    sha = git(wt, ['rev-parse', 'HEAD']).trim();
  } finally {
    let removed = true;
    try {
      git(root, ['worktree', 'remove', '--force', wt]);
    } catch {
      removed = false;
    }
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
    // never `git worktree prune`: it drops every entry whose folder is missing (07-review WR-02)
    if (!removed) forgetRegistration(root, wt);
  }
  try {
    gitNoPrompt(root, ['push', 'origin', sha + ':refs/heads/' + branch], undefined, ctx.ssh);
  } catch (err) {
    throw new UsageError(`the conventions are committed as ${sha} but the push failed: ${firstLine(err)} - push it with git push origin ${sha}:refs/heads/${branch}`);
  }
  ctx.stdout.write(`branch: ${branch}\nbase: ${short}\ntitle: ${subject}\n`);
  return 0;
}
