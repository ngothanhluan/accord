// ST-LN-78: the docker arguments scripts/test-linux.mjs builds; the container run itself needs Docker and is checked by hand.
import { expect, it } from 'vitest';

interface Plan {
  run: string[];
  report?: string;
  dotGitText?: string;
}
type ContainerArgs = (o: Record<string, unknown>) => Plan | undefined;

const load = async () =>
  ((await import(new URL('../../../scripts/test-linux.mjs', import.meta.url).href)) as { containerArgs: ContainerArgs }).containerArgs;

const base = { root: 'C:\\Work\\x\\', cwd: 'C:/Work/x', image: 'img:1', volume: 'vol', workspaces: ['packages/core'], dotGit: 'C:\\Temp\\g.git', env: {} };
const mounts = (run: string[]) => run.flatMap((a, i) => (run[i - 1] === '-v' ? [a] : []));
/** The arguments vitest receives in the container: after the image, `sh -c <script> sh`. */
const vitestArgs = (run: string[]) => run.slice(run.indexOf('img:1') + 5);
const workdir = (run: string[]) => run[run.indexOf('-w') + 1];

it('risk:parsing the JUnit report is written to its host folder, mounted at /out, whether --outputFile.junit takes its value inline or next', async () => {
  const containerArgs = await load();
  const inline = containerArgs({ ...base, args: ['related', '--run', 'a.ts', '--outputFile.junit=node_modules/.cache/accord/junit.xml'] });
  expect(inline?.report).toBe('C:/Work/x/node_modules/.cache/accord/junit.xml');
  expect(mounts(inline?.run ?? [])).toContain('C:/Work/x/node_modules/.cache/accord:/out');
  expect(vitestArgs(inline?.run ?? [])).toEqual(['related', '--run', 'a.ts', '--outputFile.junit=/out/junit.xml']);
  const next = containerArgs({ ...base, args: ['run', '--outputFile.junit', 'D:\\r\\junit.xml'] });
  expect(next?.report).toBe('D:/r/junit.xml');
  expect(mounts(next?.run ?? [])).toContain('D:/r:/out');
  expect(vitestArgs(next?.run ?? [])).toEqual(['run', '--outputFile.junit=/out/junit.xml']);
});

it("risk:parsing a worktree's .git file is replaced by one naming its gitdir under the read-only common folder", async () => {
  const containerArgs = await load();
  const plan = containerArgs({ ...base, args: [], git: { dir: 'C:/Work/main/.git/worktrees/x', common: 'C:/Work/main/.git' } });
  expect(plan?.dotGitText).toBe('gitdir: /gitcommon/worktrees/x\n');
  expect(mounts(plan?.run ?? [])).toEqual(expect.arrayContaining(['C:/Work/main/.git:/gitcommon:ro', 'C:/Temp/g.git:/work/.git:ro']));
});

it("risk:parsing a plain clone's .git folder is mounted read-only, with no replacement file", async () => {
  const containerArgs = await load();
  const plan = containerArgs({ ...base, args: [], git: { dir: 'C:/Work/x/.git', common: 'C:/Work/x/.git' } });
  expect(plan?.dotGitText).toBeUndefined();
  expect(mounts(plan?.run ?? [])).toContain('C:/Work/x/.git:/work/.git:ro');
});

it('risk:parsing a working folder or a path argument inside the checkout maps below /work, regardless of letter case', async () => {
  const containerArgs = await load();
  const plan = containerArgs({ ...base, cwd: 'c:\\work\\X\\packages\\Core', args: ['related', 'C:\\Work\\x\\packages\\core\\src\\b.ts'] });
  expect(workdir(plan?.run ?? [])).toBe('/work/packages/Core');
  expect(vitestArgs(plan?.run ?? [])).toEqual(['related', '/work/packages/core/src/b.ts']);
});

it('risk:parsing a working folder outside the checkout gives no container run', async () => {
  const containerArgs = await load();
  expect(containerArgs({ ...base, cwd: 'C:/Work/xy', args: [] })).toBeUndefined();
});
