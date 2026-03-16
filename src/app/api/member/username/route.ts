import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';

/**
 * GET /api/member/username?check=username
 * Check if a username is available
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('check');

  if (!username) {
    return NextResponse.json({ error: 'Username required' }, { status: 400 });
  }

  // Validate username format: 3-30 chars, alphanumeric + underscore only
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    return NextResponse.json({ 
      available: false, 
      error: 'Username must be 3-30 characters (letters, numbers, underscore only)' 
    }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id FROM members WHERE lower(username) = lower($1) LIMIT 1`,
      [username]
    );
    
    return NextResponse.json({
      available: result.rows.length === 0,
      username,
    });
  } catch (error) {
    console.error('Username check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}

/**
 * PUT /api/member/username
 * Set or update the authenticated member's username
 */
export async function PUT(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { username } = body || {};

  if (!username) {
    return NextResponse.json({ error: 'Username required' }, { status: 400 });
  }

  // Validate username format
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    return NextResponse.json({ 
      error: 'Username must be 3-30 characters (letters, numbers, underscore only)' 
    }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    // Get member record
    const memberRes = await client.query(
      `SELECT id, username FROM members WHERE user_id = $1 LIMIT 1`,
      [auth.userId]
    );
    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Member profile not found' }, { status: 404 });
    }
    const member = memberRes.rows[0] as { id: number; username: string | null };

    // Check if username is already taken by someone else
    const existingRes = await client.query(
      `SELECT id FROM members WHERE lower(username) = lower($1) AND id != $2 LIMIT 1`,
      [username, member.id]
    );
    if (existingRes.rows.length > 0) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    }

    // Update username
    await client.query(
      `UPDATE members SET username = $1 WHERE id = $2`,
      [username.toLowerCase(), member.id]
    );

    return NextResponse.json({
      success: true,
      message: 'Username updated successfully',
      username: username.toLowerCase(),
    });
  } catch (error) {
    console.error('Username update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
