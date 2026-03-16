import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { PoolClient, QueryResult } from 'pg';
import { ntzs, NtzsApiError } from '@/lib/ntzs';
import { ensureNtzsSchema, linkMemberWallet } from '@/lib/ntzs-db';

let cachedPasswordColumn: 'password_hash' | 'password' | null = null;
let cachedMembersHasEmail: boolean | null = null;

async function getPasswordColumn(client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: { column_name: string }[] }> }) {
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

async function getMembersHasEmail(client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: { column_name: string }[] }> }) {
  if (cachedMembersHasEmail !== null) return cachedMembersHasEmail;

  const res = await client.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'members'
      AND column_name = 'email'
    `
  );

  cachedMembersHasEmail = res.rows.length > 0;
  return cachedMembersHasEmail;
}

function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, '');

  if (!digits) return '';

  // Tanzania-friendly normalization
  if (digits.length === 10 && digits.startsWith('0')) return `255${digits.slice(1)}`;
  if (digits.length === 9) return `255${digits}`;

  return digits;
}

function isBcryptHash(value: string) {
  return value.startsWith('$2a$') || value.startsWith('$2b$') || value.startsWith('$2y$');
}

function makeRequestId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function serverError(code: string, requestId: string, details?: string) {
  const response = NextResponse.json(
    {
      error: `Internal server error (${code})`,
      requestId,
      details: process.env.NODE_ENV === 'development' ? details : undefined
    },
    { status: 500 }
  );
  response.headers.set('x-request-id', requestId);
  return response;
}

export async function POST(request: NextRequest) {
  let client: PoolClient | null = null;
  const requestId = makeRequestId();

  try {
    const body = await request.json();
    const identifier: string | undefined = body.identifier ?? body.email;
    const password: string | undefined = body.password;

    if (!identifier || !password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const isEmail = identifier.includes('@');
    const normalizedPhone = isEmail ? null : normalizePhone(identifier);

    // Find user
    try {
      client = await pool.connect();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('Signin error (DB_CONNECT_FAILED):', requestId, e);
      return serverError('DB_CONNECT_FAILED', requestId, msg);
    }

    let passwordColumn: 'password_hash' | 'password' | null = null;
    try {
      passwordColumn = await getPasswordColumn(client);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('Signin error (PASSWORD_COLUMN_LOOKUP_FAILED):', requestId, e);
      return serverError('PASSWORD_COLUMN_LOOKUP_FAILED', requestId, msg);
    }

    if (!passwordColumn) {
      console.error('Signin error (PASSWORD_COLUMN_NOT_FOUND):', requestId);
      return serverError('PASSWORD_COLUMN_NOT_FOUND', requestId);
    }

    let membersHasEmail = false;
    try {
      membersHasEmail = await getMembersHasEmail(client);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('Signin error (MEMBERS_SCHEMA_LOOKUP_FAILED):', requestId, e);
      return serverError('MEMBERS_SCHEMA_LOOKUP_FAILED', requestId, msg);
    }

    let result: QueryResult;
    try {
      result = isEmail
        ? await client.query(
            `
            SELECT u.id, u.email, u.${passwordColumn} as password_hash, u.full_name, u.role
            FROM users u
            WHERE lower(u.email) = lower($1)
            LIMIT 1
            `,
            [identifier]
          )
        : await client.query(
            `
            SELECT u.id, u.email, u.${passwordColumn} as password_hash, u.full_name, u.role
            FROM users u
            LEFT JOIN members m ON (m.user_id = u.id${membersHasEmail ? ' OR lower(m.email) = lower(u.email)' : ''})
            WHERE $1 IS NOT NULL
            AND regexp_replace(coalesce(m.phone, ''), '\\D', '', 'g') = $1
            `,
            [normalizedPhone]
          );
    } catch (e) {
      if (!isEmail && normalizedPhone) {
        // Fallback: for accounts created without email, we create a synthetic email in users.
        const phoneEmail = `${normalizedPhone}@phone.jukumu`;
        try {
          result = await client.query(
            `
            SELECT u.id, u.email, u.${passwordColumn} as password_hash, u.full_name, u.role
            FROM users u
            WHERE lower(u.email) = lower($1)
            LIMIT 1
            `,
            [phoneEmail]
          );
        } catch (fallbackErr) {
          const msg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
          console.error('Signin error (USER_LOOKUP_FAILED):', requestId, fallbackErr);
          return serverError('USER_LOOKUP_FAILED', requestId, msg);
        }
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('Signin error (USER_LOOKUP_FAILED):', requestId, e);
        return serverError('USER_LOOKUP_FAILED', requestId, msg);
      }
    }

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (!isEmail && result.rows.length > 1) {
      return NextResponse.json(
        { error: 'Namba ya simu inatumika kwenye akaunti zaidi ya moja.' },
        { status: 409 }
      );
    }

    const user = result.rows[0] as {
      id: number;
      email: string;
      password_hash: string | null;
      full_name: string;
      role: string;
    };

    // Verify password (tolerate legacy non-bcrypt values)
    const stored = user.password_hash;
    let isValidPassword = false;

    if (typeof stored === 'string' && stored.length > 0) {
      if (isBcryptHash(stored)) {
        try {
          isValidPassword = await bcrypt.compare(password, stored);
        } catch {
          isValidPassword = false;
        }
      } else {
        // Legacy plaintext fallback (migrate to bcrypt on success)
        isValidPassword = stored === password;
        if (isValidPassword) {
          try {
            const newHash = await bcrypt.hash(password, 12);
            await client.query(`UPDATE users SET ${passwordColumn} = $1 WHERE id = $2`, [newHash, user.id]);
          } catch {
            // ignore migration failure
          }
        }
      }
    }

    if (!isValidPassword) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Create JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.warn('JWT_SECRET is not set — using fallback. Set JWT_SECRET in your environment variables.');
    }

    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      },
      jwtSecret || 'jukumu-fallback-secret-change-me',
      { expiresIn: '7d' }
    );

    // Create response with token in cookie
    const response = NextResponse.json({ 
      user: { 
        id: user.id, 
        email: user.email, 
        fullName: user.full_name, 
        role: user.role 
      } 
    });

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    // Non-blocking: provision nTZS wallet for existing users who don't have one yet
    setImmediate(async () => {
      try {
        const walletClient = await pool.connect();
        try {
          await ensureNtzsSchema(walletClient);

          let memberRes = await walletClient.query(
            `SELECT id, phone, email, ntzs_user_id FROM members WHERE user_id = $1 LIMIT 1`,
            [user.id]
          );

          // Auto-create member record if missing
          if (memberRes.rows.length === 0) {
            const nm = await walletClient.query(
              `INSERT INTO members (user_id, full_name, email, phone, status)
               VALUES ($1, $2, $3, $4, 'active')
               ON CONFLICT DO NOTHING
               RETURNING id, phone, email, ntzs_user_id`,
              [user.id, user.full_name, user.email || null, null]
            );
            memberRes = nm;
          }

          if (memberRes.rows.length > 0) {
            const member = memberRes.rows[0] as { id: number; phone: string | null; email: string | null; ntzs_user_id: string | null };
            if (!member.ntzs_user_id) {
              const ntzsUser = await Promise.race([
                ntzs.users.create({
                  externalId: `member_${member.id}`,
                  email: member.email || user.email || undefined,
                  phone: member.phone ? member.phone.replace(/\D/g, '') : undefined,
                }),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('nTZS timeout')), 5000)),
              ]);
              await linkMemberWallet(walletClient, member.id, ntzsUser.id, ntzsUser.walletAddress);
              console.log(`[signin] nTZS wallet provisioned for member ${member.id}`);
            }
          }
        } finally {
          walletClient.release();
        }
      } catch (err) {
        if (err instanceof NtzsApiError) {
          console.error(`[signin] wallet provisioning failed (${err.status}):`, err.body);
        } else {
          console.error('[signin] wallet provisioning failed:', err);
        }
      }
    });

    return response;

  } catch (error) {
    console.error('Signin error (UNHANDLED):', requestId, error);
    const details = error instanceof Error ? error.message : String(error);
    return serverError('UNHANDLED', requestId, details);
  } finally {
    client?.release();
  }
}
