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
