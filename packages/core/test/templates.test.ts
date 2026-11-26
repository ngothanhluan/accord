import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import type { Tags } from 'yaml';
import { templates, validate } from '../src/index.js';
import type { TemplateName } from '../src/index.js';

const templatesDir = fileURLToPath(new URL('../templates/', import.meta.url));
const BOM = String.fromCharCode(0xfeff);
const FRONTMATTER = /^---\n([\s\S]*?)\n---(?:\n|$)/;
// Only the D-04 key names count as keys; a generic `[a-z_]+:` would also match guidance text.
const KEY = /^#? ?(id|title|type|status|parent|tracker|ui|design|assumptions|ac_hash|verified):/;

// STACK.md Decision 2: core schema, numerics stay strings (Pitfall 10 typing).
const stringNumerics = (tags: Tags) =>
  tags.filter((t) => !/int|float/.test(typeof t === 'string' ? t : t.tag));

const normalise = (text: string) =>
  (text.startsWith(BOM) ? text.slice(1) : text).replace(/\r\n/g, '\n');

function frontmatterBlock(md: string): string | null {
  const m = FRONTMATTER.exec(normalise(md));
  return m ? m[0] : null;
}

function frontmatter(md: string): Record<string, unknown> | null {
  const m = FRONTMATTER.exec(normalise(md));
  return m ? (parse(m[1], { schema: 'core', customTags: stringNumerics }) as Record<string, unknown>) : null;
}

const headings = (md: string) => md.split('\n').filter((line) => line.startsWith('## '));
const stripHtmlComments = (text: string) => text.replace(/<!--[\s\S]*?-->/g, '');
const frontmatterKeys = (md: string) =>
  (frontmatterBlock(md) ?? '')
    .split('\n')
    .map((line) => KEY.exec(line)?.[1])
    .filter((key): key is string => key !== undefined);

const build = templates['ticket-build.md'];
const maintain = templates['ticket-maintain.md'];
const epic = templates['epic.md'];
const names = Object.keys(templates) as TemplateName[];

describe('frontmatter validates against its schema', () => {
  it.each<[TemplateName, string]>([
    ['ticket-build.md', 'story'],
    ['ticket-maintain.md', 'story'],
    ['epic.md', 'epic'],
  ])('%s validates against ticket.schema.json', (name, type) => {
    const fm = frontmatter(templates[name]);
    expect(fm).not.toBeNull();
    expect(validate('ticket', fm)).toEqual([]);
    expect(fm).toMatchObject({ type, status: 'draft' });
  });

  it('verification.md validates against verification.schema.json', () => {
    const fm = frontmatter(templates['verification.md']);
    expect(fm).not.toBeNull();
    expect(validate('verification', fm)).toEqual([]);
  });
});

describe('template structure', () => {
  it('glossary.md and business-rules.md have no frontmatter', () => {
    expect(frontmatter(templates['glossary.md'])).toBeNull();
    expect(frontmatter(templates['business-rules.md'])).toBeNull();
  });

  it('headings are in D-07 order', () => {
    const story = ['## Intent', '## Requirements', '## Acceptance criteria', '## Open questions', '## Plan', '## Verification notes'];
    expect(headings(build)).toEqual(story);
    expect(headings(maintain)).toEqual(story);
    expect(headings(epic)).toEqual(['## Intent', '## Requirements', '## Open questions']);
  });

  it('build and maintain differ only inside body HTML comments', () => {
    const buildFm = frontmatterBlock(build);
    const maintainFm = frontmatterBlock(maintain);
    expect(buildFm).not.toBeNull();
    expect(buildFm).toBe(maintainFm);
    expect(buildFm).not.toContain('<!--');
    expect(maintainFm).not.toContain('<!--');
    expect(stripHtmlComments(build)).toBe(stripHtmlComments(maintain));
    expect(build).not.toBe(maintain);
  });

  it('frontmatter keys are the D-04 set in D-04 order; verified last', () => {
    const story = ['id', 'title', 'type', 'status', 'parent', 'tracker', 'ui', 'design', 'assumptions', 'ac_hash', 'verified'];
    expect(frontmatterKeys(build)).toEqual(story);
    expect(frontmatterKeys(maintain)).toEqual(story);
    expect(frontmatterKeys(epic)).toEqual(story.filter((k) => k !== 'ac_hash' && k !== 'verified'));
  });

  it('ownership guidance is present', () => {
    const businessLanguage = 'never name tables, endpoints, libraries, or screens';
    for (const md of [build, maintain, epic]) expect(md).toContain(businessLanguage);
    for (const md of [build, maintain]) expect(md).toContain('Filled in at build. Leave it empty at intent.');
    // D-116: the rejected-alternatives convention has no schema behind it, so the template guidance line is
    // the only place it is written down for someone who never reads the BA workflow.
    expect(templates['business-rules.md']).toContain('`Rejected: <option> — <reason>`');
  });

  // Phase 08.8 D-09: the comments name the stage that fills a section in (intent, build, done), never a job title,
  // and each instruction the old comments carried is still there.
  it('risk:regression templates give each instruction with no job title (D-09)', () => {
    const job = /\bBA\b|[Dd]eveloper|[Dd]esigner\b|At handover/;
    for (const name of names) {
      const text = templates[name].replace(/accord-designer/g, '');
      expect(text.split('\n').filter((line) => job.test(line)), name).toEqual([]);
    }
    const kept: [string, string[]][] = [
      ['ticket-build.md', ['Why, for whom, how success is measured, and explicit non-goals', 'One EARS line per requirement', 'One fenced gherkin block; every scenario tagged @ac-n', 'Ready stays blocked while any is unchecked', 'A short plan only.']],
      ['ticket-maintain.md', ['Why, for whom, how success is measured, and explicit non-goals', 'One EARS line per requirement', 'One fenced gherkin block; every scenario tagged @ac-n', 'Ready stays blocked while any is unchecked', 'A short plan only.']],
      ['epic.md', ['Why, for whom, how success is measured, and explicit non-goals', 'One EARS line per requirement', 'Ready stays blocked while any is unchecked']],
      ['glossary.md', ['One term per entry: the word the team actually uses and its business meaning']],
      ['business-rules.md', ['one rule per bullet', 'the ticket cites it instead of restating it', '`Rejected: <option> — <reason>`']],
      ['prototype-header.html', ['Derived from:', 'holds the design reference of this ticket']],
    ];
    for (const [name, phrases] of kept) for (const phrase of phrases) expect(templates[name as TemplateName], `${name}: ${phrase}`).toContain(phrase);
    for (const md of [build, maintain]) {
      // the self-test ticks are written at build and stay the last key
      expect(md).toContain('Self-test ticks, e.g. [ac-1, ac-2]. Written at build, not at intent.');
      expect(md).toContain('Always the last key so build edits stay far from intent edits.');
      // the verification notes are filled in at done, one block per ticked scenario, and empty before
      expect(md).toContain('Filled in at done; leave it empty before. One "### @ac-n <scenario name>" block per ticked scenario');
    }
  });

  it('templates reflect the folder convention (FMT-01)', () => {
    const legacyFolder = new RegExp('features' + '/');
    for (const name of names) expect(templates[name]).not.toMatch(legacyFolder);
    for (const md of [build, maintain]) {
      expect(md).toContain('tickets/<id>/verification.md');
      expect(md).toContain('product/glossary.md');
    }
    expect(maintain).toContain('assets/<id>/prototype.html');
    expect(templates['verification.md']).toContain('tickets/<id>/verification.md');
    const header = templates['prototype-header.html'];
    expect(header).toContain('Derived from:');
    expect(header).toContain('<!doctype html>');
    expect(header.slice(0, 2)).toBe('<!');
  });

  it('sample values contain no tokens', () => {
    // The ruleset's one placeholder is filled by the hook at print time, never by a user.
    for (const name of names.filter((n) => n !== 'ruleset.md')) {
      expect(templates[name]).not.toContain('{{');
      expect(templates[name]).not.toContain('}}');
    }
    for (const md of [build, maintain, epic]) expect(frontmatter(md)?.id).toBe('TICKET-ID');
  });
});

