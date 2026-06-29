/**
 * Withdrawal/off-ramp fee, charged ON TOP of the amount: the user is debited
 * `amount + fee` and the recipient receives the full `amount`. The fee stays in
 * the platform reserve (master wallet surplus) instead of depleting it.
 *
 * Configurable so it can track the payment provider's commercials without a code
 * change — set on the deploy environment:
 *   WITHDRAWAL_FEE_PERCENT   e.g. "1.5"  → 1.5% of the amount
 *   WITHDRAWAL_FEE_FLAT_TZS  e.g. "100"  → flat 100 TZS per withdrawal
 * Both default to 0 (no fee) until configured. The result is rounded up to whole
 * TZS so the reserve is never under-charged.
 */
export function withdrawalFeeTzs(amountTzs: number): number {
  const amount = Math.max(0, Math.round(Number(amountTzs) || 0));
  if (amount <= 0) return 0;
  const pctRaw = Number(process.env.WITHDRAWAL_FEE_PERCENT);
  const flatRaw = Number(process.env.WITHDRAWAL_FEE_FLAT_TZS);
  const pct = Number.isFinite(pctRaw) && pctRaw > 0 ? pctRaw : 0;
  const flat = Number.isFinite(flatRaw) && flatRaw > 0 ? flatRaw : 0;
  return Math.ceil((amount * pct) / 100) + Math.round(flat);
}
