# Slop patterns

<!-- One pattern per list line: `- <id>: line /<regex>/[i][ for .<ext>[, .<ext>…]] — <what it flags>`. The id is the kind a reviewer sees as `slop:<id>`; it matches `^[a-z0-9][a-z0-9-]*$`. A line regex is a JavaScript regular expression whose only allowed flag is `i`; it is matched against one added line at a time, so a construct that spans lines is out of its reach. `for` limits a pattern to the listed file extensions, lower case with the dot; a pattern with no `for` applies to every scanned file. Every added line of every changed text file is scanned, test files included; Markdown files, generated files (the `generated:` paths of accord/config.yml and the copies `accord skills sync` writes) and dependency lockfiles are not. A team adds a pattern by adding a line with a new id under `## Patterns` of accord/product/slop.md, replaces a default by writing a line with the default's id, and switches a default off with a `- Removed: <id> — <reason>` line under `## Removed`. -->

## Patterns

- empty-catch: line /^(?!\s*(?://|\*|\/\*))[^\n]*\bcatch\s*(?:\([^)]*\))?\s*\{\s*\}/ for .ts, .tsx, .mts, .cts, .js, .jsx, .mjs, .cjs — an empty catch block swallows an error

## Removed

<!-- - Removed: <id> — <reason> -->
