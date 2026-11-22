// Phase 8.5 D-01 skeleton for the red commit: the names exist so the tests compile and fail on their assertions; the next commit replaces this file.
import type { ProductChange, ProductRead } from '@accord-dev/accord-core';

export function readProductText(_root: string, _copy: { from: 'working' } | { from: 'default'; ref: string | undefined }, _file?: string): ProductRead {
  return { kind: 'absent', copy: 'working' };
}
export function productChange(_root: string, _base: string | undefined, _head: string, _file?: string): ProductChange {
  return { kind: 'unknown', why: 'skeleton' };
}
