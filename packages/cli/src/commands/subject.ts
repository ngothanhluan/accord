// ST-LN-50 D-06 `accord subject <name> <id> [tail...]`: print the subject accord writes for one kind of commit, rendered from the team's template
// (`commits.subjects.<name>`, else today's text), so a skill never carries a literal subject. A tail (a round count) follows after one space.
// Phase 8.1 W2: for `people` the second argument is the email of the people entry, not a ticket id.
import { renderSubject, SUBJECT_NAMES } from '@accord-dev/accord-core';
import type { SubjectName } from '@accord-dev/accord-core';
import { UsageError } from '../load/fs.js';
import { shown } from '../load/script-trust.js';
import type { CommandContext } from '../run.js';
import { ID } from './worktree.js';

/** The schema's `people` key pattern (config.schema.json): one `@`, no space, and nothing before or after it that is one. */
const EMAIL = /^[^@\s]+@[^@\s]+$/;
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;

export function subject(ctx: CommandContext, name: string, id: string, tail: string[]): number {
  if (!(SUBJECT_NAMES as readonly string[]).includes(name)) throw new UsageError(`no subject ${name} - the names are ${SUBJECT_NAMES.join(', ')}`);
  if (name === 'people') {
    if (!EMAIL.test(id) || INVISIBLE.test(id)) throw new UsageError(`not an email: ${shown(id)}; accord subject people takes the email of the people entry`);
  } else if (!ID.test(id)) throw new UsageError('not a valid ticket id: ' + id);
  const rest = tail.join(' ').trim();
  if (/[\r\n]/.test(rest)) throw new UsageError('the tail must be one line of text');
  ctx.stdout.write(renderSubject(ctx.snapshot.config, name as SubjectName, id, rest) + '\n');
  return 0;
}
