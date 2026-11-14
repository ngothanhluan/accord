// ST-LN-94 94-ac-4, D-11, D-20: lane R's tokens, the weighted sum of the assistant messages in the checkout's own Claude Code transcripts
// since the claim, or why they are not measured. Ported from the repo-internal benchmark's transcript reading (usage counted once per
// message id, the session and subagent file layout) and its weights (fresh 1, cache-write 1.25, cache-read 0.1, output 5); nothing is
// imported from there. Only summed counts and the earliest timestamp leave this file: no transcript text is returned or printed.
import { closeSync, openSync, readdirSync, readSync, type Dirent } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type TranscriptTokens = { tokens: number } | { notMeasured: string };

const NO_FOLDER = 'no Claude Code transcript folder for this checkout';
const NO_LINE = 'no timestamped line in the Claude Code transcript folder for this checkout';
const PARTIAL =
  'the earliest transcript left starts after the claim, so part of the time since it may be missing (Claude Code deletes transcripts after 30 days by default)';

/** Directory entries, or none when the folder cannot be read. */
function entries(dir: string): Dirent[] {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/** The `*.jsonl` files directly in `dir`; a symbolic link is never followed (a Dirent reports the link itself). */
const jsonlIn = (dir: string) => entries(dir).filter((e) => e.isFile() && e.name.endsWith('.jsonl')).map((e) => join(dir, e.name));

/** Calls `line` with each line of `file`, read in chunks so a large transcript is never held whole; an unreadable file gives no line. */
function eachLine(file: string, line: (text: string) => void): void {
  let fd: number;
  try {
    fd = openSync(file, 'r');
  } catch {
    return;
  }
  try {
    const buf = Buffer.alloc(1 << 20);
    let rest = Buffer.alloc(0);
    for (let n = readSync(fd, buf, 0, buf.length, null); n > 0; n = readSync(fd, buf, 0, buf.length, null)) {
      const chunk = rest.length === 0 ? buf.subarray(0, n) : Buffer.concat([rest, buf.subarray(0, n)]);
      let start = 0;
      for (let i = chunk.indexOf(10, start); i !== -1; i = chunk.indexOf(10, start)) {
        line(chunk.toString('utf8', start, i));
        start = i + 1;
      }
      rest = Buffer.from(chunk.subarray(start));
    }
    if (rest.length > 0) line(rest.toString('utf8'));
  } catch {
    // A file that fails part way gives the lines read so far.
  } finally {
    closeSync(fd);
  }
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

/**
 * The weighted tokens of the checkout's transcripts from `sinceSeconds` on, or why they are not measured. The folder is
 * `<CLAUDE_CONFIG_DIR or ~/.claude>/projects/<root with every character outside A-Z, a-z, 0-9 as ->`, matched case-insensitively and
 * exactly (another checkout's folder, even one whose name starts with this one's, is never read). Its session files and the subagent
 * files beneath them (`<session>/subagents/*.jsonl`) are read; a malformed line is skipped. D-20: when no line has a timestamp, or the
 * earliest one, in whole seconds, is later than `sinceSeconds`, the count may be partial and is not measured.
 */
export function transcriptTokens(root: string, sinceSeconds: number, env: NodeJS.ProcessEnv = process.env): TranscriptTokens {
  const base = env.CLAUDE_CONFIG_DIR !== undefined && env.CLAUDE_CONFIG_DIR !== '' ? env.CLAUDE_CONFIG_DIR : join(homedir(), '.claude');
  const projects = join(base, 'projects');
  const want = root.replace(/[^A-Za-z0-9]/g, '-').toLowerCase();
  const own = entries(projects).find((e) => e.isDirectory() && e.name.toLowerCase() === want);
  if (own === undefined) return { notMeasured: NO_FOLDER };
  const folder = join(projects, own.name);
  const files = jsonlIn(folder);
  for (const e of entries(folder)) if (e.isDirectory()) files.push(...jsonlIn(join(folder, e.name, 'subagents')));

  let earliest: number | undefined; // whole seconds
  const seen = new Set<string>();
  let tokens = 0;
  for (const file of files) {
    eachLine(file, (text) => {
      let o: unknown;
      try {
        o = JSON.parse(text);
      } catch {
        return;
      }
      if (typeof o !== 'object' || o === null) return;
      const line = o as { type?: unknown; timestamp?: unknown; message?: { id?: unknown; usage?: Record<string, unknown> } };
      if (typeof line.timestamp !== 'string') return;
      const ms = Date.parse(line.timestamp);
      if (Number.isNaN(ms)) return;
      const second = Math.floor(ms / 1000);
      if (earliest === undefined || second < earliest) earliest = second;
      if (line.type !== 'assistant' || second < sinceSeconds) return;
      const id = line.message?.id;
      const u = line.message?.usage;
      // A streamed message repeats its usage on every content block; the first is counted, once per message id across the folder.
      if (typeof id !== 'string' || typeof u !== 'object' || u === null || seen.has(id)) return;
      seen.add(id);
      tokens += Math.round(
        num(u.input_tokens) + 1.25 * num(u.cache_creation_input_tokens) + 0.1 * num(u.cache_read_input_tokens) + 5 * num(u.output_tokens),
      );
    });
  }
  if (earliest === undefined) return { notMeasured: NO_LINE };
  if (earliest > sinceSeconds) return { notMeasured: PARTIAL };
  return { tokens };
}
