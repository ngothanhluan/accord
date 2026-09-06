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
    const story = ['## Intent', '## Requirements', '## Acceptance criteria', '## Open questions', '## Plan'];
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
    for (const md of [build, maintain]) expect(md).toContain('Developer fills this in. BA leaves it empty.');
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
    for (const name of names) {
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
