/** Display gold as whole coins without changing the saved balance or purchase checks. */
export function formatGold(value: number): string {
  return String(Math.ceil(value));
}
