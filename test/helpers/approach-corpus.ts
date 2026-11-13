// ST-LN-91 round 6 (owner decision 2026-11-13): ONE table of every record line or block that a reviewer used as a probe or a failing case in review rounds 1 to 6 of PR #172.
// Each row says what the owner decisions require, never what the code did on the day it was written. A row is plain data (no import) so that a script can replay it against another build.
//
// Outcomes (what `accord approve` and `accord show <id> --approval --short` do with the last approach cycle, on lane M/L/P with a claim at 0.4.1):
//   BLOCK    approve refuses and the finding is listed under `## Blocking findings`;
//   LIST     approve is allowed and the finding is listed under `## Risks` (an open Must or Should, or a risk the owner dropped with their words);
//   PASS     nothing is listed and nothing blocks;
//   PROBLEM  approve refuses and the record problem is named (`Record problems:`); the line is the one in `problem`;
//   LEGACY   the claim is 0.4.0: approve is allowed, nothing is a record problem, and `list` holds what the short view shows under `## Risks` (open risk findings too);
//   LANE-S   lane S: no block and no record problem (approve itself exits 2: a lane S ticket needs no approval).
// A finding line is compared as accord prints it: trimmed, in round order. `grounds` is the answer of `accord round --approach` to the grounds rule (the approach record's pin is 0.4.1 unless `record` says otherwise).

export type Outcome = 'BLOCK' | 'LIST' | 'PASS' | 'PROBLEM' | 'LEGACY' | 'LANE-S';
export interface Row {
  id: string;
  /** The review round and the finding id that first used the line, and any later round that used it again. */
  src: string;
  /** The lines of round 1 (whole). */
  r1: string[];
  /** The lines of round 2 (diff); omitted: `No findings`; null: the record has no round 2. */
  r2?: string[] | null;
  /** Text after the last round (a verdict line). */
  tail?: string;
  claim?: '0.4.0' | '0.4.1';
  /** The pin at which the approach record began (the grounds rule reads it, never the claim). */
  record?: '0.4.0' | '0.4.1';
  lane?: 'M' | 'S' | 'L' | 'P';
  out: Outcome;
  /** BLOCK: the lines under Blocking findings (default: the first line of round 1). */
  block?: string[];
  /** LIST and LEGACY: the lines under Risks (default for LIST: the first line of round 1). */
  list?: string[];
  /** PROBLEM: the lines a record problem names (default: the first line of round 1). */
  problem?: string[];
  grounds?: 'ok' | 'refused';
  /** True when no owner decision settles the row: it records the behaviour the review accepted. */
  unspecified?: boolean;
}

export interface PlanRow {
  id: string;
  src: string;
  /** The lines of each round of plan-review.md. */
  rounds: string[][];
  record?: '0.4.0' | '0.4.1';
  /** The lines a record problem names (default none). */
  problem?: string[];
  /** `accord round --plan`: next (the next round is allowed), refused, or stop (the loop stops for the owner). */
  round: 'next' | 'refused' | 'stop';
}

const TOK = 'tokens reach the log';
const ROWS_LOSS = 'an overwrite loses rows';
const G1 = '1. Should — a — fixed — rests on: ac-1';
const LEAK = '1. Must — ' + TOK + ' — open';

