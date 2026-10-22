#!/usr/bin/env node
// CLI-04 entry: the real argv, cwd, and streams in; an exit code out. Everything testable lives in
// run.ts. `process.exitCode` is assigned rather than `process.exit` called, because exit would
// truncate a pending stdout write.
import { runCli } from './run.js';

// Only `hook` reads stdin (Claude Code sends the event there); every other command must never wait on it.
let stdin: string | undefined;
if (process.argv[2] === 'hook' && process.stdin.isTTY !== true) {
  process.stdin.setEncoding('utf8');
  stdin = '';
  for await (const chunk of process.stdin) stdin += chunk;
}

process.exitCode = await runCli(process.argv.slice(2), {
  cwd: process.cwd(),
  stdout: process.stdout,
  stderr: process.stderr,
  env: process.env,
  ...(stdin === undefined ? {} : { stdin }),
});