describe('generated module', () => {
  it('generated module matches templates/ (drift)', () => {
    const onDisk = readdirSync(templatesDir).filter((f) => /\.(md|html)$/.test(f)).sort();
    expect(Object.keys(templates), 'template file set drifted: run npm run gen').toEqual(onDisk);
    for (const name of onDisk) {
      const text = normalise(readFileSync(templatesDir + name, 'utf8'));
      expect(templates[name as TemplateName], `${name} drifted: run npm run gen`).toBe(text);
    }
  });

  it('LF and no BOM on disk', () => {
    for (const name of names) {
      const raw = readFileSync(templatesDir + name, 'utf8');
      expect(raw, `${name} has CR`).not.toContain('\r');
      expect(raw.startsWith(BOM), `${name} has BOM`).toBe(false);
    }
  });
});

describe('lane templates (spec §4)', () => {
  it.each<[TemplateName, string]>([
    ['ticket-lane.md', 'story'],
    ['epic-lane.md', 'epic'],
  ])('%s validates and declares a lane', (name, type) => {
    const fm = frontmatter(templates[name]);
    expect(validate('ticket', fm)).toEqual([]);
    expect(fm).toMatchObject({ type, status: 'draft' });
    expect(fm?.lane).toMatch(/^[SMLP]$/);
  });

  it('risk:regression ticket-lane-s.md validates and declares lane S', () => {
    const fm = frontmatter(templates['ticket-lane-s.md']);
    expect(validate('ticket', fm)).toEqual([]);
    expect(fm).toMatchObject({ type: 'story', status: 'draft', lane: 'S' });
  });

  // Phase 15 15-20 D-05: stories of an epic run lane M, so the template's lane comment names M as one feature (a story of an epic too) and L as an epic.
  it('risk:regression ticket-lane.md names lane L as an epic and lane M as one feature, a story of an epic included (D-05)', () => {
    const line = templates['ticket-lane.md'].split('\n').find((l) => l.startsWith('lane:')) ?? '';
    expect(line).toContain('# M: one feature, also a story of an epic | L: an epic | P: part of a whole project');
    expect(line).not.toContain('L: a story of an epic');
    // the comment column stays where the other keys' comments are
    const hash = (l: string): number => l.indexOf('#');
    const type = templates['ticket-lane.md'].split('\n').find((l) => l.startsWith('type:')) ?? '';
    expect(hash(line)).toBe(hash(type));
  });

  it('lane headings are in spec order', () => {
    expect(headings(templates['ticket-lane.md'])).toEqual([
      '## Intent', '## Acceptance criteria', '## Vetoes', '## Decisions', '## Corrections', '## Open questions', '## Approach',
    ]);
    expect(headings(templates['epic-lane.md'])).toEqual([
      '## Intent', '## Vetoes', '## Decisions', '## Corrections', '## Open questions', '## Approach',
    ]);
    expect(headings(templates['ticket-lane-s.md'])).toEqual(['## Understood', '## Done when', '## Scope']);
  });
});
