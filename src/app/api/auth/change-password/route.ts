import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * POST /api/auth/change-password { currentPassword, newPassword }
 *
 * Changes the signed-in user's password. Works for anyone with an account —
 * member, admin or investor — because the identity comes from the session
 * cookie and nothing here depends on which kind of user it is.
 *
 * The current password is required even though the caller is already signed
 * in. A session left open on a shared or borrowed phone is exactly the case
 * this protects against: without it, whoever picks the phone up can lock the
 * owner out of their own savings account.
 */

const MIN_LENGTH = 8;

/** Same cost as signup. A weaker hash here would quietly downgrade the account. */
const BCRYPT_COST = 12;

export async function POST(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: 'Enter your current password and a new one', code: 'missing' },
      { status: 400 }
    );
  }
  if (newPassword.length < MIN_LENGTH) {
    return NextResponse.json(
      { error: `Your new password must be at least ${MIN_LENGTH} characters`, code: 'too_short' },
      { status: 400 }
    );
  }
  if (newPassword === currentPassword) {
    return NextResponse.json(
      { error: 'Your new password must be different from the current one', code: 'unchanged' },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT id, password_hash FROM users WHERE id = $1 LIMIT 1`,
      [auth.userId]
    );
    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
    const user = res.rows[0] as { id: number; password_hash: string | null };

    // An account with no password set (created by an admin or a partner import)
    // cannot have one "changed" — there is nothing to check the request
    // against, and accepting it would let a stolen session claim the account.
    if (!user.password_hash) {
      return NextResponse.json(
        { error: 'This account has no password set. Ask an administrator to help.', code: 'no_password' },
        { status: 409 }
      );
    }

    const matches = await bcrypt.compare(currentPassword, user.password_hash);
    if (!matches) {
      // Deliberately not distinguished from any other failure in the log: a
      // wrong current password is the one case worth being quiet about.
      return NextResponse.json(
        { error: 'That is not your current password', code: 'wrong_password' },
        { status: 403 }
      );
    }

    const hashed = await bcrypt.hash(newPassword, BCRYPT_COST);
    await client.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [hashed, user.id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[auth/change-password]', error);
    return NextResponse.json({ error: 'Could not change your password' }, { status: 500 });
  } finally {
    client.release();
  }
}
