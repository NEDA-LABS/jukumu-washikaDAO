import pool from '@/lib/db';
import { reconcileLedger } from '@/lib/reconcile';
import { oncePerProcess } from '@/lib/db-once';

/**
 * Settlement that rides ordinary traffic, so it does not depend on a cron.
 *
 * The scheduled sweep is the right mechanism and it has not been running. The
 * cost was not theoretical: bank donations sat unsettled until an admin opened
 * a screen, receipts went unsent, and two members were left 350,000 short on
 * withdrawals nTZS had already reversed. Every one of those was a job that
 * only ever ran on a timer nobody was watching.
 *
 * So a small amount of the work is attached to requests the site already
 * serves. Nobody waits for it — it is started and abandoned, and the response
 * goes out regardless.
 *
 * Two things keep it from becoming a burden:
 *
 * A Postgres advisory lock, so only one instance sweeps at a time no matter
 * how many serverless workers are awake. It is tried, never waited on: a
 * request that cannot get the lock simply does not sweep.
 *
 * A timestamp in the database rather than in memory, so throttling holds
 * across instances that each start with an empty heap. A process-local
 * variable would let every cold start sweep again.
 */

/** Arbitrary but fixed: two different jobs must not choose the same number. */
const LOCK_KEY = 4_827_301;

/** How often the platform as a whole may sweep, regardless of traffic. */
const MIN_INTERVAL_MS = 120_000;

/** Kept small — this runs beside a real request, not instead of one. */
const TICK_LIMIT = 25;
const TICK_BUDGET_MS = 8_000;

/** Wrapped in a function: oncePerProcess starts the work when called, and a
 *  bare const would run a migration at import time on every cold start. */
function ensureSchema() {
  return oncePerProcess('settle_tick_schema', async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settle_ticks (
        id          INT PRIMARY KEY DEFAULT 1,
        last_run_at TIMESTAMPTZ NOT NULL DEFAULT to_timestamp(0),
        last_result JSONB,
        CONSTRAINT settle_ticks_single_row CHECK (id = 1)
      )
    `);
    await pool.query(`INSERT INTO settle_ticks (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
  });
}

/** Cheap in-process guard so a burst of requests does not all hit the database. */
let lastLocalAttempt = 0;

async function sweep(): Promise<void> {
  const client = await pool.connect();
  try {
    const lock = await client.query(`SELECT pg_try_advisory_lock($1) AS got`, [LOCK_KEY]);
    if (!(lock.rows[0] as { got: boolean }).got) return;

    try {
      // Claim the slot and check it in one statement: two instances that both
      // hold nothing cannot both decide it is their turn.
      const due = await client.query(
        `UPDATE settle_ticks
            SET last_run_at = NOW()
          WHERE id = 1 AND last_run_at < NOW() - ($1::int * INTERVAL '1 millisecond')
        RETURNING id`,
        [MIN_INTERVAL_MS]
      );
      if (due.rowCount === 0) return;

      const result = await reconcileLedger({ limit: TICK_LIMIT, budgetMs: TICK_BUDGET_MS });
      if (result.corrected > 0 || result.receiptsSent > 0) {
        console.log('[settle-tick]', JSON.stringify(result));
      }
      await client.query(
        `UPDATE settle_ticks SET last_result = $1 WHERE id = 1`,
        [JSON.stringify({ ...result, changes: result.changes.slice(0, 5), at: new Date().toISOString() })]
      );
    } finally {
      await client.query(`SELECT pg_advisory_unlock($1)`, [LOCK_KEY]).catch(() => {});
    }
  } catch (error) {
    console.error('[settle-tick]', error);
  } finally {
    client.release();
  }
}

/**
 * Start a sweep if one is due. Returns immediately — the caller is serving a
 * request and must not wait for settlement to finish.
 */
export function scheduleSettleTick(): void {
  const now = Date.now();
  if (now - lastLocalAttempt < MIN_INTERVAL_MS) return;
  lastLocalAttempt = now;

  void (async () => {
    try {
      await ensureSchema();
      await sweep();
    } catch (error) {
      // A failed sweep must never surface on the request that happened to
      // trigger it. It will be tried again by the next one.
      console.error('[settle-tick] start failed', error);
    }
  })();
}
