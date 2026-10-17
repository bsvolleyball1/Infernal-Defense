import type { WriteResult } from '../services/storage';

/** Report a failed storage write once, in one place. Returns whether the write succeeded. */
export function reportWrite(result: WriteResult, show: (message: string) => void): boolean {
  if (!result.ok) show(result.message);
  return result.ok;
}
