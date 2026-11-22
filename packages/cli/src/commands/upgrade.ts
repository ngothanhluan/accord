// ST-LN-25 `accord upgrade`, run as the newer accord: put one commit that pins this version in config.yml, the
// workflow and the hooks, with the skill files `skills sync` writes, on a new branch upgrade/<version> made from
// origin's default branch, and push it. Drop's pattern (ST-LN-34): a temporary index, no checkout, so the
// checkout it runs in is never touched.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  agentTargets,
  checkProductText,
  CONVENTIONS_FILE,
  isIntactRender,
  lintSnapshot,
  loadConfig,
  loadSnapshot,
  pluginTargets,
  refreshLintStep,
  repinConfig,
  repinWorkflow,
  RETIRED_FILES,
  skillTargets,
} from '@accord-dev/accord-core';
import type { ProductRead } from '@accord-dev/accord-core';
import pkg from '../../package.json' with { type: 'json' };
import { gitDefaultRef, gitFilesAt, loadRefInput, UsageError } from '../load/fs.js';
import { readProductText } from '../load/product.js';
import { shown } from '../load/script-trust.js';
import { newer } from './notice.js';
import { git, gitNoPrompt, gitOk } from './worktree.js';
import { hooksPlanFor, SETTINGS } from './skills.js';
import type { InitContext } from './init.js';

const NOTHING = ' - nothing was created';
const CONFIG = 'accord/config.yml';
const WORKFLOW = '.github/workflows/accord.yml';

function gitIn(root: string, args: string[], extra: { env?: NodeJS.ProcessEnv; input?: Buffer } = {}): string {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, ...extra });
  } catch (err) {
    throw new UsageError('git ' + args.join(' ') + ' failed\n' + String((err as { stderr?: string }).stderr ?? '').trim() + NOTHING);
  }
}

// ST-LN-96 rel-ac-1, CR-03, WR-08 (round 2): the upgrade writes no `ruleset` into any ticket. A ticket of the default branch that is approved and not done is in flight on its claim branch, and that branch
// keeps appending to the same end of the frontmatter (`ac_hash`, `plan_hash`), so a line written here conflicted at the branch's next merge, and the ticket, not done, put a failing `gate done` into the
// upgrade pull request. While the claim commit is reachable the claim fact already gives the rules the ticket was claimed under, and the first `accord worktree sync` or Continue after the upgrade writes
// the field into the branch's own copy (backfillRuleset in worktree.ts), before a rebase or a team script can rewrite the claim commit.

/**
 * Phase 8.5 D-11: one `unsafe line:` per refused line of the default branch's conventions.md in line order, or the one `unsafe file:` line when the entry is a link or not a regular
 * file (no line was read, so none is named). Core's fixed reasons and fixes name the file, the line and a code point, never the line, so nothing of the file is echoed.
 */
function unsafeLines(read: ProductRead): string[] {
  if (read.copy !== 'default') return []; // a git failure fell back to the working copy, which is not the default branch's file
  if (read.kind === 'not-regular') return [shown(`unsafe file: ${CONVENTIONS_FILE}: is a link or not a regular file - fix: replace it with a regular file`)];
  if (read.kind !== 'text') return [];
  return checkProductText(read.text).problems.map((p) => shown(`unsafe line: ${CONVENTIONS_FILE}:${p.line}: ${p.reason} - fix: ${p.fix}`));
}

