// CLI-01 `accord init`: the one command that runs in a repository with no `accord/` folder, because it is
// the command that creates it. Core decides what is written and where; this file contributes the filesystem
// and the report (D-107).
//
// D-130, one rule and no second: a path that exists is skipped. Nothing here reads an existing file, diffs
// it, or leaves a marker for its own benefit — there is no code path that can clobber a document a human
// owns, because there is no code path that writes over an existing file at all. The accepted cost is that a
// repository initialised at one version does not receive a later version's template improvements; upgrading
// a document stays a manual act, and the version pin is what makes the mismatch visible.
import { lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { initFiles, loadSnapshot, POINTER_FILES, pointerText, skillTargets } from '@accord-dev/accord-core';
import pkg from '../../package.json' with { type: 'json' };
import { assertNoLink } from '../guard.js';
import { loadFromFs, UsageError } from '../load/fs.js';
import { pinMessage } from '../pin.js';
import { writeSkillFiles } from './skills.js';
import type { SkillFile } from '@accord-dev/accord-core';
import type { ReportRow } from './skills.js';
import type { CommandContext } from '../run.js';

/** No `snapshot`: loading one needs an `accord/` folder, and this is the command that puts one there. */
export type InitContext = Omit<CommandContext, 'snapshot'>;

export function init(ctx: InitContext): number {
  // D-135: the version written into config.yml is the running CLI's own, read from the same manifest the
  // pin check reads. Core cannot reach this object, so it is passed in.
  const files = initFiles({ name: pkg.name, version: pkg.version });

  // T-07-02: refuse before the first byte, over every destination. The loop below writes as it iterates, so
  // a guard inside it would leave everything sorted ahead of the bad path on disk while the message claimed
  // "nothing was written". Same function `skills sync` calls, so the two write paths cannot drift.
  for (const { path } of files) assertNoLink(ctx.root, path);
  // T-07-19: the pointer files join the same pre-pass. A root-level `.md` may be a symlink out of the
  // repository, and the refusal has to land before the first byte of the whole run — not before the first
  // byte of the step that happens to reach it.
  for (const path of POINTER_FILES) assertNoLink(ctx.root, path);

  /**
   * Every refusal this repository can make, in one place: a `config.yml` that cannot be read, a version
   * this repository is not pinned to, and a skill-copy path that is not a regular file. One function with
   * two call sites and no third — three checks that merely happen to be adjacent are three things that can
   * be reordered wrong, and this ordering is the whole of what stops a refused release writing anyway.
   *
   * Returns the skill targets it guarded: the roster is the config on disk's to decide (D-131), and
   * reaching them from the snapshot loaded here is what keeps the config parsed exactly once (A-07).
   */
  const refusals = (): SkillFile[] => {
    // One config parser and one schema application for the whole CLI (A-07) — the alternative is a second
    // YAML parse here that can disagree with the first.
    const snapshot = loadSnapshot(loadFromFs(ctx.root));
    // The same sentence `skills sync` throws, so a repository whose config cannot be read gets one answer
    // rather than two. `sync` is the reason it names lint: the schema findings live there.
    if (snapshot.config === undefined) {
      throw new UsageError('accord/config.yml is missing or failed its schema; run accord lint');
    }
    // A-06, D-95: `init` is repository-reading the moment a config exists, so it refuses like every other
    // such command. On a greenfield run the config this command just wrote pins the running version, so
    // this never fires; on a D-132 run against a repository pinned elsewhere it does.
    const message = pinMessage(snapshot.config.accord, pkg.version);
    if (message !== undefined) throw new UsageError(message);
    // D-131: the same function `skills sync` calls, with the same pre-pass guard, over the roster the
    // config on disk declares — the defaults this run wrote on a greenfield repository, the human's
    // existing roster on a D-132 one. The orphan scan is deliberately not run: D-113 scopes that advisory
    // to `sync`, and a repository being initialised has no history to have orphaned anything.
    const targets = skillTargets(snapshot.config);
    for (const { path } of targets) assertNoLink(ctx.root, path);
    return targets;
  };

  // The ordering this command is judged on: a repository that has refused this release receives no byte
  // from it. `accordFiles` needs the `accord/` folder and a `config.yml` inside it implies one, so when
  // that file is already on disk the load resolves here — before the first write — and every refusal
  // lands ahead of it. A greenfield repository is the one case that cannot be guarded first: the roster
  // is decided by the config this run is about to write, so its refusals are taken after the loop and the
  // report below is what makes that run auditable.
  const guarded =
    lstatSync(join(ctx.root, 'accord', 'config.yml'), { throwIfNoEntry: false }) === undefined
      ? undefined
      : refusals();

  // Computed once, then rendered — so a `--json` mode added later cannot disagree with the text. One list
  // for both halves, so there is exactly one place that turns a status into a line of text.
  const results: ReportRow[] = [];
  // The one place that turns a status into a line of text, named so the throw path below can reach it. A
  // second expression would be a second report, free to disagree with the one the success path prints.
  // The printed string is core's forward-slash path, never the joined native one (D-51).
  const rendered = (): string => results.map((r) => r.status + ' ' + r.path + '\n').join('');

  // Everything that writes, in one region. The refusal the greenfield roster cannot hoist lands somewhere
  // inside it, so the catch prints what was written and rethrows untouched: a partial run is legible rather
  // than invisible, and `run.ts` still maps the original UsageError to exit 2. The report is NOT permission
  // to keep writing before a refusal — the ordering above is what does that work, and this only makes what
  // the ordering cannot prevent auditable.
  try {
    for (const { path, text } of files) {
      const file = join(ctx.root, ...path.split('/'));
      if (lstatSync(file, { throwIfNoEntry: false }) === undefined) {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, text); // no encoding argument: Node defaults to utf8 and writes no BOM (FMT-08)
        results.push({ status: 'created', path });
      } else {
        results.push({ status: 'skipped', path });
      }
    }

    // Greenfield only: `guarded` is already set when a config was on disk before the loop, and D-130 means
    // the loop cannot have changed one that was. Parsing the same file twice is work that can disagree with
    // itself.
    // GC-WR-01: the array, not the return value. A copy written before a later target throws is in the
    // report the catch below prints, because it was recorded the moment it became true.
    writeSkillFiles(ctx.root, guarded ?? refusals(), results);

    // CLI-03, and the one write in this command that is not skip-if-exists: an agent instruction file
    // belongs to whoever wrote it, so the block is appended to what is there rather than written over it.
    // Core decides the text and the separator (D-142, A-14); the only judgement here is which of the three
    // words to print. No `mkdirSync`: both paths are root-level file names with no directory component.
    for (const path of POINTER_FILES) {
      const file = join(ctx.root, path);
      const found = lstatSync(file, { throwIfNoEntry: false });
      const text = pointerText(found === undefined ? undefined : readFileSync(file, 'latin1'));
      if (text === undefined) {
        results.push({ status: 'skipped', path });
        continue;
      }
      // latin1 is a byte-for-byte codec — 0x00-0xFF onto U+0000-U+00FF, both directions, no substitution —
      // and it is a PAIR with the read five lines up. Decoded and re-encoded with the same codec, every byte
      // of the document survives whatever encoding its author actually used; `utf8` on this pair substituted
      // EF BF BD for each byte it could not decode and wrote the substitution back over the original, which
      // is the one thing T-07-18 forbids. Still no BOM (FMT-08): core's text carries none to encode.
      writeFileSync(file, text, 'latin1');
      // A-13: a third word, because an append is neither of the other two. `created` would be false about a
      // file that already existed and `skipped` false about one that changed; the third word is false about
      // nothing.
      results.push({ status: found === undefined ? 'created' : 'appended', path });
    }
  } catch (err) {
    ctx.stdout.write(rendered());
    throw err;
  }

  // D-133: the whole list either way, exit 0 either way. A person re-running `init` is usually asking what
  // accord thinks belongs here, and the list is the answer — a terse "nothing to do" is not. Outside the
  // try on purpose: inside it, a throw after this line would print the report twice.
  ctx.stdout.write(rendered());
  return 0;
}
