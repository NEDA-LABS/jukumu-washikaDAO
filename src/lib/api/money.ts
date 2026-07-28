/**
 * Shared money helpers for the public API's write endpoints.
 *
 * These deliberately reuse the same ledger primitives as the first-party
 * dashboard rather than reimplementing balance maths, so an API-initiated
 * payment and an in-app payment settle through exactly one code path.
 */

export function normalizePhone(input: unknown): string | null {
  const digits = String(input ?? '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10 && digits.startsWith('0')) return `255${digits.slice(1)}`;
  if (digits.length === 9) return `255${digits}`;
  if (digits.startsWith('255') && digits.length === 12) return digits;
  return null;
}

/** Positive whole TZS, or null when the input is not usable. */
export function amountTzs(input: unknown, min = 100): number | null {
  const n = Math.round(Number(input));
  if (!Number.isFinite(n) || n < min) return null;
  return n;
}

export const IDEMPOTENCY_HEADER = 'idempotency-key';
