import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';
import type { PoolClient } from 'pg';

let cachedPasswordColumn: 'password_hash' | 'password' | null = null;

async function getPasswordColumn(client: PoolClient) {
  if (cachedPasswordColumn) return cachedPasswordColumn;

  const res = await client.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name IN ('password_hash', 'password')
    `
  );

  const cols = new Set(res.rows.map((r) => r.column_name));
  cachedPasswordColumn = cols.has('password_hash') ? 'password_hash' : cols.has('password') ? 'password' : null;
  return cachedPasswordColumn;
}

function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, '');

  if (!digits) return '';

  // Tanzania-friendly normalization
  if (digits.length === 10 && digits.startsWith('0')) return `255${digits.slice(1)}`;
  if (digits.length === 9) return `255${digits}`;

  return digits;
}

export async function POST(request: NextRequest) {
  let client: PoolClient | null = null;

  try {
    const { email, password, fullName, phone, memberId } = await request.json();

    if (!password || !fullName) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const normalizedPhone = phone ? normalizePhone(phone) : '';
    const trimmedEmail = typeof email === 'string' ? email.trim() : '';
    const effectiveEmail = trimmedEmail || (normalizedPhone ? `${normalizedPhone}@phone.jukumu` : '');

    if (!effectiveEmail) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    client = await pool.connect();

    const existingUser = await client.query(
      'SELECT id FROM users WHERE lower(email) = lower($1)',
      [effectiveEmail]
    );

    if (existingUser.rows.length > 0) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    if (normalizedPhone) {
      const existingPhone = await client.query(
        `
        SELECT u.id
        FROM users u
        JOIN members m ON m.user_id = u.id
        WHERE regexp_replace(coalesce(m.phone, ''), '\\D', '', 'g') = $1
        LIMIT 1
        `,
        [normalizedPhone]
      );

      if (existingPhone.rows.length > 0) {
        return NextResponse.json({ error: 'User already exists' }, { status: 400 });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await client.query('BEGIN');

    const passwordColumn = await getPasswordColumn(client);
    if (!passwordColumn) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const result = await client.query(
      `INSERT INTO users (email, ${passwordColumn}, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, full_name, role`,
      [effectiveEmail, hashedPassword, fullName, 'member']
    );

    const user = result.rows[0];

    if (memberId) {
      await client.query(
        `
        UPDATE members
        SET user_id = $1
        WHERE id = $2
        AND user_id IS NULL
        `,
        [user.id, memberId]
      );
    } else if (normalizedPhone) {
      await client.query(
        `
        UPDATE members
        SET user_id = $1
        WHERE user_id IS NULL
        AND regexp_replace(coalesce(phone, ''), '\\D', '', 'g') = $2
        `,
        [user.id, normalizedPhone]
      );
    }

    // Always attempt email-based linkage as final fallback
    // This covers cases where member was pre-created by admin with same email
    if (trimmedEmail) {
      await client.query(
        `
        UPDATE members
        SET user_id = $1
        WHERE user_id IS NULL
          AND lower(email) = lower($2)
          AND NOT EXISTS (SELECT 1 FROM members m2 WHERE m2.user_id = $1)
        `,
        [user.id, trimmedEmail]
      );
    }

    await client.query('COMMIT');

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role
      }
    }, { status: 201 });
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore
      }
    }

    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client?.release();
  }
}
