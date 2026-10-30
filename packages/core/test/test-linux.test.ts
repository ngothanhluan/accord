// ST-LN-78: the docker arguments scripts/test-linux.mjs builds; the container run itself needs Docker and is checked by hand.
import { expect, it } from 'vitest';

interface Plan {
  run: string[];
  reportDir?: string;
  dotGitText?: string;
}
type ContainerArgs = (o: Record<string, unknown>) => Plan | undefined;

const load = async () =>
  ((await import(new URL('../../../scripts/test-linux.mjs', import.meta.url).href)) as { containerArgs: ContainerArgs }).containerArgs;

const base = {
  root: 'C:\\Work\\x',
  image: 'img:1',
  volume: 'vol',
  workspaces: ['packages/core'],
  dotGit: 'C:\\Temp\\g.git',
  env: { ACCORD_TEST_WORKERS: '4' },
};

it('risk:parsing a worktree run mounts the report folder, the git folders and the volumes, and maps the paths into the container', async () => {
  const containerArgs = await load();
  const plan = containerArgs({
    ...base,
    cwd: 'c:/Work/x',
    git: { dir: 'C:/Work/main/.git/worktrees/x', common: 'C:/Work/main/.git' },
    args: ['related', '--run', 'packages/core/src/a.ts', 'C:\\Work\\x\\packages\\core\\src\\b.ts', '--outputFile.junit=node_modules/.cache/accord/junit.xml'],
  });
  expect(plan?.reportDir).toBe('C:/Work/x/node_modules/.cache/accord');
  expect(plan?.dotGitText).toBe('gitdir: /gitcommon/worktrees/x\n');
  const run = plan?.run ?? [];
  const mounts = run.flatMap((a, i) => (run[i - 1] === '-v' ? [a] : []));
  expect(mounts).toEqual([
    'C:/Work/x:/work',
    'vol-state:/state',
    'vol-root:/work/node_modules',
    'vol-packages-core:/work/packages/core/node_modules',
    'C:/Work/main/.git:/gitcommon:ro',
    'C:/Temp/g.git:/work/.git:ro',
    'C:/Work/x/node_modules/.cache/accord:/out',
  ]);
  expect(run.slice(run.indexOf('img:1') + 5)).toEqual([
    'related', '--run', 'packages/core/src/a.ts', '/work/packages/core/src/b.ts', '--outputFile.junit=/out/junit.xml',
  ]);
  expect(run.slice(run.indexOf('-e'), run.indexOf('-e') + 2)).toEqual(['-e', 'ACCORD_TEST_WORKERS']);
  expect(run[run.indexOf('-w') + 1]).toBe('/work');
});

it('risk:parsing a separate --outputFile.junit value and a plain clone, and a cwd outside the checkout runs on the host', async () => {
  const containerArgs = await load();
  const plan = containerArgs({
    ...base,
    cwd: 'C:/Work/x/packages/core',
    git: { dir: 'C:/Work/x/.git', common: 'C:/Work/x/.git' },
    args: ['run', '--outputFile.junit', 'C:/r/junit.xml'],
  });
  const run = plan?.run ?? [];
  expect(run).toContain('C:/Work/x/.git:/work/.git:ro');
  expect(run).toContain('C:/r:/out');
  expect(run.at(-1)).toBe('--outputFile.junit=/out/junit.xml');
  expect(run[run.indexOf('-w') + 1]).toBe('/work/packages/core');
  expect(plan?.dotGitText).toBeUndefined();
  expect(containerArgs({ ...base, cwd: 'C:/Work/other', git: undefined, args: [] })).toBeUndefined();
});
