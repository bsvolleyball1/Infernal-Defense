export type RecordValue = Record<string, unknown>;

export function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function object(value: unknown, name: string): asserts value is RecordValue {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), `${name} must be an object.`);
}

export function number(value: unknown, name: string, min = 0, max = Number.MAX_SAFE_INTEGER): asserts value is number {
  check(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max, `${name} is invalid.`);
}

export function integer(value: unknown, name: string, min = 0, max = Number.MAX_SAFE_INTEGER): asserts value is number {
  number(value, name, min, max);
  check(Number.isSafeInteger(value), `${name} must be an integer.`);
}

export function boolean(value: unknown, name: string): asserts value is boolean {
  check(typeof value === 'boolean', `${name} must be a boolean.`);
}

export function array(value: unknown, name: string): asserts value is unknown[] {
  check(Array.isArray(value), `${name} must be an array.`);
}

export function choice(value: unknown, choices: readonly string[], name: string): asserts value is string {
  check(typeof value === 'string' && choices.includes(value), `${name} is unknown.`);
}

export function own(value: RecordValue, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function storageMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'QuotaExceededError') return 'Browser storage is full.';
  if (error instanceof Error && error.name === 'SecurityError') return 'Browser storage access is blocked.';
  return error instanceof Error ? error.message : 'Storage operation failed.';
}
