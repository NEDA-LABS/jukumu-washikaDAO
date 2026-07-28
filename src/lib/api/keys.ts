import crypto from 'crypto';
import type { PoolClient } from 'pg';
import pool from '@/lib/db';
import { oncePerProcess } from '@/lib/db-once';
import { ensurePartnersSchema } from './partners';

/**
 * API key storage and verification for the public /api/v1 surface.
 *
 * Keys look like `wd_live_<32 random base62 chars>` and are shown to the
 * caller exactly once, at creation. Only a SHA-256 hash is persisted, so a
 * database leak does not hand over working credentials. Lookup is by the
 * hash (indexed), never by scanning + comparing plaintext.
 */

export type ApiScope = 'read' | 'write';

export interface ApiKeyRecord {
  id: number;
  name: string;
  owner_user_id: number | null;
  scopes: ApiScope[];
  rate_limit_per_min: number;
  revoked_at: string | null;
  last_used_at: string | null;
  /** Tenant this key reads and writes as. Null if the owner never registered. */
  partner_id: number | null;
  partner_status: string | null;
  /** Internal key: sees the whole platform instead of one tenant's slice. */
  is_first_party: boolean;
}

const KEY_PREFIX = 'wd_live_';

export function hashKey(raw: string): string {
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

export function generateKey(): { raw: string; hash: string; hint: string } {
  // 24 random bytes -> 32 base64url chars, minus padding ambiguity.
  const raw = KEY_PREFIX + crypto.randomBytes(24).toString('base64url');
  return { raw, hash: hashKey(raw), hint: raw.slice(-4) };
}

export async function ensureApiKeysSchema(client: PoolClient): Promise<void> {
  return oncePerProcess('api-keys-schema', async () => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id SERIAL PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        key_hash CHAR(64) NOT NULL UNIQUE,
        key_hint VARCHAR(8) NOT NULL,
        owner_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        scopes TEXT[] NOT NULL DEFAULT ARRAY['read']::TEXT[],
        rate_limit_per_min INTEGER NOT NULL DEFAULT 120,
        last_used_at TIMESTAMP,
        revoked_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_api_keys_owner ON api_keys(owner_user_id)`);

    // Daily per-key, per-endpoint counters. One upserted row per key/day/route
    // rather than a row per request, so usage reporting never becomes the
    // heaviest write on the platform.
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_key_usage (
        key_id INTEGER NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
        day DATE NOT NULL,
        endpoint VARCHAR(120) NOT NULL,
        requests INTEGER NOT NULL DEFAULT 0,
        errors INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (key_id, day, endpoint)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_api_usage_key_day ON api_key_usage(key_id, day DESC)`);
  });
}

/**
 * Increment the daily counter for a key/endpoint. Fire-and-forget: usage
 * accounting must never delay or fail a real API response.
 */
export function recordUsage(keyId: number, endpoint: string, isError: boolean): void {
  pool
    .connect()
    .then(async (c) => {
      try {
        await c.query(
          `INSERT INTO api_key_usage (key_id, day, endpoint, requests, errors)
           VALUES ($1, CURRENT_DATE, $2, 1, $3)
           ON CONFLICT (key_id, day, endpoint)
           DO UPDATE SET requests = api_key_usage.requests + 1,
                         errors   = api_key_usage.errors + $3`,
          [keyId, endpoint.slice(0, 120), isError ? 1 : 0],
        );
      } finally {
        c.release();
      }
    })
    .catch(() => {});
}

/** Resolve a raw bearer token to a live key record, or null. */
export async function verifyKey(raw: string): Promise<ApiKeyRecord | null> {
  if (!raw || !raw.startsWith(KEY_PREFIX)) return null;

  const client = await pool.connect();
  try {
    await ensureApiKeysSchema(client);
    // The join below needs api_partners (and its partner_id columns) present.
    await ensurePartnersSchema();
    // Join the owning partner in the same round trip — every request needs the
    // tenant id to scope its queries, so fetching it separately would double
    // the auth cost on a database that is not local.
    const res = await client.query(
      `SELECT k.id, k.name, k.owner_user_id, k.scopes, k.rate_limit_per_min,
              k.revoked_at, k.last_used_at,
              p.id AS partner_id, p.status AS partner_status,
              COALESCE(p.is_first_party, false) AS is_first_party
         FROM api_keys k
         LEFT JOIN api_partners p ON p.user_id = k.owner_user_id
        WHERE k.key_hash = $1 AND k.revoked_at IS NULL
        LIMIT 1`,
      [hashKey(raw)],
    );
    if (res.rows.length === 0) return null;

    const row = res.rows[0] as ApiKeyRecord;
    // Best-effort usage stamp; never block the request on it.
    client
      .query(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, [row.id])
      .catch(() => {});
    return row;
  } catch {
    return null;
  } finally {
    client.release();
  }
}
