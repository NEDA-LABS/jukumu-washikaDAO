import pool from '@/lib/db';
import { handleWithParams, ok, fail, pageMeta } from '@/lib/api/http';
import { serializeProposal } from '@/lib/api/serialize';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/groups/{id}/proposals
 * Governance proposals for a group, with live vote tallies.
 *
 * Query: status=open|closed, type=general|ask|spend|prodcast, limit, offset
 */
export const GET = handleWithParams<{ id: string }>('read', async (_req, { params, limit, offset, searchParams }) => {
  const groupId = Number.parseInt(params.id, 10);
  if (!Number.isFinite(groupId)) return fail(422, 'invalid_request', 'Group id must be numeric.');

  const status = searchParams.get('status');
  const type = searchParams.get('type');

  const where = ['p.group_id = $1'];
  const values: unknown[] = [groupId];
  if (status) { values.push(status); where.push(`p.status = $${values.length}`); }
  if (type) { values.push(type); where.push(`p.proposal_type = $${values.length}`); }
  const clause = `WHERE ${where.join(' AND ')}`;

  const client = await pool.connect();
  try {
    const exists = await client.query(`SELECT 1 FROM groups WHERE id = $1`, [groupId]);
    if (exists.rows.length === 0) return fail(404, 'not_found', 'No group with that id.');

    const countRes = await client.query(
      `SELECT COUNT(*)::int AS n FROM group_proposals p ${clause}`, values,
    );
    const total = (countRes.rows[0] as { n: number }).n;

    const rows = await client.query(
      `SELECT p.*, m.full_name AS created_by_name,
              COALESCE(v.yes, 0)     AS yes_votes,
              COALESCE(v.no, 0)      AS no_votes,
              COALESCE(v.abstain, 0) AS abstain_votes,
              COALESCE(v.total, 0)   AS total_votes
         FROM group_proposals p
         LEFT JOIN members m ON m.id = p.created_by_member_id
         LEFT JOIN (
           SELECT proposal_id,
                  COUNT(*) FILTER (WHERE vote = 'yes')::int     AS yes,
                  COUNT(*) FILTER (WHERE vote = 'no')::int      AS no,
                  COUNT(*) FILTER (WHERE vote = 'abstain')::int AS abstain,
                  COUNT(*)::int                                  AS total
             FROM group_proposal_votes GROUP BY proposal_id
         ) v ON v.proposal_id = p.id
         ${clause}
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    );

    return ok(rows.rows.map(serializeProposal), pageMeta(total, limit, offset));
  } finally {
    client.release();
  }
});
