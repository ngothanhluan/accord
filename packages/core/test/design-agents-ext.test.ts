// Phase 11 G1 (D-01, D-02, D-03, D-17; 11-ac-4): the design record states what a team may add to an agent by role, what accord refuses, and the write risk
// it accepts on read-only roles; the release notes name the key, the rule and the refusals. The helpers follow design-hooks-parity.test.ts (copied, not imported).
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const design = read('../../../docs/design.md');
const releases = read('../../../docs/releases.md');
const flat = (text: string): string => text.replace(/\s+/g, ' ');
/** The phrases a text lacks, so a failing case names each one. */
const lacks = (text: string, parts: readonly string[]): string[] => parts.filter((p) => !text.includes(p));
/** The paragraph that opens with the bold name, up to the next blank line; empty when there is none. */
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

it('risk:regression the design record states the additions, the lock and the MCP-write risk on read-only roles (11-ac-4, D-01, D-02, D-03, D-17)', () => {
  const agents = flat(paragraph('Agents'));
  expect(agents, 'docs/design.md has no **Agents.** paragraph').not.toBe('');
  expect(
    lacks(agents, [
      '`agents.<role>.mcp`',
      '`.skills`',
      '`.tools`',
      '`accord skills sync`',
      'An MCP server is allowed on a read-only role',
      'accord cannot tell whether a server writes',
      'caught only at review',
      '`## Undeclared files`',
      'once a commit holds it',
      "the researcher's",
      '`lint.agents-config`',
      'inline stdio server',
      'judge and the foreign reviewer take none',
    ]),
  ).toEqual([]);
});

it('risk:regression the executor sentence is conditional on agents.executor (11-ac-4, D-01)', () => {
  const agents = flat(paragraph('Agents'));
  expect(agents).toContain('no Skill, MCP or web tool unless `agents.executor` adds one');
  expect(agents).not.toContain('no Skill, MCP or web tool:');
});

it('risk:regression the Agents paragraph declares the agents: block as one Phase 11 parity exception (11-ac-4)', () => {
  const agents = paragraph('Agents');
  expect(agents.match(/Parity exception \(Phase 11\)/g) ?? []).toHaveLength(1);
  const sentence = flat(agents.slice(agents.indexOf('Parity exception (Phase 11)')));
  expect(sentence).toContain('`agents:`');
  expect(sentence).toContain('`claude` runtime only');
});

it('risk:regression releases.md opens with Unreleased naming agents:, lint.agents-config, the stdio refusal, the inline fields and the pin before 0.23.0 (11-ac-4, D-17)', () => {
  expect(releases.slice(releases.search(/^## /m)).startsWith('## Unreleased\n'), 'the first section of docs/releases.md is not ## Unreleased').toBe(true);
  const section = flat(unreleased());
  expect(lacks(section, ['`agents:`', '`lint.agents-config`', 'stdio', '`type` and `url`', '`env`', '`headers`', 'pinned before 0.23.0', '`accord upgrade`'])).toEqual([]);
});

// Every lint rule G1 registered is named in the release notes: a rule a team can meet in `accord lint` without a line saying what it is would be a surprise at upgrade.
it('risk:regression every rule id G1 registered appears in the Unreleased section of releases.md (11-ac-4)', () => {
  const G1_RULES = ['lint.agents-config'] as const;
  expect(lacks(unreleased(), G1_RULES)).toEqual([]);
});
