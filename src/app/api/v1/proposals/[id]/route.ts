import pool from '@/lib/db';
import { handleWithParams, ok, fail } from '@/lib/api/http';
import { serializeProposal } from '@/lib/api/serialize';
import { PROPOSAL_SELECT, voteSummary } from '@/lib/api/proposals';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/proposals/{id}
 * One proposal in full: description, type-specific metadata, payment state
 * and the complete vote breakdown including whether it has passed.
 */
export const GET = handleWithParams<{ id: string }>('read', async (_req, { params }) => {
  const id = Number.parseInt(params.id, 10);
  if (!Number.isFinite(id)) return fail(422, 'invalid_request', 'Proposal id must be numeric.');

  const client = await pool.connect();
  try {
    const res = await client.query(`${PROPOSAL_SELECT} WHERE p.id = $1 LIMIT 1`, [id]);
    if (res.rows.length === 0) return fail(404, 'not_found', 'No proposal with that id.');

    const row = res.rows[0] as Record<string, unknown>;
    return ok({
      ...serializeProposal(row),
      group_name: (row.group_name as string) ?? null,
      recipient_name: (row.recipient_name as string) ?? null,
      votes: voteSummary(row),
      funded_at: row.funded_at ? new Date(row.funded_at as string).toISOString() : null,
    });
  } finally {
    client.release();
  }
});

/**
 * PATCH /api/v1/proposals/{id}
 * Close voting or reopen it. Reopening is refused once a payment has
 * completed, since the outcome has already been acted on.
 *
 * Body: { status: "open" | "closed" }
 */
export const PATCH = handleWithParams<{ id: string }>('write', async (request, { params }) => {
  const id = Number.parseInt(params.id, 10);
  if (!Number.isFinite(id)) return fail(422, 'invalid_request', 'Proposal id must be numeric.');

  const body = await request.json().catch(() => null);
  const status = body?.status;
  if (status !== 'open' && status !== 'closed') {
    return fail(422, 'invalid_request', '`status` must be "open" or "closed".');
  }

  const client = await pool.connect();
  try {
    const current = await client.query(
      `SELECT id, status, payment_status FROM group_proposals WHERE id = $1 LIMIT 1`, [id],
    );
    if (current.rows.length === 0) return fail(404, 'not_found', 'No proposal with that id.');

    const row = current.rows[0] as { payment_status: string | null };
    if (status === 'open' && row.payment_status === 'completed') {
      return fail(409, 'already_executed', 'This proposal has already been paid out and cannot be reopened.');
    }

    await client.query(
      `UPDATE group_proposals SET status = $1, updated_at = NOW() WHERE id = $2`, [status, id],
    );

    const res = await client.query(`${PROPOSAL_SELECT} WHERE p.id = $1`, [id]);
    const updated = res.rows[0] as Record<string, unknown>;
    return ok({ ...serializeProposal(updated), votes: voteSummary(updated) });
  } finally {
    client.release();
  }
});
