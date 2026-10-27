// Serves ST-LN-44's criteria and the rule 3 check; deleted with helpers/st-ln-44.ts and fixtures/st-ln-44/ once the ticket is done.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { lintSnapshot, loadSnapshot, type SnapshotInput } from '../src/index.js';
import { scanJUnit } from '../src/load/junit.js';
import { readDir } from './helpers/fixture.js';
import {
  asserts,
  body,
  cases,
  helpersOf,
  idOf,
  listText,
  rows,
  ROOT,
  rule3,
  TABLE,
  tableProblems,
  type Row,
} from './helpers/st-ln-44.js';

const APPROVED_SHA = 'b6e47395c1fbbc6b4ed76fcc39e6753b59afbfca04b8adc09ffcacb3f28d9bbc';

/** Replace one line of a table text, found by its start. */
function editLine(text: string, start: string, edit: (parts: string[]) => string[]): string {
  return text
    .split('\n')
    .map((l) => (l.startsWith(start) ? `| ${edit(l.slice(2, -2).split(' | ')).join(' | ')} |` : l))
    .join('\n');
}

it('risk:parsing table.md parses to rows 1 to 118 and the keep syntax of rule 3 parses without changing them', () => {
  const approvedBytes = readFileSync(new URL('./fixtures/st-ln-44/table-approved.md', import.meta.url));
  expect(createHash('sha256').update(approvedBytes).digest('hex')).toBe(APPROVED_SHA);
  const approvedText = approvedBytes.toString('utf8');
  const approved = rows(approvedText);
  expect(approved.map((r) => r.n)).toEqual(Array.from({ length: 118 }, (_, i) => i + 1));
  expect(tableProblems(approved)).toEqual([]);
  const kept = approved.filter((r) => r.action === 'kept');
  expect(kept).toHaveLength(33);
  expect(kept.every((r) => typeof r.ceiling === 'number')).toBe(true);
  const row = (n: number): Row => approved[n - 1];
  expect(row(2).ceiling).toBe(106);
  expect(row(114).ceiling).toBe(83);
  expect(row(117).ceiling).toBe(29);
  expect(row(115).action).toBe('moved');
  expect(row(115).destinations).toHaveLength(3);
  expect(row(115).destinations.map((d) => d.ceiling)).toEqual([29, 29, 29]);

  // The live table may take a late keep (an action, a note, a destination ceiling, or rows from 119) and still parse
  // to the same tests.
  const live = rows(readFileSync(TABLE, 'utf8'));
  expect(tableProblems(live)).toEqual([]);
  for (let n = 1; n <= 118; n++) {
    const l = live.find((r) => r.n === n)!;
    expect([l.file, l.title]).toEqual([row(n).file, row(n).title]);
    const key = (r: Row) => r.destinations.map((d) => [d.file, d.title]);
    expect(key(l)).toEqual(key(row(n)));
  }

  // The keep syntax of rule 3.
  let t = editLine(approvedText, '| 3 | ', (p) => {
    p[6] = p[6].replace('<br>', ' :: kept 12 s<br>');
    return p;
  });
  t = editLine(t, '| 6 | ', (p) => {
    p[4] = 'kept';
    p[8] = `Ceiling 9 s. ${p[8]}`;
    return p;
  });
  const row119 =
    '| 119 | cli/test/sandbox-guard.test.ts | risk:data-loss a template copy pushes to its own origin and matches a clone built the same way | - | kept | - | - | - | Ceiling 14 s. Reason. |';
  t = t.replace(/^(\| 118 \| .*)$/m, `$1\n${row119}`);
  const edited = rows(t);
  expect(edited).toHaveLength(119);
  expect(tableProblems(edited)).toEqual([]);
  expect(edited[2].destinations[0].ceiling).toBe(12);
  expect(edited[5].action).toBe('kept');
  expect(edited[5].ceiling).toBe(9);
  expect(edited[118].action).toBe('kept');
  expect(edited[118].ceiling).toBe(14);
  expect(() => rows('| 5 | cli/test/x.test.ts | t | - | moved | h | a :: b :: c | - | note |')).toThrow(
    'table row 5: bad destination "a :: b :: c"',
  );
  const gap = rows(`${t}\n| 121 | cli/test/y.test.ts | t | - | kept | - | - | - | Ceiling 3 s. |`);
  expect(tableProblems(gap)).not.toEqual([]);
});

