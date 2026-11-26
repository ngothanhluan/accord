// ST-LN-69 D-19: the next action of every `accord worktree` output line is printed by the command itself, from this one table, so an agent in any tool does what the line says.
// A single line ends ` - next: <action>`; a block whose lines carry a path (`enter:`, `stop:`) is preceded by one line `next: <action>`, so the path lines stay as they were.

/** One kind of output line (or exit-2 refusal) of `accord worktree open`, `push`, `sync`, `check`, `clean` and `accord new ticket --worktree`. */
export type LineKind =
  | 'pruned'
  | 'fetch-failed'
  | 'behind'
  | 'trust'
  | 'synced'
  | 'push-after-sync'
  | 'push-failed'
  | 'progress-not-pushed'
  | 'removed'
  | 'deleted'
  | 'kept'
  | 'clean-failed'
  | 'clean-skipped'
  | 'clean-stopped'
  | 'note'
  | 'stop'
  | 'enter'
  | 'held'
  | 'not-held'
  | 'not-a-ticket'
  | 'not-claimed'
  | 'claimed'
  | 'session-works'
  | 'setup-failed'
  | 'held-by-other'
  | 'leave-first'
  | 'merge-of'
  | 'ticket-push-failed'
  | 'accord-off';

/** Every action is a fixed string: no path, branch or id of the repository is ever built into one. */
export const NEXT_ACTIONS: Readonly<Record<LineKind, string>> = {
  pruned: 'show this line to the owner as it is and go on with the other lines',
  'fetch-failed': 'show this line as it is and go on with the other lines: the work uses the refs already in this clone',
  behind: 'show this line as it is and go on with the next step; never sync here, the sync runs once at verify, after review',
  trust: 'show this line as it is and stop there: allowing the team script with accord trust is the owner\'s to do, never yours',
  synced: 'show this line as it is and go on with the other lines: the default branch is in the ticket branch and setup ran on it',
  'push-after-sync': 'show this line as it is, tell the owner the synced branch is local only, and run the push command the line names; when that push fails too, show git\'s message and stop',
  'push-failed': 'show this line and git\'s message after it as they are and go on with the stage\'s next step, never stop or ask the owner; after a commit was reworded, run the next branch push as accord worktree push <id> --branch --force-with-lease',
  'progress-not-pushed': 'show this line as it is and go on with the next step of the stage, never stop, ask the owner or force anything: the progress reaches origin when verify pushes the branch',
  removed: 'show this line as it is and go on with the other lines',
  deleted: 'show this line as it is and go on with the other lines',
  kept: 'show this line as it is and go on; delete and move nothing it names and never offer to: the folder and the branch stay, a file it names that accord never deletes is the owner\'s to move or delete, and a research record is never deleted or moved, only made equal to the default branch\'s copy as the line says',
  'clean-failed': 'show this line as it is and go on with the other lines: the next clean retries',
  'clean-skipped': 'show this line as it is and go on with the other lines',
  'clean-stopped': 'show this line as it is and go on with the other lines: the rest waits for the next clean',
  note: 'show this line as it is and go on: a record or a hold was not updated',
  stop: 'show the two lines below as they are and stop there: the person opens a session in that folder and types the second line; never change directory into that folder or start the next stage from this session, and edit nothing there except the people entry, the scout\'s report with the commit and push that save it, and, in a lane S ticket, its title, Understood, Done when and Scope lines with the commit and push of that ticket file',
  enter:
    'call EnterWorktree with the path on the next line, then run accord anchor there and go on at the stage it prints, without asking; from then on every command, path and edit is in that worktree; when EnterWorktree fails, show the path, tell the owner to type the continue command again or to open a session in that folder, and stop, editing nothing',
  held: 'go on with the next step',
  'not-held': 'say in one line that this tool does not refuse a second session yet, and go on with the next step',
  'not-a-ticket': 'treat the text you were given as a New request, not as a ticket id',
  'not-claimed': 'tell the owner nobody has claimed this ticket, offer Pick up, and never claim it yourself',
  claimed: 'another person holds the claim: push nothing, show this message and stop; offer to continue the ticket only when the owner means to work on it with them',
  'session-works': 'this session works another ticket: show this message and stop, editing nothing',
  'setup-failed': 'show this message and stop there: the worktree is kept, and once the owner fixes the command they continue the ticket again in this same session and follow the enter or stop line it prints; the setup commands run again on that continue',
  'held-by-other': 'another session holds this ticket: show this message and stop, editing nothing',
  'leave-first':
    "this session stands in the ticket's worktree: show this message and stop, editing nothing and removing nothing; leave the folder with ExitWorktree (action keep) first, and when that is missing or refuses, tell the owner the folder and branch go at the next session start in another folder",
  'merge-of': 'the merge or rebase stopped and was aborted: show this message and stop, editing nothing',
  'accord-off': 'offer the person to switch accord back on with node .claude/accord.mjs on and run it only on their yes; then go on',
  'ticket-push-failed': 'no stop line follows: carry any people entry, run the push this message names, and once it succeeds run accord worktree open for this ticket with --continue and follow the line it prints; when that push fails again, show git\'s message and stop',
};

/** `next: <action>`: the line printed before an `enter:` or `stop:` block. */
export function nextLine(kind: LineKind): string {
  return `next: ${NEXT_ACTIONS[kind]}`;
}

/** `line` (one line, no newline) with ` - next: <action>` at its end. */
export function withNext(kind: LineKind, line: string): string {
  return `${line} - ${nextLine(kind)}`;
}

/** The kind of a line of `accord worktree clean`, from its own prefix; undefined for a line that is none of them (a `pruned refs/...` line, a `prune of origin failed` line). */
function cleanKind(text: string): LineKind | undefined {
  if (text.startsWith('removed ')) return 'removed';
  if (text.startsWith('deleted ')) return 'deleted';
  if (text.startsWith('kept ')) return 'kept';
  if (text.startsWith('note ')) return 'note';
  if (text.startsWith('clean failed')) return 'clean-failed';
  if (text.startsWith('clean skipped')) return 'clean-skipped';
  if (text.startsWith('clean stopped')) return 'clean-stopped';
  if (text.startsWith('fetch from origin failed')) return 'fetch-failed';
  if (text.startsWith('accord is switched off')) return 'accord-off';
  return undefined;
}

/** A clean line with its next action at the end of its first line; a line of no clean kind stays as it is. */
export function cleanLine(text: string): string {
  const kind = cleanKind(text);
  return kind === undefined ? text : withNextOnFirst(kind, text);
}

/** `text` with ` - next: <action>` at the end of its first line; the lines after it (a path, git's message, a ready-to-copy command) stay as they were. */
export function withNextOnFirst(kind: LineKind, text: string): string {
  const cut = text.indexOf('\n');
  return cut < 0 ? withNext(kind, text) : withNext(kind, text.slice(0, cut)) + text.slice(cut);
}
