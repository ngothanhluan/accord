// CLI-03 pointer block (D-141 to D-144): the short note `accord init` puts in `AGENTS.md` and `CLAUDE.md`,
// so an agent that has not loaded a skill still learns the one thing that makes it load one. Core decides
// the text and the boundary; the CLI owns the filesystem (D-107).
//
// This is the one `init` artifact that is not a plain skip-if-exists write, which is why it takes its own
// function rather than a fifth `ScaffoldFile`: a `ScaffoldFile`'s text is fixed, and the separator here is a
// function of what the human's existing file ends with. Deciding that in the CLI would put a content
// decision on the side of the seam that only knows about disks.

// D-141: an HTML comment pair. Machine-findable, invisible in rendered Markdown, and it leaves the door open
// to updating the block in place later without re-deciding the format then.
export const POINTER_START = '<!-- accord:start -->';
export const POINTER_END = '<!-- accord:end -->';

// D-144: a source literal, never derived from `runtimes:`. ROADMAP criterion 3 names both files
// unconditionally, and this is deliberately NOT the `skillTargets(config)` filtering rule, which continues
// to govern where skill copies go.
export const POINTER_FILES: readonly string[] = ['AGENTS.md', 'CLAUDE.md'];

// D-143: the two skill directories and exactly one line of rule. No skill body is copied — a copy would
// drift from the definition with nothing detecting it (CLI-03) — and there is no second rule, because an
// agent that has not loaded a skill needs the one sentence that makes it load one, and anything past that
// starts duplicating the skills.
//
// T-07-20: fixed text with no interpolation. No repository content, no config value and no argument reaches
// it, so nothing in a repository can smuggle an instruction into the context of an agent that reads it.
//
// `.claude/skills` and `.agents/skills` are directory paths, which is the one naming the "no other tools
// named" constraint permits — the same carve-out `test/helpers/denied.ts` makes for the rendered skill
// bodies, for the same reason: a shipped text has to be able to say where it installs.
const BLOCK = `${POINTER_START}

## accord

Role workflows for this repository are installed at \`.claude/skills/accord-*\` and
\`.agents/skills/accord-*\`. Load the one for the stage you are in before you touch a ticket.

A ticket is not started before \`accord gate ready <id>\` passes.
${POINTER_END}
`;

/**
 * The whole new contents of an agent instruction file, or `undefined` when nothing should change.
 *
 * `undefined` in means the file does not exist, and the caller gets the block alone back. `undefined` out
 * means skip.
 *
 * T-07-18: for every input that returns a string, that input is a byte-exact prefix of the result. This
 * appends and does nothing else — no substitution, no reflow, no re-serialisation of a document a human owns.
 *
 * A-12: the START marker alone decides that the block is already present. A start marker with no end marker
 * is a human's half-finished edit, and appending a second block beside it is exactly the overwrite D-130
 * exists to forbid — so that file is left as it is for its owner to resolve.
 *
 * A-14, the separator: an empty file gets the block alone rather than a stray leading blank line; a file
 * already ending in a blank line gets nothing added; a file ending in one newline gets one more; and a file
 * ending mid-sentence gets two, so the marker never lands on the end of someone's last sentence.
 */
export function pointerText(existing: string | undefined): string | undefined {
  if (existing === undefined || existing === '') return BLOCK;
  if (existing.includes(POINTER_START)) return undefined;
  const separator = existing.endsWith('\n\n') ? '' : existing.endsWith('\n') ? '\n' : '\n\n';
  return existing + separator + BLOCK;
}