it('risk:parsing junit cases are read with file title time and status and their text unescaped', () => {
  const xml = [
    '<?xml version="1.0" encoding="UTF-8" ?>',
    '<testsuites>',
    '  <testsuite name="packages/a/test/x.test.ts">',
    '    <testcase classname="packages/a/test/x.test.ts" name="d &gt; it &amp;gt; &lt;b&gt; &quot;q&quot; &apos;s&apos;&#10;nl" time="1.5">',
    '    </testcase>',
    '    <testcase classname="packages/a/test/x.test.ts" name="bad" time="12.25">',
    '      <failure message="boom &lt;x&gt;">stack</failure>',
    '    </testcase>',
    '    <testcase classname="packages/a/test/y.test.ts" name="skip" time="0">',
    '      <skipped/>',
    '    </testcase>',
    '  </testsuite>',
    '</testsuites>',
  ].join('\n');
  expect(cases(xml)).toEqual([
    { file: 'packages/a/test/x.test.ts', title: 'd > it &gt; <b> "q" \'s\'\nnl', time: 1.5, status: 'passed' },
    { file: 'packages/a/test/x.test.ts', title: 'bad', time: 12.25, status: 'failed' },
    { file: 'packages/a/test/y.test.ts', title: 'skip', time: 0, status: 'skipped' },
  ]);
  expect(idOf('f.ts', 'a  b > c')).toBe('f.ts#a-b->-c');
});

it('risk:complex-branching the rule 3 list stops on a test over 10 s that is not kept and on a kept test over its ceiling', () => {
  const base = { tag: '-', how: '-', note: '-' };
  const rs: Row[] = [
    { ...base, n: 1, file: 'f1', title: 'faster', action: 'faster', destinations: [] },
    { ...base, n: 2, file: 'f2', title: 'kept', action: 'kept', destinations: [], ceiling: 20 },
    {
      ...base,
      n: 3,
      file: 'f3',
      title: 'moved',
      action: 'moved',
      destinations: [
        { file: 'f3', title: 'plain' },
        { file: 'f3', title: 'held', ceiling: 15 },
      ],
    },
  ];
  const one = (file: string, title: string, time: number) =>
    rule3(rs, [{ file, title, time, status: 'passed' }]);
  expect(one('f1', 'faster', 4)).toEqual([]);
  expect(one('f1', 'faster', 7)).toMatchObject([{ n: 1, action: 'faster', stop: false }]);
  expect(one('f1', 'faster', 11)).toMatchObject([{ n: 1, stop: true }]);
  expect(one('f2', 'kept', 19)).toMatchObject([{ n: 2, action: 'kept', ceiling: 20, stop: false }]);
  expect(one('f2', 'kept', 21)).toMatchObject([{ n: 2, stop: true }]);
  expect(one('f3', 'plain', 11)).toMatchObject([{ n: 3, action: 'destination', stop: true }]);
  expect(one('f3', 'held', 14)).toMatchObject([{ n: 3, action: 'kept destination', ceiling: 15, stop: false }]);
  expect(one('f3', 'held', 16)).toMatchObject([{ n: 3, stop: true }]);
  expect(one('zz', 'nobody', 12)).toMatchObject([{ action: 'outside', stop: true }]);
  expect(one('zz', 'nobody', 9)).toEqual([]);
  const all = rule3(rs, [
    { file: 'f1', title: 'faster', time: 7, status: 'passed' },
    { file: 'f2', title: 'kept', time: 19, status: 'passed' },
  ]);
  expect(all.map((e) => e.time)).toEqual([19, 7]);
  expect(listText(all)).toBe('- #2 f2 > kept: 19.0 s, kept, ceiling 20 s\n- #1 f1 > faster: 7.0 s, faster\n');
  expect(listText(one('f1', 'faster', 11))).toBe('- #1 f1 > faster: 11.0 s, faster, STOP\n');
  expect(listText([])).toBe('No entry.\n');
});

