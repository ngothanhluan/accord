// CLI-05 `accord lint`: one call into the pure engine, one printer, one exit code. The text form wraps
// core's renderText (D-60); `--json` prints the LintResult verbatim, with no envelope and no wrapper
// key, so `jq '.findings[]'` works with no unwrapping (D-98).
import { lintSnapshot, renderText } from '@accord-dev/accord-core';
import { colourFindings } from '../render/color.js';
import type { CommandContext } from '../run.js';

export function lint(ctx: CommandContext, options: { json?: boolean }): number {
  const result = lintSnapshot(ctx.snapshot);
  ctx.stdout.write(
    options.json ? JSON.stringify(result, null, 2) + '\n' : colourFindings(renderText(result), ctx.stdout),
  );
  // D-56: an error finding fails the command; a warning never changes the exit code.
  return result.errors > 0 ? 1 : 0;
}
