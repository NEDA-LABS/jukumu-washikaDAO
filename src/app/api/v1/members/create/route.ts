import pool from '@/lib/db';
import { handle, ok, fail } from '@/lib/api/http';
import { serializeMember } from '@/lib/api/serialize';
import { normalizePhone } from '@/lib/api/money';
import { stamp } from '@/lib/api/scope';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/members/create
 * Onboard a member into your own tenant. This is the entry point for an
 * integration: a partner starts with no data at all, so a member has to exist
 * before there is anyone to lead a group or move money.
 *
 * The created member is stamped with your partner id and is visible only to
 * your keys. Phone numbers are stored but never returned by the API.
 *
 * Body: { full_name, phone?, location?, business_name?, business_type?,
 *         business_description?, gender?, age?, status? }
 */
const STATUSES = new Set(['active', 'pending', 'inactive']);

export const POST = handle('write', async (request, { scope }) => {
  const body = await request.json().catch(() => null);

  const fullName = String(body?.full_name ?? '').trim();
  if (!fullName) return fail(422, 'invalid_request', '`full_name` is required.');

  const status = body?.status ?? 'active';
  if (!STATUSES.has(status)) {
    return fail(422, 'invalid_request', `\`status\` must be one of: ${[...STATUSES].join(', ')}.`);
  }

  let phone: string | null = null;
  if (body?.phone) {
    phone = normalizePhone(body.phone);
    if (!phone) return fail(422, 'invalid_request', '`phone` must be a Tanzanian number.');
  }

  const age = body?.age != null ? Number(body.age) : null;
  if (age !== null && (!Number.isInteger(age) || age < 0 || age > 130)) {
    return fail(422, 'invalid_request', '`age` must be a whole number of years.');
  }

  const str = (v: unknown, max: number) =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

  const client = await pool.connect();
  try {
    // Duplicate phones are rejected inside a tenant only. Two partners may
    // each independently know the same person.
    if (phone) {
      const dupeValues: unknown[] = [phone];
      const tenant = scope.firstParty ? 'partner_id IS NULL' : `partner_id = $2`;
      if (!scope.firstParty) dupeValues.push(scope.partnerId);
      const dupe = await client.query(
        `SELECT id FROM members WHERE phone = $1 AND ${tenant} LIMIT 1`, dupeValues,
      );
      if (dupe.rows.length > 0) {
        return fail(409, 'member_exists', 'You already have a member with that phone number.');
      }
    }

    const inserted = await client.query(
      `INSERT INTO members
         (full_name, phone, location, business_name, business_type,
          business_description, gender, age, status, partner_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, full_name, username, avatar_url, location, status,
                 business_name, business_type, business_description, created_at`,
      [
        fullName.slice(0, 255), phone,
        str(body?.location, 160), str(body?.business_name, 160),
        str(body?.business_type, 80), str(body?.business_description, 2000),
        str(body?.gender, 20), age, status, stamp(scope),
      ],
    );

    return ok(serializeMember(inserted.rows[0]), undefined, { status: 201 });
  } finally {
    client.release();
  }
});
