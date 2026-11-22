// Phase 8.5 D-01, D-05 to D-07: the one reader of product files (accord/product/conventions.md). The CLI reads, core builds: this returns what `ProductRead` and `ProductChange` of core describe
// and nothing else. A file is read only when it is a regular file: the working copy when it and every folder above it under the root is a plain file or folder (a link or junction is never
// followed), the default-branch copy only when git's tree lists the entry as mode 100644 or 100755, by the object id that listing gave. A link gives `not-regular`, never a byte of its target.
// git only, literal argument arrays, no shell, and nothing here writes.
import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONVENTIONS_FILE, rulesetText } from '@accord-dev/accord-core';
import type { ProductChange, ProductRead } from '@accord-dev/accord-core';
import pkg from '../../package.json' with { type: 'json' };
import { UsageError } from './fs.js';
import { shown } from './script-trust.js';

/** Every spawn here is git with a literal array; a pathspec is literal, and the output is never decoded by a shell. */
const git = (root: string, args: string[]): string =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });

/** What the working tree holds at `file`: its text when it and each folder above it is a plain file or folder; `absent` when a component is missing; `not-regular` for a link, a junction or anything else. */
function workingCopy(root: string, file: string): ProductRead {
  const parts = file.split('/');
  for (let i = 0; i < parts.length; i++) {
    const found = lstatSync(join(root, ...parts.slice(0, i + 1)), { throwIfNoEntry: false });
    if (found === undefined) return { kind: 'absent', copy: 'working' };
    if (i === parts.length - 1 ? !found.isFile() : !found.isDirectory()) return { kind: 'not-regular', copy: 'working' };
  }
  try {
    return { kind: 'text', copy: 'working', text: readFileSync(join(root, ...parts), 'utf8') };
  } catch (err) {
    // gone between the walk and the read: absent; anything else (no permission) is not read
    return (err as { code?: string }).code === 'ENOENT' ? { kind: 'absent', copy: 'working' } : { kind: 'not-regular', copy: 'working' };
  }
}

/** git's listing of one tree entry: `<mode> <type> <oid>\t<path>`. */
const ENTRY = /^(\d{6}) (\w+) ([0-9a-f]{40,64})\t/;
/** Only a regular file of git's tree (a link is 120000, a submodule 160000, a folder 040000) is read. */
const REGULAR_MODES = ['100644', '100755'];

/**
 * D-01, D-07: `file` read from the working tree (`{ from: 'working' }`) or from the default ref's tree (`{ from: 'default', ref }`). With no default ref (`ref` undefined, a ref that starts with `-`,
 * or any git failure) the default read returns the working copy with note `no-default-ref` and never throws. The working copy of a branch is its own: it is not the default branch's.
 */
export function readProductText(root: string, copy: { from: 'working' } | { from: 'default'; ref: string | undefined }, file: string = CONVENTIONS_FILE): ProductRead {
  if (copy.from === 'working') return workingCopy(root, file);
  const fallback = (): ProductRead => ({ ...workingCopy(root, file), note: 'no-default-ref' });
  if (copy.ref === undefined || copy.ref.startsWith('-')) return fallback();
  let listing: string;
  try {
    listing = git(root, ['--literal-pathspecs', 'ls-tree', '-z', copy.ref, '--', file]);
  } catch {
    return fallback();
  }
  const entry = listing.split('\0').find((e) => e !== '');
  if (entry === undefined) return { kind: 'absent', copy: 'default' };
  const m = ENTRY.exec(entry);
  if (m === null || m[2] !== 'blob' || !REGULAR_MODES.includes(m[1])) return { kind: 'not-regular', copy: 'default' };
  try {
    return { kind: 'text', copy: 'default', text: git(root, ['cat-file', 'blob', m[3]]) };
  } catch {
    return fallback();
  }
}

/** D-21: the ruleset with the invocation the SubagentStart hook prints, `npx --yes <package>@<version>` of the running CLI, so a brief and the hook carry one text. */
export const cliRuleset = (): string => rulesetText(`npx --yes ${pkg.name}@${pkg.version}`);

/** An input bound, not the size cap of D-27: a findings file is a short list, never a log. */
export const MAX_FINDINGS_BYTES = 1048576;

/**
 * D-13, T-08.5-16: the text of the findings file of `accord brief --fix`, read only when it is a regular file (never a link, whose target is never opened) of at most 1 MiB.
 * Anything else is a UsageError naming the file with forward slashes and saying nothing was written; the caller writes nothing before this returns.
 */
export function readFindings(path: string): string {
  const name = shown(path.replace(/\\/g, '/'));
  const refuse = (why: string): never => {
    throw new UsageError(`the findings file ${name} ${why}; nothing was written`);
  };
  const found = lstatSync(path, { throwIfNoEntry: false });
  if (found === undefined) return refuse('does not exist');
  if (!found.isFile()) return refuse('is not a regular file (a link, a folder or a device)');
  if (found.size > MAX_FINDINGS_BYTES) return refuse(`is over ${MAX_FINDINGS_BYTES} bytes (1 MiB)`);
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return refuse('could not be read');
  }
}

/** R-9 (08.5-06): origin's URL as git reports it (`git remote get-url origin`, a local read), or undefined when there is no origin or git cannot say. It is text for core's `repositoryOf`, never run. */
export function originUrl(root: string): string | undefined {
  try {
    return git(root, ['remote', 'get-url', 'origin']).trim() || undefined;
  } catch {
    return undefined;
  }
}

/** A reason that holds a ref or a path as git printed it: one line, no control character, no backslash. */
const plain = (text: string): string => text.replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\\/g, '/');

/**
 * D-05: the branch's own change to `file`: `git diff <base>...<head>`, the merge-base form, so a line the default branch gained after the branch left it is not shown as the branch's removal. `base` is
 * the default ref; undefined (no default branch in this clone) or a git failure gives `unknown` with a reason, never a throw. A ref that starts with `-` is never passed to git.
 */
export function productChange(root: string, base: string | undefined, head: string, file: string = CONVENTIONS_FILE): ProductChange {
  if (base === undefined) return { kind: 'unknown', why: 'no default branch in this clone' };
  if (base.startsWith('-') || head.startsWith('-')) return { kind: 'unknown', why: 'not a git ref' };
  try {
    return { kind: 'diff', text: git(root, ['--literal-pathspecs', '-c', 'core.quotePath=false', 'diff', '--no-color', '--no-ext-diff', '--no-textconv', '--text', `${base}...${head}`, '--', file]) };
  } catch {
    return { kind: 'unknown', why: plain(`git could not diff ${base}...${head}`) };
  }
}
