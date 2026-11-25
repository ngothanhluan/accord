// Phase 8.1 D-01, D-03: a pull request's body is the team's PR template with every heading kept and what the ticket already knows filled in; the title is `<id>: <title>`.
// Pure: the host reads the template file and writes the body file. A heading line is never rewritten or moved, so the fill only inserts lines.
import type { Ticket, Verification } from '../model/snapshot.js';
import { headingKey, sectionLines } from '../load/sections.js';
import { sliceSplit } from './size.js';
import type { SliceSize } from './size.js';

/** One heading of a template (ATX, levels 1-6) and the lines under it up to the next heading of any level. */
export interface TemplateSection {
  level: number; // 1-6
  heading: string; // the text a reader sees after the #s: inline comments, trailing #s and spaces dropped
  line: number; // 0-based index of the heading line in the text as split (BOM and CRLF dropped)
  bodyStart: number; // index of the first line under the heading
  bodyEnd: number; // index one past the last line under it
}

/** What the ticket knows, each a list of lines as they go into the body. */
export interface PrFacts {
  id: string;
  title: string;
  intent: string[];
  criteria: string[];
  evidence: string[];
}

// Up to three spaces of indent are allowed before a heading or a fence (CommonMark); a fence closes on the same character, at least as long.
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const ATX = /^ {0,3}(#{1,6})[ \t]+(.+?)[ \t#]*$/;

const BOM = new RegExp('^\uFEFF');

/** The template text as lines: a byte order mark dropped, CRLF read as LF. */
const linesOf = (text: string): string[] => text.replace(BOM, '').replace(/\r\n/g, '\n').split('\n');

/** A line with every HTML comment that closes on it removed; an `<!--` with no `-->` after it on the line is literal text, as CommonMark reads an inline comment. */
function stripInlineComments(line: string): string {
  let seen = '';
  let at = 0;
  for (;;) {
    const start = line.indexOf('<!--', at);
    const end = start < 0 ? -1 : line.indexOf('-->', start + 4);
    // no comment left that closes on this line: the rest, any `<!--` in it included, is text
    if (end < 0) return seen + line.slice(at);
    seen += line.slice(at, start);
    at = end + 3;
  }
}

// CommonMark HTML block type 2: a line that begins (after up to three spaces) with `<!--` opens a comment that ends on the first line holding `-->`, and that whole line belongs to it.
const COMMENT_BLOCK = /^ {0,3}<!--/;

/**
 * One pass over the template lines: for each line the text a reader sees (an HTML comment removed; a comment that begins its line runs to the line holding `-->`, one still open at
 * the end hiding the rest; a line inside a fenced block is kept as written, since a fence holds text), and every ATX heading outside a fence and outside a comment, with its visible
 * text as the heading (Phase 08.8 D-16, IN-06). An unclosed `<!--` inside a line never hides the lines after it (Phase 08.8 review IN-01). A line of a comment block is never a heading.
 */
function scan(lines: string[]): { visible: string[]; sections: TemplateSection[] } {
  const visible: string[] = [];
  const out: TemplateSection[] = [];
  let fence: string | undefined;
  let inComment = false;
  lines.forEach((l, i) => {
    if (fence !== undefined) {
      const f = FENCE.exec(l);
      if (f !== null && f[1][0] === fence[0] && f[1].length >= fence.length && l.slice(f[0].length).trim() === '') fence = undefined;
      visible.push(l);
      return;
    }
    if (inComment || COMMENT_BLOCK.test(l)) {
      const rest = inComment ? l : l.slice(l.indexOf('<!--') + 4);
      const end = rest.indexOf('-->');
      inComment = end < 0;
      visible.push(inComment ? '' : stripInlineComments(rest.slice(end + 3)));
      return;
    }
    const seen = stripInlineComments(l);
    visible.push(seen);
    const f = FENCE.exec(seen);
    if (f !== null) {
      // CommonMark: a backtick fence's info string may not hold a backtick
      if (!(f[1][0] === '`' && seen.slice(f[0].length).includes('`'))) fence = f[1];
      return;
    }
    const h = ATX.exec(seen);
    if (h !== null) out.push({ level: h[1].length, heading: h[2].trim(), line: i, bodyStart: i + 1, bodyEnd: lines.length });
  });
  out.forEach((s, k) => {
    if (k + 1 < out.length) s.bodyEnd = out[k + 1].line;
  });
  return { visible, sections: out };
}

/** Every ATX heading outside a fenced block and outside an HTML comment, with its body range. A line inside a fence or a comment is never a heading; the heading text is what a reader sees. */
export const templateSections = (text: string): TemplateSection[] => scan(linesOf(text)).sections;

/** The slot a heading names: lower case, punctuation dropped, whitespace collapsed (Ruling "fill"). */
const SLOTS = {
  intent: new Set(['summary', 'description', 'what', 'why', 'motivation', 'intent', 'context', 'overview']),
  criteria: new Set(['acceptance criteria', 'done when', 'criteria']),
  evidence: new Set(['test', 'tests', 'testing', 'test plan', 'how was this tested', 'verification']),
} as const;
type Slot = keyof typeof SLOTS;
const SLOT_ORDER: readonly Slot[] = ['intent', 'criteria', 'evidence'];
const OPENING_LABEL: Readonly<Record<Slot, string>> = { intent: 'Intent:', criteria: 'Acceptance criteria:', evidence: 'Test evidence:' };

const slotOf = (heading: string): Slot | undefined => {
  const key = headingKey(heading.replace(/[^\p{L}\p{N}\s]/gu, ' '));
  return SLOT_ORDER.find((s) => SLOTS[s].has(key));
};

/**
 * A line of ticket text that would read as a heading or open a fence in the body would change the template's own headings (or swallow them), so its first mark is escaped with a
 * backslash: it shows as the text it was.
 */
const plain = (line: string): string => line.replace(/^( {0,3})(#{1,6}[ \t]|`{3,}|~{3,})/, (_m, indent: string, mark: string) => `${indent}\\${mark}`);

// A GitHub login (letters, digits, single hyphens) or an organisation team (`@org/team`), not preceded by a letter or digit, so an e-mail address is no mention; `_` may precede it,
// since `_@name_` is emphasis around a mention (Phase 08.8 review WR-07).
const MENTION = /(?<![\p{L}\p{N}])@([A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9]))*(?:\/[A-Za-z0-9_.-]+)?)/gu;

/**
 * A line as CommonMark reads its backticks (Phase 08.8 review WR-07): code spans kept as written, where a backtick run closes only on the next run of the same length; the text
 * between them with a backslash escape kept as written and every unmatched backtick escaped, so no backtick added later can pair with it.
 */
function codeSpans(text: string): { span: boolean; text: string }[] {
  const out: { span: boolean; text: string }[] = [];
  let plainText = '';
  let i = 0;
  const runAt = (at: number): number => {
    let n = 0;
    while (text[at + n] === '`') n += 1;
    return n;
  };
  while (i < text.length) {
    if (text[i] === '\\' && i + 1 < text.length) {
      plainText += text.slice(i, i + 2);
      i += 2;
    } else if (text[i] !== '`') {
      plainText += text[i];
      i += 1;
    } else {
      const n = runAt(i);
      let close = -1;
      for (let j = i + n; j < text.length; ) {
        const m = runAt(j);
        if (m === n) {
          close = j;
          break;
        }
        j += Math.max(m, 1);
      }
      if (close < 0) {
        plainText += '\\`'.repeat(n);
        i += n;
      } else {
        out.push({ span: false, text: plainText }, { span: true, text: text.slice(i, close + n) });
        plainText = '';
        i = close + n;
      }
    }
  }
  out.push({ span: false, text: plainText });
  return out;
}

/**
 * Ticket text with every `@name` outside a code span put into one, so the body notifies nobody (Phase 08.8 D-16, IN-06; review WR-07). A name right beside a code span is set
 * apart from it by a space, since two touching backtick runs would read as one.
 */
const quoteMentions = (text: string): string => {
  const parts = codeSpans(text);
  return parts
    .map((p, k) => {
      if (p.span) return p.text;
      return p.text.replace(MENTION, (m: string, name: string, at: number) => {
        const before = at === 0 && k > 0 ? ' ' : '';
        const after = at + m.length === p.text.length && k + 1 < parts.length ? ' ' : '';
        return `${before}\`@${name}\`${after}`;
      });
    })
    .join('');
};

/**
 * The template with the ticket's facts in it, and the headings of the sections nobody filled.
 *
 * A section whose body is blank or only HTML comments is filled when its heading names a slot (Intent, acceptance criteria, test evidence); the first such section takes the slot, the
 * filled lines go directly under the heading, and the section's own comment lines stay after them. A slot no section takes goes into the opening block, which always begins
 * `**<id>: <title>**`. Every other empty section is returned in `remaining`, in template order, for the agent to write; a heading that holds nothing but sub-headings is no section to write.
 * A slot with no lines (a lane R ticket has no criteria) fills nothing.
 */
export function fillTemplate(template: string, facts: PrFacts): { body: string; remaining: string[] } {
  const lines = linesOf(template);
  const { visible, sections } = scan(lines);
  const empty = (s: TemplateSection): boolean => visible.slice(s.bodyStart, s.bodyEnd).every((l) => l.trim() === '');

  const text: Record<Slot, string[]> = { intent: facts.intent.map(quoteMentions), criteria: facts.criteria.map(quoteMentions), evidence: facts.evidence.map(quoteMentions) };
  const taken = new Map<Slot, TemplateSection>();
  const remaining: string[] = [];
  sections.forEach((s, k) => {
    if (!empty(s)) return;
    const slot = slotOf(s.heading);
    if (slot !== undefined && !taken.has(slot) && text[slot].length > 0) {
      taken.set(slot, s);
      return;
    }
    const container = k + 1 < sections.length && sections[k + 1].level > s.level;
    if (!container) remaining.push(s.heading);
  });

  const opening: string[] = [`**${facts.id}: ${quoteMentions(facts.title)}**`, ''];
  for (const slot of SLOT_ORDER) {
    if (taken.has(slot) || text[slot].length === 0) continue;
    opening.push(OPENING_LABEL[slot], ...text[slot].map(plain), '');
  }

  const after = new Map<number, string[]>([...taken].map(([slot, s]) => [s.line, text[slot].map(plain)]));
  const out: string[] = [...opening];
  lines.forEach((l, i) => {
    out.push(l);
    const filled = after.get(i);
    if (filled !== undefined) out.push(...filled);
  });
  return { body: out.join('\n').replace(/\n*$/, '\n'), remaining };
}

/** Phase 15 D-07: which slice a pull request is, of how many. */
export interface SlicePart {
  n: number;
  of: number;
}

/** A pull request title of a slice ends `(slice <n> of <m>)`; the numbers are the only text added (T-15-37). */
export const sliceTitle = (title: string, slice: SlicePart): string => `${title} (slice ${slice.n} of ${slice.of})`;

/** The title of a ticket's pull request: its id, then its title (Ruling "title"), and for a slice the part naming it. */
export const prTitle = (id: string, title: string, slice?: SlicePart): string => (slice === undefined ? `${id}: ${title}` : sliceTitle(`${id}: ${title}`, slice));

/**
 * Phase 15 D-06: the facts of one slice's pull request. Only the criteria lines (and their evidence lines) that carry a tag the slice's `covers:` names are kept, so the filled template lists what this
 * pull request delivers; a line with no `@ac-n` tag belongs to no slice and is left out.
 */
export function sliceFacts(facts: PrFacts, covers: readonly string[]): PrFacts {
  const mine = (line: string): boolean => covers.some((c) => c.startsWith('@') && line.startsWith(`- \`${c}\` `));
  return { ...facts, criteria: facts.criteria.filter(mine), evidence: facts.evidence.filter(mine) };
}

/**
 * Phase 15 D-06, SC-2: the block that opens the body of a slice's pull request: `Slice <n> of <m>`, the criteria lines the slice delivers, and the measured size with the review budget (or the
 * words that it could not be measured). Numbers and the criteria lines `prFacts` made (tags in code spans) only.
 */
export function sliceBlock(slice: SlicePart, delivers: readonly string[], size: SliceSize | undefined, budget: number): string {
  const sizeLine = size === undefined ? 'Size: not measured (git could not say where this slice starts)' : `Size: ${size.total} lines (${sliceSplit(size)}), review budget ${budget}`;
  return [`Slice ${slice.n} of ${slice.of}`, '', ...(delivers.length === 0 ? [] : ['Delivers:', ...delivers, '']), sizeLine, '', ''].join('\n');
}

/**
 * Why a pull request title cannot go through the quoted `--title "<title>"` argument the skills write, or undefined when it can (Ruling "title"). A double quote, a backtick, `$` and a backslash
 * mean something to bash and PowerShell inside double quotes, and `%` is expanded by cmd.exe there (D-16 item 7); a control character, a line break or an invisible format character would
 * show as one thing and be another. `'`, `!`, `;` and `&` pass on purpose (Phase 08.8 session Ruling 2): they are literal inside double quotes in cmd.exe, PowerShell and non-interactive bash, and
 * 22 of the 132 ticket titles of this repository hold `'`. The text names the character and the fix.
 */
export function prTitleProblem(title: string): string | undefined {
  const fix = 'fix: rename the ticket without it (accord/tickets), or have pr.command print a title without it';
  for (const ch of title) {
    const named =
      ch === '"' ? 'a double quote (")'
      : ch === '`' ? 'a backtick'
      : ch === '$' ? 'a dollar sign ($)'
      : ch === '\\' ? 'a backslash'
      : ch === '%' ? 'a percent sign (%), which cmd.exe expands inside double quotes'
      : ch === '\n' || ch === '\r' ? 'a line break'
      : /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(ch) ? `a control or invisible character (<U+${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}>)`
      : undefined;
    if (named !== undefined) return `the pull request title holds ${named}, which would break the quoted gh argument - ${fix}`;
  }
  return undefined;
}

// GitHub's rule, as `gh` reads it: the directories in order, a name `pull_request_template` in any case with `-` for `_`, any extension; or a PULL_REQUEST_TEMPLATE folder of `.md` files.
const TEMPLATE_DIRS = ['.github', '', 'docs'] as const;
const SINGLE_NAME = /^pull[_-]request[_-]template(?:\.|$)/i;
const FOLDER_NAME = /^pull_request_template$/i;

/**
 * The pull request template of a repository, from the paths git tracks (never from a directory read) (Ruling "template discovery"). `configured` (pr.template) names one tracked path and wins;
 * else a single template in `.github/`, the root or `docs/`, the first directory that has one; else the first `.md` file by byte order of the first PULL_REQUEST_TEMPLATE folder of those
 * directories, with `count`, the number of `.md` files it holds, so the host can say which of several it took. A single template outranks a folder. Undefined when there is none, or
 * when `configured` is not tracked.
 */
export function findTemplate(tracked: readonly string[], configured?: string): { path: string; count?: number } | undefined {
  if (configured !== undefined) return tracked.includes(configured) ? { path: configured } : undefined;
  const sorted = [...tracked].sort();
  const under = (dir: string, depth: number): string[][] =>
    sorted.map((p) => p.split('/')).filter((parts) => parts.length === depth + (dir === '' ? 0 : 1) && (dir === '' || parts[0] === dir));
  for (const dir of TEMPLATE_DIRS) {
    const single = under(dir, 1).find((parts) => SINGLE_NAME.test(parts[parts.length - 1]));
    if (single !== undefined) return { path: single.join('/') };
  }
  for (const dir of TEMPLATE_DIRS) {
    const files = under(dir, 2).filter((parts) => FOLDER_NAME.test(parts[parts.length - 2]) && parts[parts.length - 1].endsWith('.md'));
    if (files.length > 0) return { path: files[0].join('/'), count: files.length };
  }
  return undefined;
}

/** Today's body for a ticket pull request with no template and no script (Ruling "today's body"): one `- <subject>` line per commit, in the order given. */
export const todaysBody = (subjects: readonly string[]): string => subjects.map((s) => `- ${s}\n`).join('');

/** Today's body for an epic pull request: its Intent text, as the epic skill passed it to `gh pr create --body`, with its `@name`s in code spans (Phase 08.8 review WR-08). */
export const epicBody = (intent: readonly string[]): string => intent.map((l) => `${quoteMentions(l)}\n`).join('');

/** The lines of `## <name>` of a ticket as written, comments and blank lines dropped; empty when the section is absent. */
const linesUnder = (ticket: Ticket, name: string): string[] => sectionLines(ticket.sections, name);

/**
 * What the ticket knows (Ruling "sources per ticket kind"). Intent: `## Intent` (lane M, L, P and an epic), `## Understood` (lane S), `## Question` (lane R). Criteria: each scenario's name
 * with its `@ac-<n>` tag, or the `## Done when` lines of a lane S ticket; none for lane R. Evidence: per scenario its `@test:<id>` tags and the `Result:` of its verification.md block, or
 * `(not recorded)` when it has neither. Tags go in code spans, so a pull request body never mentions a GitHub user named `ac-1` or `test`.
 */
export function prFacts(ticket: Ticket, verification?: Verification): PrFacts {
  const lane = ticket.frontmatter?.lane;
  const intentOf = lane === 'S' ? 'Understood' : lane === 'R' ? 'Question' : 'Intent';
  const scenarios = lane === 'S' || lane === 'R' ? [] : ticket.scenarios;
  const criteria = lane === 'S' ? linesUnder(ticket, 'Done when') : scenarios.map((s) => (s.acTag === undefined ? `- ${s.name}` : `- \`@${s.acTag}\` ${s.name}`));
  const evidence = scenarios.map((s) => {
    const tests = s.tags.filter((t) => t.startsWith('@test:')).map((t) => `\`${t.slice('@test:'.length)}\``);
    const result = s.acTag === undefined ? undefined : verification?.blocks.find((b) => b.acTag === s.acTag)?.result;
    const said = [...(tests.length === 0 ? [] : [`tests ${tests.join(', ')}`]), ...(result === undefined ? [] : [`Result: ${result}`])];
    return `- ${s.acTag === undefined ? '' : `\`@${s.acTag}\` `}${s.name}: ${said.length === 0 ? '(not recorded)' : said.join('; ')}`;
  });
  return { id: ticket.id, title: ticket.frontmatter?.title ?? ticket.id, intent: linesUnder(ticket, intentOf), criteria, evidence };
}
