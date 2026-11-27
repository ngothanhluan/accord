// D-42 verification.md: one block per `## @ac-n <name>` heading, matched by tag.
import type { LoadFinding } from '../model/finding.js';
import type { EvidenceBlock, RepoRecord, Section, Verification, VerificationFrontmatter } from '../model/snapshot.js';
import { loadFrontmatter } from './frontmatter.js';
import { duplicateHeadings, scan, stripHtmlComments } from './sections.js';
import { unfinishedLine } from './unfinished.js';
import { REPO_NAME } from './work.js';

const BLOCK = /^@(ac-[1-9][0-9]*)\b\s*(.*)$/;
const tagOf = (s: Section): string | undefined => BLOCK.exec(s.heading)?.[1];

// Phase 08.9.3 D-07, Ruling R16: the label lines of a `## Repository <name>` section. A label starts its line (never a list item), outside a fence.
const REPO_HEADING = /^Repository\s+(\S+)$/;
const LABEL = /^(Suite|Slice|PR|Verified head|Merged):[ \t]*(.*)$/;
const SUITE = /^(passed|failed)[ \t]+(\S.*)$/;
const SLICE_N = /^([1-9][0-9]*)$/;
const PR_NUMBER = /^#([1-9][0-9]*)$/;
const SHA40 = /^[0-9a-fA-F]{40}$/;

/** The name of the repository a `## Repository <name>` heading holds, or undefined when the heading is no such record (another heading, or a name that is not a REPO_NAME). */
const repoOf = (s: Section): string | undefined => {
  const name = REPO_HEADING.exec(s.heading)?.[1];
  return name !== undefined && REPO_NAME.test(name) ? name : undefined;
};

/** Reads one section into its record: the suite line, the groups, and every label line that did not read. Pure over the section's lines (comments stripped, fences skipped). */
function readRecord(name: string, section: Section, fenced: (line: number) => boolean): RepoRecord {
  const record: RepoRecord = { name, line: section.line, slices: [], unread: [] };
  let group: RepoRecord['slices'][number] | undefined;
  for (const l of stripHtmlComments(section.lines)) {
    if (fenced(l.line)) continue;
    const m = LABEL.exec(l.text);
    if (m === null) continue;
    const label = m[1] as RepoRecord['unread'][number]['label'];
    const value = m[2].trim();
    const text = l.text.trimEnd();
    const bad = (repeated?: true): void => {
      record.unread.push({ line: l.line, label, text, ...(group === undefined ? {} : { n: group.n }), ...(repeated === undefined ? {} : { repeated }) });
    };
    if (label === 'Suite') {
      const suite = SUITE.exec(value);
      if (record.suite !== undefined) bad(true);
      else if (suite === null) bad();
      else record.suite = { result: suite[1] as 'passed' | 'failed', command: suite[2].trim(), line: l.line };
    } else if (label === 'Slice') {
      const n = SLICE_N.exec(value)?.[1];
      // a Slice: line that does not read opens no group, and closes the one before it, so the labels after it are never taken for that group's
      group = n === undefined ? undefined : { n: Number(n), line: l.line };
      if (group === undefined) bad();
      else record.slices.push(group);
    } else if (group === undefined) bad();
    else if (label === 'PR') {
      const pr = PR_NUMBER.exec(value)?.[1];
      if (group.pr !== undefined) bad(true);
      else if (pr === undefined) bad();
      else group.pr = Number(pr);
    } else {
      const key = label === 'Merged' ? 'merged' : 'verifiedHead';
      if (group[key] !== undefined) bad(true);
      else if (!SHA40.test(value)) bad();
      else group[key] = value;
    }
  }
  return record;
}

export function parseVerification(
  id: string,
  file: string,
  text: string,
): { verification: Verification; findings: LoadFinding[] } {
  const fm = loadFrontmatter<VerificationFrontmatter>(file, text, 'verification');
  const findings = [...fm.findings];
  const { sections, fences } = scan(fm.body, fm.bodyOffset);
  // D-40 applied by tag (D-42): the first block with a tag wins, later ones are skipped.
  findings.push(...duplicateHeadings(file, sections, tagOf));

  const blocks: EvidenceBlock[] = [];
  const seen = new Set<string>();
  for (const section of sections) {
    const m = BLOCK.exec(section.heading);
    if (!m || seen.has(m[1])) continue;
    seen.add(m[1]);
    const lines = stripHtmlComments(section.lines);

    const resultLine = lines.find((l) => /^Result:/.test(l.text));
    const result = resultLine ? /^Result:\s*(.*)$/.exec(resultLine.text)?.[1].trim() : undefined;
    const valid = result === 'pass' || result === 'fail' || result === 'blocked';
    if (!valid) {
      findings.push({
        file,
        line: resultLine?.line ?? section.line,
        rule: 'load.result-invalid',
        reason: 'Result must be pass, fail, or blocked',
      });
    }

    const at = lines.findIndex((l) => /^Evidence:/.test(l.text));
    let evidence = '';
    if (at >= 0) {
      const first = /^Evidence:\s*(.*)$/.exec(lines[at].text)?.[1] ?? '';
      evidence = [first, ...lines.slice(at + 1).map((l) => l.text)]
        .map((t) => t.trimEnd())
        .join('\n')
        .trim();
    }

    blocks.push({
      acTag: m[1],
      name: m[2].trim(),
      line: section.line,
      ...(valid ? { result } : {}),
      evidence,
    });
  }

  // Phase 08.9.3 D-07: the record of each other repository the ticket touched; the first section of a name is read, a second is skipped with a finding, as a second evidence block of a tag is
  const fenced = (line: number): boolean => fences.some((f) => f.open <= line && line <= f.close);
  const repos: RepoRecord[] = [];
  for (const section of sections) {
    const name = repoOf(section);
    if (name === undefined) continue;
    if (repos.some((r) => r.name === name)) {
      findings.push({ file, line: section.line, rule: 'load.repo-record-duplicate', reason: `duplicate "## Repository ${name}"; the first occurrence is used` });
      continue;
    }
    repos.push(readRecord(name, section, fenced));
  }

  const unfinished = unfinishedLine(fm.body, fm.bodyOffset); // ST-LN-72 D-11: the body as split, comments kept, so no section reader's comment stripping hides it
  const verification: Verification = {
    ticket: id,
    file,
    ...(fm.value === undefined ? {} : { frontmatter: fm.value }),
    blocks,
    ...(repos.length === 0 ? {} : { repos }),
    ...(unfinished === undefined ? {} : { unfinished }),
  };
  return { verification, findings };
}
