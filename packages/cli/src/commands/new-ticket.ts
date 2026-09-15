// CLI-04 `accord new ticket <id>`: the first command a BA runs, and the one place accord creates a
// document a human is supposed to own. It substitutes the id and sets `type:` — and fills in nothing
// else (D-104). Title, intent, requirements, scenarios and ticks stay the template's placeholder text,
// because accord records human intent and never synthesises it. The `@ac-1` tag scaffolding ROADMAP
// criterion 1 asks for already ships inside ticket-build.md and ticket-maintain.md, so there is
// nothing to generate — only to substitute.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setFrontmatterKey, templates } from '@accord-dev/accord-core';
import { UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';

// The ticket schema's own id pattern (packages/core/schemas/ticket.schema.json). Duplicated as a
// literal rather than read out of the schema so it is visible at the one call site that matters.
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const PLACEHOLDER = 'TICKET-ID';

export function newTicket(
  ctx: CommandContext,
  id: string,
  options: { type: 'epic' | 'story' | 'bug' },
): number {
  // T-05-14: this is the only guard between an argv string and a filesystem write, so it runs before
  // anything else touches a path. The pattern admits no slash, no backslash, no leading dot and no
  // space, so no traversal sequence survives it.
  if (!ID.test(id)) {
    throw new UsageError(
      'not a valid ticket id: ' +
        id +
        ' - a letter or digit, then letters, digits, dots, hyphens, or underscores',
    );
  }

  // The generated record on the core public API is the only template source: packages/core/templates/
  // is not shipped into a consumer's node_modules the way the generated module is. `epic` has its own
  // template (no Acceptance criteria, Plan, or Verification notes), which is why `--type` exists at all.
  const name =
    options.type === 'epic' ? 'epic.md' : (`ticket-${ctx.snapshot.config?.profile ?? 'build'}.md` as const);
  // Two steps and no more. One global replacement covers both places the placeholder appears — the
  // frontmatter `id` value and the Gherkin `Feature:` line — and `setFrontmatterKey` preserves the
  // trailing guidance comment on the `type:` line, which is exactly what D-43 and D-45 bought.
  const text = setFrontmatterKey(templates[name].replaceAll(PLACEHOLDER, id), 'type', options.type);

  const rel = 'accord/tickets/' + id + '.md';
  const file = join(ctx.root, rel);
  // T-05-15: refusing is the behaviour, not an afterthought — a BA-authored ticket can never be
  // destroyed by a second `new ticket`. Exit 2: this is a usage error, not a gate verdict.
  if (existsSync(file)) throw new UsageError(rel + ' already exists - nothing was written');
  mkdirSync(join(ctx.root, 'accord', 'tickets'), { recursive: true });
  writeFileSync(file, text);
  ctx.stdout.write(rel + '\n');
  return 0;
}
