import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthTokenPayload(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const groupId = Number.parseInt(id, 10);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    // Verify membership
    const memberRes = await client.query(
      `SELECT m.id, gm.role FROM members m
       JOIN group_members gm ON gm.member_id = m.id
       WHERE m.user_id = $1 AND gm.group_id = $2
       LIMIT 1`,
      [auth.userId, groupId]
    );
    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { role } = memberRes.rows[0] as { id: number; role: string };

    // Check if snippe_payments table exists
    const tableCheck = await client.query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'snippe_payments'
      ) AS exists`
    );
    const tableExists = (tableCheck.rows[0] as { exists: boolean }).exists;
    if (!tableExists) {
      return NextResponse.json({ success: true, payments: [], summary: { total_collected: 0, total_disbursed: 0, this_month_collected: 0 } });
    }

    // All payments for this group (contributions, topups, disbursements)
    const paymentsRes = await client.query(
      `SELECT sp.reference, sp.status, sp.amount_tzs, sp.net_tzs,
              sp.channel_type, sp.channel_provider, sp.payment_type,
              sp.customer_phone, sp.customer_name,
              sp.member_id, m.full_name as member_name,
              sp.metadata->>'contribution_month' as contribution_month,
              sp.metadata->>'initiated_by_name' as initiated_by,
              sp.failure_reason, sp.completed_at, sp.created_at
       FROM snippe_payments sp
       LEFT JOIN members m ON m.id = sp.member_id
       WHERE sp.group_id = $1
       ORDER BY sp.created_at DESC
       LIMIT 100`,
      [groupId]
    );

    // Summary stats
    const summaryRes = await client.query(
      `SELECT
         COALESCE(SUM(CASE WHEN payment_type IN ('contribution','group_topup') AND status = 'completed' THEN amount_tzs ELSE 0 END), 0) as total_collected,
         COALESCE(SUM(CASE WHEN payment_type = 'disbursement' AND status = 'completed' THEN amount_tzs ELSE 0 END), 0) as total_disbursed,
         COALESCE(SUM(CASE WHEN payment_type IN ('contribution','group_topup') AND status = 'completed'
           AND created_at >= date_trunc('month', CURRENT_DATE) THEN amount_tzs ELSE 0 END), 0) as this_month_collected,
         COUNT(CASE WHEN payment_type IN ('contribution','group_topup') AND status = 'completed'
           AND created_at >= date_trunc('month', CURRENT_DATE) THEN 1 END) as this_month_payers
       FROM snippe_payments
       WHERE group_id = $1`,
      [groupId]
    );
    const summary = summaryRes.rows[0] as {
      total_collected: number;
      total_disbursed: number;
      this_month_collected: number;
      this_month_payers: number;
    };

    // Member contribution status this month (for leaders)
    let memberPayments: any[] = [];
    const isLeader = ['leader', 'mwenyekiti', 'katibu', 'mwekahazina'].includes(role);
    if (isLeader) {
      const currentMonth = new Date().toISOString().slice(0, 7);
      memberPayments = (await client.query(
        `SELECT gm.member_id, m.full_name, m.phone,
                CASE WHEN EXISTS (
                  SELECT 1 FROM snippe_payments sp
                  WHERE sp.group_id = $1 AND sp.member_id = gm.member_id
                    AND sp.payment_type = 'contribution' AND sp.status = 'completed'
                    AND sp.metadata->>'contribution_month' = $2
                ) THEN true ELSE false END as paid_this_month
         FROM group_members gm
         JOIN members m ON m.id = gm.member_id
         WHERE gm.group_id = $1
         ORDER BY m.full_name`,
        [groupId, currentMonth]
      )).rows;
    }

    return NextResponse.json({
      success: true,
      payments: paymentsRes.rows,
      summary: {
        total_collected: Number(summary.total_collected),
        total_disbursed: Number(summary.total_disbursed),
        this_month_collected: Number(summary.this_month_collected),
        this_month_payers: Number(summary.this_month_payers),
      },
      memberPayments,
      isLeader,
    });
  } catch (error) {
    console.error('Group payments GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
