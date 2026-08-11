import pool from '@/lib/db';
import { oncePerProcess } from '@/lib/db-once';

/**
 * Public support for WashikaDAU itself.
 *
 * Distinct from every other flow in the platform: a donation is not held on
 * anyone's behalf, so it creates no member or group balance and no liability.
 * It arrives by mobile money into the treasury and is recorded here, and the
 * donations table — not the ledger — is the source of truth for the total the
 * landing page shows.
 *
 * Donors are not accounts. Someone can give without signing up, so all we keep
 * is the name they chose to be thanked by and the number that paid.
 */

export function ensureDonationsSchema() {
  return oncePerProcess('donations-schema', async () => {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS donations (
          id             SERIAL PRIMARY KEY,
          donor_name     VARCHAR(160) NOT NULL,
          phone          VARCHAR(32) NOT NULL,
          amount_tzs     BIGINT NOT NULL CHECK (amount_tzs > 0),
          ntzs_id        VARCHAR(120),
          status         VARCHAR(24) NOT NULL DEFAULT 'pending',
          -- The public handle for the certificate. Unguessable, because the
          -- certificate page carries a donor's name and is not behind a login.
          certificate_code VARCHAR(24) NOT NULL UNIQUE,
          message        TEXT,
          created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          settled_at     TIMESTAMPTZ
        )
      `);
      // Crypto gifts arrive on chain, outside this application, so they carry
      // a hash instead of an nTZS deposit id and wait on a human check.
      await client.query(`ALTER TABLE donations ADD COLUMN IF NOT EXISTS method VARCHAR(12) NOT NULL DEFAULT 'mobile'`);
      await client.query(`ALTER TABLE donations ADD COLUMN IF NOT EXISTS token VARCHAR(8)`);
      // What they actually sent. amount_tzs holds its shilling value so one
      // total can span assets, but a certificate must say "25 USDC", not the
      // converted figure — that is what the donor gave.
      await client.query(`ALTER TABLE donations ADD COLUMN IF NOT EXISTS token_amount NUMERIC(20,6)`);
      await client.query(`ALTER TABLE donations ADD COLUMN IF NOT EXISTS tx_hash VARCHAR(120)`);
      await client.query(`ALTER TABLE donations ADD COLUMN IF NOT EXISTS from_address VARCHAR(120)`);
      await client.query(`ALTER TABLE donations ADD COLUMN IF NOT EXISTS reviewed_by_user_id INTEGER`);
      await client.query(`ALTER TABLE donations ADD COLUMN IF NOT EXISTS review_reason TEXT`);
      // A mobile donation has a number; a crypto one does not.
      await client.query(`ALTER TABLE donations ALTER COLUMN phone DROP NOT NULL`);
      // One confirmed donation per on-chain transaction.
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS donations_txhash_confirmed
          ON donations (lower(tx_hash))
          WHERE tx_hash IS NOT NULL AND status = 'completed'
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS donations_status ON donations (status, created_at DESC)`);
      await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS donations_ntzs_id ON donations (ntzs_id) WHERE ntzs_id IS NOT NULL`);
    } finally {
      client.release();
    }
  });
}

/**
 * A certificate code. Ambiguous characters are left out so it survives being
 * read aloud or copied off a screen.
 */
export function newCertificateCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 10; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `WD-${out.slice(0, 5)}-${out.slice(5)}`;
}

/** Tanzanian mobile numbers, normalised to 255XXXXXXXXX. */
export function normalizeDonorPhone(input: string): string {
  const digits = String(input || '').replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return `255${digits.slice(1)}`;
  if (digits.length === 9) return `255${digits}`;
  return digits;
}

export function isValidDonorPhone(normalized: string): boolean {
  return /^255[67]\d{8}$/.test(normalized);
}

export const DONATION_TOKENS = ['ntzs', 'usdc', 'usdt'] as const;
export type DonationToken = (typeof DONATION_TOKENS)[number];

/** Rough TZS value of a stablecoin unit, for the running total only. */
const USD_TZS = 2650;

/**
 * A gift's value in shillings, so one total can hold every asset.
 *
 * nTZS is 1:1 with the shilling by construction. USDC and USDT are converted
 * at a fixed rate — deliberately a constant rather than a live feed, because
 * the number on the landing page is a thank-you, not an accounting figure,
 * and it should not move because a rate moved.
 */
export function toTzs(amount: number, token: DonationToken | null): number {
  if (token === 'usdc' || token === 'usdt') return Math.round(amount * USD_TZS);
  return Math.round(amount);
}

export function normalizeTxHash(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const v = input.trim();
  return /^0x[a-fA-F0-9]{64}$/.test(v) ? v.toLowerCase() : null;
}

export function looksLikeWalletAddress(input: unknown): boolean {
  return typeof input === 'string' && /^0x[a-fA-F0-9]{40}$/.test(input.trim());
}

export interface DonationTotals {
  totalTzs: number;
  supporters: number;
}

export async function getDonationTotals(): Promise<DonationTotals> {
  await ensureDonationsSchema();
  const res = await pool.query(
    `SELECT COALESCE(SUM(amount_tzs), 0)::bigint AS total, COUNT(*)::int AS n
       FROM donations WHERE status = 'completed'`
  );
  const row = res.rows[0] as { total: string; n: number };
  return { totalTzs: Number(row.total), supporters: row.n };
}
