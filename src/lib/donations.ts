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