const rows: Row[] = [];
const add = (r: Row): void => void rows.push(r);

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Round 1 (03-group1-REVIEW.md)
add({
  id: 'r1-CR01-closed-states-not-open',
  src: 'round 1 CR-01 (probe: withdrawn, owner-dropped, repeated findings counted as open)',
  r1: ['1. Must — a withdrawn one — withdrawn', '2. Should — owner dropped — owner: "drop it"', '3. Must — repeated one — repeated as 2.1', '4. Must — security withdrawn — withdrawn — risk: security'],
  r2: ['1. Must — repeats 1.3: repeated one — open — rests on: ac-1'],
  out: 'LIST',
  list: ['1. Must — repeats 1.3: repeated one — open — rests on: ac-1'],
});
add({ id: 'r1-CR02-no-findings-round-2', src: 'round 1 CR-02 (open security finding, round 2 reports No findings)', r1: ['1. Must — leaks token — open — risk: security'], out: 'BLOCK' });
add({ id: 'r1-CR02-verdict-line', src: 'round 1 CR-02 (a verdict line after round 2); round 2 C2', r1: ['1. Must — leaks token — open — risk: security'], tail: 'verdict: accepted-by-owner "fine"\n', out: 'BLOCK' });
add({ id: 'r1-CR02-round-1-only', src: 'round 1 CR-02 (no round 2 yet)', r1: ['1. Must — leaks token — open — risk: security'], r2: null, out: 'BLOCK' });

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Round 2 (03-group1-REREVIEW.md)
add({
  id: 'r2-A-unmarked-repeat',
  src: 'round 2 RR-CR-01 probe A; round 3 A',
  r1: ['1. Must — ' + TOK + ' — repeated as 2.1 — risk: security'],
  r2: ['1. Must — repeats 1.1: tokens still reach the log — open'],
  out: 'BLOCK',
  block: ['1. Must — repeats 1.1: tokens still reach the log — open'],
});
add({
  id: 'r2-A2-dangling-repeated-as',
  src: 'round 2 RR-CR-01 item 2; round 3 A2',
  r1: ['1. Must — ' + ROWS_LOSS + ' — repeated as 2.2 — risk: data-loss'],
  r2: ['1. Should — the cache can go stale — open — rests on: ac-1'],
  out: 'BLOCK',
  list: ['1. Should — the cache can go stale — open — rests on: ac-1'],
});
add({ id: 'r2-B-owner-drop-with-words', src: 'round 2 RR-CR-01 probe B; round 3 B', r1: ['1. Must — ' + TOK + ' — owner: "ship it" — risk: security'], out: 'LIST' });
add({ id: 'r2-B2-bare-owner', src: 'round 3 B2', r1: ['1. Must — ' + TOK + ' — owner: — risk: security'], out: 'BLOCK' });
add({
  id: 'r2-C-deferred-risk',
  src: 'round 2 RR-CR-01 probe C; round 3 C',
  r1: ['1. Should — a — fixed'],
  r2: ['1. Must — the export deletes old files — deferred — risk: data-loss'],
  out: 'BLOCK',
  block: ['1. Must — the export deletes old files — deferred — risk: data-loss'],
});
add({ id: 'r2-C2-deferred-risk-nice', src: 'round 5 p5c D1', r1: ['1. Nice — tokens — deferred — risk: security'], out: 'BLOCK' });
add({
  id: 'r2-D-legacy-open-risk',
  src: 'round 2 RR-WR-01 probe D; round 3 D (a ticket claimed under 0.4.0 keeps its old approve and lists the risk)',
  claim: '0.4.0',
  r1: ['1. Must — ' + TOK + ' — open — risk: security'],
  r2: ['1. Should — the cache can go stale — open'],
  out: 'LEGACY',
  list: ['1. Must — ' + TOK + ' — open — risk: security', '1. Should — the cache can go stale — open'],
});
add({
  id: 'r2-K-state-forms',
  src: 'round 2 probe K (the seven states of critique.md and a capitalised Withdrawn)',
  r1: ['1. Must — a — withdrawn: not real', '2. Should — b — owner: "drop it"', '3. Must — c — repeated as 2.1', '4. Should — d — Withdrawn', '5. Must — e — owner:"x"'],
  r2: ['1. Must — repeats 1.3: c — open'],
  out: 'LIST',
  list: ['4. Should — d — Withdrawn', '1. Must — repeats 1.3: c — open'],
});
add({ id: 'r2-N-nice-with-risk-mark', src: 'round 2 RR-CR-01 item 4 probe N; round 3 N', r1: ['1. Nice — ' + TOK + ' — open — risk: security'], out: 'BLOCK' });
for (const lane of ['L', 'P'] as const) {
  add({
    id: 'r2-lane-' + lane + '-capped',
    src: 'round 2 RR-WR-04 (D-18: lanes L and P get the capped rules)',
    lane,
    r1: ['1. Must — ' + TOK + ' — open — risk: security'],
    r2: ['1. Should — y — open — rests on: ac-1'],
    out: 'BLOCK',
    list: ['1. Should — y — open — rests on: ac-1'],
  });
}
add({
  id: 'r2-S-lane-s-leftover',
  src: 'round 2 RR-IN-02 probe S; round 4 S1; round 6 S1 (lane S blocks nothing)',
  lane: 'S',
  r1: ['1. Must — tokens — open — risks: security', '2. Must — rows — open — risk: data-loss'],
  out: 'LANE-S',
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Round 3 (03-group1-REVIEW3.md)
const WORDS = ' — risk: security';
add({ id: 'r3-H1a-Withdrawn-capital', src: 'round 3 H1a; round 5 D7', r1: ['1. Must — ' + TOK + ' — Withdrawn' + WORDS], out: 'BLOCK' });
add({ id: 'r3-H1b-Fixed-capital', src: 'round 3 H1b', r1: ['1. Must — ' + TOK + ' — Fixed' + WORDS], out: 'BLOCK' });
add({ id: 'r3-H1c-Owner-capital', src: 'round 3 H1c', r1: ['1. Must — ' + TOK + ' — Owner: "ship it"' + WORDS], out: 'BLOCK' });
add({ id: 'r3-H2-rests-on-risk', src: 'round 3 CR-01 H2; round 4 V-H2', r1: [LEAK + ' — rests on: risk: security'], out: 'BLOCK' });
add({ id: 'r3-H3-risk-Security-capital', src: 'round 3 CR-01 H3; round 4 V-H3', r1: [LEAK + ' — risk: Security'], out: 'BLOCK' });
add({ id: 'r3-H4-mark-before-state', src: 'round 3 CR-01 H4; round 4 V-H4', r1: ['1. Must — ' + TOK + ' — risk: security — open'], out: 'BLOCK' });
add({ id: 'r3-H5-two-marks', src: 'round 3 H5', r1: [LEAK + ' — rests on: ac-1 — risk: security'], out: 'BLOCK' });
add({ id: 'r3-H7-unverified-reason', src: 'round 3 H7', r1: ['1. Must — ' + TOK + ' — unverified: needs a citation — risk: security'], out: 'BLOCK' });
add({ id: 'r3-H19-withdrawn-with-reason', src: 'round 3 H19', r1: ['1. Must — ' + TOK + ' — withdrawn: the log is redacted — risk: security'], out: 'PASS' });
// Owner decision round 5: a separator other than ' — ' leaves one segment of text, so there is no mark slot and no finding state: the open Must is listed under Risks.
add({ id: 'r3-H18-ascii-hyphens', src: 'round 3 H18; round 4 V-H18', r1: ['1. Must - ' + TOK + ' - open - risk: security'], out: 'LIST' });
add({ id: 'r4-V-en-en-dash', src: 'round 4 V-en', r1: ['1. Must – ' + TOK + ' – open – risk: security'], out: 'LIST' });
add({ id: 'r4-V-dd-double-hyphen', src: 'round 4 V-dd', r1: ['1. Must -- ' + TOK + ' -- open -- risk: security'], out: 'LIST' });
add({
  id: 'r3-H14-owner-drop-then-open-repeat',
  src: 'round 3 H14',
  r1: ['1. Must — ' + TOK + ' — owner: "ship it" — risk: security'],
  r2: ['1. Must — repeats 1.1: tokens still reach the log — open'],
  out: 'BLOCK',
  block: ['1. Must — repeats 1.1: tokens still reach the log — open'],
  list: ['1. Must — ' + TOK + ' — owner: "ship it" — risk: security'],
});
add({
  id: 'r3-H11-legacy-owner-drop-and-repeat',
  src: 'round 3 H11 (claimed under 0.4.0)',
  claim: '0.4.0',
  r1: ['1. Must — ' + TOK + ' — owner: "ship it" — risk: security', '2. Must — overwrite — repeated as 2.1 — risk: data-loss'],
  r2: ['1. Should — repeats 1.2: overwrite still — open'],
  out: 'LEGACY',
  list: ['1. Must — ' + TOK + ' — owner: "ship it" — risk: security', '1. Should — repeats 1.2: overwrite still — open'],
});
add({
  id: 'r3-NM1-round-2-rests-on-risk',
  src: 'round 3 NM1',
  r1: ['1. Should — a — fixed'],
  r2: ['1. Must — ' + TOK + ' — open — rests on: risk: security'],
  out: 'BLOCK',
  block: ['1. Must — ' + TOK + ' — open — rests on: risk: security'],
});
add({ id: 'r3-NM2-unreadable-severity', src: 'round 3 NM2; round 4 V-NM2', r1: ['1. Must/Should — ' + TOK + ' — open — risk: security'], out: 'PROBLEM' });

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Round 4 (03-group1-REVIEW4.md)
add({ id: 'r4-X1-test-id-with-hyphen-fixed', src: 'round 4 CR-01 X1', r1: ['1. Must — ' + ROWS_LOSS + ' — open — risk: data-loss — test: export - fixed width rows survive'], out: 'BLOCK' });
add({ id: 'r4-X2-unverified-reason-fixed', src: 'round 4 CR-01 X2', r1: ['1. Must — ' + TOK + ' — unverified: the planner says - fixed by redacting, no citation — risk: security'], out: 'BLOCK' });
add({ id: 'r4-X3-unverified-reason-withdrawn', src: 'round 4 CR-01 X3', r1: ['1. Must — ' + TOK + ' — unverified: the redaction - withdrawn from the plan — risk: security'], out: 'BLOCK' });
add({ id: 'r4-F1b-fixed-risk-with-npm-command', src: 'round 4 CR-01 F1b; round 5 F3', r1: ['1. Must — ' + TOK + ' — fixed — risk: security — command: npm test -- packages/core/test/log.test.ts'], out: 'PASS' });
add({ id: 'r4-F1c-withdrawn-risk-test-id', src: 'round 4 F1c', r1: ['1. Must — ' + ROWS_LOSS + ' — withdrawn — risk: data-loss — test: export - keeps rows'], out: 'PASS' });
add({ id: 'r4-F1-open-state-stays-on-the-line', src: 'round 4 F1 (a later `fixed: 1.1` line is no state of the finding)', r1: [LEAK + ' — risk: security'], r2: ['fixed: 1.1', 'No findings'], out: 'BLOCK' });
add({
  id: 'r4-F2-round-2-must-command-with-npm-dashes',
  src: 'round 4 CR-01 F2',
  r1: ['1. Should — a — fixed'],
  r2: ['1. Must — the csv drops a quoted comma — open — command: npm test -- packages/cli/test/export.test.ts'],
  out: 'LIST',
  list: ['1. Must — the csv drops a quoted comma — open — command: npm test -- packages/cli/test/export.test.ts'],
  grounds: 'ok',
});
add({
  id: 'r4-F2-pre-command-in-backticks',
  src: 'round 4 F2-pre',
  r1: ['1. Should — a — fixed'],
  r2: ['1. Must — the csv drops a quoted comma — open — command: `npm test -- packages/cli/test/export.test.ts`'],
  out: 'LIST',
  list: ['1. Must — the csv drops a quoted comma — open — command: `npm test -- packages/cli/test/export.test.ts`'],
  grounds: 'ok',
});
add({
  id: 'r4-F3-normal-record',
  src: 'round 4 F3 (the template record: fixed, withdrawn, deferred, the word risk in prose)',
  r1: [
    '1. Must — the writer reuses the row cache, so a second export returns the first report — fixed — rests on: ac-1',
    '2. Should — the risk is that a comma in a field splits the row — fixed — rests on: D-01',
    '3. Must — ' + TOK + ' — fixed — risk: security',
    '4. Nice — name the mode csv, not text — deferred',
    '5. Should — a huge report times out - the writer streams nothing — withdrawn — rests on: Veto "No new dependency."',
  ],
  r2: ['fixed: 1.1, 1.2, 1.3', 'withdrawn: 1.5', 'No findings'],
  out: 'PASS',
});
add({
  id: 'r4-F4-owner-drop-and-open-should-with-prose',
  src: 'round 4 F4',
  r1: ['1. Must — ' + TOK + ' — owner: "ship it - the log is local" — risk: security', '2. Should — the main risk - a slow export on 1M rows — open — rests on: ac-1'],
  out: 'LIST',
  list: ['1. Must — ' + TOK + ' — owner: "ship it - the log is local" — risk: security', '2. Should — the main risk - a slow export on 1M rows — open — rests on: ac-1'],
});
add({ id: 'r4-F5-en-dash-in-prose', src: 'round 4 F5', r1: ['1. Should — pages 1 – 3 print twice — open — rests on: ac-1'], out: 'LIST' });
add({ id: 'r4-F6-hyphen-then-risk-words', src: 'round 4 WR-01 F6', r1: ['1. Should — the cache - risk: a stale read on reload — open — rests on: ac-1'], out: 'LIST' });
add({ id: 'r4-F7-em-dash-then-risk-words', src: 'round 4 p4c F7', r1: ['1. Should — the retry has no key — risk: a duplicate row on timeout — open — rests on: ac-1'], out: 'LIST' });
const CLOSED = "## Closed Extend: the owner's no\n\n";
add({
  id: 'r4-C1-unreadable-line-in-closed-cycle',
  src: 'round 4 IN-01 C1',
  r1: ['1. Must/Should — x — open'],
  r2: null,
  tail: CLOSED + '## Round 1 (whole)\n\n1. Should — y — open — rests on: ac-1\n\n## Round 2 (diff)\n\nNo findings\n',
  out: 'PROBLEM',
});
// Owner decision round 6 (WR-01): a slot is a record problem when its value is a security or data-loss kind written wrongly. A kind one letter off (`secrity`, `data-lost`) is such a value (Ruling).
add({
  id: 'r4-C2-misspelt-kind-in-closed-cycle',
  src: 'round 4 IN-01 C2',
  r1: ['1. Must — x — open — risk: secrity'],
  r2: null,
  tail: CLOSED + '## Round 1 (whole)\n\n1. Should — y — open — rests on: ac-1\n\n## Round 2 (diff)\n\nNo findings\n',
  out: 'PROBLEM',
  unspecified: true,
});
add({ id: 'r4-C2b-misspelt-kind-before-state', src: 'round 4 C2 (the misspelt kind in the current cycle, before the state)', r1: ['1. Must — x — risk: secrity — open'], out: 'PROBLEM', unspecified: true });
add({ id: 'r4-C2c-data-lost', src: 'round 4 C2 (data-lost: one letter off data-loss)', r1: ['1. Must — x — open — risk: data-lost'], out: 'PROBLEM', unspecified: true });
add({ id: 'r4-S1-lane-s-misspelt-mark', src: 'round 4 S1 (lane S asks no mark check)', lane: 'S', r1: ['1. Must/Should — x — open — risk: secrity'], out: 'LANE-S' });
add({
  id: 'r4-N1-critic-block-verbatim',
  src: 'round 4 CR-02 N1',
  r1: [LEAK, '   failing case: a login with a bad password → the token is written to app.log', '   rests on: risk: security'],
  out: 'BLOCK',
  block: [LEAK],
});
add({ id: 'r4-N2-backticked-mark', src: 'round 4 CR-02 N2; round 5 legacy forms', r1: [LEAK + ' — `risk: security`'], out: 'PROBLEM' });
add({ id: 'r4-N3-double-quoted-mark', src: 'round 4 CR-02 N3', r1: [LEAK + ' — "risk: security"'], out: 'PROBLEM' });
add({ id: 'r4-N3b-backticked-rests-on', src: 'round 4 CR-02 N3b', r1: [LEAK + ' — rests on: `risk: security`'], out: 'PROBLEM' });
add({
  id: 'r4-L1-legacy-unreadable-marks',
  src: 'round 4 L1 (claimed under 0.4.0: nothing is held to the mark check)',
  claim: '0.4.0',
  r1: ['1. Must — tokens — open — rests on: risk: security', '2. Must/Should — x — open', '3. Must — y — open — risk: secrity'],
  out: 'LEGACY',
  list: ['1. Must — tokens — open — rests on: risk: security', '3. Must — y — open — risk: secrity'],
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Round 5 (03-group1-REVIEW5.md)
add({ id: 'r5-B1-risks-plural', src: 'round 5 CR-02 B1', r1: [LEAK + ' — risks: security'], out: 'PROBLEM' });
add({ id: 'r5-B2-data-underscore-loss', src: 'round 5 CR-02 B2', r1: ['1. Must — ' + ROWS_LOSS + ' — open — risk: data_loss'], out: 'PROBLEM' });
add({ id: 'r5-B3-security-risk-prose', src: 'round 5 CR-02 B3', r1: [LEAK + ' — security risk'], out: 'LIST' });
add({ id: 'r5-B4-u2011-hyphen', src: 'round 5 CR-02 B4', r1: ['1. Must — ' + ROWS_LOSS + ' — open — risk: data‑loss'], out: 'PROBLEM' });
add({ id: 'r5-B4b-u2010-hyphen', src: 'round 5 CR-02 B4 (U+2010)', r1: ['1. Must — ' + ROWS_LOSS + ' — open — risk: data‐loss'], out: 'PROBLEM' });
add({ id: 'r5-B5-semicolon', src: 'round 5 CR-02 B5', r1: [LEAK + ' — risk; security'], out: 'PROBLEM' });
add({ id: 'r5-B6-data-loss-risk-prose', src: 'round 5 CR-02 B6', r1: ['1. Must — ' + ROWS_LOSS + ' — open — data-loss risk'], out: 'LIST' });
add({ id: 'r5-B7-no-findings-line-names-risk', src: 'round 5 CR-02 B7 (prose is never scanned)', r1: [G1], r2: ['No findings — 1.1 aside, risk: security remains in the log path'], out: 'PASS' });
add({ id: 'r5-B8-note-line-names-risk', src: 'round 5 B8', r1: [G1], r2: ['No findings', 'Note: risk: security remains in the log path'], out: 'PASS' });
add({ id: 'r5-R1-comma', src: 'round 5 WR-01 R1', r1: [LEAK + ' — risk, security'], out: 'PROBLEM' });
add({ id: 'r5-R2-full-stop', src: 'round 5 WR-01 R2', r1: [LEAK + ' — risk: security.'], out: 'PROBLEM' });
add({ id: 'r5-F9-risk-data-loss-test-name', src: 'round 5 CR-01 F9 (accord names its own tests risk:<kind>)', r1: ['1. Should — a fetch prunes early; add a `risk:data-loss` test — fixed — rests on: ac-1'], out: 'PASS' });
add({
  id: 'r5-F1-critic-block-fixed-risk',
  src: 'round 5 F1; round 6 N-critic-block',
  r1: ['1. Must — ' + TOK + ' — fixed', '   failing case: a login with a bad password → the token is written to app.log', '   rests on: risk: security'],
  r2: ['fixed: 1.1', 'No findings'],
  out: 'PASS',
});
add({
  id: 'r5-F2-block-rests-on-ac-round-2',
  src: 'round 5 WR-03 F2; round 6 WR03-F2',
  r1: ['1. Should — the csv drops a quoted comma — fixed — rests on: ac-1'],
  r2: ['1. Must — the header row is written twice — open', '   failing case: export a report → the csv has two header rows', '   rests on: ac-1'],
  out: 'LIST',
  list: ['1. Must — the header row is written twice — open'],
  grounds: 'ok',
});
add({
  id: 'r5-F2c-one-line-rests-on-ac-round-2',
  src: 'round 5 F2c',
  r1: ['1. Should — the csv drops a quoted comma — fixed — rests on: ac-1'],
  r2: ['1. Must — the header row is written twice — open — rests on: ac-1'],
  out: 'LIST',
  list: ['1. Must — the header row is written twice — open — rests on: ac-1'],
  grounds: 'ok',
});
add({
  id: 'r5-F4-prose-risk-in-findings',
  src: 'round 5 F4',
  r1: ['1. Should — the main risk is a slow export — fixed — rests on: ac-1', '2. Should — risk: a stale cache — fixed — rests on: ac-1'],
  out: 'PASS',
});
add({ id: 'r5-F5-owner-quote-note', src: 'round 5 WR-02 F5', r1: [G1, '', 'The owner said: "there is no risk - security is handled by the proxy".'], out: 'PASS' });
add({ id: 'r5-F6-withdrawn-reason-names-risk', src: 'round 5 WR-02 F6', r1: ['1. Should — headers are missing — withdrawn: no risk - security headers are set by the proxy — rests on: ac-1'], out: 'PASS' });
add({ id: 'r5-F7-unverified-reason-names-risk', src: 'round 5 WR-02 F7', r1: ['1. Should — headers are missing — unverified: the proxy sets them, so no risk: security issue — rests on: ac-1'], out: 'LIST' });
add({ id: 'r5-F8-fixed-then-owner-words', src: 'round 5 F8 (a real-record form; no owner decision settles the state)', r1: ['1. Should — a — fixed, owner: "A" — rests on: ac-1'], out: 'LIST', unspecified: true });
add({ id: 'r5-D2-dangling-repeated-as-with-fixed-repeat', src: 'round 5 p5c D2', r1: ['1. Must — tokens — repeated as 2.9 — risk: security'], r2: ['1. Must — repeats 1.1: tokens — fixed'], out: 'BLOCK' });
add({
  id: 'r5-D3-repeat-chain-later-open',
  src: 'round 5 p5c D3',
  r1: ['1. Must — tokens — repeated as 2.1 — risk: security'],
  r2: ['1. Must — repeats 1.1: tokens still — open — rests on: ac-1'],
  out: 'BLOCK',
  block: ['1. Must — repeats 1.1: tokens still — open — rests on: ac-1'],
});
add({ id: 'r5-D4-repeat-chain-later-fixed', src: 'round 5 p5c D4', r1: ['1. Must — tokens — repeated as 2.1 — risk: security'], r2: ['1. Must — repeats 1.1: tokens still — fixed — rests on: ac-1'], out: 'PASS' });
add({ id: 'r5-D5-owner-words', src: 'round 5 p5c D5', r1: ['1. Must — tokens — owner: "ship it" — risk: security'], out: 'LIST' });
add({ id: 'r5-D6-bare-owner', src: 'round 5 p5c D6', r1: ['1. Must — tokens — owner: — risk: security'], out: 'BLOCK' });
add({ id: 'r5-D7-Withdrawn-capital', src: 'round 5 p5c D7', r1: ['1. Must — tokens — Withdrawn — risk: security'], out: 'BLOCK' });
add({ id: 'r5-D8-withdrawn-comma-see', src: 'round 5 p5c D8', r1: ['1. Must — tokens — withdrawn, see 2.1 — risk: security'], out: 'BLOCK' });
add({
  id: 'r5-L1-legacy-open-risk-and-unread',
  src: 'round 5 L1',
  claim: '0.4.0',
  r1: ['1. Must — ' + TOK + ' — open — `risk: security`', '2. Must — rows — open — risk: data-loss'],
  out: 'LEGACY',
  list: ['1. Must — ' + TOK + ' — open — `risk: security`', '2. Must — rows — open — risk: data-loss'],
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Round 6 (03-group1-REVIEW6.md)
add({ id: 'r6-CR01-colon-risk-before-state', src: 'round 6 CR-01 (severity followed by a colon)', r1: ['1. Must: ' + TOK + ' — risk: security — open'], out: 'BLOCK' });
add({ id: 'r6-CR01-en-dash-after-severity', src: 'round 6 CR-01', r1: ['1. Must – ' + TOK + ' — risk: security — open'], out: 'BLOCK' });
add({ id: 'r6-CR01-hyphen-after-severity', src: 'round 6 CR-01', r1: ['1. Must - ' + TOK + ' — risk: data-loss — open'], out: 'BLOCK' });
add({ id: 'r6-CR01-colon-bad-slot-before-state', src: 'round 6 CR-01', r1: ['1. Must: ' + TOK + ' — risks: security — open'], out: 'PROBLEM' });
add({ id: 'r6-CR01-control-em-dash', src: 'round 6 CR-01 control', r1: ['1. Must — ' + TOK + ' — risk: security — open'], out: 'BLOCK' });
add({ id: 'r6-CR01-colon-risk-after-state', src: 'round 6 X1c', r1: ['1. Must: ' + TOK + ' — open — risk: security'], out: 'BLOCK' });
add({ id: 'r6-CR01-colon-fixed-risk-closes', src: 'round 6 CR-01 (derived: the state of a colon-form line is read as well)', r1: ['1. Must: ' + TOK + ' — risk: security — fixed'], out: 'PASS', unspecified: true });
add({ id: 'r6-CR01-colon-fixed-unmarked-closes', src: 'round 6 CR-01 (derived)', r1: ['1. Must: ' + TOK + ' — fixed'], out: 'PASS', unspecified: true });
add({
  id: 'r6-CR02-indented-risk-note-under-fixed',
  src: 'round 6 CR-02',
  r1: ['1. Should — the cache is stale — fixed — rests on: ac-1', '   - Risk: a stale cache shows old rows for a minute'],
  out: 'PASS',
});
add({
  id: 'r6-CR02-indented-risk-note-under-open',
  src: 'round 6 CR-02 (an open finding with the same note: the note is prose)',
  r1: ['1. Should — the cache is stale — open — rests on: ac-1', '   - Risk: a stale cache shows old rows for a minute'],
  out: 'LIST',
  list: ['1. Should — the cache is stale — open — rests on: ac-1'],
});
add({ id: 'r6-WR01-risk-words-in-text-slot', src: 'round 6 WR-01', r1: ['1. Should — the export streams rows — risk: a partial file is left on a crash — fixed — rests on: ac-1'], out: 'PASS' });
add({ id: 'r6-WR01-risks-words-in-text-slot', src: 'round 6 WR-01', r1: ['1. Should — the export streams rows — risks: a partial file and a slow disk — fixed — rests on: ac-1'], out: 'PASS' });
add({
  id: 'r6-WR01-risk-none-left-in-unverified-reason',
  src: 'round 6 WR-01',
  r1: ['1. Should — headers are missing — fixed — rests on: ac-1'],
  r2: ['1. Should — the delimiter is wrong — unverified: the planner says Task 2 covers it — risk: none left — rests on: ac-1'],
  out: 'LIST',
  list: ['1. Should — the delimiter is wrong — unverified: the planner says Task 2 covers it — risk: none left — rests on: ac-1'],
});
add({ id: 'r6-WR01-risk-none-after-ground', src: 'round 6 WR-01', r1: ['1. Should — the header row is written twice — fixed — rests on: ac-1 — risk: none'], out: 'PASS' });
add({ id: 'r6-WR01-risk-low-before-ground', src: 'round 6 WR-01', r1: ['1. Should — the header row is written twice — fixed — risk: low — rests on: ac-1'], out: 'PASS' });
add({ id: 'r6-WR01-risk-none-open', src: 'round 6 WR-01 (an open finding with a non-kind risk value is an ordinary open finding)', r1: ['1. Should — the header row is written twice — open — risk: none'], out: 'LIST' });
add({
  id: 'r6-WR02-column-0-rests-on-under-finding',
  src: 'round 6 WR-02 X2 (Ruling: a mark-shaped line directly under a finding with no blank line is a record problem)',
  r1: [LEAK, 'rests on: risk: security'],
  out: 'PROBLEM',
  problem: ['rests on: risk: security'],
});
add({ id: 'r6-WR02-column-0-risk-under-finding', src: 'round 6 WR-02 X2b', r1: [LEAK, 'risk: security'], out: 'PROBLEM', problem: ['risk: security'] });
add({ id: 'r6-WR02-rests-on-risk-no-colon', src: 'round 6 WR-02 X3', r1: [LEAK + ' — rests on risk: security'], out: 'PROBLEM' });
add({
  id: 'r6-WR02-block-after-a-blank-line',
  src: 'round 6 X8 (an indented line after a blank line is a paragraph of the same list item: the block)',
  r1: [LEAK, '', '   rests on: risk: security'],
  out: 'BLOCK',
  block: [LEAK],
});
add({ id: 'r6-X4-blockquote-block-line', src: 'round 6 X4 (a quoted line is no block line of the critic: prose)', r1: [LEAK, '   > rests on: risk: security'], out: 'LIST', unspecified: true });
add({ id: 'r6-X5-risk-in-the-text-slot', src: 'round 6 X5 (the finding text is segment 2, never a mark slot)', r1: ['1. Must — risk: security — open'], out: 'LIST', unspecified: true });
add({ id: 'r6-X6-numbered-bullet-paren', src: 'round 6 X6', r1: ['- 1) Must — ' + TOK + ' — open — risk: security'], out: 'BLOCK' });
add({ id: 'r6-X7-bold-severity-and-mark', src: 'round 6 X7', r1: ['1. **Must** — ' + TOK + ' — **risk: security** — open'], out: 'PROBLEM' });
add({ id: 'r6-X9-risk-then-ground-no-hyphen', src: 'round 6 X9 (Ruling: a rests-on value that is no risk kind is prose)', r1: [LEAK + ' — risk: security — rests on: ac1'], out: 'BLOCK' });
add({ id: 'r6-X10-no-space-after-colon', src: 'round 6 X10', r1: [LEAK + ' — risk:security'], out: 'BLOCK' });
add({ id: 'r6-X11-Risk-Security-capital', src: 'round 6 X11', r1: [LEAK + ' — Risk: Security'], out: 'BLOCK' });
add({ id: 'r6-N-prose-nice-open', src: 'round 6 WR-03 (an open Nice is never listed)', r1: ['1. Nice — ' + TOK + ', a security risk — open'], out: 'PASS' });
add({ id: 'r6-N-prose-should-open', src: 'round 6 WR-03', r1: ['1. Should — ' + TOK + ', a security risk — open'], out: 'LIST' });
add({
  id: 'r6-N-command-with-em-dash-unquoted',
  src: 'round 6 norm (an unquoted em dash splits the command; the line cannot be read as closed, so it fails closed)',
  r1: ['1. Must — ' + TOK + ' — fixed — risk: security — command: node scripts/check.mjs — see log'],
  out: 'BLOCK',
  unspecified: true,
});
add({ id: 'r6-N-command-with-em-dash-in-backticks', src: 'round 6 norm', r1: ['1. Must — ' + TOK + ' — fixed — risk: security — command: `node check.mjs — x`'], out: 'PASS' });
add({
  id: 'r6-N-line-test-command-fixed',
  src: 'round 6 norm',
  r1: ['1. Must — ' + TOK + ' — fixed — risk: security — test: log#redacts — command: npm test -- packages/core/test/log.test.ts'],
  out: 'PASS',
});
add({
  id: 'r6-N-block-rests-on-two-refs',
  src: 'round 6 norm (an unparsed ground is prose; no owner decision settles it)',
  r1: [G1],
  r2: ['1. Must — the delimiter is wrong — open', '   failing case: x → y', '   rests on: ac-1, D-01'],
  out: 'LIST',
  list: ['1. Must — the delimiter is wrong — open'],
  unspecified: true,
});
add({
  id: 'r6-N-block-rests-on-the-veto',
  src: 'round 6 norm',
  r1: [G1],
  r2: ['1. Must — the delimiter is wrong — open', '   failing case: x → y', '   rests on: the Veto "No new dependency."'],
  out: 'LIST',
  list: ['1. Must — the delimiter is wrong — open'],
  unspecified: true,
});
add({
  id: 'r6-N-block-repeats-the-one-line-mark',
  src: 'round 6 norm',
  r1: [G1],
  r2: ['1. Must — the delimiter is wrong — open — rests on: ac-1', '   failing case: x → y', '   rests on: ac-1'],
  out: 'LIST',
  list: ['1. Must — the delimiter is wrong — open — rests on: ac-1'],
});
add({
  id: 'r6-N-block-conflicting-second-mark',
  src: 'round 5 (a second, different mark in the block is a conflict)',
  r1: ['1. Must — ' + TOK + ' — open — risk: security', '   rests on: risk: data-loss'],
  out: 'PROBLEM',
  problem: ['rests on: risk: data-loss'],
});
add({ id: 'r6-N-D-bare', src: 'round 6 norm (a bare D-01 is no mark)', r1: [G1], r2: ['1. Must — the delimiter is wrong — open — D-01'], out: 'LIST', list: ['1. Must — the delimiter is wrong — open — D-01'], unspecified: true });
add({ id: 'r6-L1-legacy-all-written-forms', src: 'round 6 L1 (claimed under 0.4.0)', claim: '0.4.0', r1: [LEAK + ' — risks: security', '2. Must — rows — open — risk: data-loss', '3. Must — rows — open', '   rests on: risk: security'], out: 'LEGACY', list: [LEAK + ' — risks: security', '2. Must — rows — open — risk: data-loss', '3. Must — rows — open'] });
add({
  id: 'r6-GR-record-begun-after-the-upgrade',
  src: 'round 3 WR-01 grounds.mjs (Phase 2 grounds rule keeps its record pin: a claim at 0.4.0 with a record begun at 0.4.1 is asked grounds)',
  claim: '0.4.0',
  record: '0.4.1',
  r1: ['1. Must — a — fixed'],
  r2: ['1. Must — the export drops rows with a comma — open'],
  out: 'LEGACY',
  list: ['1. Must — the export drops rows with a comma — open'],
  grounds: 'refused',
});
add({
  id: 'r6-GR-record-begun-before-the-upgrade',
  src: 'round 3 WR-01 grounds.mjs control',
  claim: '0.4.0',
  record: '0.4.0',
  r1: ['1. Must — a — fixed'],
  r2: ['1. Must — the export drops rows with a comma — open'],
  out: 'LEGACY',
  list: ['1. Must — the export drops rows with a comma — open'],
  grounds: 'ok',
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Round 7 (03-group1-REVIEW7.md, probes accord-rr7/s/r7.mjs and r7c.mjs).
// CR-01: a security or data-loss kind written one edit off (one insertion, deletion, substitution or adjacent transposition, measured over the whole kind string, the `data` part included) is a
// record problem, on the finding line and on the critic's `rests on: risk:` line, in the current cycle and in a closed one. Two or more edits off is prose.
const KIND_TYPOS = ['date-loss', 'dta-loss', 'daat-loss', 'data-los', 'datta-loss', 'data-lsos', 'data_lost', 'dataloss', 'secrity', 'secuirty', 'sceurity', 'ecurity', 'securty', 'securitty', 'seburity'];
for (const k of KIND_TYPOS) {
  const tag = k.replace(/[^a-z]+/g, '-');
  add({ id: 'r7-CR01-one-off-' + tag + '-after-state', src: 'round 7 CR-01 (' + k + ' one edit off, after the state)', r1: [LEAK + ' — risk: ' + k], out: 'PROBLEM' });
}
add({ id: 'r7-CR01-one-off-date-loss-before-state', src: 'round 7 CR-01 (date-loss before the state)', r1: ['1. Must — ' + TOK + ' — risk: date-loss — open'], out: 'PROBLEM' });
add({ id: 'r7-CR01-one-off-block-date-loss', src: 'round 7 CR-01 (the critic block: rests on: risk: date-loss)', r1: [LEAK, '   rests on: risk: date-loss'], out: 'PROBLEM', problem: ['rests on: risk: date-loss'] });
add({ id: 'r7-CR01-one-off-block-dta-loss', src: 'round 7 CR-01 (the critic block: rests on: risk: dta-loss)', r1: [LEAK, '   failing case: a login → the token is in app.log', '   rests on: risk: dta-loss'], out: 'PROBLEM', problem: ['rests on: risk: dta-loss'] });
add({ id: 'r7-CR01-one-off-block-secuirty', src: 'round 7 CR-01 (the critic block: rests on: risk: secuirty)', r1: [LEAK, '   rests on: risk: secuirty'], out: 'PROBLEM', problem: ['rests on: risk: secuirty'] });
add({ id: 'r7-CR01-one-off-data-space-loss-typo', src: 'round 7 CR-01 (data loss with a space, a letter doubled)', r1: ['1. Must — ' + ROWS_LOSS + ' — open — risk: data lloss'], out: 'PROBLEM' });
add({
  id: 'r7-CR01-one-off-date-loss-in-closed-cycle',
  src: 'round 7 CR-01 (MC-closed-date-loss: a closed cycle holds risk: date-loss, then a clean cycle)',
  r1: [LEAK + ' — risk: date-loss'],
  r2: null,
  tail: CLOSED + '## Round 1 (whole)\n\n' + G1 + '\n\n## Round 2 (diff)\n\nNo findings\n',
  out: 'PROBLEM',
});
// Two or more edits off stays prose (Ruling, round 6): none of these is a record problem, and an open one is an ordinary open finding.
for (const k of ['sec', 'ecuri', 'lossy', 'dat-ss', 'sucurita']) {
  add({ id: 'r7-CR01-two-off-' + k, src: 'round 7 CR-01 (two or more edits off is prose)', r1: ['1. Should — the export is slow — open — risk: ' + k + ' — rests on: ac-1'], out: 'LIST' });
}
add({ id: 'r7-CR01-control-data-los', src: 'round 7 controls (data-los, secrity, sceurity, ecurity were already problems)', r1: [LEAK + ' — risk: data-los'], out: 'PROBLEM' });

// CR-02: the critic's block may carry several `rests on:` lines, and a line ground may coexist with a block ground. Every valid ground is read; a second valid ground, or a second, different
// test or command, is never a record problem. Only a mis-written risk kind is (the conflicting-risk row above stays a problem).
const SHOULD_CSV = '1. Should — the delimiter is wrong — fixed';
add({ id: 'r7-CR02-G1-line-ac-block-D', src: 'round 7 CR-02 G1', r1: ['1. Must — the header row is written twice — fixed — rests on: ac-1', '   failing case: export → two headers', '   rests on: D-01'], out: 'PASS', grounds: 'ok' });
add({ id: 'r7-CR02-G2-two-block-grounds', src: 'round 7 CR-02 G2', r1: ['1. Must — the header row is written twice — fixed', '   failing case: export → two headers', '   rests on: ac-1', '   rests on: D-01'], out: 'PASS', grounds: 'ok' });
add({ id: 'r7-CR02-G3-line-test-block-test', src: 'round 7 CR-02 G3', r1: [SHOULD_CSV + ' — test: export#writes-csv', '   rests on: test: export#delimiter'], out: 'PASS', grounds: 'ok' });
add({
  id: 'r7-CR02-G4-open-two-block-grounds-r2',
  src: 'round 7 CR-02 G4',
  r1: [G1],
  r2: ['1. Must — the header row is written twice — open', '   failing case: x', '   rests on: ac-1', '   rests on: D-01'],
  out: 'LIST',
  list: ['1. Must — the header row is written twice — open'],
  grounds: 'ok',
});
add({ id: 'r7-CR02-two-block-commands', src: 'round 7 CR-02 (two different commands in the block)', r1: [SHOULD_CSV, '   rests on: command: npm test -- a', '   rests on: command: npm test -- b'], out: 'PASS', grounds: 'ok' });
add({ id: 'r7-CR02-three-block-grounds-mixed', src: 'round 7 CR-02 (ac, decision and a test in one block)', r1: [SHOULD_CSV, '   rests on: ac-1', '   rests on: D-01', '   rests on: test: export#delimiter'], out: 'PASS', grounds: 'ok' });
add({ id: 'r7-CR02-line-quote-block-ac', src: 'round 7 CR-02 (a quoted ticket line on the line, an ac in the block)', r1: [SHOULD_CSV + ' — rests on: Veto "No new dependency."', '   rests on: ac-1'], out: 'PASS', grounds: 'ok' });
add({ id: 'r7-CR02-risk-line-second-ground-block', src: 'round 7 CR-02 (an open risk on the line keeps blocking with a second ground in the block)', r1: [LEAK + ' — risk: security', '   rests on: ac-1', '   rests on: D-01'], out: 'BLOCK' });
add({ id: 'r7-CR02-second-ground-and-misspelt-risk-is-problem', src: 'round 7 CR-02 (a second valid ground does not hide a mis-written risk kind)', r1: [LEAK, '   rests on: ac-1', '   rests on: D-01', '   rests on: risk: secrity'], out: 'PROBLEM', problem: ['rests on: risk: secrity'] });

// Every ground kind, as a one-line mark and as the critic's block line, in a round 2 Must that rests on nothing else (round 6 'norm').
const KINDS: { mark: string; risk?: true }[] = [
  { mark: 'rests on: ac-1' },
  { mark: 'rests on: D-01' },
  { mark: 'rests on: Veto "No new dependency."' },
  { mark: 'rests on: Intent "Owners can export their report as CSV."' },
  { mark: 'test: export#writes-csv' },
  { mark: 'command: npm test -- packages/core/test/x.test.ts' },
  { mark: 'rests on: test: export#writes-csv' },
  { mark: 'rests on: command: npm test -- x' },
  { mark: 'risk: security', risk: true },
  { mark: 'rests on: risk: data-loss', risk: true },
];
for (const k of KINDS) {
  const first = '1. Must — the delimiter is wrong — open';
  const oneLine = first + ' — ' + k.mark;
  add({
    id: 'r6-ground-line-' + k.mark.replace(/[^A-Za-z0-9]+/g, '-'),
    src: 'round 6 norm N-line',
    r1: ['1. Should — the header row is written twice — fixed — rests on: ac-1'],
    r2: [oneLine],
    out: k.risk ? 'BLOCK' : 'LIST',
    ...(k.risk ? { block: [oneLine] } : { list: [oneLine] }),
    grounds: 'ok',
  });
  add({
    id: 'r6-ground-block-' + k.mark.replace(/[^A-Za-z0-9]+/g, '-'),
    src: 'round 6 norm N-block',
    r1: ['1. Should — the header row is written twice — fixed — rests on: ac-1'],
    r2: [first, '   failing case: export → a semicolon', '   ' + (k.mark.startsWith('rests on:') ? k.mark : 'rests on: ' + k.mark)],
    out: k.risk ? 'BLOCK' : 'LIST',
    ...(k.risk ? { block: [first] } : { list: [first] }),
    grounds: 'ok',
  });
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Legacy (claim 0.4.0): the written forms of round 5 and 6 (accord-rr5/s/legacy-forms.mjs, accord-rr6/s/legacy6.mjs), each as round 1 of a two-round record. Nothing is a record problem
// and approve is allowed; the short view lists every finding that is still open, a risk finding included (D-12, owner decision 3).
const LEGACY_FORMS: { line: string[]; listed: boolean }[] = [
  { line: ['1. Must — tokens reach the log — fixed by redacting — risk: security'], listed: true },
  { line: ['1. Must — tokens reach the log — Fixed — risk: security'], listed: true },
  { line: ['1. Must - tokens reach the log - open - risk: security'], listed: true },
  { line: ['1. Must — tokens reach the log — open — `risk: security`'], listed: true },
  { line: ['1. Should — a — withdrawn by the critic'], listed: true },
  { line: ['1. Should — a — unverified: the planner says — fixed'], listed: true },
  { line: ['1. Must — a — unverified: x — deferred'], listed: true },
  { line: ['1. Must — add a `risk:data-loss` test — fixed, owner: "A"'], listed: true },
  { line: ['1. Should — the cache - risk: a stale read — open — rests on: ac-1'], listed: true },
  { line: ['1. Must — a — open — command: npm test -- x'], listed: true },
  { line: ['1. Must — tokens — open — risks: security'], listed: true },
  { line: ['1. Should — a — fixed — risk: none'], listed: false },
  { line: ['1. Must: tokens reach the log — risk: security — open'], listed: true },
  { line: ['1. Must — tokens — open — rests on: ac1'], listed: true },
  { line: ['1. Should — the export streams rows — risk: a partial file — fixed — rests on: ac-1'], listed: false },
  { line: ['1. Must — tokens — open — risk; security'], listed: true },
  { line: ['1. Must — rows — open — risk: data‑loss'], listed: true },
  { line: ['1. Must — rows — fixed — rests on: test: x#y'], listed: false },
  { line: ['1. Must — rows — open — rests on: command: npm test -- x'], listed: true },
  { line: ['1. Should — a — unverified: the planner says — risk: none left'], listed: true },
  { line: ['1. Must — a — open — **risk: security**'], listed: true },
  { line: ['1. Must — a — owner: "ship it" — risk: security'], listed: true },
  { line: ['1. Must — a — repeated as 2.1 — risk: security'], listed: true },
  { line: ['1. Must — a — deferred — risk: data-loss'], listed: true },
  { line: ['1. Must — tokens reach the log — open', '   failing case: x → y', '   rests on: risk: security'], listed: true },
  { line: ['1. Must — tokens reach the log — open', '   failing case: x → y', '   rests on: ac-1'], listed: true },
  { line: ['1. Must — tokens reach the log — open', '   failing case: x → y', '   rests on: ac1'], listed: true },
  { line: ['1. Must — tokens reach the log — fixed — rests on: ac-1', '   rests on: D-01'], listed: false },
  { line: ['1. Should — the cache — fixed', '   - Risk: a stale cache shows old rows'], listed: false },
  { line: ['1. Must — tokens reach the log — open', 'rests on: risk: security'], listed: true },
];
LEGACY_FORMS.forEach((f, i) =>
  add({
    id: 'legacy-form-' + String(i + 1).padStart(2, '0'),
    src: 'rounds 5 and 6 legacy forms (claimed under 0.4.0, byte comparison against origin/main)',
    claim: '0.4.0',
    r1: f.line,
    out: 'LEGACY',
    list: f.listed ? [f.line[0]] : [],
    unspecified: true,
  }),
);

export const ROWS: readonly Row[] = rows;

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// plan-review.md rows (the grounds rule reads the record's pin; a ticket claimed under 0.4.0 whose plan critique begins at 0.4.1 is held to it)
export const PLAN_ROWS: readonly PlanRow[] = [
  { id: 'plan-r5-P1-risk-test-name', src: 'round 5 CR-01 P1 (accord names its own tests risk:<kind>; 7 real plan records say so)', rounds: [['1. Must — Task 1: a fetch prunes early; add a `risk:data-loss` test — open']], round: 'next' },
  { id: 'plan-r5-P2-control', src: 'round 5 P2', rounds: [['1. Must — Task 1: a fetch prunes early; add a data-loss test — open']], round: 'next' },
  { id: 'plan-r5-P3-prose-note', src: 'round 5 P3', rounds: [['1. Should — Task 1: the header is written twice — open', '', 'Security lens: no risk: security path is touched.']], round: 'next' },
  {
    id: 'plan-r5-P4-fixed-by-the-planner',
    src: 'round 5 P4',
    rounds: [['1. Must — Task 1: header twice — fixed by the planner'], ['1. Should — Task 1: the delimiter is a comma — open — rests on: ac-1']],
    round: 'next',
  },
  {
    id: 'plan-r4-P1-round-2-must-npm-command',
    src: 'round 4 CR-01 P1',
    rounds: [['1. Should — Task 2: a — fixed'], ['1. Must — Task 2: the csv drops a quoted comma — open — command: npm test -- packages/cli/test/export.test.ts']],
    round: 'next',
  },
  {
    id: 'plan-r4-P2-em-dash-risk-words',
    src: 'round 4 WR-01 P2',
    rounds: [['1. Should — Task 2: the retry has no key — risk: a duplicate row on timeout — open — rests on: ac-1']],
    round: 'next',
  },
  { id: 'plan-r4-P3-hyphen-risk-words', src: 'round 4 WR-01 P3', rounds: [['1. Should — Task 2: the cache - risk: a stale read — open — rests on: ac-1']], round: 'next' },
  { id: 'plan-r6-PL1-risk-none', src: 'round 6 WR-01 PL1', rounds: [['1. Should — Task 1: header twice — fixed — risk: none']], round: 'next' },
  { id: 'plan-r6-PL3-one-round-risks-plural', src: 'round 6 PL3 (a mark slot whose value is a mis-written kind is a record problem of a plan under the grounds rule)', rounds: [['1. Should — Task 1: quoting — open — risks: security']], problem: ['1. Should — Task 1: quoting — open — risks: security'], round: 'refused' },
  {
    id: 'plan-r6-PL4-three-rounds-risk-words-in-text',
    src: 'round 6 PL4 (refused by the stop at round 3, not by a mark)',
    rounds: [['1. Should — Task 1: header twice — fixed — rests on: ac-1'], ['1. Should — Task 1: delimiter — fixed — rests on: ac-1'], ['1. Should — Task 1: the writer — risk: a slow disk — open — rests on: ac-1']],
    round: 'stop',
  },
  {
    id: 'plan-r6-PL5-legacy-record-three-rounds-risks-plural',
    src: 'round 6 PL5 (a plan record begun under 0.4.0 keeps the older rule, no mark is checked; refused by the stop at round 3)',
    record: '0.4.0',
    rounds: [['1. Should — Task 1: header twice — fixed'], ['1. Should — Task 1: delimiter — fixed'], ['1. Should — Task 1: quoting — open — risks: security']],
    round: 'stop',
  },
  {
    id: 'plan-r6-CR02-indented-risk-note',
    src: 'round 6 CR-02 (the same note under a plan finding)',
    rounds: [['1. Should — Task 1: the cache is stale — fixed — rests on: ac-1', '   - Risk: a stale cache shows old rows for a minute']],
    round: 'next',
  },
  {
    id: 'plan-r7-CR01-one-off-date-loss',
    src: 'round 7 CR-01 (a plan finding with a data-loss kind one edit off is a record problem under the grounds rule)',
    rounds: [['1. Should — Task 1: quoting — open — risk: date-loss']],
    problem: ['1. Should — Task 1: quoting — open — risk: date-loss'],
    round: 'refused',
  },
  {
    id: 'plan-r7-CR02-two-block-grounds',
    src: 'round 7 CR-02 (a second valid ground under a plan finding is no record problem)',
    rounds: [['1. Should — Task 1: the cache is stale — fixed', '   rests on: ac-1', '   rests on: D-01']],
    round: 'next',
  },
];
