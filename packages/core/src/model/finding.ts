// D-52 finding shape: one type for load, lint, and gate. D-56 adds `level`; the loader produces a
// `LoadFinding` without it and lint stamps every loader finding `error` (D-58).
export type Level = 'error' | 'warning'; // D-56

export interface Finding {
  file: string; // repo-relative, forward slashes: 'accord/tickets/LOGIN-1.md'
  line?: number; // 1-based line in that file; absent for file-level findings
  rule: string; // dotted id: 'schema.required', 'load.frontmatter-missing', 'lint.id-mismatch'
  reason: string; // ajv message or loader text, e.g. "must have required property 'repo'"
  pointer?: string; // JSON pointer inside frontmatter or config.yml: '' = root, '/tracker', '/verified/2'
  level: Level; // D-56: an error fails lint; a warning never changes the exit code
}

// What the loader produces: no `level`; lint stamps these `error` at the merge step (D-58).
export type LoadFinding = Omit<Finding, 'level'>;

// What validate() returns (D-20 seam); the loader stamps `file` and `line` (D-33).
export interface SchemaFinding {
  pointer: string; // ajv instancePath
  rule: string; // 'schema.' + ajv keyword
  reason: string; // ajv message
  param?: string; // ajv params.additionalProperty (additionalProperties) or params.missingProperty (required)
}