export function upgrade(ctx: InitContext): number {
  const root = ctx.root;
  const v = pkg.version;
  const ssh = new Map<string, string>(); // core.sshCommand, read once for this command's network calls
  if (!gitOk(root, ['remote', 'get-url', 'origin'])) throw new UsageError('no origin remote - accord upgrade pushes its branch there' + NOTHING);
  try {
    gitNoPrompt(root, ['fetch', '--no-prune', 'origin'], undefined, ssh);
  } catch (err) {
    throw new UsageError('fetch from origin failed: ' + String((err as { stderr?: string }).stderr ?? err).trim().split('\n')[0] + NOTHING);
  }
  if (gitNoPrompt(root, ['ls-remote', 'origin', 'refs/heads/upgrade/' + v], undefined, ssh).trim() !== '') {
    throw new UsageError(`upgrade/${v} already exists on origin - delete it with git push origin --delete upgrade/${v}, then run accord upgrade again` + NOTHING);
  }
  const ref = gitDefaultRef(root);
  if (ref === undefined) throw new UsageError('no origin/main in this clone - run git fetch origin, then try again' + NOTHING);
  const short = ref.replace('refs/remotes/origin/', '');
  const base = git(root, ['rev-parse', ref]).trim();

  const files = gitFilesAt(root, ref, [CONFIG, WORKFLOW, SETTINGS, ...RETIRED_FILES]);
  const text = files[CONFIG];
  if (text === undefined) throw new UsageError(`no ${CONFIG} on ${short}` + NOTHING);
  const old = loadConfig(CONFIG, text);
  if (old.config === undefined) throw new UsageError(`${CONFIG} on ${short} is invalid: ${old.findings[0]?.reason ?? 'unreadable'}` + NOTHING);
  const pinned = old.config.accord;

  if (!newer(v, pinned)) {
    throw new UsageError(`${short} pins accord ${pinned}, which is not older than ${v}; accord upgrade never moves a pin back` + NOTHING);
  }
  const next = repinConfig(text, v);
  const config = next === undefined ? undefined : loadConfig(CONFIG, next).config;
  if (next === undefined || config?.accord !== v) {
    throw new UsageError(`the accord: line of ${CONFIG} on ${short} could not be rewritten - set it to "${v}" by hand` + NOTHING);
  }

  const writes: { path: string; text: string }[] = [{ path: CONFIG, text: next }];
  const workflow = files[WORKFLOW];
  const refresh = workflow === undefined ? undefined : refreshLintStep(workflow, pkg.name, v);
  if (workflow !== undefined) {
    writes.push({ path: WORKFLOW, text: repinWorkflow(refresh !== undefined && 'text' in refresh ? refresh.text : workflow, pkg.name, pinned, v) });
  }
  let warning: string | undefined;
  if (refresh !== undefined && 'refused' in refresh) {
    const rerun = `run accord upgrade again before merging upgrade/${v} (close its pull request, delete the branch with git push origin --delete upgrade/${v}, and fix the step on ${short} first); otherwise the refresh waits for the next release`;
    const fix = refresh.refused === 'count' ? 'leave exactly one step named lint and gate and' : 'the step named lint and gate must be a block list item without an anchor, as accord init writes it; make it one and';
    warning = `warning: the lint-and-gate script in ${WORKFLOW} was not refreshed: ${fix} ${rerun}`;
  }
  const hooks = hooksPlanFor(files[SETTINGS], config);
  if (hooks?.text !== undefined) writes.push({ path: SETTINGS, text: hooks.text });
  const input = loadRefInput(root, ref);
  input.files[CONFIG] = next;
  const bad = lintSnapshot(loadSnapshot(input)).findings.filter((f) => f.level === 'error');
  if (bad.length > 0) {
    throw new UsageError(
      `the upgrade would fail lint on ${short}:\n${bad.map((f) => `${f.file}: ${f.rule}: ${f.reason}`).join('\n')}\nfix these on ${short} first` + NOTHING,
    );
  }
  // The lint guard above is not widened: loadRefInput still reads config and tickets only, so a conventions line never refuses the upgrade (P5); it is listed after `title:` instead.
  const unsafe = unsafeLines(readProductText(root, { from: 'default', ref }));
  writes.push(...skillTargets(config), ...agentTargets(config), ...pluginTargets(config, pkg));

  const folder = mkdtempSync(join(tmpdir(), 'accord-upgrade-'));
  let sha: string;
  try {
    const env = { ...process.env, GIT_INDEX_FILE: join(folder, 'index') };
    gitIn(root, ['read-tree', base], { env });
    // BUG-LN-15: one hash-object for every file, read from the temporary folder; --no-filters keeps the bytes as
    // written, as --stdin did, and its output lines follow the order of the paths.
    const paths = writes.map((w, i) => {
      const file = join(folder, `blob-${i}`);
      writeFileSync(file, w.text, 'utf8');
      return file;
    });
    const shas = gitIn(root, ['hash-object', '-w', '--no-filters', '--stdin-paths'], { input: Buffer.from(paths.join('\n') + '\n', 'utf8') }).trim().split('\n');
    const info = writes.map((w, i) => `100644 ${shas[i]}\t${w.path}\n`).join('');
    gitIn(root, ['update-index', '--index-info'], { env, input: Buffer.from(info, 'utf8') });
    // ST-LN-80: a retired file whose marker shows no edit leaves the tree. The text is read from the git tree, which
    // follows no link; a link's blob holds its target, whose marker is never intact.
    const retired = RETIRED_FILES.filter((p) => isIntactRender(files[p] ?? ''));
    if (retired.length > 0) gitIn(root, ['update-index', '--force-remove', '--', ...retired], { env });
    const tree = gitIn(root, ['write-tree'], { env }).trim();
    sha = gitIn(root, ['commit-tree', tree, '-p', base], { input: Buffer.from(`upgrade: accord ${v}\n`, 'utf8') }).trim();
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
  try {
    gitNoPrompt(root, ['push', 'origin', sha + ':refs/heads/upgrade/' + v], undefined, ssh);
  } catch (err) {
    throw new UsageError(
      `the upgrade commit ${sha} was made but the push failed: ${String((err as { stderr?: string }).stderr ?? err).trim().split('\n')[0]} - push it with git push origin ${sha}:refs/heads/upgrade/${v}` +
        (warning === undefined ? '' : '\n' + warning),
    );
  }
  ctx.stdout.write(`branch: upgrade/${v}\nbase: ${short}\ntitle: upgrade: accord ${v}\n${unsafe.map((l) => l + '\n').join('')}`);
  if (warning !== undefined) ctx.stderr.write(warning + '\n');
  // D-16: an accord hook the owner edited was kept in the upgrade commit; one line each, on stderr beside the warning.
  ctx.stderr.write((hooks?.notes ?? []).map((n) => n + '\n').join(''));
  return 0;
}
