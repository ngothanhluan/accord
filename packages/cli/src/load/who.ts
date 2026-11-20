// Phase 8.2 D-07: the per-person display setting, `git config accord.who`. It is read from git config in every scope (so `git config --global accord.who initials` works once per machine),
// never from accord/config.yml: it is a person's own choice, like `accord trust`. Reading never throws and never stops a command: an unset key, a failed git call and a value that is
// neither `email` nor `initials` all show the email.
import { execFileSync } from 'node:child_process';
import type { AccordConfig } from '@accord-dev/accord-core';
import { whoShown } from '../render/who.js';
import type { WhoMode } from '../render/who.js';

/** The setting: the mode it asks for, and the trimmed text git holds (undefined when the key is unset or git could not say). */
export function gitWho(root: string): { mode: WhoMode; value: string | undefined } {
  let value: string | undefined;
  try {
    value = execFileSync('git', ['config', '--get', 'accord.who'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    value = undefined; // exit 1: the key is unset
  }
  return { mode: value === 'initials' ? 'initials' : 'email', value };
}

/** The setting and the function every view of a person calls: `show(email)` is the email or the initials the config's `people` map holds for it (an unreadable config shows the email). */
export function whoFor(root: string, config: AccordConfig | undefined): { mode: WhoMode; value: string | undefined; show: (email: string) => string } {
  const { mode, value } = gitWho(root);
  return { mode, value, show: (email) => whoShown(email, mode, config?.people) };
}
