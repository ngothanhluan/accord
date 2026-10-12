// Spec §5: depends_on names tickets in this snapshot and never forms a cycle. Levels live in rules.ts.
import type { RepoSnapshot } from '../model/snapshot.js';
import type { Draft, Rule } from './rules.js';

/** The ids `id` depends on that exist in the snapshot. */
const known = (snapshot: RepoSnapshot, id: string): string[] =>
  (snapshot.tickets[id].frontmatter?.depends_on ?? []).filter((d) => Object.hasOwn(snapshot.tickets, d));

/** One finding per id that names no ticket, at its array pointer. */
export const dependsUnknown: Rule['check'] = (snapshot) =>
  Object.values(snapshot.tickets).flatMap((t) =>
    (t.frontmatter?.depends_on ?? [])
      .map((d, i) => ({ d, i }))
      .filter(({ d }) => !Object.hasOwn(snapshot.tickets, d))
      .map(({ d, i }) => ({
        file: t.file,
        pointer: `/depends_on/${i}`,
        reason: `depends_on names "${d}", which is not a ticket in accord/tickets/`,
      })),
  );

/**
 * Tarjan's strongly connected components over the known edges. A component of two or more tickets, or
 * one ticket that depends on itself, is a cycle; it is reported once, on its smallest id in code-point
 * order, so the finding does not depend on the order tickets were loaded.
 */
export const dependsCycle: Rule['check'] = (snapshot) => {
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const out: Draft[] = [];
  let counter = 0;

  const visit = (v: string): void => {
    index.set(v, counter);
    low.set(v, counter);
    counter++;
    stack.push(v);
    onStack.add(v);
    for (const w of known(snapshot, v)) {
      if (!index.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v) ?? 0, low.get(w) ?? 0));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v) ?? 0, index.get(w) ?? 0));
      }
    }
    if (low.get(v) !== index.get(v)) return;
    const component: string[] = [];
    let w: string | undefined;
    do {
      w = stack.pop();
      if (w === undefined) break;
      onStack.delete(w);
      component.push(w);
    } while (w !== v);
    if (component.length > 1 || known(snapshot, v).includes(v)) {
      component.sort();
      out.push({
        file: snapshot.tickets[component[0]].file,
        pointer: '/depends_on',
        reason: `depends_on forms a cycle among ${component.join(', ')}`,
      });
    }
  };

  for (const id of Object.keys(snapshot.tickets).sort()) if (!index.has(id)) visit(id);
  return out;
};
