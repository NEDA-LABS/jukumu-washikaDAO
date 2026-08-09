import pool from '@/lib/db';
import type { PoolClient } from 'pg';
import { oncePerProcess } from '@/lib/db-once';

/**
 * Funding that arrives from outside the platform.
 *
 * A funder holding nTZS in any wallet — on any platform — can send it on-chain
 * to the WashikaDAU treasury address and have it land in a group's balance.
 * The chain movement happens entirely outside this application, so all we can
 * record when they submit is a *claim*: "I sent X from address Y".
 *
 * That claim never credits anything on its own. Anyone can type an address and
 * an amount, and crediting on an unverified assertion would let a stranger mint
 * group balance out of nothing. A claim starts `pending` and only becomes money
 * when the arrival is confirmed against the treasury.
 */

/** The one on-chain wallet every external transfer is sent to. */
export async function getTreasuryAddress(client: PoolClient): Promise<string | null> {
  const res = await client.query(
    `SELECT ntzs_wallet_address FROM wallet_accounts
      WHERE owner_type = 'master' AND owner_id = 0 LIMIT 1`
  );
  return (res.rows[0] as { ntzs_wallet_address: string | null } | undefined)?.ntzs_wallet_address ?? null;
}

export function ensureExternalFundingSchema() {
  return oncePerProcess('external-funding-schema', async () => {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS external_funding_claims (
          id             SERIAL PRIMARY KEY,
          group_id       INTEGER NOT NULL REFERENCES groups(id),
          proposal_id    INTEGER REFERENCES group_proposals(id),
          claimed_by_user_id INTEGER NOT NULL REFERENCES users(id),
          -- Self-declared and unverified, so it is only a hint for whoever
          -- reconciles the claim. Optional on purpose: the hash below is the
          -- identifier that actually matters.
          from_address   VARCHAR(120),
          amount_tzs     BIGINT NOT NULL CHECK (amount_tzs > 0),
          tx_hash        VARCHAR(120) NOT NULL,
          status         VARCHAR(20) NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'confirmed', 'rejected')),
          note           TEXT,
          reviewed_by_user_id INTEGER REFERENCES users(id),
          reviewed_at    TIMESTAMPTZ,
          review_reason  TEXT,
          created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      // The first cut of this table had it the other way round: the address
      // required and the hash optional. CREATE TABLE IF NOT EXISTS leaves an
      // existing table alone, so the swap has to be stated explicitly.
      await client.query(`ALTER TABLE external_funding_claims ALTER COLUMN from_address DROP NOT NULL`);
      await client.query(`
        DO $$
        BEGIN
          -- Only enforceable if nothing already recorded lacks a hash.
          IF NOT EXISTS (SELECT 1 FROM external_funding_claims WHERE tx_hash IS NULL) THEN
            ALTER TABLE external_funding_claims ALTER COLUMN tx_hash SET NOT NULL;
          END IF;
        END $$;
      `);

      // One confirmed claim per transaction hash. Without this, re-submitting
      // the same transfer after a confirmation would credit the group twice.
      // This is the whole reason the hash is mandatory: a claim identified
      // only by a sender address and an amount has nothing to deduplicate on.
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS external_funding_claims_txhash_confirmed
          ON external_funding_claims (lower(tx_hash))
          WHERE tx_hash IS NOT NULL AND status = 'confirmed'
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS external_funding_claims_pending
          ON external_funding_claims (status, created_at DESC)
      `);
    } finally {
      client.release();
    }
  });
}

/**
 * A rough shape check on an EVM address. Deliberately not a checksum
 * validation: the point is to catch a pasted phone number or a truncated
 * copy, not to decide whether the address is real. Confirmation does that.
 */
export function looksLikeWalletAddress(input: unknown): boolean {
  return typeof input === 'string' && /^0x[a-fA-F0-9]{40}$/.test(input.trim());
}

export function normalizeTxHash(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const v = input.trim();
  if (!v) return null;
  return /^0x[a-fA-F0-9]{64}$/.test(v) ? v.toLowerCase() : null;
}
