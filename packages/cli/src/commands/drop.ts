// ST-LN-34 `accord drop <id>`: put the ticket file, set to dropped with its reason, on a new branch drop/<id>
// made from origin's default branch, without a checkout, and push it. The branch holds the ticket file and the
// research records it lists that the default branch lacks (ST-LN-13); the claim branch's code never travels.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isResearchPath, isResearchRecord, lintSnapshot, loadSnapshot, markDropped } from '@accord-dev/accord-core';
import { droppedOn, gitDefaultRef, gitFilesAt, loadRefInput, UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';
import { branchOf, git, gitNoPrompt, gitOk, ID, listWorktrees } from './worktree.js';

const NOTHING = ' - nothing was created';

function gitIn(root: string, args: string[], extra: { env?: NodeJS.ProcessEnv; input?: Buffer } = {}): string {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, ...extra });
  } catch (err) {
    throw new UsageError('git ' + args.join(' ') + ' failed\n' + String((err as { stderr?: string }).stderr ?? '').trim() + NOTHING);
  }
}

const resolve = (root: string, ref: string): string | undefined => {
  try {
    return execFileSync('git', ['rev-parse', '--verify', '-q', ref], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return undefined;
  }
};

export function drop(ctx: CommandContext, id: string, opts: { reason?: string }): number {
  const root = ctx.root;
  const ssh = new Map<string, string>(); // core.sshCommand, read once for this command's network calls
  if (!ID.test(id)) throw new UsageError('not a valid ticket id: ' + id + NOTHING);
  const reason = opts.reason?.trim();
  if (reason !== undefined && (reason === '' || /[\r\n]/.test(reason))) throw new UsageError('--reason must be one line of text' + NOTHING);
  if (!gitOk(root, ['remote', 'get-url', 'origin'])) throw new UsageError('no origin remote - accord drop pushes the record there' + NOTHING);
  const b = branchOf(ctx.snapshot, id);
  const path = 'accord/tickets/' + id + '.md';
  const held = listWorktrees(root).find((w) => w.branch === b);
  if (held !== undefined && git(held.path, ['status', '--porcelain', '--untracked-files=all', '--', path]).trim() !== '') {
    throw new UsageError(`${path} has uncommitted changes in ${held.path} - commit and push them on ${b} first` + NOTHING);
  }
  try {
    gitNoPrompt(root, ['fetch', '--no-prune', 'origin'], undefined, ssh);
  } catch (err) {
    throw new UsageError('fetch from origin failed: ' + String((err as { stderr?: string }).stderr ?? err).trim().split('\n')[0] + NOTHING);
  }
  const ref = gitDefaultRef(root);
  if (ref === undefined) throw new UsageError('no origin/main in this clone - run git fetch origin, then try again' + NOTHING);
  const short = ref.replace('refs/remotes/origin/', '');
  const base = git(root, ['rev-parse', ref]).trim();

  if (droppedOn(root, ref, [id]).has(id)) throw new UsageError(`${id} is already dropped on ${short}` + NOTHING);
  if (gitNoPrompt(root, ['ls-remote', 'origin', 'refs/heads/drop/' + id], undefined, ssh).trim() !== '') {
    throw new UsageError(`drop/${id} already exists on origin - delete it with git push origin --delete drop/${id}, then run accord drop again` + NOTHING);
  }
  const L = resolve(root, 'refs/heads/' + b);
  const R = resolve(root, 'refs/remotes/origin/' + b);
  let tip: string;
  if (L !== undefined && R !== undefined && L !== R) {
    if (gitOk(root, ['merge-base', '--is-ancestor', R, L])) tip = L;
    else if (gitOk(root, ['merge-base', '--is-ancestor', L, R])) tip = R;
    else throw new UsageError(`${b} here and origin/${b} have diverged - pull or push ${b} so one holds the other, then run accord drop again` + NOTHING);
  } else {
    tip = L ?? R ?? base;
  }

  if (!gitOk(root, ['cat-file', '-e', tip + ':' + path])) {
    throw new UsageError(`no ${path} on ${tip === base ? short : b} - nothing to drop` + NOTHING);
  }
  const text = git(root, ['-c', 'log.showSignature=false', 'show', '--no-show-signature', tip + ':' + path]);
  let next: string | undefined;
  try {
    next = markDropped(text, reason);
  } catch (err) {
    throw new UsageError(`${path}: ${(err as Error).message}` + NOTHING);
  }
  if (next === undefined) throw new UsageError(`${path} has no "## Dropped" reason - pass --reason "<why>"` + NOTHING);

  // The research records the ticket lists (ST-LN-13): the drop branch holds the ones the default branch lacks.
  const listed = [...new Set(loadSnapshot({ files: { [path]: next }, tree: [] }).tickets[id]?.frontmatter?.research ?? [])].filter(isResearchPath);
  const records = listed.filter(isResearchRecord);
  // Only Markdown travels (the drop writes nothing else to the default branch): refuse a listed other file only the claim branch holds, before anything is written.
  for (const p of listed.filter((q) => !isResearchRecord(q))) {
    if (resolve(root, tip + ':' + p) !== undefined && resolve(root, base + ':' + p) === undefined) {
      throw new UsageError(
        `${p} is listed under research: and only ${b} holds it, but only .md research records travel with a drop - rename it to .md on ${b} (and update the research: key), or put it on ${short} first, then run accord drop again` + NOTHING,
      );
    }
  }
  if (held !== undefined) {
    for (const p of records) {
      if (git(held.path, ['status', '--porcelain', '--untracked-files=all', '--', p]).trim() !== '') {
        throw new UsageError(`${p} has uncommitted changes in ${held.path} - commit and push them on ${b} first` + NOTHING);
      }
    }
  }
  const carried: Record<string, string> = {};
  for (const p of records) {
    const atBase = resolve(root, base + ':' + p);
    const atTip = resolve(root, tip + ':' + p);
    if (atTip === undefined) continue;
    if (atBase === undefined) carried[p] = atTip;
    else if (atBase !== atTip) {
      throw new UsageError(
        `${p} on ${b} differs from the copy on ${short}; a drop never replaces a research record the default branch holds - make the two equal on ${b}, or list a new record instead, then run accord drop again` +
          NOTHING,
      );
    }
  }

  const input = loadRefInput(root, ref);
  input.files[path] = next;
  if (!input.tree.includes(path)) input.tree.push(path);
  const extra = {
    ...gitFilesAt(root, tip, Object.keys(carried)),
    ...gitFilesAt(root, ref, listed.filter((p) => !Object.hasOwn(carried, p) && !Object.hasOwn(input.files, p))),
  };
  for (const [p, text] of Object.entries(extra)) {
    input.files[p] = text;
    if (!input.tree.includes(p)) input.tree.push(p);
  }
  const errors = lintSnapshot(loadSnapshot(input)).findings.filter((f) => f.level === 'error');
  if (errors.length > 0) {
    throw new UsageError(
      `the drop record would fail lint on ${short}:\n` + errors.map((f) => `${f.file}: ${f.rule}: ${f.reason}`).join('\n') + `\nfix these on ${short} first` + NOTHING,
    );
  }

  const folder = mkdtempSync(join(tmpdir(), 'accord-drop-'));
  let sha: string;
  try {
    const env = { ...process.env, GIT_INDEX_FILE: join(folder, 'index') };
    const blob = gitIn(root, ['hash-object', '-w', '--stdin'], { input: Buffer.from(next, 'utf8') }).trim();
    gitIn(root, ['read-tree', base], { env });
    gitIn(root, ['update-index', '--add', '--cacheinfo', `100644,${blob},${path}`], { env });
    for (const [p, b2] of Object.entries(carried)) gitIn(root, ['update-index', '--add', '--cacheinfo', `100644,${b2},${p}`], { env });
    const tree = gitIn(root, ['write-tree'], { env }).trim();
    sha = gitIn(root, ['commit-tree', tree, '-p', base], { input: Buffer.from(`drop: ${id}\n`, 'utf8') }).trim();
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
  try {
    gitNoPrompt(root, ['push', 'origin', sha + ':refs/heads/drop/' + id], undefined, ssh);
  } catch (err) {
    throw new UsageError(
      `the drop commit ${sha} was made but the push failed: ${String((err as { stderr?: string }).stderr ?? err).trim().split('\n')[0]} - push it with git push origin ${sha}:refs/heads/drop/${id}`,
    );
  }
  ctx.stdout.write(`branch: drop/${id}\nbase: ${short}\ntitle: drop: ${id}\n`);
  return 0;
}
