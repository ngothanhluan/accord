// D-61 to D-64: the six EARS patterns classify silently; anything else gets one fixed diagnosis.
import { describe, expect, it } from 'vitest';
import { classifyEars } from '../src/lint/ears.js';

describe('classifyEars (D-61 to D-64)', () => {
  it.each([
    ['The system shall log every request.', 'ubiquitous'],
    ['WHEN the user submits the form, the system SHALL save the data', 'event-driven'],
    ['While the aircraft is on ground, the system shall disable reverse thrust', 'state-driven'],
    ['IF the password is wrong THEN the system SHALL show an error', 'unwanted-behaviour'],
    ['Where the premium feature is enabled, the system shall show the export button', 'optional-feature'],
    ['While the user is signed in, when the session expires, the system shall redirect to login', 'complex'],
  ])('classifies %j as %s', (line, pattern) => {
    expect(classifyEars(line)).toEqual({ pattern });
  });

  // The valid-build fixture lines: English keywords around Vietnamese content (D-63).
  it.each([
    ['WHEN người dùng gửi email và mật khẩu hợp lệ the system SHALL mở bảng điều khiển', 'event-driven'],
    ['IF mật khẩu sai THEN the system SHALL hiển thị thông báo lỗi', 'unwanted-behaviour'],
    ['WHEN người dùng có tài khoản the system SHALL cho phép đăng nhập', 'event-driven'],
  ])('classifies the fixture line %j as %s', (line, pattern) => {
    expect(classifyEars(line)).toEqual({ pattern });
  });

  it.each([
    ['WHEN the user clicks, it saves', "has WHEN but no 'the system shall'"],
    ['The user logs in', "no EARS keyword and no 'the system shall'"],
    ['The system must log it', "has 'the system must' but the verb must be 'shall'"],
    ['WHEN x the system shall', "has 'the system shall' but no response after it"],
    ['Sau khi đăng nhập WHEN x the system shall y', "has 'the system shall' but the line starts with prose and no keyword"],
    ['WHEN a WHEN b the system shall c', 'has WHEN twice'],
    ['WHEN the system shall save', "has WHEN but no trigger before 'the system shall'"],
    ['IF x the system shall y', "has IF but no THEN before 'the system shall'"],
    ['WHEN x THEN the system shall y', 'has THEN but no IF'],
    ['IF x THEN y WHEN z the system shall w', "THEN must come last before 'the system shall'"],
  ])('diagnoses %j', (line, reason) => {
    expect(classifyEars(line)).toEqual({ reason });
  });

  // D-61: `should` is a verb diagnosis; case and whitespace runs do not matter.
  it.each([
    ['the system should x', { reason: "has 'the system should' but the verb must be 'shall'" }],
    ['The System Shall x', { pattern: 'ubiquitous' }],
    ['the   system   shall x', { pattern: 'ubiquitous' }],
  ])('%j -> %j (D-61)', (line, result) => {
    expect(classifyEars(line)).toEqual(result);
  });
});
