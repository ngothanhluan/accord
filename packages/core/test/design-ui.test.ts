// Phase 11 G3 (D-07 to D-11, D-16; 11-ac-10, 11-ac-11): the spec's UI tickets section, the design record and the release notes describe the ui work. The spec says the visual options at approach, the four
// screenshot-or-owner tiers, the name-only check at the verified commit, and no longer says `blocked`, never pass for a UI scenario; docs/design.md has the **UI tickets.** paragraph and names the owner
// check in its *Fresh context* sentence; releases.md lists the G3 lines. The helpers follow design-lenses.test.ts (copied, not imported).
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const spec = read('../../../docs/specs/2026-10-12-workflow-layer-design.md');
const design = read('../../../docs/design.md');
const releases = read('../../../docs/releases.md');
const flat = (text: string): string => text.replace(/\s+/g, ' ');
/** The phrases a text lacks, so a failing case names each one. */
const lacks = (text: string, parts: readonly string[]): string[] => parts.filter((p) => !text.includes(p));
/** The paragraph of docs/design.md that opens with the bold name, up to the next blank line; empty when there is none. */
const paragraph = (name: string): string => {
  const start = design.indexOf(`**${name}.**`);
  if (start < 0) return '';
  const end = design.indexOf('\n\n', start);
  return design.slice(start, end < 0 ? undefined : end);
};
/** The `## Unreleased` section of releases.md, up to the next `## ` heading; empty when there is none. */
const unreleased = (): string => {
  const start = releases.indexOf('\n## Unreleased');
  if (start < 0) return '';
  const end = releases.indexOf('\n## ', start + 1);
  return releases.slice(start, end < 0 ? undefined : end);
};
/** The UI tickets section of the spec: from its bold heading to the next bold heading. */
const uiSection = (): string => {
  const start = spec.indexOf('**UI tickets**');
  if (start < 0) return '';
  const end = spec.indexOf('\n**', start + 1);
  return spec.slice(start, end < 0 ? undefined : end);
};

it('risk:regression the spec, design record and release notes describe the ui work (D-07 to D-11, D-16)', () => {
  const bad: string[] = [];

  const section = flat(uiSection());
  if (section === '') bad.push('the spec has no **UI tickets** section');
  for (const p of lacks(section, [
    '`ui: { direction: <name>, build: <name>, review: <name> }`',
    '`ui.screenshots`',
    "the designer's built-in direction",
    'no extra build skill',
    "the `ui` lens's own checklist alone",
    'two or three visual options',
    '`accord/assets/<id>/option-1.html`',
    "owner's pick",
    '`accord approve`',
    '`prototype.html`',
    '`- Chosen:`',
    'four tiers',
    '`ac-<n>-<state>.<ext>`',
    'the owner check',
    'a name-only check at the verified commit',
    '`gate.ui-evidence-missing`',
  ])) bad.push('spec lacks: ' + p);
  if (/never pass/.test(section)) bad.push('the spec UI tickets section still says "never pass"');
  if (/Without a browser available/.test(section)) bad.push('the spec UI tickets section still says a missing browser blocks');

  const ui = flat(paragraph('UI tickets'));
  if (ui === '') bad.push('docs/design.md has no **UI tickets.** paragraph');
  for (const p of lacks(ui, [
    '`ui.direction`',
    '`ui.build`',
    '`ui.review`',
    '`ui.screenshots`',
    'a built-in default',
    '`accord-executor-ui`',
    '`accord-reviewer-ui`',
    '`agent: accord-executor-ui`',
    'the dispatch hook refuses',
    'built-in `ui` lens',
    'two or three visual options',
    '`option-1.html`',
    '`prototype.html`',
    '`Tier: command`',
    '`Tier: verifier`',
    '`Tier: manual`',
    '`Tier: owner check`',
    '`Evidence commit: <sha>`',
    '`gate.ui-evidence-missing`',
    'checks only names',
    '`load.tier-invalid`',
    'A ticket claimed before 0.23.0',
    '`UI_EVIDENCE_FROM`',
    'Parity exception (Phase 11)',
    'Claude Code',
  ])) bad.push('design.md **UI tickets.** lacks: ' + p);
  if (!/Parity exception \(Phase 11\)[^.]*(?:agent files|UI agents|hook)/.test(ui)) bad.push('design.md **UI tickets.** has no parity exception sentence naming the agents or the hook');

  const fresh = flat(design.slice(design.indexOf('*Fresh context.*'), design.indexOf('\n', design.indexOf('*Fresh context.*'))));
  for (const p of lacks(fresh, ['`@ui` criterion', "owner's check", '`Tier: owner check`'])) bad.push('design.md *Fresh context* lacks: ' + p);

  const notes = flat(unreleased());
  if (notes === '') bad.push('releases.md has no ## Unreleased section');
  for (const p of lacks(notes, [
    '`ui:`',
    '`ui.direction`',
    '`ui.build`',
    '`ui.review`',
    '`ui.screenshots`',
    '`accord-executor-ui`',
    '`accord-reviewer-ui`',
    '`agent:` line',
    'dispatch hook',
    'built-in `ui` lens',
    'visual options',
    '`Tier:`',
    '`Evidence commit:`',
    '`Owner:`',
    '`gate.ui-evidence-missing`',
    '`load.tier-invalid`',
    'claimed before 0.23.0',
  ])) bad.push('releases.md ## Unreleased lacks: ' + p);

  expect(bad).toEqual([]);
});
