export interface Finding {
  path: string; // JSON pointer from ajv instancePath: '' = document root, '/tracker', '/verified/2'
  rule: string; // 'schema.' + ajv keyword, e.g. 'schema.required', 'schema.additionalProperties'
  reason: string; // ajv message, e.g. "must have required property 'repo'"
}
