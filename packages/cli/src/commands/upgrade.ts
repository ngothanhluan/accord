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
  branchTemplateOf,
  DEFAULT_BRANCH_TEMPLATE,
  isIntactRender,
  lintSnapshot,
  loadConfig,
  loadSnapshot,
  pinOf,
  pluginTargets,
  refreshLintStep,
  repinConfig,
  repinWorkflow,
  RETIRED_FILES,
  rulesetOfTicket,
  setFrontmatterKey,
  skillTargets,
  statusRows,
} from '@accord-dev/accord-core';
import type { SnapshotInput } from '@accord-dev/accord-core';
import pkg from '../../package.json' with { type: 'json' };
import { catBatch, gitDefaultRef, gitFilesAt, loadRefInput, snapshotAt, UsageError } from '../load/fs.js';
import { claimCommitOf } from '../load/research-facts.js';
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

const PLAIN = /^\d+\.\d+\.\d+$/;
const firstLine = (e: unknown): string => String((e as { stderr?: string }).stderr ?? (e as Error).message ?? e).trim().split('\n')[0];

/**
 * ST-LN-96 rel-ac-1, D-02 Ruling, T-03.1-13: `ruleset: "<pin at the ticket's claim commit>"` for every ticket of `ref` that is in flight: it has a lane, is not dropped, has no `ruleset`,
 * is not done on `ref`, and has a claim branch (the `branch` template with its id, local or on origin, local first) that holds a `claim: <id>` commit. The value is only what that commit's
 * committed accord/config.yml pins, and only a plain x.y.z, so it is the value the rules compare with later (the first one the branch wrote). A ticket whose claim pin cannot be read gets
 * no field and a line in `notes`; a git failure on the whole lookup writes nothing and adds one line. One claim lookup per candidate, one cat-file for it, no network.
 */
function inFlightRulesets(root: string, ref: string, configText: string, input: SnapshotInput, notes: string[]): { path: string; text: string }[] {
  const path = (id: string): string => `accord/tickets/${id}.md`;
  try {
    const tickets = loadSnapshot(input).tickets;
    const wanted = Object.values(tickets)
      .filter((t) => t.frontmatter?.lane !== undefined && t.frontmatter.status !== 'dropped' && input.files[path(t.id)] !== undefined && rulesetOfTicket(input.files[path(t.id)]) === undefined)
      .map((t) => t.id);
    if (wanted.length === 0) return [];
    const templates = [...new Set([branchTemplateOf(configText) ?? DEFAULT_BRANCH_TEMPLATE, DEFAULT_BRANCH_TEMPLATE])];
    const listed = new Set(gitIn(root, ['for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/remotes/origin']).split('\n').map((l) => l.trim()));
    const refsOf = (id: string): string[] => {
      const names = templates.map((t) => t.replace('{id}', id));
      return [...names.map((n) => 'refs/heads/' + n), ...names.map((n) => 'refs/remotes/origin/' + n)].filter((r) => listed.has(r));
    };
    const branched = wanted.filter((id) => refsOf(id).length > 0);
    if (branched.length === 0) return [];
    const finished = new Set(statusRows(snapshotAt(root, ref, branched)).filter((r) => r.stage === 'done').map((r) => r.id));
    const out: { path: string; text: string }[] = [];
    for (const id of branched.filter((i) => !finished.has(i))) {
      try {
        let claim: { sha: string } | undefined;
        for (const r of refsOf(id)) {
          claim = claimCommitOf(root, id, ref, r)?.claim;
          if (claim !== undefined) break;
        }
        if (claim === undefined) continue; // a branch with no claim commit does not claim the ticket
        const [config] = catBatch(root, [`${claim.sha}:${CONFIG}`], 'the claim pin');
        if (config === undefined) throw new Error(`${CONFIG} cannot be read at claim commit ${claim.sha}`);
        const pin = pinOf(config);
        if (pin === undefined || !PLAIN.test(pin)) throw new Error(`${CONFIG} at claim commit ${claim.sha} pins ${pin === undefined ? 'no accord version' : `"${pin}", which is not a plain x.y.z`}`);
        out.push({ path: path(id), text: setFrontmatterKey(input.files[path(id)], 'ruleset', pin) });
      } catch (e) {
        notes.push(`warning: ${id}: ruleset not written, the claim pin could not be read (${firstLine(e)})`);
      }
    }
    return out;
  } catch (e) {
    notes.push(`warning: ruleset was not written into the tickets in flight, the claim branches could not be read (${firstLine(e)})`);
    return [];
  }
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
  const notes: string[] = []; // ST-LN-96 rel-ac-1: one line per ticket whose ruleset could not be written
  for (const w of inFlightRulesets(root, ref, text, input, notes)) {
    writes.push(w);
    input.files[w.path] = w.text; // the lint pass below checks the written ticket
  }
  const bad = lintSnapshot(loadSnapshot(input)).findings.filter((f) => f.level === 'error');
  if (bad.length > 0) {
    throw new UsageError(
      `the upgrade would fail lint on ${short}:\n${bad.map((f) => `${f.file}: ${f.rule}: ${f.reason}`).join('\n')}\nfix these on ${short} first` + NOTHING,
    );
  }
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
        [warning, ...notes].map((l) => (l === undefined ? '' : '\n' + l)).join(''),
    );
  }
  ctx.stdout.write(`branch: upgrade/${v}\nbase: ${short}\ntitle: upgrade: accord ${v}\n`);
  for (const line of [warning, ...notes]) if (line !== undefined) ctx.stderr.write(line + '\n');
  return 0;
}
