// The ONLY file that imports ajv (D-20). Swap the implementation here; the seam is ./index.ts.
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { ErrorObject } from 'ajv/dist/2020.js';
import ticketSchema from '../../schemas/ticket.schema.json' with { type: 'json' };
import verificationSchema from '../../schemas/verification.schema.json' with { type: 'json' };
import configSchema from '../../schemas/config.schema.json' with { type: 'json' };
import type { Finding } from '../model/finding.js';

// Defaults keep strictSchema on and strictRequired off; strictRequired would throw on config's if/then.
const ajv = new Ajv2020({ allErrors: true });

const validators = {
  ticket: ajv.compile(ticketSchema),
  verification: ajv.compile(verificationSchema),
  config: ajv.compile(configSchema),
} as const;

export const schemaIds = ['ticket', 'verification', 'config'] as const;
export type SchemaId = (typeof schemaIds)[number];

export function validate(schemaId: SchemaId, doc: unknown): Finding[] {
  const v = validators[schemaId];
  if (v(doc)) return [];
  return (v.errors ?? []).map((e: ErrorObject) => ({
    path: e.instancePath,
    rule: `schema.${e.keyword}`,
    reason: e.message ?? e.keyword,
  }));
}
