import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { reconcileLedger } from '@/lib/reconcile';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/admin/ledger/sync — the reconciliation, with a button on it.
 *
 * Same code as the schedule and the traffic tick; only the trigger differs.
 * Kept because a person watching a screen should never have to wait for a
 * timer, and because for a while the timer was the only thing that could do
 * this and it was not running.
 */
async function requireAdmin(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return null;
  const res = await pool.query(`SELECT role FROM users WHERE id = $1 LIMIT 1`, [auth.userId]);
  return (res.rows[0] as { role?: string } | undefined)?.role === 'admin' ? auth : null;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!process.env.NTZS_API_KEY) {
    return NextResponse.json({ error: 'nTZS is not configured' }, { status: 503 });
  }

  const result = await reconcileLedger({ limit: 120, budgetMs: 40_000 });
  return NextResponse.json(
    { ...result, changes: result.changes.slice(0, 20) },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