it('risk:parsing assertions are a multiset of expect statements and local assertion-helper calls', () => {
  const source = [
    "const refused = async (t: string) => { expect(1).toBe(1); };",
    "it('x', async () => {",
    "  await refused('a');",
    "  await refused('a');",
    "  refused('b');",
    '  expect(x).toBe(',
    '    2);',
    '});',
  ].join('\n');
  expect(helpersOf(source)).toEqual(['refused']);
  const test = body(source, 'x');
  expect(test).toBeDefined();
  // Whitespace runs become one space, so the break after `toBe(` reads as `toBe( 2)`.
  expect(asserts(test!, ['refused'])).toEqual(["refused('a');", "refused('a');", "refused('b');", 'expect(x).toBe( 2);']);
  expect(asserts(source, ['refused'])).toHaveLength(4);

  // A helper nested in a function, a destructured parameter that is not a call, and a call inside expect( that is not counted twice.
  const nested = [
    'function verdicts(repo: string) {',
    '  const fails = async (rule: string) => {',
    "    expect((await run(repo)).code).toBe(1);",
    "    expect('}(' + rule).toContain(rule);",
    '  };',
    '  const passes = async () => expect((await run(repo)).code).toBe(0);',
    '  return { fails, passes };',
    '}',
    "it('p', inReviewed(async (repo, { passes }) => {",
    '  // a comment with an apostrophe, expect(1) and "quotes',
    '  await passes();',
    '  await fails(`a ${"}"} b`);',
    '  expect(await passes()).toBe(undefined);',
    '}), 120_000);',
  ].join('\n');
  expect(helpersOf(nested).sort()).toEqual(['fails', 'passes', 'verdicts']);
  const p = body(nested, 'p');
  expect(asserts(p!, helpersOf(nested))).toEqual([
    'passes();',
    'fails(`a ${"}"} b`);',
    'expect(await passes()).toBe(undefined);',
  ]);
  // The same statements are found in a body that declares the helpers itself.
  const inline = ["it('q', async () => {", ...nested.split('\n').slice(0, 8), '  await passes();', '});'].join('\n');
  expect(asserts(body(inline, 'q')!, helpersOf(inline))).toEqual(['passes();']);

  // The real lane-s.test.ts declares fails and passes once, nested in verdicts, and each split test calls them.
  const laneS = readFileSync(new URL('../../cli/test/lane-s.test.ts', import.meta.url), 'utf8');
  const hs = helpersOf(laneS);
  expect(hs).toEqual(expect.arrayContaining(['fails', 'passes']));
  const failing = body(laneS, 'risk:complex-branching lane S gate done fails on a code commit after the review');
  expect(asserts(failing!, hs)).toContain("fails('gate.commit-after-review');");
});

it('ac-1 no test in the measuring run takes over 10 s apart from a kept test within its ceiling', () => {
  const rs = rows(readFileSync(TABLE, 'utf8'));
  expect(tableProblems(rs)).toEqual([]);
  const cs = cases(readFileSync(new URL('./fixtures/st-ln-44/after-junit.xml', import.meta.url), 'utf8'));
  const has = (file: string, title: string) => cs.some((c) => c.file === file && c.title === title);
  // The run is whole: every row is found, each destination of a moved or merged row, the row's own test otherwise.
  const missing = rs.flatMap((r) =>
    (r.action === 'moved' || r.action === 'merged' ? r.destinations : [r])
      .filter((d) => !has(d.file, d.title))
      .map((d) => `#${r.n} ${d.file} > ${d.title}`),
  );
  expect(missing).toEqual([]);
  // Git Bash ran the executed workflow-script cases (row #2): they were not skipped.
  const two = rs.find((r) => r.n === 2)!;
  expect(cs.find((c) => c.file === two.file && c.title === two.title)?.status).not.toBe('skipped');
  expect(
    rule3(rs, cs)
      .filter((e) => e.stop)
      .map((e) => listText([e]).trim()),
  ).toEqual([]);
});

// The sha256 of accord/tickets/ST-LN-44/before-junit.xml: the full run at 1cec2ac (1531 cases), recorded in the ledger.
const BEFORE_SHA256 = '15775f281540569d9fb29ca291d329457daeeafde50064bd88358937ab1a000c';

const after = () => readFileSync(new URL('./fixtures/st-ln-44/after-junit.xml', import.meta.url), 'utf8');

