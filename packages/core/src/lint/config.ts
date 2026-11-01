// ST-LN-80: models.architect still validates so an old config loads, but nothing reads it any more.
import type { Rule } from './rules.js';

export const modelRetired: Rule['check'] = (snapshot) =>
  snapshot.config?.models?.architect === undefined
    ? []
    : [
        {
          file: 'accord/config.yml',
          pointer: '/models/architect',
          reason:
            'models.architect has no effect: accord no longer renders accord-architect, and the planner drafts the approach, so models.planner now applies; remove models.architect',
        },
      ];
