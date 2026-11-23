// Phase 8.1 G2 (D-01, D-03): a pull request body is the team's template with every heading kept and what the ticket knows filled in. Pure core: no file is read here.
import { expect, it } from 'vitest';
import { epicBody, fillTemplate, findTemplate, prTitle, templateSections, prTitleProblem, todaysBody } from '../src/index.js';
import type { PrFacts } from '../src/index.js';

const FACTS: PrFacts = {
  id: 'T-1',
  title: 'Export',
  intent: ['Owners can export their report as CSV.'],
  criteria: ['- `@ac-1` export writes a csv', '- `@ac-2` commas are escaped'],
  evidence: [],
};

const headings = (text: string): string[] => templateSections(text).map((s) => `${s.level} ${s.heading}`);

const TEMPLATE = [
  '# Pull request',
  '<!-- keep this heading -->',
  '',
  '## Description',
  '<!-- What does this change? -->',
  '',
  '## Acceptance criteria',
  '',
  '### Notes',
  'Mention the migration, if any.',
  '',
  '```text',
  '## fake heading inside a fence',
  '```',
  '',
  '## Screenshots',
  '<!-- add screenshots -->',
  '',
].join('\n');

it('risk:parsing a filled template keeps every heading line unchanged and in order (8.1-ac-1)', () => {
  const { body, remaining } = fillTemplate(TEMPLATE, FACTS);
  // a heading inside a fence is no heading, so the template reads as five and the body as the same five
  expect(headings(TEMPLATE)).toEqual(['1 Pull request', '2 Description', '2 Acceptance criteria', '3 Notes', '2 Screenshots']);
  expect(headings(body)).toEqual(headings(TEMPLATE));

  const lines = body.split('\n');
  const under = (heading: string): string[] => lines.slice(lines.indexOf(heading) + 1, lines.indexOf(heading) + 3);
  expect(under('## Description')).toContain('Owners can export their report as CSV.');
  expect(under('## Acceptance criteria').join('\n')).toContain('`@ac-1` export writes a csv');
  expect(body.startsWith('**T-1: Export**\n')).toBe(true);
  // every line of the template is still there, in order: the fill only inserts
  let at = -1;
  for (const l of TEMPLATE.split('\n')) {
    const next = lines.indexOf(l, at + 1);
    expect(next, `template line "${l}" is kept in order`).toBeGreaterThan(at);
    at = next;
  }
  // the section no slot fills is left for the agent; a heading that only holds sub-headings is no section to write
  expect(remaining).toEqual(['Screenshots']);
});

const BOM = String.fromCharCode(0xfeff);

it('risk:complex-branching template discovery follows pr.template then a single template then the first of a folder (D-01)', () => {
  // .github/ before the root before docs/; the name matches ignoring case, with _ or - between the words, any extension
  expect(findTemplate(['docs/PULL_REQUEST_TEMPLATE.md', 'Pull-Request-Template.txt'])).toEqual({ path: 'Pull-Request-Template.txt' });
  expect(findTemplate(['Pull-Request-Template.txt', '.github/pull_request_template.md'])).toEqual({ path: '.github/pull_request_template.md' });
  expect(findTemplate(['docs/pull_request_template.md'])).toEqual({ path: 'docs/pull_request_template.md' });
  // a folder: the first .md of the first PULL_REQUEST_TEMPLATE folder by byte order (upper case before lower), counting the files it holds
  const folder = ['.github/PULL_REQUEST_TEMPLATE/b.md', '.github/PULL_REQUEST_TEMPLATE/A.md'];
  expect(findTemplate(folder)).toEqual({ path: '.github/PULL_REQUEST_TEMPLATE/A.md', count: 2 });
  // a single template outranks a folder; a file deeper than the folder, or not ending .md, is no candidate
  expect(findTemplate([...folder, 'docs/pull_request_template.md'])).toEqual({ path: 'docs/pull_request_template.md' });
  expect(findTemplate(['.github/PULL_REQUEST_TEMPLATE/a/deep.md', '.github/PULL_REQUEST_TEMPLATE/notes.txt'])).toBeUndefined();
  // pr.template names one tracked file and wins over every rule; a name that is not tracked finds nothing
  expect(findTemplate([...folder, '.github/pull_request_template.md'], '.github/PULL_REQUEST_TEMPLATE/b.md')).toEqual({ path: '.github/PULL_REQUEST_TEMPLATE/b.md' });
  expect(findTemplate(folder, 'docs/other.md')).toBeUndefined();
  // none
  expect(findTemplate(['README.md', 'src/pull_request_template_notes.md'])).toBeUndefined();
});

