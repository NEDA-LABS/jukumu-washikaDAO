import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'investor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let client;
  try {
    client = await pool.connect();
    const res = await client.query(
      `SELECT ip.*, u.email
       FROM investor_profiles ip
       JOIN users u ON u.id = ip.user_id
       WHERE ip.user_id = $1 LIMIT 1`,
      [auth.userId]
    );
    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, profile: res.rows[0] });
  } catch (error) {
    console.error('Investor profile GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client?.release();
  }
}

export async function PUT(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'investor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const fields: Record<string, unknown> = {};

  if (typeof body?.fullName === 'string') fields.full_name = body.fullName.trim();
  if (typeof body?.company === 'string') fields.company = body.company.trim() || null;
  if (['individual', 'institutional', 'ngo', 'fund'].includes(body?.investorType)) fields.investor_type = body.investorType;
  if (typeof body?.country === 'string') fields.country = body.country.trim();
  if (typeof body?.website === 'string') fields.website = body.website.trim() || null;
  if (typeof body?.linkedin === 'string') fields.linkedin = body.linkedin.trim() || null;
  if (typeof body?.bio === 'string') fields.bio = body.bio.trim() || null;
  if (body?.minInvestmentTzs !== undefined) fields.min_investment_tzs = body.minInvestmentTzs ? Number(body.minInvestmentTzs) : null;
  if (body?.maxInvestmentTzs !== undefined) fields.max_investment_tzs = body.maxInvestmentTzs ? Number(body.maxInvestmentTzs) : null;
  if (Array.isArray(body?.focusAreas)) fields.focus_areas = body.focusAreas.filter((f: unknown) => typeof f === 'string');

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  let client;
  try {
    client = await pool.connect();
    const setClauses = Object.keys(fields).map((k, i) => `${k} = $${i + 2}`).join(', ');
    const values = [auth.userId, ...Object.values(fields)];
    await client.query(
      `UPDATE investor_profiles SET ${setClauses}, updated_at = NOW() WHERE user_id = $1`,
      values
    );
    const res = await client.query(`SELECT * FROM investor_profiles WHERE user_id = $1 LIMIT 1`, [auth.userId]);
    return NextResponse.json({ success: true, profile: res.rows[0] });
  } catch (error) {
    console.error('Investor profile PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client?.release();
  }
}
