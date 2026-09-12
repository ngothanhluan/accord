// D-52 finding shape: one type for load, lint, and gate. Phase 3 adds `level` with the rule table.
export interface Finding {
  file: string; // repo-relative, forward slashes: 'accord/tickets/LOGIN-1.md'
  line?: number; // 1-based line in that file; absent for file-level findings
  rule: string; // dotted id: 'schema.required', 'load.frontmatter-missing'
  reason: string; // ajv message or loader text, e.g. "must have required property 'repo'"
  pointer?: string; // JSON pointer inside frontmatter or config.yml: '' = root, '/tracker', '/verified/2'
}

// What validate() returns (D-20 seam); the loader stamps `file` and `line` (D-33).
export interface SchemaFinding {
  pointer: string; // ajv instancePath
  rule: string; // 'schema.' + ajv keyword
  reason: string; // ajv message
  param?: string; // ajv params.additionalProperty (additionalProperties) or params.missingProperty (required)
}
