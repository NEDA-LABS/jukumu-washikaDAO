import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const checks: Record<string, unknown> = {};

  // Check 1: Auth
  const auth = getAuthTokenPayload(request);
  checks.auth = auth ? { userId: auth.userId, role: auth.role } : null;
  if (!auth) {
    return NextResponse.json({ checks, error: 'Auth failed - no valid token' });
  }

  // Check 2: SNIPPE_API_KEY
  checks.snippeKeySet = !!process.env.SNIPPE_API_KEY;
  checks.snippeKeyLength = process.env.SNIPPE_API_KEY?.length ?? 0;

  // Check 3: DB connection
  let client;
  try {
    client = await pool.connect();
    checks.dbConnected = true;
  } catch (err) {
    checks.dbConnected = false;
    checks.dbError = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ checks });
  }

  try {
    // Check 4: Member lookup
    const memberRes = await client.query(
      `SELECT m.id, m.full_name, m.email, m.phone FROM members m WHERE m.user_id = $1 LIMIT 1`,
      [auth.userId]
    );
    checks.memberFound = memberRes.rows.length > 0;
    if (memberRes.rows.length > 0) {
      const m = memberRes.rows[0] as { id: number; full_name: string; phone: string };
      checks.member = { id: m.id, name: m.full_name, hasPhone: !!m.phone };
    }

    // Check 5: Group memberships
    const groupsRes = await client.query(
      `SELECT g.id, g.name, g.monthly_contribution, gm.role
       FROM groups g JOIN group_members gm ON gm.group_id = g.id
       WHERE gm.member_id = $1 LIMIT 5`,
      [memberRes.rows[0]?.id]
    );
    checks.groups = groupsRes.rows;

    // Check 6: Snippe API reachability
    try {
      const snippeRes = await fetch('https://api.snippe.sh/v1/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SNIPPE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: 1000, currency: 'TZS' }),
      });
      const snippeText = await snippeRes.text();
      checks.snippeStatus = snippeRes.status;
      try {
        checks.snippeResponse = JSON.parse(snippeText);
      } catch {
        checks.snippeRawResponse = snippeText.slice(0, 300);
      }
    } catch (err) {
      checks.snippeNetworkError = err instanceof Error ? err.message : String(err);
    }

    return NextResponse.json({ checks });
  } catch (err) {
    checks.unexpectedError = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ checks });
  } finally {
    client.release();
  }
}
