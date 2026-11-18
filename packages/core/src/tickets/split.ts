// ST-LN-28 D-14: the split file an approved epic is written from, `accord new ticket --type epic --lane L --split <file>`.
// The session writes it after the owner approved the split; this reads it and checks it whole, so the CLI refuses a bad split
// before it writes any file. YAML, core schema with numerics kept as strings (a title or an id that looks like a number keeps
// its spelling); no tag builds an object. Pure: no I/O.
import { parseDocument } from 'yaml';
import { stringNumerics } from '../load/yaml.js';

export interface SplitStory {
  title: string;
  /** one to five lines, each one line of text */
  intent: string[];
  /** 1-based numbers of earlier stories this one depends on, ascending and without repeats */
  after: number[];
  /** the story's ticket id, only in a repository where accord assigns none */
  id?: string;
}

export interface Split {
  title: string;
  intent: string[];
  vetoes: string[];
  /** two to ten stories, in the order they are written and printed */
  stories: SplitStory[];
  /** the epic's ticket id, only in a repository where accord assigns none */
  id?: string;
}

const MIN_STORIES = 2;
const MAX_STORIES = 10;
const MAX_INTENT = 5;
const EPIC_KEYS = ['id', 'title', 'intent', 'vetoes', 'stories'];
const STORY_KEYS = ['id', 'title', 'intent', 'after'];

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** `value` as one line of text, or the reason it is not one. */
function oneLine(value: unknown, what: string): string | { problem: string } {
  if (typeof value !== 'string' || value.trim() === '') return { problem: what + ' is missing or empty' };
  if (/[\r\n]/.test(value)) return { problem: what + ' must be one line of text' };
  return value.trim();
}

/** A list of lines: every entry one line of text; the count is checked by the caller. */
function lineList(value: unknown, what: string, problems: string[]): string[] | undefined {
  if (!Array.isArray(value)) {
    problems.push(what + ' must be a list of lines, one "- text" entry per line');
    return undefined;
  }
  const out: string[] = [];
  let bad = false;
  for (const entry of value) {
    const line = oneLine(entry, what + ' line');
    if (typeof line === 'string') out.push(line);
    else {
      problems.push(line.problem.replace(' is missing or empty', ' has an empty or non-text entry'));
      bad = true;
      break;
    }
  }
  return bad ? undefined : out;
}

/** The ids of an `after:` list as 1-based numbers; a scalar counts as a list of one. */
function afterList(value: unknown, n: number, count: number, problems: string[]): number[] {
  const label = 'story ' + n;
  const entries = value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];
  const out: number[] = [];
  for (const entry of entries) {
    if (typeof entry !== 'string' || !/^(0|[1-9][0-9]{0,8})$/.test(entry)) {
      problems.push(label + ': after takes story numbers, such as after: [1, 2]');
      return [];
    }
    const k = Number(entry);
    if (k < 1 || k > count) problems.push(label + ': after ' + k + ' is outside the list of ' + count + ' stories');
    else if (k === n) problems.push(label + ': after ' + k + ' names the story itself');
    else if (k > n) problems.push(label + ': after ' + k + ' names a later story, so the depends_on order would not be acyclic');
    else if (!out.includes(k)) out.push(k);
  }
  return out.sort((a, b) => a - b);
}

/** `id` of the epic or a story: optional, one line when given. */
function idOf(value: unknown, what: string, problems: string[]): string | undefined {
  if (value === undefined) return undefined;
  const id = oneLine(value, what + ' id');
  if (typeof id === 'string') return id;
  problems.push(id.problem);
  return undefined;
}

function unknownKeys(map: Record<string, unknown>, known: readonly string[], what: string, problems: string[]): void {
  for (const key of Object.keys(map)) if (!known.includes(key)) problems.push(what + ': unknown key "' + key + '" (known: ' + known.join(', ') + ')');
}

/**
 * Read a split file: the epic's `title`, `intent` (one to five lines) and `vetoes`, and two to ten `stories`, each with a `title`,
 * an `intent` and an optional `after` of earlier story numbers. Returns the split when nothing is wrong, else only the problems,
 * one per fault, each naming the epic or the story. Nothing here touches a file; a story that names itself or a later story in
 * `after` is refused, so the depends_on graph the stories get is acyclic by construction.
 */
export function parseSplit(text: string): { split?: Split; problems: string[] } {
  const doc = parseDocument(text, { schema: 'core', customTags: stringNumerics });
  if (doc.errors.length > 0) return { problems: ['the split is not valid YAML: ' + doc.errors[0].message.split('\n')[0]] };
  const root: unknown = doc.toJS();
  if (!isRecord(root)) return { problems: ['the split must be a YAML mapping with title, intent, vetoes and stories'] };
  const problems: string[] = [];
  unknownKeys(root, EPIC_KEYS, 'epic', problems);

  const title = oneLine(root.title, 'epic title');
  if (typeof title !== 'string') problems.push(title.problem);
  const id = idOf(root.id, 'epic', problems);

  let intent: string[] | undefined;
  if (root.intent === undefined) problems.push('epic intent is missing: one to five lines');
  else {
    intent = lineList(root.intent, 'epic intent', problems);
    if (intent !== undefined && (intent.length < 1 || intent.length > MAX_INTENT)) {
      problems.push('epic intent is ' + intent.length + ' lines: one to at most five lines');
      intent = undefined;
    }
  }
  const vetoes = root.vetoes === undefined || root.vetoes === null ? [] : lineList(root.vetoes, 'epic vetoes', problems);

  const stories: SplitStory[] = [];
  if (!Array.isArray(root.stories)) problems.push('stories must be a list of ' + MIN_STORIES + ' to ' + MAX_STORIES + ' stories');
  else if (root.stories.length < MIN_STORIES || root.stories.length > MAX_STORIES) {
    problems.push('the split holds ' + root.stories.length + ' stories: it needs two to ten stories');
  } else {
    const count = root.stories.length;
    root.stories.forEach((item: unknown, i: number) => {
      const n = i + 1;
      const label = 'story ' + n;
      if (!isRecord(item)) {
        problems.push(label + ' must be a mapping with title, intent and optional after');
        return;
      }
      unknownKeys(item, STORY_KEYS, label, problems);
      const t = oneLine(item.title, label + ' title');
      if (typeof t !== 'string') problems.push(t.problem);
      const sid = idOf(item.id, label, problems);
      let lines: string[] | undefined;
      if (item.intent === undefined) problems.push(label + ' intent is missing: one to five lines');
      else {
        lines = lineList(item.intent, label + ' intent', problems);
        if (lines !== undefined && (lines.length < 1 || lines.length > MAX_INTENT)) {
          problems.push(label + ' intent is ' + lines.length + ' lines: one to at most five lines');
          lines = undefined;
        }
      }
      const after = afterList(item.after, n, count, problems);
      if (typeof t === 'string' && lines !== undefined) stories.push({ title: t, intent: lines, after, ...(sid === undefined ? {} : { id: sid }) });
    });
  }

  if (problems.length > 0 || typeof title !== 'string' || intent === undefined || vetoes === undefined) return { problems };
  return { split: { title, intent, vetoes, stories, ...(id === undefined ? {} : { id }) }, problems };
}
