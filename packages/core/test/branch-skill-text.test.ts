// Issue #341 D-04, D-09, D-10, R-16: the rendered skill text a runtime loads says what a {type}/{id}-{slug} branch needs: the branch to find the pull request by is the one
// git prints in the ticket's worktree, and the agent proposes a change word and passes it with --change.
import { describe, expect, it } from 'vitest';
import { skillTargets } from '../src/index.js';
import type { AccordConfig } from '../src/index.js';

const config: AccordConfig = {
  accord: '0.1.0',
  profile: 'build',
  tracker: { adapter: 'none' },
  design: { tokens: '' },
  roles: ['ba', 'dev'],
  runtimes: ['claude'],
};
const files: Record<string, string> = Object.fromEntries(skillTargets(config).map((f) => [f.path, f.text]));
const read = (path: string): string => {
  const text = files[path];
  if (text === undefined) throw new Error('not rendered: ' + path);
  return text;
};

describe('the pull request is found by the ticket branch git prints (D-09, R-16)', () => {
  it('risk:regression finish.md and verify-ci.md keep the gh query and define <branch> as git branch --show-current in the ticket worktree', () => {
    for (const file of ['.claude/skills/accord/finish.md', '.claude/skills/accord/verify-ci.md']) {
      const text = read(file).replace(/\s+/g, ' ');
      expect(text, file).toContain('gh pr list --head <branch> --state open --json number,url');
      expect(text, file).toContain("`<branch>` is the ticket's branch as `git branch --show-current` prints it in its worktree");
    }
  });

  it('risk:regression no rendered file names a t/ branch for the pull request query', () => {
    for (const [path, text] of Object.entries(files)) expect(text, path).not.toContain('--head t/');
  });
});

describe('the change word (D-04, D-10)', () => {
  it('risk:regression new.md and pickup.md name --change <word>, and intent.md names change: and branch_types', () => {
    expect(read('.claude/skills/accord/new.md')).toContain('--change <word>');
    expect(read('.claude/skills/accord/pickup.md')).toContain('--change <word>');
    const intent = read('.claude/skills/accord/intent.md');
    expect(intent).toContain('`change:`');
    expect(intent).toContain('branch_types');
  });
});

// IN-05: the intent stage proposes from the team's own list, which may differ from the default words.
describe("the team's branch_types (IN-05)", () => {
  it("risk:regression intent.md sends the agent to the branch_types of accord/config.yml, not to the default words", () => {
    const intent = read('.claude/skills/accord/intent.md').replace(/\s+/g, ' ');
    expect(intent).toContain('the words `branch_types` lists in `accord/config.yml`');
    expect(intent).not.toContain('names the default words');
  });
});
