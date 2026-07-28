import pool from '@/lib/db';
import { oncePerProcess } from '@/lib/db-once';

/**
 * Partner registry.
 *
 * A WashikaDAU login is not the same thing as a partner. Before anyone can
 * mint API keys they register an organisation and state what they are
 * building — so every key on the platform traces back to a named party with
 * a stated purpose.
 *
 * Scope policy:
 *   read  — self-serve, granted on registration.
 *   write — moves real money, so it stays gated behind manual review.
 *
 * Partners are also the tenant boundary. Every group and member carries a
 * `partner_id`; a partner's API key only ever sees rows stamped with its own
 * id. Rows created through WashikaDAU's own app have `partner_id IS NULL`
 * (first-party data) and are invisible to every partner.
 */
export type PartnerStatus = 'active' | 'suspended';

export interface Partner {
  id: number;
  user_id: number;
  org_name: string;
  contact_email: string;
  website: string | null;
  use_case: string;
  status: PartnerStatus;
  write_enabled: boolean;
  write_requested: boolean;
  /** Internal WashikaDAU keys: bypass tenant scoping and read everything. */
  is_first_party: boolean;
  created_at: string;
}

export function ensurePartnersSchema() {
  return oncePerProcess('api-partners-schema', async () => {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS api_partners (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          org_name VARCHAR(160) NOT NULL,
          contact_email VARCHAR(200) NOT NULL,
          website VARCHAR(300),
          use_case TEXT NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          write_enabled BOOLEAN NOT NULL DEFAULT false,
          write_requested BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_api_partners_user ON api_partners(user_id)`);
      await client.query(
        `ALTER TABLE api_partners ADD COLUMN IF NOT EXISTS is_first_party BOOLEAN NOT NULL DEFAULT false`,
      );

      // The tenant boundary. Nullable on purpose: existing rows — everything
      // created through our own app — stay NULL and are never visible to a
      // partner key. ON DELETE SET NULL so removing a partner orphans their
      // records to first-party rather than destroying real groups and people.
      for (const table of ['groups', 'members']) {
        await client.query(
          `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS partner_id INTEGER
             REFERENCES api_partners(id) ON DELETE SET NULL`,
        );
        await client.query(
          `CREATE INDEX IF NOT EXISTS idx_${table}_partner ON ${table}(partner_id)`,
        );
      }
    } finally {
      client.release();
    }
  });
}

export async function getPartner(userId: number): Promise<Partner | null> {
  await ensurePartnersSchema();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT id, user_id, org_name, contact_email, website, use_case,
              status, write_enabled, write_requested, is_first_party, created_at
         FROM api_partners WHERE user_id = $1 LIMIT 1`,
      [userId],
    );
    return (res.rows[0] as Partner) ?? null;
  } finally {
    client.release();
  }
}
