// Phase 8.5 D-01 skeleton for the red commit: the names exist so the tests compile and fail on their assertions; the next commit replaces this file.
export type ProductRead =
  | { kind: 'text'; copy: 'working' | 'default'; text: string; note?: 'no-default-ref' }
  | { kind: 'absent'; copy: 'working' | 'default'; note?: 'no-default-ref' }
  | { kind: 'not-regular'; copy: 'working' | 'default'; note?: 'no-default-ref' };
export type ProductChange = { kind: 'diff'; text: string } | { kind: 'unknown'; why: string };
export type ProductRole = 'executor' | 'fix-executor' | 'planner' | 'scout' | 'critic' | 'judge' | 'reviewer' | 'foreign-reviewer' | 'main-session' | 'lane-s-session';
export type BlockKind = 'ruleset' | 'related' | 'rejected' | 'epic' | 'conventions' | 'changed';
export interface RelatedParts { id: string; lines: string[] }
export interface ProductInputs { ruleset?: string; related?: RelatedParts; epic?: string; conventions?: ProductRead; changed?: ProductChange }
export const BLOCK_ORDER: readonly BlockKind[] = [];
export const ROLE_BLOCKS = {} as Readonly<Record<ProductRole, readonly BlockKind[]>>;
export const WRITER_DUTY = '';
export const JUDGE_DUTY = '';
export const CHANGED_DUTY = '';
export const REJECTED_DUTY = '';
export const EPIC_DUTY = '';
export const RELATED_DUTY = '';
export const FINDINGS_DUTY = '';
export const CONVENTIONS_HEADING = '';
export const CHANGED_HEADING = '';
export const REJECTED_HEADING = '';
export const FINDINGS_HEADING = '';
export const NO_DEFAULT_REF_LINE = '';
export const CHANGED_WITHHELD_LINE = '';
export const productBlocks = (_role: ProductRole, _inputs: ProductInputs): string[] => [];
export const conventionsBlock = (_read: ProductRead, _role: ProductRole): string => '';
export const changedBlock = (_change: ProductChange): string => '';
export const subagentContext = (ruleset: string, _epic: string | undefined): string => ruleset;
