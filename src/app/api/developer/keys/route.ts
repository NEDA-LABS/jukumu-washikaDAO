import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensureApiKeysSchema, generateKey, type ApiScope } from '@/lib/api/keys';

export const dynamic = 'force-dynamic';

/**
 * API key management for the signed-in user. This is session-authenticated
 * (not key-authenticated) — it is how a developer bootstraps their first key.
 */

export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = await pool.connect();
  try {
    await ensureApiKeysSchema(client);
    const res = await client.query(
      `SELECT id, name, key_hint, scopes, rate_limit_per_min, last_used_at, revoked_at, created_at
         FROM api_keys WHERE owner_user_id = $1 ORDER BY created_at DESC`,
      [auth.userId],
    );
    // Never return key_hash; the hint is the last 4 chars for identification.
    return NextResponse.json({ keys: res.rows });
  } catch (error) {
    console.error('[developer/keys] list', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 120) : 'Default key';
  const requested: string[] = Array.isArray(body?.scopes) ? body.scopes : ['read'];
  const scopes = requested.filter((s): s is ApiScope => s === 'read' || s === 'write');
  if (scopes.length === 0) scopes.push('read');

  const client = await pool.connect();
  try {
    await ensureApiKeysSchema(client);

    const existing = await client.query(
      `SELECT COUNT(*)::int AS n FROM api_keys WHERE owner_user_id = $1 AND revoked_at IS NULL`,
      [auth.userId],
    );
    if ((existing.rows[0] as { n: number }).n >= 10) {
      return NextResponse.json({ error: 'Key limit reached (10). Revoke an unused key first.' }, { status: 429 });
    }

    const { raw, hash, hint } = generateKey();
    const res = await client.query(
      `INSERT INTO api_keys (name, key_hash, key_hint, owner_user_id, scopes)
       VALUES ($1, $2, $3, $4, $5::text[])
       RETURNING id, name, key_hint, scopes, rate_limit_per_min, created_at`,
      [name, hash, hint, auth.userId, scopes],
    );

    // `key` is returned exactly once — only the hash is stored.
    return NextResponse.json({ key: raw, record: res.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[developer/keys] create', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'A numeric ?id= is required.' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await ensureApiKeysSchema(client);
    const res = await client.query(
      `UPDATE api_keys SET revoked_at = NOW()
        WHERE id = $1 AND owner_user_id = $2 AND revoked_at IS NULL
        RETURNING id`,
      [id, auth.userId],
    );
    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Key not found or already revoked.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, revoked: id });
  } catch (error) {
    console.error('[developer/keys] revoke', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
