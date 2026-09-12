// D-42 verification.md: one block per `## @ac-n <name>` heading, matched by tag.
import type { Finding } from '../model/finding.js';
import type { EvidenceBlock, Section, Verification, VerificationFrontmatter } from '../model/snapshot.js';
import { loadFrontmatter } from './frontmatter.js';
import { duplicateHeadings, scan, stripHtmlComments } from './sections.js';

const BLOCK = /^@(ac-[1-9][0-9]*)\b\s*(.*)$/;
const tagOf = (s: Section): string | undefined => BLOCK.exec(s.heading)?.[1];

export function parseVerification(
  id: string,
  file: string,
  text: string,
): { verification: Verification; findings: Finding[] } {
  const fm = loadFrontmatter<VerificationFrontmatter>(file, text, 'verification');
  const findings = [...fm.findings];
  const { sections } = scan(fm.body, fm.bodyOffset);
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

  const verification: Verification = {
    ticket: id,
    file,
    ...(fm.value === undefined ? {} : { frontmatter: fm.value }),
    blocks,
  };
  return { verification, findings };
}
