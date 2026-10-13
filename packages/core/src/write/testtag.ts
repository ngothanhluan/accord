// Writes `@test:<id>` onto a scenario's tag line: the one edit task-done makes to a ticket.
import { normaliseText } from '../load/frontmatter.js';
import type { ScenarioRef } from '../model/snapshot.js';

/**
 * For each map whose scenario lacks `@test:<test>`, inserts ` @test:<test>` right after the `@ac-n` token
 * on the nearest line above the scenario, so a trailing `#` comment cannot swallow it. Maps onto a scenario
 * the ticket lacks are skipped. Output is LF, no BOM.
 */
export function writeTestTags(
  text: string,
  scenarios: ScenarioRef[],
  maps: { test: string; ac: string }[],
): { text: string; written: { ac: string; test: string }[] } {
  const lines = normaliseText(text).split('\n');
  const written: { ac: string; test: string }[] = [];
  for (const { test, ac } of maps) {
    const sc = scenarios.find((s) => '@' + s.acTag === ac);
    if (sc === undefined || sc.tags.includes('@test:' + test)) continue;
    for (let i = sc.line - 2; i >= 0; i--) {
      const m = new RegExp(String.raw`(^|\s)${ac}(?=\s|$)`).exec(lines[i]);
      if (m === null) continue;
      const at = m.index + m[0].length;
      lines[i] = lines[i].slice(0, at) + ' @test:' + test + lines[i].slice(at);
      written.push({ ac, test });
      break;
    }
  }
  return { text: lines.join('\n'), written };
}
