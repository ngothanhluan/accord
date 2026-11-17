# Security review

<!-- One pattern or check per list line. Pattern: `- <id>: path <entry>[, <entry>…] — <what it guards>` or `- <id>: line /<regex>/[i] — <what it guards>`. An id matches `^[a-z0-9][a-z0-9-]*$`. A path entry ending in `/` is a folder prefix, an entry with no `/` is a file name at any depth, any other entry is one exact path; there is no glob. A line regex is a JavaScript regular expression whose only allowed flag is `i`. Checklist: `- <id>: <check>`. A change that matches a pattern needs the security reviewer, who reads the checklist. A default is removed only by a `- Removed: <id> — <reason>` line under `## Removed`, with the owner's yes. A team adds a pattern or a check by adding a line with a new id. -->

## Patterns

- spawn: line /\b(spawn|spawnSync|exec|execSync|execFile|execFileSync|fork|child_process|subprocess|Popen|os\.system)\b/ — process spawn
- file-write: line /\b(writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream|rmSync|rmdirSync|unlink|unlinkSync|rename|renameSync|copyFile|copyFileSync|symlink|symlinkSync)\b/ — file writes
- built-path: line /\b(join|resolve|normalize)\s*\(.*\b(input|argv|args?|params?|query|body|req|request)\b/ — paths built from input
- ci-workflow: path .github/workflows/ — CI workflow files
- manifest: path package.json, package-lock.json, npm-shrinkwrap.json, yarn.lock, pnpm-lock.yaml, requirements.txt, pyproject.toml, poetry.lock, go.mod, go.sum, Cargo.toml, Cargo.lock, Gemfile, Gemfile.lock — dependency manifests
- secret-name: line /\b(secrets?|tokens?|passwords?|passwd|api[_-]?keys?|credentials?|private[_-]?keys?|auth|authn|authz|authenticat\w*|authori[sz]\w*)\b/i — auth and secret or token names
- security-config: path accord/product/security.md, accord/config.yml — the security trigger list and the generated paths it skips

## Checklist

- injection: no input reaches a shell, a query or an eval unescaped; a command runs with an argument list, never a joined string
- path-traversal: no path built from input leaves its root through .., an absolute path or a link before it is read or written
- secrets: no secret, token or key is written to a file, a log, an error message or a commit
- untrusted-input: input from a file, the network, an environment variable or another process is checked before use
- ci-permissions: a workflow asks only the permissions it needs and never runs a fork's code with secrets
- new-dependencies: each new dependency is needed, maintained and pinned
- hook-commands: a hook or script command takes no text a user or a repository controls
- authorisation: each action checks that its caller may perform it

## Removed

<!-- - Removed: <id> — <reason> -->