it('risk:parsing a CRLF template with a byte order mark is filled with its headings kept (8.1-ac-1)', () => {
  const template = BOM + TEMPLATE.replace(/\n/g, '\r\n');
  const { body, remaining } = fillTemplate(template, FACTS);
  expect(body).not.toContain('\r');
  expect(body).not.toContain(BOM);
  expect(headings(body)).toEqual(headings(TEMPLATE));
  expect(remaining).toEqual(['Screenshots']);
});

it('risk:parsing a template with no matching heading gets the opening block (D-01)', () => {
  const { body, remaining } = fillTemplate('## Checklist\n- [ ] I ran the tests\n', { ...FACTS, evidence: ['- `@ac-1` export writes a csv: (not recorded)'] });
  expect(body.split('\n').slice(0, 9)).toEqual([
    '**T-1: Export**',
    '',
    'Intent:',
    'Owners can export their report as CSV.',
    '',
    'Acceptance criteria:',
    '- `@ac-1` export writes a csv',
    '- `@ac-2` commas are escaped',
    '',
  ]);
  expect(body).toContain('Test evidence:\n- `@ac-1` export writes a csv: (not recorded)');
  expect(body.endsWith('## Checklist\n- [ ] I ran the tests\n')).toBe(true);
  expect(remaining).toEqual([]);
  // ticket text that would read as a heading or open a fence cannot change the template's own headings
  const risky = fillTemplate('## Description\n', { ...FACTS, intent: ['## Not a heading', '```', 'text'] });
  expect(headings(risky.body)).toEqual(['2 Description']);
});

it('risk:security a title that would break the quoted gh argument is refused and today is a list of subjects (D-01)', () => {
  for (const bad of ['Say "hi"', 'run `x`', 'pay $5', 'a\\b', 'two\nlines', 'bell\u0007']) expect(prTitleProblem(prTitle('T-1', bad)), bad).toContain('title');
  expect(prTitleProblem(prTitle('T-1', 'Say "hi"'))).toContain('"');
  expect(prTitleProblem(prTitle('T-1', 'Export'))).toBeUndefined();
  expect(todaysBody(['claim: T-1', 'feat: add x'])).toBe('- claim: T-1\n- feat: add x\n');
  expect(epicBody(['Teams see every export.', 'No new dependency.'])).toBe('Teams see every export.\nNo new dependency.\n');
});

// Phase 08.8 D-16 (item 7, session Ruling 2): the title check adds only `%`, which cmd.exe expands inside the double-quoted --title; `'`, `!`, `;` and `&` are literal there and still pass.
it('risk:security the title check refuses a percent sign and lets literal shell characters through (D-16)', () => {
  expect(prTitleProblem(prTitle('T-1', 'Fix 100% CPU'))).toContain('percent sign');
  expect(prTitleProblem(prTitle('T-1', "Don't break & fix; now!"))).toBeUndefined();
  for (const bad of ['Say "hi"', 'run `x`', 'pay $5', 'a\b', 'two\nlines', 'bell\u0007']) expect(prTitleProblem(prTitle('T-1', bad)), bad).toContain('title');
});

