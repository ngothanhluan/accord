// Phase 8.1 G3b (D-08 group 2, D-18): the facts and gaps about accord's own setup in a repository: the version pin against the running CLI and npm, the CI workflow, the rendered skill, agent and
// hook files, accord's hooks in .claude/settings.json, the config keys new since the pin, script trust and the security file. It reads, and writes nothing: no config.yml edit, no trust allow, no rendered file.
import { CONFIG_KEYS, newKeys, pluginDir, securityFile, setKeysOf } from '@accord-dev/accord-core';
import type { AuditFact, AuditGap } from '@accord-dev/accord-core';
import pkg from '../../package.json' with { type: 'json' };
import { latestRelease, newer } from '../commands/notice.js';
import { readRegular, renderHealth } from '../commands/skills.js';
import { declared } from '../commands/trust.js';
import type { CommandContext } from '../run.js';
import { inspect, shown } from './script-trust.js';

const CONFIG = 'accord/config.yml';
const WORKFLOW = '.github/workflows/accord.yml';
const SECURITY = 'accord/product/security.md';
const FIX_MARK = ' - run: ';
const PIN_LINE = /^config\.yml pins accord (\S+), running /;
export const NOT_CHECKED = "config.yml does not pass this CLI's schema";

/** The gap for a pin message `pinMessage` built: the first part as the text, and as the fix the command it names, or /accord-upgrade when the running CLI is the newer one. */
export function pinGap(message: string, running: string): { text: string; fix: string } {
  const at = message.lastIndexOf(FIX_MARK);
  const text = at < 0 ? message : message.slice(0, at);
  const command = at < 0 ? undefined : message.slice(at + FIX_MARK.length);
  const pinned = PIN_LINE.exec(message)?.[1];
  // A stale build (npm run build) is fixed by building; only an older pin is fixed by the upgrade skill.
  if (command === undefined || (command.startsWith('npx') && pinned !== undefined && newer(running, pinned))) return { text, fix: '/accord-upgrade' };
  return { text, fix: command };
}

const FIX_TRUST = (kind: string): string => `run accord trust to read what it runs and its digest, then accord trust ${kind}@<digest> with the digest it shows`;

/** The group 2 facts and gaps (Ruling "group 2 gap ids and fixes"). */
export async function auditHealth(ctx: CommandContext): Promise<{ facts: AuditFact[]; gaps: AuditGap[] }> {
  const facts: AuditFact[] = [];
  const gaps: AuditGap[] = [];
  const fact = (name: string, value: string): void => {
    facts.push({ name, value });
  };
  const gap = (id: string, text: string, fix: string): void => {
    gaps.push({ id, text, fix });
  };
  const config = ctx.snapshot.config;
  const pinned = ctx.pinned ?? config?.accord;

  // the pin against the running CLI (D-18) and against npm
  if (ctx.pinMismatch !== undefined) {
    const { text, fix } = pinGap(ctx.pinMismatch, pkg.version);
    gap('pin-mismatch', text, fix);
  }
  const configFindings = ctx.snapshot.errors.filter((e) => e.file === CONFIG && e.rule !== 'load.config-missing');
  if (config === undefined && configFindings.length > 0) {
    gap(
      'config-invalid',
      `accord/config.yml does not pass this CLI's schema (${configFindings.length} ${configFindings.length === 1 ? 'finding' : 'findings'})`,
      `accord lint names them; when the pin is newer than this CLI, run npx --yes ${pkg.name}@${pinned ?? '<pin>'} audit`,
    );
  }
  // An unanswered request is "no observation", never "up to date" (D-08, plan-time Ruling).
  const { latest, observed } = await latestRelease();
  fact('npm-latest', observed && latest !== undefined ? latest : 'no observation');
  if (observed && latest !== undefined && pinned !== undefined && newer(latest, pinned)) {
    gap('pin-behind-latest', `npm has accord ${latest} and this repository pins ${pinned}`, '/accord-upgrade');
  }

  // the CI workflow
  const workflow = readRegular(ctx.root, WORKFLOW);
  if (workflow.state === 'missing') gap('workflow-missing', `${WORKFLOW} does not exist, so no pull request is checked by accord`, 'accord init (it writes only the files that are missing)');
  else if (workflow.state === 'file') {
    const versions = new Set<string>();
    for (const m of workflow.text.matchAll(/npx --yes (\S+?)@(\S+)/g)) if (m[1] === pkg.name) versions.add(m[2] as string);
    const others = [...versions].filter((v) => v !== pinned);
    if (pinned !== undefined && others.length > 0) {
      gap('workflow-pin', `${WORKFLOW} runs accord ${others.join(', ')}, and config.yml pins ${pinned}`, `set the version in the workflow's npx --yes ${pkg.name}@<version> lines to ${pinned}`);
    }
    if (!/^[ \t]*timeout-minutes:/m.test(workflow.text)) {
      gap('workflow-timeout', `${WORKFLOW} sets no timeout-minutes, so a stuck run holds the required check for GitHub's default six hours`, "add timeout-minutes: 15 under the accord job's runs-on:");
    }
  }

  // everything below needs a config this CLI could read (Ruling "a config this CLI cannot validate")
  if (config === undefined) {
    for (const name of ['rendered-files', 'new-keys', 'scripts']) fact(name, `not checked (${NOT_CHECKED})`);
  } else {
    const r = renderHealth(ctx.root, config);
    fact('rendered-files', `${r.checked} skill, agent and plugin files checked`);
    for (const p of r.missing) gap('render-missing', `${p} is not on disk`, 'accord skills sync');
    for (const p of r.edited) gap('render-edited', `${p} was edited by hand`, 'accord skills sync, which overwrites the edit, so keep a change you want somewhere else first');
    for (const p of r.orphans) {
      gap('render-orphan', `${p} is no longer rendered for this config`, `delete it: rm -rf ${p}${p === pluginDir ? ', then remove extraKnownMarketplaces.accord and enabledPlugins["accord-panel@accord"] from .claude/settings.json' : ''}`);
    }
    for (const p of r.retired) gap('render-retired', `${p} is a file accord no longer renders`, `delete it: rm ${p}`);
    for (const h of r.hooksMissing) gap('hook-missing', h.text, h.fix);
    for (const h of r.hooksEdited) gap('hook-edited', h.text, h.fix);
    for (const h of r.hooksDoubled) gap('hook-doubled', h.text, h.fix);

    for (const k of newKeys(CONFIG_KEYS, pinned, pkg.version, setKeysOf(config))) fact('new-key', `${k.key} (since ${k.since}) unset; default: ${k.default}`);

    // trust: read, never changed (`if-allowed` computes no digest for a command no allow names)
    for (const s of declared(ctx)) {
      const i = inspect(ctx.root, s.kind, s.command, 'if-allowed');
      const named = `${s.kind} "${shown(s.command)}"`;
      if (i.state === 'allowed') fact('script', `${named} allowed here`);
      else if (i.state === 'never') gap('script-untrusted', `${named} has not been allowed in this repository, so it never runs`, FIX_TRUST(s.kind));
      else gap('script-trust-stale', `${named} ${i.state === 'other-command' ? 'is not the command that was allowed' : 'or the files it reaches changed since it was allowed'}, so it does not run`, FIX_TRUST(s.kind));
    }
  }

  // the security file (reported, never edited): each line the guard refuses
  for (const p of securityFile(ctx.snapshot)) gap('security-file', `${SECURITY} line ${p.line ?? 1}: ${p.reason}`, `edit ${SECURITY} at line ${p.line ?? 1}, as accord lint names it`);
  return { facts, gaps };
}
