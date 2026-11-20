# Slop patterns

<!-- One pattern per list line: `- <id>: line /<regex>/[i][ for .<ext>[, .<ext>…]] — <what it flags>`. The id is the kind a reviewer sees as `slop:<id>`; it matches `^[a-z0-9][a-z0-9-]*$`. A line regex is a JavaScript regular expression whose only allowed flag is `i`; it is matched against one added line at a time, so a construct that spans lines is out of its reach. `for` limits a pattern to the listed file extensions, lower case with the dot; a pattern with no `for` applies to every scanned file. Every added line of every changed text file is scanned, test files included; Markdown files, generated files (the `generated:` paths of accord/config.yml and the copies `accord skills sync` writes) and dependency lockfiles are not. A team adds a pattern by adding a line with a new id under `## Patterns` of accord/product/slop.md, replaces a default by writing a line with the default's id, and switches a default off with a `- Removed: <id> — <reason>` line under `## Removed`. Three more kinds are not patterns, because they need the files and not one line: `new-dependency` (a name added to a package manifest), `file-growth` (a file grown past `slop.max_file_lines`, default 500) and `orphan-file` (a new file no other tracked file names); `- Removed: <kind> — <reason>` switches them off too. The code kinds skip a line that starts a comment. A regex that must match an HTML comment start is written `<!\-\-`, because a literal one would open a comment in this file. -->

## Patterns

- empty-catch: line /^(?!\s*(?://|\*|\/\*))[^\n]*\bcatch\s*(?:\([^)]*\))?\s*\{\s*\}/ for .ts, .tsx, .mts, .cts, .js, .jsx, .mjs, .cjs — an empty catch block swallows an error
- empty-catch-cs: line /^(?!\s*(?://|\*|\/\*))[^\n]*\bcatch\s*(?:\([^)]*\))?\s*\{\s*\}/ for .cs — an empty catch block swallows an error
- empty-catch-py: line /^\s*except\b[^:]*:\s*pass\b/ for .py — an except block that only passes swallows an error
- any-type: line /^(?!\s*(?://|\*|\/\*))[^\n]*(?:[\w)\]?]\s*:\s*any\b|\bas\s+any\b|\bas\s+unknown\s+as\b|<any>)/ for .ts, .tsx, .mts, .cts — an any type or an unknown cast switches type checking off
- any-type-cs: line /^(?!\s*(?://|\*|\/\*))[^\n]*(?:\bdynamic\s+[A-Za-z_]\w*\s*(?:[=;,()]|$)|<dynamic\s*[>,])/ for .cs — a dynamic declaration switches type checking off
- any-type-py: line /^(?!\s*#)[^\n]*(?::\s*Any\b|->\s*Any\b|\bcast\(\s*Any\b|[\[,]\s*Any\s*[\],])/ for .py — an Any annotation switches type checking off
- commented-code: line /^\s*\/\/\s*(?:(?:const|let|var)\s+[\w$]+\s*(?:[:=]|;)|(?:if|for|while|switch)\s*\(|(?:import|export)\b.*\bfrom\b\s*['"]|return\b[^;]*;\s*$|await\s+\S|throw\s+new\b|[\w$.]+\([^)]*\)\s*;\s*$|[})\]]+[;,]?\s*$)/ for .ts, .tsx, .mts, .cts, .js, .jsx, .mjs, .cjs — commented-out code should be deleted, git keeps it
- commented-code-cs: line /^\s*\/\/\s*(?:(?:var|int|long|bool|string|double|decimal)\s+\w+\s*(?:=|;)|(?:if|for|foreach|while|switch|using)\s*\(|return\b[^;]*;\s*$|await\s+[\w.]+\(|throw\s+new\b|[\w.]+\([^)]*\)\s*;\s*$|[})\]]+[;,]?\s*$)/ for .cs — commented-out code should be deleted, git keeps it
- commented-code-py: line /^\s*#\s*(?:import\s+[\w.]+(?:\s+as\s+\w+)?\s*$|from\s+[\w.]+\s+import\s+\S|(?:def|class)\s+\w+.*:\s*$|(?:if|elif|while)\s\S+\s?(?:==|!=|<=|>=)\s?\S[^:]*:\s*$|(?:if|elif|while)\s+[\w.]+\([^)]*\)\s*:\s*$|for\s+\w+\s+in\s+[^:]*:\s*$|return\s+(?:[\w.]+\(.*\)|None|True|False|\d+)\s*$|print\(.*\)\s*$|[A-Za-z_][\w.]*\s*=\s*[\w.]+\(.*\)\s*$)/ for .py — commented-out code should be deleted, git keeps it
- commented-code-html: line /<!\-\-\s*<[a-z][^>]*>/i for .html, .htm, .vue, .svelte, .cshtml, .razor — commented-out markup should be deleted, git keeps it
- commented-code-css: line /^\s*\/\*\s*[.#]?[\w-]+\s*\{[^}]*\}?\s*\*\/\s*$/i for .css, .scss, .sass, .less — a commented-out rule should be deleted, git keeps it
- important-css: line /!\s*important\b/i for .css, .scss, .sass, .less, .html, .htm, .vue, .svelte, .cshtml, .razor — an important flag wins a specificity fight by force
- inline-style-html: line /\bstyle\s*=\s*["']/i for .html, .htm, .vue, .svelte, .cshtml, .razor — an inline style belongs in a stylesheet

## Removed

<!-- - Removed: <id> — <reason> -->
