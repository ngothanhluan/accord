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

/**
 * Silent until the repository holds a lane M, L or P ticket: that ticket opts the repository into the policy; a lane S or lane R
 * (ST-LN-94 D-10) ticket alone does not.
 */
const OPTS_IN: readonly string[] = ['M', 'L', 'P'];
export const testUntraced: Rule['check'] = (snapshot) => {
  const report = snapshot.config?.tests?.report;
  if (report === undefined || !Object.values(snapshot.tickets).some((t) => OPTS_IN.includes(t.frontmatter?.lane ?? ''))) return [];
  return untracedTests(snapshot).map((id) => ({ file: normaliseKey(report), reason: UNTRACED(id) }));
};

/** Why a baseline id can go: a scenario's `@test:` now names it, it carries `risk:`, or it is absent from a report that holds other cases of its file. */
export type RemovableWhy = 'test' | 'risk' | 'absent';

/**
 * Phase 8.2 D-05, D-11: the lines of accord/tests-baseline.txt that can be deleted now, in baseline order, and how many ids could not be judged. The `named` set is `untracedTests`'s own. An id the
 * report does not hold is judged absent only when the report holds at least one case of the same file (the text before its first `#`): this repository's `tests.affected` writes the same report
 * path with a subset of the suite, so a missing id whose file has no case in the report may simply not have run; such an id, and one with no `#`, is counted in `notJudged` and never listed.
 * Undefined when the snapshot holds no report or no baseline: nothing can be judged, which the caller says instead of reporting that none can go.
 */
export function removableBaseline(snapshot: RepoSnapshot): { removable: { id: string; why: RemovableWhy }[]; notJudged: number } | undefined {
  if (snapshot.tests === undefined || snapshot.testsBaseline === undefined) return undefined;
  const named = new Set(
    Object.values(snapshot.tickets).flatMap((t) =>
      t.scenarios.flatMap((s) => s.tags.filter((x) => x.startsWith('@test:')).map((x) => x.slice('@test:'.length))),
    ),
  );
  const fileOf = (id: string): string | undefined => (id.includes('#') ? id.slice(0, id.indexOf('#')) : undefined);
  const inReport = new Set(Object.keys(snapshot.tests).flatMap((id) => fileOf(id) ?? []));
  const removable: { id: string; why: RemovableWhy }[] = [];
  let notJudged = 0;
  for (const id of snapshot.testsBaseline) {
    if (named.has(id)) removable.push({ id, why: 'test' });
    else if (id.includes('risk:')) removable.push({ id, why: 'risk' });
    else if (!Object.hasOwn(snapshot.tests, id)) {
      const file = fileOf(id);
      if (file !== undefined && inReport.has(file)) removable.push({ id, why: 'absent' });
      else notJudged++;
    }
  }
  return { removable, notJudged };
}
