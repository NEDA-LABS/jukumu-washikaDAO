import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ensureNtzsSchema } from '@/lib/ntzs-db';

/**
 * Unified activity feed for the member dashboard overview.
 * Merges (a) member activities (joins/training), (b) wallet transactions the
 * user was party to, and (c) recent proposals in groups the user belongs to.
 *
 * Each row is normalised into a common shape with a client-side `href` for
 * click-through, and both Swahili + English text (so the client picks the
 * label without another round-trip).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const limit = Math.min(parseInt(searchParams.get('limit') || '12'), 40);

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await ensureNtzsSchema(client);

    // Look up the member id once
    const memberRes = await client.query(
      `SELECT id FROM members WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    if (memberRes.rows.length === 0) {
      return NextResponse.json({ items: [] });
    }
    const memberId = (memberRes.rows[0] as { id: number }).id;

    // (a) Group joins
    const joinsPromise = client.query(
      `SELECT g.id AS group_id, g.name AS group_name, gm.joined_date AS date
         FROM group_members gm
         JOIN groups g ON g.id = gm.group_id
        WHERE gm.member_id = $1
        ORDER BY gm.joined_date DESC
        LIMIT $2`,
      [memberId, limit]
    );

    // (b) Wallet transactions the user was party to
    const txPromise = client.query(
      `SELECT t.id, t.type, t.status, t.purpose,
              t.from_member_id, t.from_group_id, t.to_member_id, t.to_group_id,
              t.amount_tzs, t.created_at,
              fg.name AS from_group_name,
              tg.name AS to_group_name,
              tm.full_name AS to_member_name,
              fm.full_name AS from_member_name
         FROM ntzs_transactions t
         LEFT JOIN groups  fg ON fg.id = t.from_group_id
         LEFT JOIN groups  tg ON tg.id = t.to_group_id
         LEFT JOIN members tm ON tm.id = t.to_member_id
         LEFT JOIN members fm ON fm.id = t.from_member_id
        WHERE t.from_member_id = $1 OR t.to_member_id = $1
        ORDER BY t.created_at DESC
        LIMIT $2`,
      [memberId, limit]
    );

    // (c) Recent proposals in the user's groups
    const propPromise = client.query(
      `SELECT p.id, p.title, p.proposal_type, p.created_at,
              p.group_id, g.name AS group_name
         FROM group_proposals p
         JOIN groups g ON g.id = p.group_id
        WHERE p.group_id IN (
          SELECT group_id FROM group_members WHERE member_id = $1
        )
        ORDER BY p.created_at DESC
        LIMIT $2`,
      [memberId, limit]
    ).catch(() => ({ rows: [] as any[] })); // group_proposals may not exist yet

    const [joins, txs, props] = await Promise.all([joinsPromise, txPromise, propPromise]);

    type FeedItem = {
      key: string;
      kind: 'join' | 'deposit' | 'withdraw' | 'contribution' | 'received' | 'transfer' | 'proposal';
      date: string;
      title_sw: string;
      title_en: string;
      subtitle: string | null;
      href: string;
    };

    const items: FeedItem[] = [];

    for (const j of joins.rows as any[]) {
      items.push({
        key: `join-${j.group_id}-${j.date}`,
        kind: 'join',
        date: j.date,
        title_sw: `Umejiunga na ${j.group_name}`,
        title_en: `You joined ${j.group_name}`,
        subtitle: null,
        href: `/member-dashboard/groups/${j.group_id}`,
      });
    }

    for (const t of txs.rows as any[]) {
      const amt = Number(t.amount_tzs || 0).toLocaleString();
      const outgoing = t.from_member_id === memberId;

      if (t.type === 'deposit') {
        items.push({
          key: `tx-${t.id}`,
          kind: 'deposit',
          date: t.created_at,
          title_sw: `Umeweka TSh ${amt}`,
          title_en: `Deposited TSh ${amt}`,
          subtitle: t.status,
          href: '/member-dashboard?section=wallet',
        });
      } else if (t.type === 'withdrawal') {
        items.push({
          key: `tx-${t.id}`,
          kind: 'withdraw',
          date: t.created_at,
          title_sw: `Umetoa TSh ${amt}`,
          title_en: `Withdrew TSh ${amt}`,
          subtitle: t.status,
          href: '/member-dashboard?section=wallet',
        });
      } else if (t.purpose === 'contribution' && outgoing && t.to_group_id) {
        items.push({
          key: `tx-${t.id}`,
          kind: 'contribution',
          date: t.created_at,
          title_sw: `Umechangia TSh ${amt} kwa ${t.to_group_name}`,
          title_en: `Contributed TSh ${amt} to ${t.to_group_name}`,
          subtitle: t.status,
          href: `/member-dashboard/groups/${t.to_group_id}`,
        });
      } else if (t.purpose === 'p2p') {
        if (outgoing) {
          items.push({
            key: `tx-${t.id}`,
            kind: 'transfer',
            date: t.created_at,
            title_sw: `Umetuma TSh ${amt} kwa ${t.to_member_name || 'mtumiaji'}`,
            title_en: `Sent TSh ${amt} to ${t.to_member_name || 'a user'}`,
            subtitle: t.status,
            href: '/member-dashboard?section=wallet',
          });
        } else {
          items.push({
            key: `tx-${t.id}`,
            kind: 'received',
            date: t.created_at,
            title_sw: `Umepokea TSh ${amt} kutoka ${t.from_member_name || 'mtumiaji'}`,
            title_en: `Received TSh ${amt} from ${t.from_member_name || 'a user'}`,
            subtitle: t.status,
            href: '/member-dashboard?section=wallet',
          });
        }
      } else if (t.type === 'disbursement' && !outgoing && t.from_group_id) {
        items.push({
          key: `tx-${t.id}`,
          kind: 'received',
          date: t.created_at,
          title_sw: `Umepokea TSh ${amt} kutoka ${t.from_group_name}`,
          title_en: `Received TSh ${amt} from ${t.from_group_name}`,
          subtitle: t.status,
          href: `/member-dashboard/groups/${t.from_group_id}`,
        });
      }
    }

    for (const p of props.rows as any[]) {
      items.push({
        key: `prop-${p.id}`,
        kind: 'proposal',
        date: p.created_at,
        title_sw: `Pendekezo jipya kwa ${p.group_name}: ${p.title}`,
        title_en: `New proposal in ${p.group_name}: ${p.title}`,
        subtitle: p.proposal_type,
        href: `/member-dashboard/groups/${p.group_id}/proposals/${p.id}`,
      });
    }

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({ items: items.slice(0, limit) });
  } catch (error) {
    console.error('[feed]', error);
    return NextResponse.json({ error: 'Failed to load feed' }, { status: 500 });
  } finally {
    client.release();
  }
}
