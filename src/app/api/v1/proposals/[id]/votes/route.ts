import pool from '@/lib/db';
import { handleWithParams, ok, fail } from '@/lib/api/http';
import { ensureVotesTable, voteSummary, VOTE_CHOICES, type VoteChoice } from '@/lib/api/proposals';
import { ownsProposal } from '@/lib/api/scope';

export const dynamic = 'force-dynamic';

const TALLY = `
  SELECT p.id, p.status,
         g.voting_threshold_numerator   AS vt_num,
         g.voting_threshold_denominator AS vt_den,
         (SELECT COUNT(*)::int FROM group_members gm
           WHERE gm.group_id = p.group_id AND gm.status = 'active') AS eligible_voters,
         COALESCE(v.yes,0)::int AS yes_votes, COALESCE(v.no,0)::int AS no_votes,
         COALESCE(v.abstain,0)::int AS abstain_votes, COALESCE(v.total,0)::int AS total_votes
    FROM group_proposals p
    LEFT JOIN groups g ON g.id = p.group_id
    LEFT JOIN (
      SELECT proposal_id,
             COUNT(*) FILTER (WHERE vote='yes')::int AS yes,
             COUNT(*) FILTER (WHERE vote='no')::int AS no,
             COUNT(*) FILTER (WHERE vote='abstain')::int AS abstain,
             COUNT(*)::int AS total
        FROM group_proposal_votes GROUP BY proposal_id
    ) v ON v.proposal_id = p.id
   WHERE p.id = $1
`;

/**
 * GET /api/v1/proposals/{id}/votes
 * Who voted and how, plus the running tally. Useful for showing a live
 * board during a group meeting.
 */
export const GET = handleWithParams<{ id: string }>('read', async (_req, { params, scope }) => {
  const id = Number.parseInt(params.id, 10);
  if (!Number.isFinite(id)) return fail(422, 'invalid_request', 'Proposal id must be numeric.');

  const client = await pool.connect();
  try {
    await ensureVotesTable(client);

    if (!(await ownsProposal(client, scope, id))) {
      return fail(404, 'not_found', 'No proposal with that id.');
    }

    const tally = await client.query(TALLY, [id]);
    if (tally.rows.length === 0) return fail(404, 'not_found', 'No proposal with that id.');

    const ballots = await client.query(
      `SELECT v.member_id, m.full_name AS member_name, v.vote, v.created_at, v.updated_at
         FROM group_proposal_votes v
         LEFT JOIN members m ON m.id = v.member_id
        WHERE v.proposal_id = $1
        ORDER BY v.updated_at DESC`,
      [id],
    );

    return ok({
      proposal_id: id,
      summary: voteSummary(tally.rows[0] as Record<string, unknown>),
      ballots: ballots.rows.map((b) => {
        const r = b as Record<string, unknown>;
        return {
          member_id: r.member_id as number,
          member_name: (r.member_name as string) ?? null,
          vote: r.vote as string,
          cast_at: new Date(r.created_at as string).toISOString(),
          updated_at: new Date(r.updated_at as string).toISOString(),
        };
      }),
    });
  } finally {
    client.release();
  }
});

/**
 * POST /api/v1/proposals/{id}/votes
 * Cast or change a vote. One ballot per member — voting again replaces the
 * previous choice rather than adding a second one.
 *
 * Body: { member_id, vote: "yes" | "no" | "abstain" }
 */
export const POST = handleWithParams<{ id: string }>('write', async (request, { params, scope }) => {
  const id = Number.parseInt(params.id, 10);
  if (!Number.isFinite(id)) return fail(422, 'invalid_request', 'Proposal id must be numeric.');

  const body = await request.json().catch(() => null);
  const memberId = Number(body?.member_id);
  const vote = body?.vote as VoteChoice;

  if (!Number.isFinite(memberId)) return fail(422, 'invalid_request', '`member_id` is required.');
  if (!VOTE_CHOICES.includes(vote)) {
    return fail(422, 'invalid_request', `\`vote\` must be one of: ${VOTE_CHOICES.join(', ')}.`);
  }

  const client = await pool.connect();
  try {
    await ensureVotesTable(client);

    if (!(await ownsProposal(client, scope, id))) {
      return fail(404, 'not_found', 'No proposal with that id.');
    }

    const prop = await client.query(
      `SELECT id, group_id, status FROM group_proposals WHERE id = $1 LIMIT 1`, [id],
    );
    if (prop.rows.length === 0) return fail(404, 'not_found', 'No proposal with that id.');
    const p = prop.rows[0] as { group_id: number; status: string };

    if (p.status !== 'open') {
      return fail(409, 'voting_closed', 'Voting on this proposal is closed.');
    }

    // Only active members of the owning group may vote.
    const membership = await client.query(
      `SELECT 1 FROM group_members
        WHERE group_id = $1 AND member_id = $2 AND status = 'active' LIMIT 1`,
      [p.group_id, memberId],
    );
    if (membership.rows.length === 0) {
      return fail(403, 'not_eligible', 'That member is not an active member of this proposal’s group.');
    }

    await client.query(
      `INSERT INTO group_proposal_votes (proposal_id, member_id, vote)
       VALUES ($1, $2, $3)
       ON CONFLICT (proposal_id, member_id)
       DO UPDATE SET vote = EXCLUDED.vote, updated_at = CURRENT_TIMESTAMP`,
      [id, memberId, vote],
    );

    const tally = await client.query(TALLY, [id]);
    return ok({
      proposal_id: id,
      member_id: memberId,
      vote,
      summary: voteSummary(tally.rows[0] as Record<string, unknown>),
    }, undefined, { status: 201 });
  } finally {
    client.release();
  }
});
