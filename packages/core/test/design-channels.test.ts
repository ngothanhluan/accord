// Phase 8.5 8.5-ac-20: docs/design.md says, for each agent, which command and which copy of the conventions it gets, and states every gap and parity exception of the product-text delivery.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AGENT_CHANNELS } from '../src/index.js';

const design = readFileSync(new URL('../../../docs/design.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const lines = design.split('\n');

/** The lines from the one starting with `start` up to, not including, the next line starting with `stop`. */
function part(start: string, stop: string): string {
  const from = lines.findIndex((l) => l.startsWith(start));
  expect(from, `docs/design.md has no ${start} paragraph`).toBeGreaterThanOrEqual(0);
  const to = lines.findIndex((l, i) => i > from && l.startsWith(stop));
  expect(to, `docs/design.md has no ${stop} after ${start}`).toBeGreaterThan(from);
  return lines.slice(from, to).join('\n');
}

describe('docs/design.md states the product-text channels (8.5-ac-20)', () => {
  it("risk:regression the design states each agent's channel and every gap of the product-text delivery (8.5-ac-20 D-07 D-19 D-26)", () => {
    const text = part('**Product text.**', '**Agents.**');
    const tableAt = text.split('\n').findIndex((l) => l === '| Agent | Gets | From | Conventions copy |');
    expect(tableAt, 'the channels table header is missing').toBeGreaterThanOrEqual(0);
    const rows = text
      .split('\n')
      .slice(tableAt)
      .filter((l) => l.startsWith('|'));

    for (const [name, channel] of Object.entries(AGENT_CHANNELS)) {
      // the first cell holds no backticks: the Routing table's own test counts every line that starts with a backtick cell between its two paragraphs
      const row = rows.find((r) => r.startsWith(`| ${name} `));
      expect(row, `no table row for ${name}`).toBeDefined();
      expect(row, `the row of ${name} lacks its command`).toContain(channel.command);
    }
    for (const who of ['the main session', 'the lane S session']) {
      const row = rows.find((r) => r.startsWith(`| ${who} `));
      expect(row, `no table row for ${who}`).toBeDefined();
      expect(row).toContain('accord anchor');
    }
    for (const name of ['accord-verifier', 'accord-debugger', 'accord-researcher']) {
      const row = rows.find((r) => r.startsWith(`| ${name} `));
      expect(row, `no table row for ${name}`).toBeDefined();
      expect(row, `the row of ${name} lacks its channel`).toContain('the SubagentStart hook only');
    }

    for (const phrase of [
      'depends on the last fetch of that clone',
      'lives on the working machine',
      'deferred and shown to the owner at verify',
      'nothing refuses a session that skipped it',
      "when the pull request's repository differs from origin's",
      'about 2 KB',
      'until 999.51 removes them',
      'Cursor, Codex and Copilot',
      'through no channel',
    ])
      expect(text, `the Product text part lacks: ${phrase}`).toContain(phrase);
    expect(text).toMatch(/ticket text, delivered unchecked[\s\S]{0,400}?backlog 999\.(?!51\b)\d+/);

    const hooks = part('**Hooks.**', '## 10.');
    expect(hooks).toContain('`accord anchor` prints the same ruleset first on every tool but Claude Code');
    expect(hooks).toContain('the SubagentStart text is unchanged');
  });

  // Phase 08.6 D-04, D-06: the design lists no auditor and says in one line what catches a criterion with two readings.
  it('risk:regression docs/design.md lists no auditor and says what catches a criterion with two readings (D-04 D-06)', () => {
    expect(design.match(/auditor/gi) ?? [], 'docs/design.md still names the auditor').toEqual([]);
    const agents = part('**Agents.**', '**Routing.**');
    expect(agents).toContain('`scout`, `critic`, `planner`, `executor`, `reviewer`, `final-reviewer`, `foreign-reviewer`, `judge`, `verifier`, `debugger`, and `researcher`');
    const line = lines.filter((l) => l.includes('a criterion with two readings is caught by the approach critic'));
    expect(line, 'one line of the design says what catches a criterion with two readings').toHaveLength(1);
    for (const phrase of ["the owner's approval of the short approach view", 'acceptance tests written red', 'once Phase 10 builds them'])
      expect(line[0], `the line lacks: ${phrase}`).toContain(phrase);
    // the line comes after the Stages table and before the paragraph on switching stages off
    expect(lines.indexOf(line[0] as string)).toBeGreaterThan(lines.findIndex((l) => l.startsWith('| verify | `verify.md` |')));
    expect(lines.indexOf(line[0] as string)).toBeLessThan(lines.findIndex((l) => l.startsWith('A team may switch `discuss`')));
  });
});
