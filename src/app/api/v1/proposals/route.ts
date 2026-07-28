import pool from '@/lib/db';
import { handle, ok, pageMeta } from '@/lib/api/http';
import { serializeProposal } from '@/lib/api/serialize';
import { PROPOSAL_SELECT, voteSummary, PROPOSAL_TYPES } from '@/lib/api/proposals';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/proposals
 * Every proposal across every group — the cross-group feed you want for a
 * governance dashboard. Filter by ?group_id= &status= &type= &passed=
 */
export const GET = handle('read', async (_req, { limit, offset, searchParams }) => {
  const groupId = searchParams.get('group_id');
  const status = searchParams.get('status');
  const type = searchParams.get('type');
  const fundedOnly = searchParams.get('funded') === 'true';

  const where: string[] = [];
  const params: unknown[] = [];

  if (groupId && Number.isFinite(Number(groupId))) {
    params.push(Number(groupId));
    where.push(`p.group_id = $${params.length}`);
  }
  if (status === 'open' || status === 'closed') {
    params.push(status);
    where.push(`p.status = $${params.length}`);
  }
  if (type && (PROPOSAL_TYPES as readonly string[]).includes(type)) {
    params.push(type);
    where.push(`p.proposal_type = $${params.length}`);
  }
  if (fundedOnly) where.push(`p.funded_at IS NOT NULL`);

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const client = await pool.connect();
  try {
    const total = await client.query(
      `SELECT COUNT(*)::int AS n FROM group_proposals p ${clause}`, params,
    );
    const res = await client.query(
      `${PROPOSAL_SELECT} ${clause} ORDER BY p.created_at DESC, p.id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );

    return ok(
      res.rows.map((r) => ({
        ...serializeProposal(r),
        group_name: (r as { group_name?: string }).group_name ?? null,
        votes: voteSummary(r),
      })),
      pageMeta((total.rows[0] as { n: number }).n, limit, offset),
    );
  } finally {
    client.release();
  }
});
