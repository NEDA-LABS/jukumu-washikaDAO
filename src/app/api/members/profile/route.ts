import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { oncePerProcess } from '@/lib/db-once';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const client = await pool.connect();

    try {
      // Ensure the avatar column exists (idempotent).
      await oncePerProcess('members-avatar-column', () => client.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS avatar_url TEXT`));
      // Primary lookup: member linked to this user
      let result = await client.query(`
        SELECT
          m.id,
          m.full_name,
          -- Without this the dashboard sees username: undefined for everyone,
          -- so the claim prompt reappears on every sign-in no matter how many
          -- times you claim one, and Settings shows the field blank.
          m.username,
          m.email,
          m.phone,
          m.location,
          m.business_type,
          m.business_name,
          m.business_description,
          m.gender,
          m.age,
          m.monthly_revenue,
          m.employee_count,
          m.avatar_url,
          m.status,
          m.created_at,
          g.name as group_name,
          g.id as group_id,
          gm.role as group_role
        FROM members m
        LEFT JOIN group_members gm ON m.id = gm.member_id
        LEFT JOIN groups g ON gm.group_id = g.id
        WHERE m.user_id = $1
      `, [userId]);

      // Self-healing fallback: if no linked member found, try matching by email or phone
      if (result.rows.length === 0) {
        const userRes = await client.query(
          'SELECT email FROM users WHERE id = $1 LIMIT 1',
          [userId]
        );
        if (userRes.rows.length > 0) {
          const userEmail = (userRes.rows[0] as { email: string }).email;
          // Try email match first (standard users)
          await client.query(
            `UPDATE members SET user_id = $1
             WHERE user_id IS NULL
               AND lower(email) = lower($2)
               AND NOT EXISTS (SELECT 1 FROM members m2 WHERE m2.user_id = $1)`,
            [userId, userEmail]
          );
          // Phone-only users have users.email = "{phone}@phone.jukumu" — extract the
          // digits and also try linking by member.phone for those users.
          const phoneOnlyMatch = userEmail.match(/^(\d+)@phone\.jukumu$/);
          if (phoneOnlyMatch) {
            const phoneDigits = phoneOnlyMatch[1];
            await client.query(
              `UPDATE members SET user_id = $1
               WHERE user_id IS NULL
                 AND regexp_replace(coalesce(phone, ''), '\\D', '', 'g') = $2
                 AND NOT EXISTS (SELECT 1 FROM members m2 WHERE m2.user_id = $1)`,
              [userId, phoneDigits]
            );
          }
          // Re-fetch after linking
          result = await client.query(`
            SELECT 
              m.id,
              m.full_name,
              m.email,
              m.phone,
              m.location,
              m.business_type,
              m.business_name,
              m.business_description,
              m.gender,
              m.age,
              m.monthly_revenue,
              m.employee_count,
              m.status,
              m.created_at,
              g.name as group_name,
              g.id as group_id,
              gm.role as group_role
            FROM members m
            LEFT JOIN group_members gm ON m.id = gm.member_id
            LEFT JOIN groups g ON gm.group_id = g.id
            WHERE m.user_id = $1
          `, [userId]);
        }
      }

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Member profile not found' }, { status: 404 });
      }

      return NextResponse.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const body = await request.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Patch semantics: only columns actually present in the body are written.
    // Sending just { avatarUrl } from Settings must not blank out the rest of
    // the profile, which a fixed all-columns UPDATE would do.
    const FIELDS: Record<string, string> = {
      fullName: 'full_name',
      phone: 'phone',
      location: 'location',
      businessType: 'business_type',
      businessName: 'business_name',
      businessDescription: 'business_description',
      monthlyRevenue: 'monthly_revenue',
      employeeCount: 'employee_count',
      avatarUrl: 'avatar_url',
    };

    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, column] of Object.entries(FIELDS)) {
      if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
      const raw = body[key];
      values.push(typeof raw === 'string' && raw.length === 0 ? null : raw ?? null);
      sets.push(`${column} = $${values.length}`);
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const client = await pool.connect();
    await oncePerProcess('members-avatar-column', () => client.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS avatar_url TEXT`));

    values.push(userId);
    const result = await client.query(
      `UPDATE members SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $${values.length} RETURNING *`,
      values,
    );

    client.release();
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }
    
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
