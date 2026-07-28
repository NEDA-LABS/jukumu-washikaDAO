import type { PoolClient } from 'pg';

export const PROPOSAL_TYPES = ['general', 'ask', 'spend', 'prodcast'] as const;
export type ProposalType = (typeof PROPOSAL_TYPES)[number];

export const VOTE_CHOICES = ['yes', 'no', 'abstain'] as const;
export type VoteChoice = (typeof VOTE_CHOICES)[number];

/** Columns every proposal response is built from, with tallies joined in. */
export const PROPOSAL_SELECT = `
  SELECT p.id, p.group_id, p.title, p.description, p.status,
         p.proposal_type, p.metadata, p.funded_at,
         p.payment_amount_tzs, p.payment_status, p.recipient_member_id,
         p.recipient_phone, p.executed_at, p.created_at, p.updated_at,
         p.created_by_member_id,
         m.full_name AS created_by_name,
         rm.full_name AS recipient_name,
         g.name AS group_name,
         g.voting_threshold_numerator   AS vt_num,
         g.voting_threshold_denominator AS vt_den,
         (SELECT COUNT(*)::int FROM group_members gm
           WHERE gm.group_id = p.group_id AND gm.status = 'active') AS eligible_voters,
         COALESCE(v.yes, 0)::int     AS yes_votes,
         COALESCE(v.no, 0)::int      AS no_votes,
         COALESCE(v.abstain, 0)::int AS abstain_votes,
         COALESCE(v.total, 0)::int   AS total_votes
    FROM group_proposals p
    LEFT JOIN members m  ON m.id  = p.created_by_member_id
    LEFT JOIN members rm ON rm.id = p.recipient_member_id
    LEFT JOIN groups  g  ON g.id  = p.group_id
    LEFT JOIN (
      SELECT proposal_id,
             COUNT(*) FILTER (WHERE vote = 'yes')::int     AS yes,
             COUNT(*) FILTER (WHERE vote = 'no')::int      AS no,
             COUNT(*) FILTER (WHERE vote = 'abstain')::int AS abstain,
             COUNT(*)::int                                 AS total
        FROM group_proposal_votes GROUP BY proposal_id
    ) v ON v.proposal_id = p.id
`;

/**
 * How many "yes" votes this group needs, from its own threshold fraction
 * (e.g. 3/5 of active members). Always at least one.
 */
export function requiredYes(row: Record<string, unknown>): number {
  const num = Number(row.vt_num ?? 3);
  const den = Number(row.vt_den ?? 5);
  const eligible = Number(row.eligible_voters ?? 0);
  if (!eligible || !den) return 1;
  return Math.max(1, Math.ceil((eligible * num) / den));
}

/** Vote state for a proposal row, including whether it has passed. */
export function voteSummary(row: Record<string, unknown>) {
  const need = requiredYes(row);
  const yes = Number(row.yes_votes ?? 0);
  return {
    yes,
    no: Number(row.no_votes ?? 0),
    abstain: Number(row.abstain_votes ?? 0),
    total: Number(row.total_votes ?? 0),
    eligible_voters: Number(row.eligible_voters ?? 0),
    required_yes: need,
    threshold: `${Number(row.vt_num ?? 3)}/${Number(row.vt_den ?? 5)}`,
    passed: yes >= need,
  };
}

/** The voting-schema healer, shared by every proposal endpoint. */
export async function ensureVotesTable(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS group_proposal_votes (
      id SERIAL PRIMARY KEY,
      proposal_id INTEGER NOT NULL REFERENCES group_proposals(id) ON DELETE CASCADE,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      vote VARCHAR(20) NOT NULL CHECK (vote IN ('yes', 'no', 'abstain')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (proposal_id, member_id)
    )
  `);
}
