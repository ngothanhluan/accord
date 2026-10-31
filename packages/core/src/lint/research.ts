// ST-LN-13: every entry of a ticket's `research:` key names a dated record under accord/research/.
import { isResearchPath, recordHeaderFaults } from '../load/research.js';
import type { Draft, Rule } from './rules.js';

export const researchReference: Rule['check'] = (snapshot) =>
  Object.values(snapshot.tickets).flatMap((t) =>
    (t.frontmatter?.research ?? []).flatMap((p, i): Draft[] => {
      const at = (reason: string): Draft[] => [{ file: t.file, pointer: `/research/${i}`, reason: `research lists "${p}", ${reason}` }];
      if (!isResearchPath(p)) return at('which is not a path under accord/research/');
      if (!Object.hasOwn(snapshot.files, p)) return at('which is not a file in the repository');
      const faults = recordHeaderFaults(snapshot.files[p]);
      if (faults.length === 2) return at('whose first five lines hold neither "Date: <YYYY-MM-DD>" nor "Repository at <sha>"');
      if (faults[0] === 'date') return at('whose first five lines hold no "Date: <YYYY-MM-DD>"');
      if (faults[0] === 'commit') return at('whose first five lines hold no "Repository at <sha>"');
      return [];
    }),
  );