// Phase 08.8 D-16 (item 9, IN-06): `remaining` names the heading a reader sees, and a heading inside an HTML comment is no section.
it('risk:parsing template headings are read as a reader sees them and a heading inside a comment is no section (D-16)', () => {
  const template = ['## Summary ##', '', '## Testing <!-- how you tested -->', '', '<!--', '## Hidden', '-->', '', '## Notes', 'Some words.', ''].join('\n');
  expect(templateSections(template).map((s) => s.heading)).toEqual(['Summary', 'Testing', 'Notes']);
  const { body, remaining } = fillTemplate(template, { ...FACTS, evidence: [] });
  expect(remaining).toEqual(['Testing']);
  const lines = template.split('\n');
  let at = -1;
  for (const line of lines.filter((l) => l !== '')) {
    const next = body.split('\n').indexOf(line, at + 1);
    expect(next, `the line ${line} is kept in order`).toBeGreaterThan(at);
    at = next;
  }
});

// Phase 08.8 D-16 (IN-06): an at-name in the title or the Intent lines must not notify anyone, so it goes into a code span.
it('risk:security mentions in the title and intent reach the body inside code spans (D-16)', () => {
  const { body } = fillTemplate('## Description\n\n## Screenshots\n', { ...FACTS, title: 'Ask @alice', intent: ['cc @bob-x and @ac-1'] });
  expect(body).toContain('**T-1: Ask `@alice`**');
  expect(body).toContain('cc `@bob-x` and `@ac-1`');
  expect(body).not.toMatch(/(^|[^`\w])@(alice|bob-x)/);
});

// Phase 08.8 review WR-07: one unbalanced backtick, an escaped backtick, emphasis around the name or a code span right beside it must not leave an at-name outside a code span.
// Backtick runs pair the CommonMark way (a run closes only on a run of the same length); an unmatched one is escaped so it can pair with nothing.
it('risk:security mentions stay quoted past an unbalanced backtick and inside emphasis (REVIEW WR-07)', () => {
  const cases: [string, string][] = [
    ['use ` then @alice', 'use \\` then `@alice`'],
    ['a ``code ` span`` then @bob', 'a ``code ` span`` then `@bob`'],
    ['cc _@carol_ and *@dave*', 'cc _`@carol`_ and *`@dave`*'],
    ['`@ac-1` already quoted and @erin', '`@ac-1` already quoted and `@erin`'],
    ['x\\` then @frank `y`', 'x\\` then `@frank` `y`'],
    ['see `code`@gina', 'see `code` `@gina`'],
  ];
  const { body } = fillTemplate('## Description\n', { ...FACTS, intent: cases.map(([line]) => line) });
  const lines = body.split('\n');
  for (const [line, quoted] of cases) expect(lines, line).toContain(quoted);
});

// Phase 08.8 review WR-08: with no PR template an epic's body is its Intent text, and its at-names reach that body inside code spans too.
it('risk:security an epic body with no template carries its Intent mentions quoted (REVIEW WR-08)', () => {
  const body = epicBody(['Teams see every export.', 'cc @alice and @org/team']);
  expect(body).toBe('Teams see every export.\ncc `@alice` and `@org/team`\n');
});

// Phase 08.8 review IN-01: a comment that spans lines starts only where `<!--` begins the line (an HTML block); an unclosed `<!--` inside a heading is literal text, as GitHub shows it.
it('risk:parsing an unclosed comment inside a heading hides no later heading (REVIEW IN-01)', () => {
  expect(templateSections('## A <!-- x\n## B\n--> ## C\n## D').map((s) => s.heading)).toEqual(['A <!-- x', 'B', 'D']);
  // a comment that begins its line still hides the lines up to its end, and one closed on its line is dropped from the heading
  expect(templateSections('## A <!-- note -->\n<!--\n## Hidden\n-->\n## B').map((s) => s.heading)).toEqual(['A', 'B']);
});
