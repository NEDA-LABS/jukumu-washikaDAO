import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { createMobilePayment } from '@/lib/snippe';
import { insertPendingPayment } from '@/lib/snippe-db';

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('255')) return digits;
  if (digits.startsWith('0')) return '255' + digits.slice(1);
  return '255' + digits;
}

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

  let body: { amount: number; phone_number?: string };
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

    // Use phone from request body, fallback to member profile phone
    const rawPhone = body.phone_number || member.phone;
    if (!rawPhone) {
      return NextResponse.json({ error: 'Nambari ya simu inahitajika' }, { status: 400 });
    }
    const phoneNumber = normalizePhone(rawPhone);

    const nameParts = member.full_name.trim().split(/\s+/);
    const firstname = nameParts[0] || 'Member';
    const lastname = nameParts.slice(1).join(' ') || firstname;

    const payment = await createMobilePayment({
      amount,
      phone_number: phoneNumber,
      customer: { firstname, lastname },
      webhook_url: webhookUrl,
      metadata: {
        payment_type: 'group_topup',
        member_id: String(member.id),
        group_id: String(group.id),
      },
    });

    // Pre-insert pending record so polling & summary queries work even if webhook is slow
    await insertPendingPayment(client, {
      reference: payment.data.reference,
      amount,
      phone: phoneNumber,
      customerName: member.full_name,
      paymentType: 'group_topup',
      memberId: member.id,
      groupId: group.id,
      metadata: {
        payment_type: 'group_topup',
        member_id: String(member.id),
        group_id: String(group.id),
      },
    });

    return NextResponse.json({
      success: true,
      reference: payment.data.reference,
      status: payment.data.status,
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
