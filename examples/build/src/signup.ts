// One account per email address, compared without letter case (accord/product/business-rules.md).
const MIN_PASSWORD = 10;

const accounts = new Map<string, string>();

export type SignupResult = { workspace: string } | { refused: 'address-taken' | 'password-too-short' };

export function signUp(email: string, password: string): SignupResult {
  if (password.length < MIN_PASSWORD) return { refused: 'password-too-short' };
  const address = email.toLowerCase();
  if (accounts.has(address)) return { refused: 'address-taken' };
  accounts.set(address, password);
  return { workspace: 'workspace for ' + address };
}

export function forget(email: string): void {
  accounts.delete(email.toLowerCase());
}
