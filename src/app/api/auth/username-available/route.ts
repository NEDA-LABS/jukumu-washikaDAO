import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { USERNAME_RE, normalizeUsername } from '@/lib/username';

/**
 * GET /api/auth/username-available?u=handle
 *
 * Public availability check for the signup form. The equivalent check on
 * /api/member/username is behind the session cookie, which a person creating
 * an account does not have yet.
 *
 * This only ever reports whether a handle is free — it never reveals who holds
 * a taken one.
 */
export async function GET(request: NextRequest) {
  const raw = new URL(request.url).searchParams.get('u') || '';
  const username = normalizeUsername(raw);

  if (!USERNAME_RE.test(username)) {
    return NextResponse.json({ available: false, invalid: true, username });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 1 FROM members WHERE lower(username) = $1 LIMIT 1`,
      [username]
    );
    return NextResponse.json({ available: result.rows.length === 0, username });
  } catch (error) {
    console.error('Username availability check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
