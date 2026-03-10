import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ntzs, NtzsApiError } from '@/lib/ntzs';
import { ensureNtzsSchema, updateTransactionStatus } from '@/lib/ntzs-db';

/**
 * Sync transaction statuses by polling nTZS API for any pending/submitted transactions.
 * Called by the frontend after a deposit/withdrawal to update status without waiting for webhooks.
 */
export async function POST(request: NextRequest) {
  const { userId } = await request.json();

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  if (!process.env.NTZS_API_KEY) {
    return NextResponse.json({ synced: 0 });
  }

  const client = await pool.connect();

  try {
    await ensureNtzsSchema(client);

    // Get member id
    const memberRes = await client.query(
      `SELECT m.id FROM members m JOIN users u ON u.id = m.user_id WHERE u.id = $1 LIMIT 1`,
      [userId]
    );
    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }
    const memberId = (memberRes.rows[0] as { id: number }).id;

    // Find all pending/submitted transactions for this member
    const pendingRes = await client.query(
      `SELECT id, ntzs_id, type, status
       FROM ntzs_transactions
       WHERE (from_member_id = $1 OR to_member_id = $1)
         AND status IN ('pending', 'submitted', 'processing')
       ORDER BY created_at DESC
       LIMIT 20`,
      [memberId]
    );

    let synced = 0;

    for (const row of pendingRes.rows as { id: number; ntzs_id: string; type: string; status: string }[]) {
      try {
        let newStatus: string | null = null;
        let txHash: string | undefined;

        if (row.type === 'deposit') {
          const deposit = await ntzs.deposits.get(row.ntzs_id);
          newStatus = deposit.status;
        } else if (row.type === 'withdrawal') {
          const withdrawal = await ntzs.withdrawals.get(row.ntzs_id);
          newStatus = withdrawal.status;
        } else if (row.type === 'transfer') {
          const transfer = await ntzs.transfers.get(row.ntzs_id);
          newStatus = transfer.status;
          txHash = transfer.txHash;
        }

        if (newStatus && newStatus !== row.status) {
          await updateTransactionStatus(client, row.ntzs_id, newStatus, txHash);
          synced++;
        }
      } catch (err) {
        if (err instanceof NtzsApiError) {
          console.error(`[sync] Failed to check ${row.type} ${row.ntzs_id}:`, err.status, err.body);
        } else {
          console.error(`[sync] Error checking ${row.ntzs_id}:`, err);
        }
      }
    }

    return NextResponse.json({ synced, checked: pendingRes.rows.length });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
