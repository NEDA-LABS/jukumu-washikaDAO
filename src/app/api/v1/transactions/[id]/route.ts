import pool from '@/lib/db';
import { handleWithParams, ok, fail } from '@/lib/api/http';
import { serializeTransaction } from '@/lib/api/serialize';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/transactions/{id}
 * Poll a single transaction. `{id}` accepts our numeric id or the
 * provider's external id, so you can look up a deposit by whichever
 * identifier you kept.
 */
export const GET = handleWithParams<{ id: string }>('read', async (_req, { params }) => {
  const numeric = Number.parseInt(params.id, 10);
  const byExternal = !Number.isFinite(numeric);

  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT t.*,
              fm.full_name AS from_member_name, tm.full_name AS to_member_name,
              fg.name AS from_group_name,       tg.name AS to_group_name
         FROM ntzs_transactions t
         LEFT JOIN members fm ON fm.id = t.from_member_id
         LEFT JOIN members tm ON tm.id = t.to_member_id
         LEFT JOIN groups  fg ON fg.id = t.from_group_id
         LEFT JOIN groups  tg ON tg.id = t.to_group_id
        WHERE ${byExternal ? 't.ntzs_id = $1' : 't.id = $1'}
        LIMIT 1`,
      [byExternal ? params.id : numeric],
    );
    if (res.rows.length === 0) return fail(404, 'not_found', 'No transaction with that id.');

    const row = res.rows[0];
    return ok({
      ...serializeTransaction(row),
      // `posted` is the ledger's own view: true once the money has actually
      // been applied to a balance, regardless of the provider's wording.
      settled: Boolean(row.posted),
    });
  } finally {
    client.release();
  }
});
