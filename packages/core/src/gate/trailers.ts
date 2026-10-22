// ST-LN-8 D-07: a forbidden line is any body line (never the subject) that starts, after whitespace, with a
// `-by:` token or contains "Generated with"; case ignored. Reads the raw message, never git's trailer parser.
export function forbiddenLines(message: string): string[] {
  return message
    .split('\n')
    .slice(1)
    .filter((l) => /^\s*[A-Za-z0-9-]*-by:/i.test(l) || /generated with/i.test(l))
    .map((l) => l.trim());
}

export const trailerReason = (sha: string, line: string): string =>
  `commit ${sha.slice(0, 12)} carries the forbidden line "${line}"; commits.trailers is forbid in accord/config.yml`;
