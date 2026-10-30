import setup, { GB, type VitestRun } from '../../../../../test/lock.js';

export default (project: VitestRun) =>
  setup(project, { lock: process.env.ACCORD_FORK_CAP_LOCK, free: () => 5 * GB, perFork: GB, reserve: 4 * GB, poll: 0, platform: 'win32', log: () => {} });
