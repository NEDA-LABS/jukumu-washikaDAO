import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { createMobilePayment } from '@/lib/snippe';

export async function POST(request: NextRequest) {
  if (!process.env.SNIPPE_API_KEY) {
    return NextResponse.json({ error: 'Payment service not configured (SNIPPE_API_KEY missing)' }, { status: 503 });
  }

  const auth = getAuthTokenPayload(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { groupId: number; amount?: number; month?: string; phone_number?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { groupId, month } = body;
  if (!groupId) {
    return NextResponse.json({ error: 'groupId is required' }, { status: 400 });
  }

  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    console.error('DB connect error:', err);
    return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
  }
  try {
    // Get member profile
    const memberRes = await client.query(
      `SELECT m.id, m.full_name, m.email, m.phone
       FROM members m
       WHERE m.user_id = $1
       LIMIT 1`,
      [auth.userId]
    );
    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Member profile not found' }, { status: 404 });
    }
    const member = memberRes.rows[0] as {
      id: number;
      full_name: string;
      email: string;
      phone: string;
    };

    // Verify membership and get group details
    const groupRes = await client.query(
      `SELECT g.id, g.name, g.monthly_contribution, gm.role
       FROM groups g
       JOIN group_members gm ON gm.group_id = g.id
       WHERE g.id = $1 AND gm.member_id = $2
       LIMIT 1`,
      [groupId, member.id]
    );
    if (groupRes.rows.length === 0) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 });
    }
    const group = groupRes.rows[0] as {
      id: number;
      name: string;
      monthly_contribution: number;
    };

    const amountTzs = body.amount ?? Number(group.monthly_contribution ?? 0);
    if (!amountTzs || amountTzs <= 0) {
      return NextResponse.json({ error: 'Invalid contribution amount' }, { status: 400 });
    }

    const contributionMonth = month ?? new Date().toISOString().slice(0, 7);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://jukumu.netlify.app';
    const webhookUrl = `${appUrl}/api/webhooks/snippe`;

    // Use phone from request body, fallback to member profile phone
    const phoneNumber = body.phone_number || member.phone;
    if (!phoneNumber) {
      return NextResponse.json({ error: 'Nambari ya simu inahitajika' }, { status: 400 });
    }

    // Split full name into first/last for Snippe API
    const nameParts = member.full_name.trim().split(/\s+/);
    const firstname = nameParts[0] || 'Member';
    const lastname = nameParts.slice(1).join(' ') || firstname;

    const payment = await createMobilePayment({
      amount: amountTzs,
      phone_number: phoneNumber.replace(/^\+/, ''),
      customer: { firstname, lastname },
      webhook_url: webhookUrl,
      metadata: {
        payment_type: 'contribution',
        member_id: String(member.id),
        group_id: String(group.id),
        contribution_month: contributionMonth,
      },
    });

    return NextResponse.json({
      success: true,
      reference: payment.data.reference,
      status: payment.data.status,
      amount: amountTzs,
      month: contributionMonth,
      group: group.name,
    });
  } catch (error) {
    console.error('Contribution checkout error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get('groupId');

  const client = await pool.connect();
  try {
    const memberRes = await client.query(
      `SELECT id FROM members WHERE user_id = $1 LIMIT 1`,
      [auth.userId]
    );
    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }
    const memberId = (memberRes.rows[0] as { id: number }).id;

    const params: unknown[] = [memberId];
    let groupFilter = '';
    if (groupId) {
      params.push(Number(groupId));
      groupFilter = `AND sp.group_id = $${params.length}`;
    }

    const paymentsRes = await client.query(
      `SELECT sp.reference, sp.status, sp.amount_tzs, sp.net_tzs,
              sp.channel_type, sp.channel_provider, sp.payment_type,
              sp.group_id, g.name as group_name,
              sp.metadata->>'contribution_month' as contribution_month,
              sp.failure_reason, sp.completed_at, sp.created_at
       FROM snippe_payments sp
       LEFT JOIN groups g ON g.id = sp.group_id
       WHERE sp.member_id = $1 ${groupFilter}
       ORDER BY sp.created_at DESC
       LIMIT 50`,
      params
    );

    return NextResponse.json({ success: true, payments: paymentsRes.rows });
  } catch (error) {
    console.error('Contributions GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
