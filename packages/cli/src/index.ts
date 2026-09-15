#!/usr/bin/env node
// CLI-04 entry: the real argv, cwd, and streams in; an exit code out. Everything testable lives in
// run.ts. `process.exitCode` is assigned rather than `process.exit` called, because exit would
// truncate a pending stdout write.
import { runCli } from './run.js';

process.exitCode = await runCli(process.argv.slice(2), {
  cwd: process.cwd(),
  stdout: process.stdout,
  stderr: process.stderr,
  env: process.env,
});
