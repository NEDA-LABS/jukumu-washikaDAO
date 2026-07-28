import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensurePartnersSchema } from '@/lib/api/partners';

export const dynamic = 'force-dynamic';

async function requireAdmin(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const res = await pool.query(`SELECT role FROM users WHERE id = $1 LIMIT 1`, [auth.userId]);
  const role = (res.rows[0] as { role?: string } | undefined)?.role;
  if (role !== 'admin') {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }
  return { auth };
}

/** GET /api/admin/partners — every partner, with key counts and usage. */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard.error) return guard.error;

  await ensurePartnersSchema();
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT p.id, p.user_id, p.org_name, p.contact_email, p.website, p.use_case,
             p.status, p.write_enabled, p.write_requested, p.created_at,
             u.email AS user_email, u.full_name AS user_name,
             COALESCE(k.active_keys, 0)::int AS active_keys,
             COALESCE(k.reqs_7d, 0)::int AS requests_7d
        FROM api_partners p
        LEFT JOIN users u ON u.id = p.user_id
        LEFT JOIN (
          SELECT ak.owner_user_id,
                 COUNT(*) FILTER (WHERE ak.revoked_at IS NULL) AS active_keys,
                 COALESCE(SUM(usage.reqs), 0) AS reqs_7d
            FROM api_keys ak
            LEFT JOIN (
              SELECT key_id, SUM(requests) AS reqs FROM api_key_usage
               WHERE day > CURRENT_DATE - 7 GROUP BY key_id
            ) usage ON usage.key_id = ak.id
           GROUP BY ak.owner_user_id
        ) k ON k.owner_user_id = p.user_id
       ORDER BY (p.write_requested AND NOT p.write_enabled) DESC, p.created_at DESC
    `);
    return NextResponse.json({ partners: res.rows });
  } catch (error) {
    console.error('[admin/partners] list', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}

/**
 * PATCH /api/admin/partners — approve or revoke write access, or suspend.
 * Body: { partner_id, write_enabled?, status? }
 */
export async function PATCH(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard.error) return guard.error;

  const body = await request.json().catch(() => null);
  const partnerId = Number(body?.partner_id);
  if (!Number.isFinite(partnerId)) {
    return NextResponse.json({ error: '`partner_id` is required.' }, { status: 422 });
  }

  const sets: string[] = [];
  const values: unknown[] = [];

  if (typeof body?.write_enabled === 'boolean') {
    values.push(body.write_enabled);
    sets.push(`write_enabled = $${values.length}`);
    // Granting write clears the pending flag so it leaves the review queue.
    if (body.write_enabled) sets.push(`write_requested = false`);
  }
  if (body?.status === 'active' || body?.status === 'suspended') {
    values.push(body.status);
    sets.push(`status = $${values.length}`);
  }
  if (sets.length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 422 });
  }

  await ensurePartnersSchema();
  const client = await pool.connect();
  try {
    values.push(partnerId);
    const res = await client.query(
      `UPDATE api_partners SET ${sets.join(', ')}, updated_at = NOW()
        WHERE id = $${values.length} RETURNING *`,
      values,
    );
    if (res.rows.length === 0) return NextResponse.json({ error: 'Partner not found.' }, { status: 404 });
    return NextResponse.json({ partner: res.rows[0] });
  } catch (error) {
    console.error('[admin/partners] update', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
