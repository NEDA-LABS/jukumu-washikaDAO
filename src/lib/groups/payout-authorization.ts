import type { PoolClient } from 'pg';

/**
 * Group money only leaves on a passed vote.
 *
 * Leadership is who *executes* a payout, not who *authorizes* one — a chairman
 * or treasurer acting alone is exactly the failure this platform exists to
 * prevent. Every path that moves money out of a group treasury runs this check
 * against the proposal the members actually voted on.
 *
 * The proposal row is locked FOR UPDATE, so two leaders pressing pay at the
 * same moment cannot both pass: the second waits, then sees the payment_status
 * the first one wrote.
 */

export class PayoutAuthorizationError extends Error {
  status: number;
  details?: string;

  constructor(status: number, message: string, details?: string) {
    super(message);
    this.name = 'PayoutAuthorizationError';
    this.status = status;
    this.details = details;
  }
}

export interface AuthorizedPayout {
  proposalId: number;
  amountTzs: number;
  recipientMemberId: number | null;
  recipientPhone: string | null;
  title: string;
}

interface ProposalRow {
  id: number;
  group_id: number;
  title: string;
  proposal_type: string;
  payment_amount_tzs: string | number | null;
  recipient_member_id: number | null;
  recipient_phone: string | null;
  payment_status: string | null;
  voting_threshold_numerator: number;
  voting_threshold_denominator: number;
}

/**
 * Verify that `proposalId` authorizes paying `amountTzs` out of `groupId`.
 *
 * Must be called inside a transaction — the FOR UPDATE lock it takes is only
 * meaningful if the caller's debit commits or rolls back with it.
 *
 * Throws PayoutAuthorizationError on every failure so callers can map .status
 * straight onto the response.
 */
export async function assertPayoutAuthorized(
  client: PoolClient,
  groupId: number,
  proposalId: unknown,
  amountTzs: number
): Promise<AuthorizedPayout> {
  const id = Number(proposalId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new PayoutAuthorizationError(
      400,
      'A passed proposal is required to send money from a group',
      'Pass `proposalId` for a proposal that has reached its voting threshold.'
    );
  }

  // The threshold is a property of the group, not of the individual proposal.
  // FOR UPDATE OF p so the lock lands on the proposal row and the join to
  // groups stays read-only.
  const res = await client.query(
    `SELECT p.id, p.group_id, p.title, p.proposal_type, p.payment_amount_tzs,
            p.recipient_member_id, p.recipient_phone, p.payment_status,
            g.voting_threshold_numerator, g.voting_threshold_denominator
       FROM group_proposals p
       JOIN groups g ON g.id = p.group_id
      WHERE p.id = $1
      FOR UPDATE OF p`,
    [id]
  );
  if (res.rows.length === 0) {
    throw new PayoutAuthorizationError(404, 'Proposal not found');
  }
  const proposal = res.rows[0] as ProposalRow;

  // A proposal only authorizes spending from the treasury it was voted in.
  if (Number(proposal.group_id) !== groupId) {
    throw new PayoutAuthorizationError(403, 'That proposal belongs to a different group');
  }

  if (proposal.payment_status === 'completed') {
    throw new PayoutAuthorizationError(409, 'This proposal has already been paid out');
  }

  // Vote threshold, measured against active members — the same rule the
  // proposal execute route applies.
  const votesRes = await client.query(
    `SELECT COUNT(*) FILTER (WHERE vote = 'yes') AS yes_votes
       FROM group_proposal_votes WHERE proposal_id = $1`,
    [id]
  );
  const yesVotes = Number((votesRes.rows[0] as { yes_votes: string }).yes_votes);

  const membersRes = await client.query(
    `SELECT COUNT(*) AS total FROM group_members WHERE group_id = $1 AND status = 'active'`,
    [groupId]
  );
  const totalMembers = Number((membersRes.rows[0] as { total: string }).total);

  const requiredYes = Math.ceil(
    (totalMembers * proposal.voting_threshold_numerator) / proposal.voting_threshold_denominator
  );
  if (yesVotes < requiredYes) {
    throw new PayoutAuthorizationError(
      403,
      'Proposal has not reached its voting threshold',
      `Requires ${requiredYes} yes votes, has ${yesVotes}.`
    );
  }

  // The vote approved a number. Paying more than that is not what passed —
  // paying less is fine (a partial or cheaper-than-quoted spend).
  const approved = proposal.payment_amount_tzs != null ? Number(proposal.payment_amount_tzs) : null;
  if (approved == null || !Number.isFinite(approved) || approved <= 0) {
    throw new PayoutAuthorizationError(
      400,
      'This proposal has no approved amount',
      'Set a payment amount on the proposal before disbursing.'
    );
  }
  if (amountTzs > approved) {
    throw new PayoutAuthorizationError(
      403,
      'Amount exceeds what the group approved',
      `Approved ${approved.toLocaleString()} TZS, attempted ${amountTzs.toLocaleString()} TZS.`
    );
  }

  return {
    proposalId: id,
    amountTzs: approved,
    recipientMemberId: proposal.recipient_member_id,
    recipientPhone: proposal.recipient_phone,
    title: proposal.title,
  };
}