function before(): string {
  const bytes = readFileSync(new URL('accord/tickets/ST-LN-44/before-junit.xml', ROOT));
  if (createHash('sha256').update(bytes).digest('hex') !== BEFORE_SHA256)
    throw new Error('before-junit.xml is not the recorded baseline run');
  return bytes.toString('utf8');
}

/** Every id of a row's own test and of each of its destinations. */
function rowIds(rs: Row[]): Set<string> {
  return new Set(rs.flatMap((r) => [idOf(r.file, r.title), ...r.destinations.map((d) => idOf(d.file, d.title))]));
}

it('ac-2 every test tag that names a test of the table names one passing test and lint reports no error', () => {
  const REPORT = 'node_modules/.cache/accord/junit.xml';
  const files: Record<string, string> = {};
  for (const [k, v] of Object.entries(readDir(new URL('accord/', ROOT)).files)) files['accord/' + k] = v;
  files[REPORT] = after();
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: fileURLToPath(ROOT), maxBuffer: 64 * 1024 * 1024 })
    .toString('utf8')
    .split('\0')
    .filter((f) => f !== '');
  const input: SnapshotInput = { files, tree: [...tracked, REPORT] };
  const snap = loadSnapshot(input);
  expect(lintSnapshot(snap).findings.filter((f) => f.level === 'error')).toEqual([]);

  const rs = rows(readFileSync(TABLE, 'utf8'));
  const ids = rowIds(rs);
  const report = cases(after());
  const status = scanJUnit(after());
  const failures: string[] = [];
  const check = (ticket: string, ac: string, id: string) => {
    const n = report.filter((c) => idOf(c.file, c.title) === id).length;
    if (n !== 1) failures.push(`${ticket} ${ac} ${id}: ${n} cases in the report`);
    else if (status[id] !== 'passed') failures.push(`${ticket} ${ac} ${id}: ${status[id]}`);
  };
  // A tag naming a test outside the table's rows is not this ticket's to check; ST-LN-44's own tags name this file.
  for (const [ticket, t] of Object.entries(snap.tickets)) {
    if (ticket === 'ST-LN-44') continue;
    for (const s of t.scenarios)
      for (const tag of s.tags)
        if (tag.startsWith('@test:') && ids.has(tag.slice(6))) check(ticket, s.acTag ?? '-', tag.slice(6));
  }
  // Each criterion test the table keeps, speeds up or rebuilds still holds its ticket's tag (D-04, rule 1).
  for (const r of rs.filter((x) => x.tag !== '-')) {
    const [ticket, ac] = r.tag.split(' ');
    const scenario = snap.tickets[ticket]?.scenarios.find((s) => s.acTag === ac);
    if (!scenario?.tags.includes('@test:' + idOf(r.file, r.title)))
      failures.push(`${ticket} ${ac} ${idOf(r.file, r.title)}: the scenario does not carry the tag`);
  }
  expect(failures).toEqual([]);
});

it('ac-3 every test gone since the baseline run is a row the table moves and every destination exists', () => {
  const rs = rows(readFileSync(TABLE, 'utf8'));
  const pair = (c: { file: string; title: string }) => `${c.file}\0${c.title}`;
  const beforeSet = new Set(cases(before()).map(pair));
  const afterSet = new Set(cases(after()).map(pair));
  const failures: string[] = [];
  // Rows from 119 are appended keeps of rule 3; one of them (a new test of this ticket) has no before pair.
  for (const r of rs.filter((x) => x.n <= 118))
    if (!beforeSet.has(pair(r))) failures.push(`#${r.n} ${r.file} > ${r.title}: not in the before run`);
  const gone = new Set(['removed', 'merged', 'moved']);
  const goneOk = new Set(rs.filter((r) => gone.has(r.action)).map(pair));
  for (const p of beforeSet)
    if (!afterSet.has(p) && !goneOk.has(p)) failures.push(`${p.replace('\0', ' > ')}: gone but no row removes, merges or moves it`);
  for (const r of rs.filter((x) => x.action === 'moved' || x.action === 'merged'))
    for (const d of r.destinations)
      if (!afterSet.has(pair(d))) failures.push(`#${r.n} ${d.file} > ${d.title}: destination not in the after run`);
  expect(failures).toEqual([]);
});
