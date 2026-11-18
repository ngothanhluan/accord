// ST-LN-69 D-19: every `accord worktree` output line that worktree.md maps names its next action itself, from one table (NEXT_ACTIONS).
import { expect, it } from 'vitest';
import { NEXT_ACTIONS, nextLine, withNext } from '../src/commands/next-action.js';
import type { LineKind } from '../src/commands/next-action.js';

// The kinds of output line (and exit-2 refusal) that worktree.md maps at acddb5f2, one name each:
// `pruned`, `fetch from origin failed`, `behind:` and its trust form, `merged:`/`rebased:`/`synced:`, both `push of` forms,
// `removed`/`deleted`/`kept`/`clean failed`/`clean skipped`/`clean stopped`, `note <id>:`, `stop:`, `enter:`, `held:`, `not held:`,
// and the exit-2 messages `not a ticket:`, `not claimed:`, `claimed:`, `this session works`, a setup command, a session that holds the ticket, `merge of`.
const MAPPED: LineKind[] = [
  'pruned',
  'fetch-failed',
  'behind',
  'trust',
  'synced',
  'push-after-sync',
  'push-failed',
  'removed',
  'deleted',
  'kept',
  'clean-failed',
  'clean-skipped',
  'clean-stopped',
  'note',
  'stop',
  'enter',
  'held',
  'not-held',
  'not-a-ticket',
  'not-claimed',
  'claimed',
  'session-works',
  'setup-failed',
  'held-by-other',
  'merge-of',
];

it('ac-12 every mapped worktree line kind has a next action (ST-LN-69 7-ac-12)', () => {
  for (const kind of MAPPED) {
    const action = NEXT_ACTIONS[kind];
    expect(typeof action, kind).toBe('string');
    expect(action.trim(), kind).not.toBe('');
    expect(action, kind).not.toContain('\n');
    expect(action, kind).not.toContain(' - next:');
  }
  expect(withNext('pruned', 'pruned /x: gone')).toBe(`pruned /x: gone - next: ${NEXT_ACTIONS.pruned}`);
  expect(nextLine('enter')).toBe(`next: ${NEXT_ACTIONS.enter}`);
});
