// Spec §9: every report case traces to a criterion (a scenario's @test:<id>), a named risk (risk: in its
// name), or the adoption baseline (accord/tests-baseline.txt). A warning in lint; gate.test-untraced makes
// it an error at Done for lane tickets.
import { normaliseKey } from '../load/snapshot.js';
import type { RepoSnapshot } from '../model/snapshot.js';
import type { Rule } from './rules.js';

/** Untraced report case ids, sorted in code-point order; [] when no report is loaded. */
export function untracedTests(snapshot: RepoSnapshot): string[] {
  if (snapshot.tests === undefined) return [];
  const named = new Set(
    Object.values(snapshot.tickets).flatMap((t) =>
      t.scenarios.flatMap((s) => s.tags.filter((x) => x.startsWith('@test:')).map((x) => x.slice('@test:'.length))),
    ),
  );
  const baseline = new Set(snapshot.testsBaseline ?? []);
  return Object.keys(snapshot.tests)
    .filter((id) => !named.has(id) && !baseline.has(id) && !id.includes('risk:'))
    .sort();
}

export const UNTRACED = (id: string): string =>
  `test "${id}" is named by no scenario's @test:, carries no risk:, and is not in accord/tests-baseline.txt`;

/** Silent until the repository holds a lane ticket: the first lane ticket opts the repository into the policy. */
export const testUntraced: Rule['check'] = (snapshot) => {
  const report = snapshot.config?.tests?.report;
  if (report === undefined || !Object.values(snapshot.tickets).some((t) => t.frontmatter?.lane !== undefined)) return [];
  return untracedTests(snapshot).map((id) => ({ file: normaliseKey(report), reason: UNTRACED(id) }));
};
