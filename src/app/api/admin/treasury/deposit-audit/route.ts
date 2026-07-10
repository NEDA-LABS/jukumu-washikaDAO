import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { PoolClient } from 'pg';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensureNtzsSchema } from '@/lib/ntzs-db';
import { ntzs } from '@/lib/ntzs';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Read-only audit of every recent nTZS deposit vs the depositor's balance.
 * Shows the DB status/posted flag, the LIVE nTZS status, the owner, and that
 * member's current ledger balance — so we can see which minted deposits were
 * marked settled (posted=true) without the balance ever moving. Changes nothing.
 */
const BATCH = 15;

async function liveStatus(ntzsId: string): Promise<string | null> {
  try { return (await ntzs.deposits.get(ntzsId)).status ?? null; } catch { return null; }
}

export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client: PoolClient = await pool.connect();
  try {
    await ensureNtzsSchema(client);

    const r = await client.query(
      `SELECT t.id, t.ntzs_id, t.amount_tzs, t.net_tzs, t.status, t.posted,
              t.to_member_id, t.to_group_id, t.note, t.created_at,
              m.full_name AS member_name,
              wa.balance_tzs AS member_balance
       FROM ntzs_transactions t
       LEFT JOIN members m ON m.id = t.to_member_id
       LEFT JOIN wallet_accounts wa ON wa.owner_type = 'member' AND wa.owner_id = t.to_member_id
       WHERE t.type = 'deposit'
       ORDER BY t.created_at DESC
       LIMIT 30`
    );
    const rows = r.rows as {
      id: number; ntzs_id: string | null; amount_tzs: string; net_tzs: string | null;
      status: string; posted: boolean; to_member_id: number | null; to_group_id: number | null;
      note: string | null; member_name: string | null; member_balance: string | null; created_at: string;
    }[];

    // Live nTZS status per deposit (batched).
    const live: (string | null)[] = new Array(rows.length).fill(null);
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      const res = await Promise.all(slice.map((x) => (x.ntzs_id ? liveStatus(x.ntzs_id) : Promise.resolve(null))));
      for (let j = 0; j < slice.length; j++) live[i + j] = res[j];
    }

    let mintedPostedTzs = 0, mintedUnpostedTzs = 0;
    const deposits = rows.map((x, i) => {
      const amt = Math.round(Number(x.amount_tzs));
      const minted = live[i] === 'minted' || live[i] === 'completed' || live[i] === 'success';
      if (minted && x.posted) mintedPostedTzs += amt;
      if (minted && !x.posted) mintedUnpostedTzs += amt;
      return {
        amountTzs: amt, dbStatus: x.status, liveStatus: live[i], posted: x.posted,
        toMemberId: x.to_member_id, member: x.member_name,
        memberBalanceTzs: x.member_balance != null ? Math.round(Number(x.member_balance)) : null,
        note: x.note,
      };
    });

    return NextResponse.json({
      success: true,
      count: rows.length,
      mintedButPostedTzs: mintedPostedTzs,   // minted + posted=true (should be on the balance)
      mintedUnpostedTzs: mintedUnpostedTzs,  // minted + posted=false (settle tool would credit)
      deposits,
      note: 'For each minted+posted deposit, memberBalanceTzs should be >= its amount. If a member has 138,000 minted+posted but a tiny balance, it was marked settled without crediting.',
    });
  } catch (error) {
    console.error('Deposit audit error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
