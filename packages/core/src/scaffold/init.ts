// CLI-01 scaffold plan (D-107, D-130): which paths `accord init` writes into a repository, and the text of
// each. Core decides path and content; the CLI owns every filesystem call, so nothing here touches a disk.
//
// T-07-01: every path is a source literal. `initFiles` takes only `{ name, version }` and neither reaches a
// path component, so no argument and no config value can steer a write — the same rule the skill target
// table follows, for the same reason.
//
// The version arrives as a parameter because core cannot read the CLI's `package.json` at all, and because a
// test can then drive a version without rewriting a manifest (`cli/src/pin.ts` precedent).

import { templates } from '../generated/templates.js';
import { workflowYml } from './workflow.js';

export interface ScaffoldFile {
  path: string; // repo-relative, forward slashes, never a native separator (D-51)
  text: string;
}

// Code-point order, never a locale-aware compare, so the output is identical on every host.
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

// D-134: fixed defaults with a comment per key, asking nothing and taking no flags. Editing a YAML file whose
// keys carry their own guidance is a better first minute than answering four questions about terms the team
// has not met yet, and a non-interactive command is what lets the same binary run in CI.
const CONFIG = (version: string): string => `# The accord contract for this repository. Every key below is required; edit the values, keep the keys.
# \`accord init\` never writes over a file that already exists, so what you put here survives re-running it.

# The version every accord command in this repository must be. A command running under a different version
# refuses rather than applying a different release's rules to your tickets.
accord: "${version}"

# build - a new product: a ticket with a screen carries a design: URL, or a prototype under accord/assets/.
# maintain - an existing product: a ticket with a screen carries a prototype derived from what ships today.
profile: build

tracker:
  # none - accord needs nothing outside this repository.
  # github-issues - also add \`repo: owner/name\` here.
  adapter: none

design:
  # Path to the file holding this product's design tokens, for example src/styles/tokens.css. While it is
  # empty the hardcoded-value check is skipped; fill it in and every prototype is checked against it.
  tokens: ""

# Who works through accord here. ba and dev are required; drop designer if nobody plays that part.
roles: [ba, dev, designer]

# Where \`accord skills sync\` puts the skill copies: claude -> .claude/skills, codex -> .agents/skills,
# cursor and copilot -> both.
runtimes: [claude, codex]

# Where the test report lands. \`accord gate done\` reads it to check that the test behind each
# @test: tag really passed; without it there is no Done.
# Before the first ticket carrying an @test: scenario, remove the "# " from the two lines below and
# change report: to the path your own test runner writes its report to.
# tests:
#   report: reports/junit.xml
`;

/**
 * Every file `accord init` puts in place, sorted by path. Pure: same list on every call and every host.
 *
 * Paths are composed as literals rather than joined: node:path is banned in core (CORE-01) and a `join`
 * would emit a backslash on Windows, which would then be written into a file and printed to a terminal
 * (D-51).
 *
 * `name` is part of the signature although only `version` is read today: the generated CI workflow pins
 * accord as `<name>@<version>` from this same object (D-139), so settling the shape here is one signature
 * every caller reads instead of two.
 */
export function initFiles(pkg: { name: string; version: string }): ScaffoldFile[] {
  const { name, version } = pkg;
  const out: ScaffoldFile[] = [
    { path: 'accord/config.yml', text: CONFIG(version) },
    // CLI-02: the same two strings render both the config pin and the workflow pin, so D-135's equality
    // holds by construction rather than by anyone remembering to update two places.
    { path: '.github/workflows/accord.yml', text: workflowYml(name, version) },
    // A-05: the two product documents have fixed homes in the folder convention (docs/design.md section 2)
    // and are exactly what a BA is told to fill in first, so `init` puts them there. The other five shipped
    // templates carry a TICKET-ID placeholder and are rendered per ticket by `accord new ticket` or copied
    // into accord/tickets/<id>/ — a copy at a fixed path would be a placeholder document nobody can use.
    //
    // The text is the generated record, never a read of packages/core/templates/: that folder is not shipped
    // into a consumer's node_modules the way the generated module is (new-ticket.ts:34-36 carries the same
    // note, for the same reason).
    { path: 'accord/product/glossary.md', text: templates['glossary.md'] },
    { path: 'accord/product/business-rules.md', text: templates['business-rules.md'] },
  ];
  return out.sort((a, b) => cmp(a.path, b.path));
}
