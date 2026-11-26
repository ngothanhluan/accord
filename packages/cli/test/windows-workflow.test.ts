// D-01 and D-02 of Phase 08.9.1: the shape of `.github/workflows/windows.yml` and of the part of
// `.github/workflows/ci.yml` it was split from. Both real files are parsed, never re-typed: a copy
// proves only that the copy is right. A workflow nobody runs on a pull request is the one that drifts
// silently, so the pieces that must stay equal (the Ubuntu test job's steps and the Windows job's
// steps) are compared against each other, not against a literal.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// Narrow local shapes: the documents are data, not a typed API.
interface Step {
  name?: string;
  if?: string;
  shell?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, unknown>;
}
interface Job {
  name?: string;
  'runs-on'?: string;
  'timeout-minutes'?: number;
  permissions?: unknown;
  needs?: string[];
  strategy?: { 'fail-fast'?: boolean; matrix: Record<string, unknown> };
  steps: Step[];
}
interface Workflow {
  on: Record<string, { branches?: string[] } | Array<{ cron: string }> | null>;
  permissions?: Record<string, string>;
  concurrency?: Record<string, unknown>;
  jobs: Record<string, Job>;
}

function load(file: string): Workflow {
  const url = new URL(`../../../.github/workflows/${file}`, import.meta.url);
  return parse(readFileSync(fileURLToPath(url), 'utf8')) as Workflow;
}

const windows = load('windows.yml');
const ci = load('ci.yml');

/** The shard expression of ci.yml, read as the one windows.yml writes: the only difference allowed between the two test steps. */
const CI_SHARD = '${{ matrix.target.shard }}/${{ matrix.target.of }}';
const WINDOWS_SHARD = '${{ matrix.shard }}/5';

describe('windows.yml and ci.yml (D-01, D-02)', () => {
  it('risk:regression windows.yml runs on push to main, nightly and on dispatch, never on a pull request (D-01)', () => {
    expect(Object.keys(windows.on).sort()).toEqual(['push', 'schedule', 'workflow_dispatch']);
    expect((windows.on.push as { branches?: string[] }).branches).toEqual(['main']);
    const schedule = windows.on.schedule as Array<{ cron: string }>;
    expect(schedule).toHaveLength(1);
    // Daily, and never minute 0: GitHub names the top of the hour as its busiest time.
    expect(schedule[0].cron).toMatch(/^([1-9]|[1-5][0-9]) ([0-9]|1[0-9]|2[0-3]) \* \* \*$/);

    const job = windows.jobs.test;
    expect(Object.keys(windows.jobs)).toEqual(['test']);
    expect(job['runs-on']).toBe('windows-latest');
    expect(job['timeout-minutes']).toBe(30);
    expect(job.strategy?.['fail-fast']).toBe(false);
    expect(job.strategy?.matrix.node).toEqual([22, 24]);
    expect(job.strategy?.matrix.shard).toEqual([1, 2, 3, 4, 5]);
    expect(job.steps.at(-1)?.run).toBe(`npm test -- --shard=${WINDOWS_SHARD}`);
  });

  it("risk:security windows.yml reads only and reports through GitHub's own notification (D-02)", () => {
    expect(windows.permissions).toEqual({ contents: 'read' });
    expect(windows.concurrency).toEqual({ group: 'windows-${{ github.ref }}', 'cancel-in-progress': false });
    for (const job of Object.values(windows.jobs)) {
      expect(job.permissions).toBeUndefined();
      for (const step of job.steps) {
        expect(step.run ?? '', 'no step calls the gh CLI').not.toMatch(/\bgh /);
        if (step.uses !== undefined) {
          expect(step.uses).toMatch(/^actions\/(checkout|setup-node)@/);
        }
        expect(step.env, 'no step carries an env block or a secret').toBeUndefined();
      }
    }
  });

  it("risk:regression the Windows job runs the Ubuntu test job's steps (D-01)", () => {
    const winSteps = windows.jobs.test.steps;
    const ciSteps = ci.jobs.test.steps;

    // Step 0 is the temp folder step of the Windows runner, with no `if:` since every job here is Windows.
    expect(winSteps[0].shell).toBe('pwsh');
    expect(winSteps[0]).not.toHaveProperty('if');
    expect(winSteps[0].run).toContain('TEMP=$env:RUNNER_TEMP');
    expect(winSteps[0].run).toContain('TMP=$env:RUNNER_TEMP');
    expect(winSteps[0].run).toContain('>> $env:GITHUB_ENV');

    // Checkout, setup-node, npm ci and the build are the same steps in both files.
    expect(winSteps.slice(1, -1)).toEqual(ciSteps.slice(0, -1));
    expect(winSteps.slice(1, -1).map((s) => s.run ?? s.uses)).toEqual([
      'actions/checkout@v7',
      'actions/setup-node@v7',
      'npm ci',
      'npm run build',
    ]);
    expect(winSteps[2].with).toEqual({ 'node-version': '${{ matrix.node }}', cache: 'npm' });

    // The test step: the two shard expressions are asserted on their own, then every other key must match.
    const ciTest = ciSteps.at(-1) as Step;
    const winTest = winSteps.at(-1) as Step;
    expect(ciTest.run).toBe(`npm test -- --shard=${CI_SHARD}`);
    expect(winTest.run).toBe(`npm test -- --shard=${WINDOWS_SHARD}`);
    expect({ ...ciTest, run: ciTest.run?.replace(CI_SHARD, WINDOWS_SHARD) }).toEqual(winTest);
  });

  it('risk:regression ci.yml keeps its Ubuntu matrix, concurrency rule and ci-ok (D-01, D-02)', () => {
    expect(Object.keys(ci.on).sort()).toEqual(['pull_request', 'push']);
    expect((ci.on.push as { branches?: string[] }).branches).toEqual(['main']);
    expect(ci.concurrency).toEqual({
      group: 'ci-${{ github.workflow }}-${{ github.ref }}',
      'cancel-in-progress': "${{ github.event_name == 'pull_request' }}",
    });
    expect(ci.jobs.test.strategy?.matrix.target).toEqual([{ os: 'ubuntu-latest', shard: 1, of: 1 }]);
    for (const job of Object.values(ci.jobs)) {
      expect(String(job['runs-on'])).not.toBe('windows-latest');
    }
    expect(ci.jobs['ci-ok'].needs).toEqual(['static', 'test', 'examples', 'macos']);
  });
});
