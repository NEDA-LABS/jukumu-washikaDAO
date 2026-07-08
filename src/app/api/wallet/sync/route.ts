import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ntzs, NtzsApiError } from '@/lib/ntzs';
import { ensureNtzsSchema } from '@/lib/ntzs-db';
import { settleExternalTransaction } from '@/lib/wallet/ledger';

/**
 * Polls nTZS for any pending deposit/withdrawal and settles status changes
 * against the ledger (crediting deposits, refunding failed withdrawals) — a
 * backstop for webhooks. Settlement is idempotent, so webhook + sync can't
 * double-apply.
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

    const memberRes = await client.query(
      `SELECT m.id FROM members m JOIN users u ON u.id = m.user_id WHERE u.id = $1 LIMIT 1`,
      [userId]
    );
    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }
    const memberId = (memberRes.rows[0] as { id: number }).id;

    const pendingRes = await client.query(
      `SELECT ntzs_id, type, status
       FROM ntzs_transactions
       WHERE (from_member_id = $1 OR to_member_id = $1)
         AND ntzs_id IS NOT NULL
         AND (status IN ('pending', 'submitted', 'processing')
              OR (type = 'deposit' AND posted = false))
       ORDER BY created_at DESC
       LIMIT 20`,
      [memberId]
    );

    let synced = 0;

    for (const row of pendingRes.rows as { ntzs_id: string; type: string; status: string }[]) {
      try {
        let newStatus: string | null = null;
        let txHash: string | undefined;

        if (row.type === 'deposit') {
          newStatus = (await ntzs.deposits.get(row.ntzs_id)).status;
        } else if (row.type === 'withdrawal') {
          newStatus = (await ntzs.withdrawals.get(row.ntzs_id)).status;
        } else if (row.type === 'transfer') {
          const t = await ntzs.transfers.get(row.ntzs_id);
          newStatus = t.status;
          txHash = t.txHash;
        }

        if (newStatus && newStatus !== row.status) {
          await client.query('BEGIN');
          await settleExternalTransaction(client, row.ntzs_id, newStatus, txHash);
          await client.query('COMMIT');
          synced++;
        }
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
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
