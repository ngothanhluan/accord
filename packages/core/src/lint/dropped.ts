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

// ST-LN-31 D-03: a lane never drops to lane S after approval; approved_hash is what accord approve wrote.
export const droppedApproved: Rule['check'] = (snapshot) =>
  Object.values(snapshot.tickets).flatMap((t) => {
    if (t.frontmatter?.status !== 'dropped' || !t.frontmatter.approved_hash) return [];
    const s = t.sections.find((x) => headingKey(x.heading) === 'dropped');
    const moved = s !== undefined && stripHtmlComments(s.lines).some((l) => l.text.trim().toLowerCase() === 'moved to lane s');
    return moved ? [{ file: t.file, pointer: '/approved_hash', reason: 'an approved ticket never moves to lane S: approved_hash is set and ## Dropped says moved to lane S' }] : [];
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
