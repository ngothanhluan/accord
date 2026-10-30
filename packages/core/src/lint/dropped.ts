// Spec §3: a dropped ticket says why, and nothing live waits on it. Levels live in rules.ts.
import { headingKey, stripHtmlComments } from '../load/sections.js';
import type { Rule } from './rules.js';

export const droppedReason: Rule['check'] = (snapshot) =>
  Object.values(snapshot.tickets).flatMap((t) => {
    if (t.frontmatter?.status !== 'dropped') return [];
    const s = t.sections.find((x) => headingKey(x.heading) === 'dropped');
    const said = s !== undefined && stripHtmlComments(s.lines).some((l) => l.text.trim() !== '');
    return said ? [] : [{ file: t.file, pointer: '/status', reason: 'a dropped ticket needs a "## Dropped" section saying why' }];
  });

export const dependsDropped: Rule['check'] = (snapshot) =>
  Object.values(snapshot.tickets).flatMap((t) => {
    const own = t.frontmatter?.status;
    if (own === 'dropped' || own === 'archived') return [];
    return (t.frontmatter?.depends_on ?? []).flatMap((d, i) =>
      Object.hasOwn(snapshot.tickets, d) && snapshot.tickets[d].frontmatter?.status === 'dropped'
        ? [{ file: t.file, pointer: `/depends_on/${i}`, reason: `depends_on names "${d}", which is dropped; re-plan this ticket without it` }]
        : [],
    );
  });
