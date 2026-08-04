import pool from '@/lib/db';
import { oncePerProcess } from '@/lib/db-once';

/**
 * Columns added to `groups` after the original migration.
 *
 * These are created lazily on request, so any route that READS one has to be
 * able to guarantee it exists first — otherwise a fresh environment throws
 * "column does not exist" on whichever endpoint happens to run before the one
 * that creates it. Memoized per process, so it costs one round trip per boot
 * rather than one per request.
 */
export function ensureGroupContactColumns() {
  return oncePerProcess('groups-contact-columns', async () => {
    const client = await pool.connect();
    try {
      await client.query(`ALTER TABLE groups ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(32)`);
      await client.query(`ALTER TABLE groups ADD COLUMN IF NOT EXISTS contact_email VARCHAR(200)`);
    } finally {
      client.release();
    }
  });
}
