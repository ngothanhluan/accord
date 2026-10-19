// D-60: core renders findings colour-free and the CLI wraps that text — it never re-renders a finding
// and never builds a second formatter. Colour goes through node:util `styleText` with the `stream`
// option, so Node's own `validateStream` decides whether an escape is emitted; it already honours
// NO_COLOR, NODE_DISABLE_COLORS, FORCE_COLOR, and isTTY (STACK Decision 5, T-05-03).
import { styleText } from 'node:util';

// renderText emits `file[:line]: level rule reason`; only the level token is styled. The summary line
// (`N errors, M warnings`) has no `file:` prefix and therefore never matches.
const LEVEL = /^(\S*?:(?:\d+:)?) (error|warning)\b/;

export function colourFindings(text: string, stream: NodeJS.WritableStream): string {
  return text
    .split('\n')
    .map((line) => {
      const m = LEVEL.exec(line);
      if (m === null) return line;
      const level = m[2];
      return m[1] + ' ' + styleText(level === 'error' ? 'red' : 'yellow', level, { stream }) + line.slice(m[0].length);
    })
    .join('\n');
}

const STEP = /^- (Given|When|Then|And|But)(?= )/;

// Headings cyan; in the criteria part, step keywords green and ac-n ids yellow. Escapes only wrap text, so
// stripping them gives back the colour-off view.
export function colourApproval(text: string, stream: NodeJS.WritableStream): string {
  let criteria = false;
  return text
    .split('\n')
    .map((line) => {
      if (line.startsWith('## ')) {
        criteria = line === '## Acceptance criteria';
        return styleText('cyan', line, { stream });
      }
      if (!criteria) return line;
      const m = STEP.exec(line);
      const rest = m === null ? line : '- ' + styleText('green', m[1] ?? '', { stream }) + line.slice(m[0].length);
      // The id pattern must skip the escape codes just added: they hold no "ac-".
      return rest.replace(/\bac-[1-9][0-9]*\b/g, (id) => styleText('yellow', id, { stream }));
    })
    .join('\n');
}
