import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensureNtzsSchema } from '@/lib/ntzs-db';
import { ensureExternalFundingSchema } from '@/lib/wallet/external-funding';

/**
 * Group activity feed — merges wallet transactions where the group is party
 * (contributions in, disbursements out, transfers between members and the
 * treasury) with proposal events (created + funded/executed) so members can
 * see everything happening in their group in one place.
 *
 * Auth: user must be a member of the group.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const groupId = parseInt(id);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });
  }
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 60);

  // The funder lookup reads external_funding_claims, created lazily.
  await ensureExternalFundingSchema();

  const client = await pool.connect();
  try {
    await ensureNtzsSchema(client);

    // Auth check: caller must belong to the group
    const memberRes = await client.query(
      `SELECT gm.member_id
         FROM group_members gm
         JOIN members m ON m.id = gm.member_id
        WHERE gm.group_id = $1 AND m.user_id = $2
        LIMIT 1`,
      [groupId, auth.userId]
    );
    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const txPromise = client.query(
      `SELECT t.id, t.type, t.status, t.purpose, t.metadata,
              t.from_member_id, t.from_group_id, t.to_member_id, t.to_group_id,
              t.amount_tzs, t.created_at,
              fm.full_name AS from_member_name,
              tm.full_name AS to_member_name,
              fu.full_name AS funder_name
         FROM ntzs_transactions t
         LEFT JOIN members fm ON fm.id = t.from_member_id
         LEFT JOIN members tm ON tm.id = t.to_member_id
         -- Who funded, for money that arrived from outside the group: an
         -- investor spending an in-app balance, or someone who sent nTZS to
         -- the treasury and had it confirmed.
         LEFT JOIN LATERAL (
           SELECT u.full_name FROM users u
            WHERE u.id = COALESCE(
              NULLIF(t.metadata->>'investor_user_id', '')::int,
              (SELECT c.claimed_by_user_id FROM external_funding_claims c
                WHERE c.id = NULLIF(t.metadata->>'claim_id', '')::int)
            )
         ) fu ON true
        WHERE t.from_group_id = $1 OR t.to_group_id = $1
        ORDER BY t.created_at DESC
        LIMIT $2`,
      [groupId, limit]
    );

    const propPromise = client.query(
      `SELECT p.id, p.title, p.proposal_type, p.status, p.funded_at,
              p.created_at, p.executed_at,
              m.full_name AS creator_name
         FROM group_proposals p
         LEFT JOIN members m ON m.id = p.created_by_member_id
        WHERE p.group_id = $1
        ORDER BY p.created_at DESC
        LIMIT $2`,
      [groupId, limit]
    ).catch(() => ({ rows: [] as any[] }));

    const [txs, props] = await Promise.all([txPromise, propPromise]);

    type FeedKind = 'contribution' | 'funding' | 'disbursement' | 'transfer_in' | 'transfer_out' | 'proposal_created' | 'proposal_funded';
    type FeedItem = {
      key: string;
      kind: FeedKind;
      date: string;
      status: string | null;
      amount_tzs: number | null;
      title_sw: string;
      title_en: string;
      href: string | null;
    };

    const items: FeedItem[] = [];

    for (const t of txs.rows as any[]) {
      const amt = Number(t.amount_tzs || 0);
      const amtStr = amt.toLocaleString();
      const incoming = t.to_group_id === groupId;

      if (incoming && t.purpose === 'funding') {
        const who = t.funder_name || null;
        const external = t.metadata?.kind === 'external_funding';
        items.push({
          key: `tx-${t.id}`,
          kind: 'funding',
          date: t.created_at, status: t.status, amount_tzs: amt,
          title_sw: who
            ? `Ufadhili kutoka ${who}${external ? ' (nTZS)' : ''}`
            : `Ufadhili umepokelewa${external ? ' (nTZS)' : ''}`,
          title_en: who
            ? `Funding from ${who}${external ? ' (nTZS)' : ''}`
            : `Funding received${external ? ' (nTZS)' : ''}`,
          href: null,
        });
      } else if (incoming && (t.purpose === 'contribution' || t.type === 'deposit')) {
        items.push({
          key: `tx-${t.id}`,
          kind: 'contribution',
          date: t.created_at, status: t.status, amount_tzs: amt,
          title_sw: `Mchango kutoka ${t.from_member_name || 'mwanachama'}`,
          title_en: `Contribution from ${t.from_member_name || 'a member'}`,
          href: null,
        });
      } else if (!incoming && t.to_member_name) {
        items.push({
          key: `tx-${t.id}`,
          kind: 'disbursement',
          date: t.created_at, status: t.status, amount_tzs: amt,
          title_sw: `Malipo kwa ${t.to_member_name}`,
          title_en: `Payout to ${t.to_member_name}`,
          href: null,
        });
      } else if (incoming) {
        items.push({
          key: `tx-${t.id}`,
          kind: 'transfer_in',
          date: t.created_at, status: t.status, amount_tzs: amt,
          title_sw: `Umeingiza TSh ${amtStr}`,
          title_en: `Received TSh ${amtStr}`,
          href: null,
        });
      } else {
        items.push({
          key: `tx-${t.id}`,
          kind: 'transfer_out',
          date: t.created_at, status: t.status, amount_tzs: amt,
          title_sw: `Umetuma TSh ${amtStr}`,
          title_en: `Sent TSh ${amtStr}`,
          href: null,
        });
      }
    }

    for (const p of props.rows as any[]) {
      items.push({
        key: `prop-${p.id}`,
        kind: 'proposal_created',
        date: p.created_at,
        status: p.status ?? null,
        amount_tzs: null,
        title_sw: `Pendekezo jipya: ${p.title}`,
        title_en: `New proposal: ${p.title}`,
        href: `/member-dashboard/groups/${groupId}/proposals/${p.id}`,
      });
      if (p.funded_at || p.executed_at) {
        const date = p.executed_at || p.funded_at;
        items.push({
          key: `prop-fund-${p.id}`,
          kind: 'proposal_funded',
          date,
          status: 'completed',
          amount_tzs: null,
          title_sw: `Pendekezo limetekelezwa: ${p.title}`,
          title_en: `Proposal executed: ${p.title}`,
          href: `/member-dashboard/groups/${groupId}/proposals/${p.id}`,
        });
      }
    }

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return NextResponse.json({ items: items.slice(0, limit) });
  } catch (error) {
    console.error('[group feed]', error);
    return NextResponse.json({ error: 'Failed to load feed' }, { status: 500 });
  } finally {
    client.release();
  }
}
