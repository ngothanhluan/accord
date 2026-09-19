import { expect, test } from 'vitest';
import { forget, signUp } from '../src/signup.js';

test('creates the account', () => {
  forget('mai@example.test');
  expect(signUp('mai@example.test', 'correct-horse')).toEqual({ workspace: 'workspace for mai@example.test' });
});

test('refuses an address already taken', () => {
  forget('mai@example.test');
  signUp('mai@example.test', 'correct-horse');
  expect(signUp('MAI@example.test', 'another-password')).toEqual({ refused: 'address-taken' });
});
