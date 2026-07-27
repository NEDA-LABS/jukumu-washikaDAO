import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const revalidate = 60;

/**
 * Public platform metrics for the landing hero.
 *
 * Every figure is read live from the database. Each query is isolated so a
 * table that doesn't exist yet on a given environment degrades to 0 instead of
 * failing the whole response.
 */
async function scalar(
  client: { query: (sql: string) => Promise<{ rows: Record<string, unknown>[] }> },
  sql: string,
): Promise<number> {
  try {
    const res = await client.query(sql);
    const raw = res.rows[0] ? Object.values(res.rows[0])[0] : 0;
    const n = Number(raw ?? 0);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ groups: 0, members: 0, businesses: 0, trainings: 0, volumeTzs: 0, heldTzs: 0, live: false });
  }

  const client = await pool.connect();
  try {
    const [groups, members, businesses, trainings, volumeTzs, heldTzs] = await Promise.all([
      scalar(client, `SELECT COUNT(*) FROM groups WHERE status = 'active'`),
      scalar(client, `SELECT COUNT(*) FROM members`),
      scalar(
        client,
        `SELECT COUNT(*) FROM members
          WHERE COALESCE(NULLIF(TRIM(business_name), ''), NULLIF(TRIM(business_type), '')) IS NOT NULL`,
      ),
      scalar(client, `SELECT COUNT(*) FROM training_modules`),
      // Settled money that has moved through the platform.
      scalar(
        client,
        `SELECT COALESCE(SUM(amount_tzs), 0) FROM ntzs_transactions
          WHERE status IN ('completed', 'minted', 'success', 'successful')`,
      ),
      // Money currently sitting in group treasuries.
      scalar(client, `SELECT COALESCE(SUM(balance_tzs), 0) FROM wallet_accounts WHERE owner_type = 'group'`),
    ]);

    return NextResponse.json(
      { groups, members, businesses, trainings, volumeTzs, heldTzs, live: true },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
    );
  } catch (error) {
    console.error('[public/stats]', error);
    return NextResponse.json({ groups: 0, members: 0, businesses: 0, trainings: 0, volumeTzs: 0, heldTzs: 0, live: false });
  } finally {
    client.release();
  }
}
