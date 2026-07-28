import pool from '@/lib/db';
import { handleWithParams, ok, fail } from '@/lib/api/http';
import { amountTzs, normalizePhone } from '@/lib/api/money';
import { serializeProposal } from '@/lib/api/serialize';
import { PROPOSAL_SELECT, voteSummary, PROPOSAL_TYPES, type ProposalType } from '@/lib/api/proposals';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/groups/{id}/proposals/create
 * Open a proposal for the group to vote on.
 *
 * Required fields vary by type:
 *   general  — title
 *   ask      — title, amount_tzs        (member requests funds)
 *   spend    — title, amount_tzs, and a recipient_phone or vendor_name
 *   prodcast — title, funding_goal_tzs  (pitched to investors once passed)
 *
 * Body: { created_by_member_id, title, description?, type?, amount_tzs?,
 *         recipient_member_id?, recipient_phone?, funding_goal_tzs?,
 *         timeline?, expected_impact?, vendor_name?, expense_category? }
 */
export const POST = handleWithParams<{ id: string }>('write', async (request, { params }) => {
  const groupId = Number.parseInt(params.id, 10);
  if (!Number.isFinite(groupId)) return fail(422, 'invalid_request', 'Group id must be numeric.');

  const body = await request.json().catch(() => null);
  const createdBy = Number(body?.created_by_member_id);
  const title = String(body?.title ?? '').trim();
  const description = String(body?.description ?? '').trim();
  const type = (body?.type ?? 'general') as ProposalType;

  if (!Number.isFinite(createdBy)) return fail(422, 'invalid_request', '`created_by_member_id` is required.');
  if (!title) return fail(422, 'invalid_request', '`title` is required.');
  if (!(PROPOSAL_TYPES as readonly string[]).includes(type)) {
    return fail(422, 'invalid_request', `\`type\` must be one of: ${PROPOSAL_TYPES.join(', ')}.`);
  }

  let paymentAmount: number | null = null;
  let recipientPhone: string | null = null;
  const recipientMemberId = body?.recipient_member_id != null ? Number(body.recipient_member_id) : null;
  const metadata: Record<string, unknown> = {};

  if (type === 'ask' || type === 'spend') {
    paymentAmount = amountTzs(body?.amount_tzs, 1);
    if (paymentAmount === null) {
      return fail(422, 'invalid_request', `\`amount_tzs\` is required for a "${type}" proposal.`);
    }
  }
  if (type === 'ask') {
    metadata.business_purpose = description;
  }
  if (type === 'spend') {
    const vendor = String(body?.vendor_name ?? '').trim();
    if (body?.recipient_phone) {
      recipientPhone = normalizePhone(body.recipient_phone);
      if (!recipientPhone) return fail(422, 'invalid_request', '`recipient_phone` must be a Tanzanian number.');
    }
    if (!recipientPhone && !vendor && recipientMemberId == null) {
      return fail(422, 'invalid_request', 'A "spend" proposal needs a recipient_phone, recipient_member_id or vendor_name.');
    }
    metadata.vendor_name = vendor;
    metadata.expense_category = String(body?.expense_category ?? '').trim();
  }
  if (type === 'prodcast') {
    const goal = amountTzs(body?.funding_goal_tzs, 1);
    if (goal === null) {
      return fail(422, 'invalid_request', '`funding_goal_tzs` is required for a "prodcast" proposal.');
    }
    metadata.funding_goal_tzs = goal;
    metadata.project_description = String(body?.project_description ?? description).trim();
    metadata.timeline = String(body?.timeline ?? '').trim();
    metadata.expected_impact = String(body?.expected_impact ?? '').trim();
  }

  const client = await pool.connect();
  try {
    const group = await client.query(`SELECT 1 FROM groups WHERE id = $1`, [groupId]);
    if (group.rows.length === 0) return fail(404, 'not_found', 'No group with that id.');

    // The author must actually belong to the group they're proposing to.
    const membership = await client.query(
      `SELECT 1 FROM group_members WHERE group_id = $1 AND member_id = $2 AND status = 'active' LIMIT 1`,
      [groupId, createdBy],
    );
    if (membership.rows.length === 0) {
      return fail(403, 'not_eligible', 'The author is not an active member of this group.');
    }

    if (recipientMemberId != null) {
      const rm = await client.query(`SELECT 1 FROM members WHERE id = $1`, [recipientMemberId]);
      if (rm.rows.length === 0) return fail(404, 'not_found', 'No member with that recipient_member_id.');
    }

    const inserted = await client.query(
      `INSERT INTO group_proposals
         (group_id, created_by_member_id, title, description, proposal_type,
          metadata, payment_amount_tzs, recipient_member_id, recipient_phone,
          payment_status, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'open')
       RETURNING id`,
      [
        groupId, createdBy, title.slice(0, 255), description || null, type,
        Object.keys(metadata).length ? JSON.stringify(metadata) : null,
        paymentAmount, recipientMemberId, recipientPhone,
        paymentAmount != null ? 'pending' : null,
      ],
    );

    const id = (inserted.rows[0] as { id: number }).id;
    const res = await client.query(`${PROPOSAL_SELECT} WHERE p.id = $1`, [id]);
    const row = res.rows[0] as Record<string, unknown>;

    return ok(
      { ...serializeProposal(row), group_name: (row.group_name as string) ?? null, votes: voteSummary(row) },
      undefined,
      { status: 201 },
    );
  } finally {
    client.release();
  }
});
