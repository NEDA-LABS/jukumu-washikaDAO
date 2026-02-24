import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { createPaymentSession } from '@/lib/snippe';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.SNIPPE_API_KEY) {
    return NextResponse.json({ error: 'Payment service not configured (SNIPPE_API_KEY missing)' }, { status: 503 });
  }

  const auth = getAuthTokenPayload(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const groupId = Number.parseInt(id, 10);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });
  }

  let body: { amount: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { amount } = body;
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'amount (TZS) is required and must be > 0' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    // Get member
    const memberRes = await client.query(
      `SELECT m.id, m.full_name, m.email, m.phone
       FROM members m WHERE m.user_id = $1 LIMIT 1`,
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

    // Verify membership
    const groupRes = await client.query(
      `SELECT g.id, g.name, gm.role
       FROM groups g
       JOIN group_members gm ON gm.group_id = g.id
       WHERE g.id = $1 AND gm.member_id = $2
       LIMIT 1`,
      [groupId, member.id]
    );
    if (groupRes.rows.length === 0) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 });
    }
    const group = groupRes.rows[0] as { id: number; name: string; role: string };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://jukumu.netlify.app';
    const webhookUrl = `${appUrl}/api/webhooks/snippe`;

    const session = await createPaymentSession({
      amount,
      description: `Amana kwa Mfuko wa ${group.name}`,
      customer: {
        name: member.full_name,
        phone: member.phone,
        email: member.email,
      },
      redirect_url: `${appUrl}/member-dashboard/groups/${groupId}`,
      webhook_url: webhookUrl,
      metadata: {
        payment_type: 'group_topup',
        member_id: String(member.id),
        group_id: String(group.id),
      },
    });

    return NextResponse.json({
      success: true,
      checkout_url: session.data.checkout_url,
      reference: session.data.reference,
      amount,
      group: group.name,
    });
  } catch (error) {
    console.error('Group top-up checkout error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    client.release();
  }
}
