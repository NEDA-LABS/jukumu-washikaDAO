import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensurePartnersSchema, getPartner } from '@/lib/api/partners';

export const dynamic = 'force-dynamic';

/** GET /api/developer/partner — the caller's partner profile, or null. */
export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const partner = await getPartner(auth.userId);
  return NextResponse.json({ partner });
}

/**
 * POST /api/developer/partner — register as a partner.
 *
 * Read access is granted immediately. Write access moves real money, so
 * asking for it only records the request; a human still has to enable it.
 */
export async function POST(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const orgName = String(body?.org_name ?? '').trim();
  const contactEmail = String(body?.contact_email ?? '').trim();
  const website = String(body?.website ?? '').trim() || null;
  const useCase = String(body?.use_case ?? '').trim();
  const wantsWrite = Boolean(body?.wants_write);

  if (orgName.length < 2) return NextResponse.json({ error: 'Organisation name is required.' }, { status: 422 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail)) {
    return NextResponse.json({ error: 'A valid contact email is required.' }, { status: 422 });
  }
  if (useCase.length < 20) {
    return NextResponse.json({ error: 'Tell us a little more about what you are building (at least 20 characters).' }, { status: 422 });
  }

  await ensurePartnersSchema();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `INSERT INTO api_partners (user_id, org_name, contact_email, website, use_case, write_requested)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE
         SET org_name = EXCLUDED.org_name,
             contact_email = EXCLUDED.contact_email,
             website = EXCLUDED.website,
             use_case = EXCLUDED.use_case,
             write_requested = api_partners.write_requested OR EXCLUDED.write_requested,
             updated_at = NOW()
       RETURNING id, user_id, org_name, contact_email, website, use_case,
                 status, write_enabled, write_requested, created_at`,
      [auth.userId, orgName.slice(0, 160), contactEmail.slice(0, 200), website?.slice(0, 300) ?? null, useCase.slice(0, 2000), wantsWrite],
    );
    return NextResponse.json({ partner: res.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
