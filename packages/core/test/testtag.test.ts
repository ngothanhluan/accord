import { describe, expect, it } from 'vitest';
import { loadSnapshot, writeTestTags } from '../src/index.js';
import { CONFIG, LANE_BODY, laneTicket } from '../../../test/helpers/lane.js';

const BODY = LANE_BODY.replace(' @test:export#writes-csv', ' # first').replace(' @test:export#escapes-commas', '');
const TICKET = laneTicket('T-1', { body: BODY });
const scenarios = (text: string) =>
  loadSnapshot({ files: { 'accord/config.yml': CONFIG, 'accord/tickets/T-1.md': text }, tree: [] }).tickets['T-1'].scenarios;

describe('writeTestTags', () => {
  it('risk:parsing inserts the test tag right after the ac token and before a comment', () => {
    const r = writeTestTags(TICKET, scenarios(TICKET), [
      { test: 'export#writes-csv', ac: '@ac-1' },
      { test: 'x#y', ac: '@ac-9' },
    ]);
    expect(r.written).toEqual([{ ac: '@ac-1', test: 'export#writes-csv' }]);
    expect(r.text.replace('  @ac-1 @test:export#writes-csv # first', '  @ac-1 # first')).toBe(TICKET);
    expect(r.text).toContain('\n  @ac-1 @test:export#writes-csv # first\n');
  });

  it('risk:parsing reads crlf and writes lf', () => {
    const crlf = '﻿' + TICKET.replace(/\n/g, '\r\n');
    const r = writeTestTags(crlf, scenarios(TICKET), [{ test: 'export#writes-csv', ac: '@ac-1' }]);
    const lf = writeTestTags(TICKET, scenarios(TICKET), [{ test: 'export#writes-csv', ac: '@ac-1' }]);
    expect(r.text).toBe(lf.text);
    expect(r.text.startsWith('---')).toBe(true);
  });
});
