import crypto from 'crypto';
import type { PoolClient } from 'pg';
import pool from '@/lib/db';
import { oncePerProcess } from '@/lib/db-once';

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
  });
}

/** Resolve a raw bearer token to a live key record, or null. */
export async function verifyKey(raw: string): Promise<ApiKeyRecord | null> {
  if (!raw || !raw.startsWith(KEY_PREFIX)) return null;

  const client = await pool.connect();
  try {
    await ensureApiKeysSchema(client);
    const res = await client.query(
      `SELECT id, name, owner_user_id, scopes, rate_limit_per_min, revoked_at, last_used_at
         FROM api_keys
        WHERE key_hash = $1 AND revoked_at IS NULL
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
