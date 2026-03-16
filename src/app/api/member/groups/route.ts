import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ntzs, NtzsApiError } from '@/lib/ntzs';
import { ensureNtzsSchema, linkGroupWallet } from '@/lib/ntzs-db';

/**
 * POST /api/member/groups
 * Any authenticated member can create a new group.
 * They automatically become the group leader.
 */
export async function POST(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { name, monthlyContribution, votingNumerator = 3, votingDenominator = 5 } = body || {};

  if (!name || !monthlyContribution) {
    return NextResponse.json({ error: 'Jina la kundi na mchango wa kila mwezi vinahitajika.' }, { status: 400 });
  }

  const contribution = Number(monthlyContribution);
  if (!Number.isFinite(contribution) || contribution <= 0) {
    return NextResponse.json({ error: 'Mchango wa kila mwezi lazima uwe nambari halali.' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    // Get the calling member's record
    const memberRes = await client.query(
      `SELECT id FROM members WHERE user_id = $1 LIMIT 1`,
      [auth.userId]
    );
    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Wasifu wa mwanachama haujapatikana.' }, { status: 404 });
    }
    const memberId = (memberRes.rows[0] as { id: number }).id;

    // Check unique group name
    const exists = await client.query(
      `SELECT id FROM groups WHERE lower(name) = lower($1) LIMIT 1`,
      [name.trim()]
    );
    if (exists.rows.length > 0) {
      return NextResponse.json({ error: 'Kundi lenye jina hilo tayari lipo. Tumia jina lingine.' }, { status: 400 });
    }

    await client.query('BEGIN');

    // Create the group — leader_id references users table
    const groupRes = await client.query(
      `INSERT INTO groups (name, leader_id, founded_date, monthly_contribution, status,
        voting_threshold_numerator, voting_threshold_denominator)
       VALUES ($1, $2, CURRENT_DATE, $3, 'active', $4, $5)
       RETURNING *`,
      [name.trim(), auth.userId, contribution, votingNumerator, votingDenominator]
    );
    const group = groupRes.rows[0] as { id: number; name: string };

    // Add the creator as group leader in group_members
    await client.query(
      `INSERT INTO group_members (group_id, member_id, joined_date, role, status)
       VALUES ($1, $2, CURRENT_DATE, 'leader', 'active')`,
      [group.id, memberId]
    );

    await client.query('COMMIT');

    // Provision nTZS treasury wallet (non-blocking)
    let walletAddress: string | null = null;
    try {
      await ensureNtzsSchema(client);
      const ntzsUser = await ntzs.users.create({
        externalId: `group_${group.id}`,
        email: `group_${group.id}@groups.jukumu`,
      });
      await linkGroupWallet(client, group.id, ntzsUser.id, ntzsUser.walletAddress);
      walletAddress = ntzsUser.walletAddress;
    } catch (walletErr) {
      if (walletErr instanceof NtzsApiError) {
        console.error(`[member/groups] nTZS wallet error (${walletErr.status}):`, walletErr.body);
      } else {
        console.error('[member/groups] nTZS wallet error:', walletErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Kundi limeanzishwa kwa mafanikio!',
      group: { ...group, walletAddress },
    }, { status: 201 });

  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Member group creation error:', error);
    return NextResponse.json({ error: 'Hitilafu imetokea. Jaribu tena.' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = await pool.connect();
  try {
    // Map authenticated user -> member profile
    let memberRes = await client.query(
      `
      SELECT id
      FROM members
      WHERE user_id = $1
      LIMIT 1
      `,
      [auth.userId]
    );

    // Self-healing fallback: link by email if user_id not set
    if (memberRes.rows.length === 0) {
      const userRes = await client.query(
        'SELECT email FROM users WHERE id = $1 LIMIT 1',
        [auth.userId]
      );
      if (userRes.rows.length > 0) {
        const userEmail = (userRes.rows[0] as { email: string }).email;
        await client.query(
          `UPDATE members SET user_id = $1
           WHERE user_id IS NULL
             AND lower(email) = lower($2)
             AND NOT EXISTS (SELECT 1 FROM members m2 WHERE m2.user_id = $1)`,
          [auth.userId, userEmail]
        );
        memberRes = await client.query(
          `SELECT id FROM members WHERE user_id = $1 LIMIT 1`,
          [auth.userId]
        );
      }
    }

    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Member profile not found' }, { status: 404 });
    }

    const memberId = memberRes.rows[0].id as number;

    // List all active memberships for this member
    const groupsRes = await client.query(
      `
      SELECT
        g.id,
        g.name,
        g.founded_date,
        g.monthly_contribution,
        g.status,
        gm.role AS member_role,
        gm.joined_date,
        gm.status AS membership_status
      FROM group_members gm
      JOIN groups g ON g.id = gm.group_id
      WHERE gm.member_id = $1
      ORDER BY g.created_at DESC NULLS LAST, g.id DESC
      `,
      [memberId]
    );

    return NextResponse.json({
      success: true,
      memberId,
      groups: groupsRes.rows
    });
  } catch (error) {
    console.error('Member groups error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
