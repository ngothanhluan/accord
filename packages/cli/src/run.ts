// CLI-04 command spine: every command is the same pipeline with a different middle — resolve the git
// root, load the snapshot, check the version pin, call one pure core function, print, return an exit
// code. argv, cwd, and both streams are injected, so a test drives the whole CLI in-process and
// nothing reaches `process.*` (STACK Decision 7). Exit codes follow STACK Decision 1: 0 pass,
// 1 lint/gate failure, 2 usage or environment error.
import { loadSnapshot } from '@accord-dev/accord-core';
import type { RepoSnapshot } from '@accord-dev/accord-core';
import { Command, CommanderError, Option } from 'commander';
import pkg from '../package.json' with { type: 'json' };
import { gate } from './commands/gate.js';
import { lint } from './commands/lint.js';
import { newTicket } from './commands/new-ticket.js';
import { status } from './commands/status.js';
import { loadFromFs, UsageError } from './load/fs.js';
import { pinMessage } from './pin.js';
import { repoRoot } from './root.js';

export interface RunOptions {
  cwd: string;
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
  // Declared now although only the tracker adapter reads it, so adding that adapter does not reopen
  // this file or change the shape every test constructs.
  env?: NodeJS.ProcessEnv;
}

export interface CommandContext {
  root: string;
  snapshot: RepoSnapshot;
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
  env: NodeJS.ProcessEnv;
}

/**
 * Root, snapshot, pin — in that order, once per command (D-95, D-103). A repository with no `accord/`
 * folder throws the loader's own UsageError before the pin is ever consulted.
 */
function preflight(opts: RunOptions): CommandContext {
  const root = repoRoot(opts.cwd);
  const snapshot = loadSnapshot(loadFromFs(root));
  // D-94: a hard refusal, no flag and no environment variable that skips it. `config` is undefined
  // when config.yml is missing or failed the schema (D-31); those repositories must report their
  // schema findings through lint rather than a pin error, so the check is guarded rather than global.
  if (snapshot.config !== undefined) {
    const message = pinMessage(snapshot.config.accord, pkg.version);
    if (message !== undefined) throw new UsageError(message);
  }
  return { root, snapshot, stdout: opts.stdout, stderr: opts.stderr, env: opts.env ?? {} };
}

export async function runCli(argv: string[], opts: RunOptions): Promise<number> {
  let code = 0;
  const program = new Command('accord')
    .description('check the accord folder in this repository')
    .exitOverride()
    .configureOutput({
      writeOut: (str) => {
        opts.stdout.write(str);
      },
      writeErr: (str) => {
        opts.stderr.write(str);
      },
    })
    .version(pkg.version);

  program
    .command('lint')
    .description('report every finding in the accord folder')
    .option('--json', 'print the LintResult object instead of text')
    .action((options: { json?: boolean }) => {
      code = lint(preflight(opts), options);
    });

  // Both subcommands route through the same preflight the lint action uses, so the pin check is never
  // conditional on which gate was asked for (D-95).
  const gates = program.command('gate').description('run one gate against one ticket');
  for (const which of ['ready', 'done'] as const) {
    gates
      .command(which + ' <id>')
      .description('report whether the ticket passes the ' + which + ' gate')
      .option('--json', 'print the GateResult object instead of text')
      .action((id: string, options: { json?: boolean }) => {
        code = gate(preflight(opts), which, id, options);
      });
  }

  // D-95: `new ticket` is deliberately *not* exempt from the pin. The ticket template changes between
  // versions, so scaffolding from a template the repository is not pinned to is exactly the split
  // PITFALLS section 11 describes — the same shared preflight therefore stops it before any path is
  // constructed and before any byte is written. `--type` is the only option: `--title` was rejected
  // under D-104, and there is no `feature` subcommand — the one in docs/design.md section 7 died with
  // the features/ folder.
  program
    .command('new')
    .description('scaffold a document a human then fills in')
    .command('ticket <id>')
    .description("write accord/tickets/<id>.md from the active profile's template, filling nothing in")
    .addOption(
      new Option('--type <type>', 'which template to render (D-104)')
        .choices(['epic', 'story', 'bug'])
        .default('story'),
    )
    .action((id: string, options: { type: 'epic' | 'story' | 'bug' }) => {
      code = newTicket(preflight(opts), id, options);
    });

  program
    .command('status')
    .description('print one row per ticket')
    .option('--json', 'print the StatusRow array instead of the table')
    .option('--all', 'include archived tickets (D-93)')
    // The only async action: `status` may ask the tracker what it knows (INTG-01). `parseAsync`
    // awaits it, so the exit code is still settled before runCli returns.
    .action(async (options: { json?: boolean; all?: boolean }) => {
      code = await status(preflight(opts), options);
    });

  try {
    await program.parseAsync(argv, { from: 'user' });
  } catch (err) {
    if (err instanceof UsageError) {
      opts.stderr.write(err.message + '\n');
      return err.exitCode;
    }
    if (err instanceof CommanderError) {
      // `--version` and `--help` are answered before any action runs, so they never reach preflight
      // and D-95's exemption holds by construction. Every other commander refusal is a bad argument,
      // which STACK Decision 1 puts at exit 2 — exit 1 is reserved for a lint or gate verdict.
      return err.code === 'commander.version' || err.code === 'commander.helpDisplayed' ? 0 : 2;
    }
    opts.stderr.write((err instanceof Error ? err.message : String(err)) + '\n');
    return 2;
  }
  return code;
}
