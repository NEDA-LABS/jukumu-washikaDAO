import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { oncePerProcess } from '@/lib/db-once';

function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, '');

  if (!digits) return '';

  // Tanzania-friendly normalization
  if (digits.length === 10 && digits.startsWith('0')) return `255${digits.slice(1)}`;
  if (digits.length === 9) return `255${digits}`;

  return digits;
}

export async function GET() {
  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT id, full_name, email, phone, location, business_type, group_name, 
             gender, age, created_at, status 
      FROM members 
      ORDER BY created_at DESC
    `);
    client.release();
    
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fullName, email, phone, location, businessType, idType, idNumber, gender, age, status = 'pending' } = body;

    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      return NextResponse.json({ error: 'Jina kamili ni lazima.' }, { status: 400 });
    }

    if (!location || typeof location !== 'string' || !location.trim()) {
      return NextResponse.json({ error: 'Eneo ni lazima.' }, { status: 400 });
    }

    if (!businessType || typeof businessType !== 'string' || !businessType.trim()) {
      return NextResponse.json({ error: 'Aina ya biashara ni lazima.' }, { status: 400 });
    }

    if (!idType || typeof idType !== 'string' || !idType.trim()) {
      return NextResponse.json({ error: 'Aina ya kitambulisho ni lazima.' }, { status: 400 });
    }

    if (!idNumber || typeof idNumber !== 'string' || !idNumber.trim()) {
      return NextResponse.json({ error: 'Nambari ya kitambulisho ni lazima.' }, { status: 400 });
    }

    if (!gender || typeof gender !== 'string' || !gender.trim()) {
      return NextResponse.json({ error: 'Jinsia ni lazima.' }, { status: 400 });
    }

    const numericAge =
      typeof age === 'number'
        ? age
        : typeof age === 'string'
          ? Number.parseInt(age, 10)
          : Number.NaN;

    if (!Number.isFinite(numericAge)) {
      return NextResponse.json({ error: 'Umri si sahihi.' }, { status: 400 });
    }

    if (numericAge < 18 || numericAge > 100) {
      return NextResponse.json({ error: 'Umri lazima uwe kati ya 18 na 100.' }, { status: 400 });
    }

    const normalizedPhone = typeof phone === 'string' ? normalizePhone(phone) : '';
    if (!normalizedPhone) {
      return NextResponse.json({ error: 'Nambari ya simu ni lazima.' }, { status: 400 });
    }
 
    const client = await pool.connect();

    try {
      const existingPhone = await client.query(
        `
        SELECT id
        FROM members
        WHERE regexp_replace(coalesce(phone, ''), '\\D', '', 'g') = $1
        LIMIT 1
        `,
        [normalizedPhone]
      );

      if (existingPhone.rows.length > 0) {
        return NextResponse.json({ error: 'Nambari ya simu tayari imesajiliwa.' }, { status: 400 });
      }

      // Ensure ID columns exist — once per process, not on every registration
      try {
        await oncePerProcess('members-id-columns', async () => {
          await client.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS id_type VARCHAR(50)`);
          await client.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS id_number VARCHAR(100)`);
        });
      } catch (alterError) {
        console.log('Columns might already exist:', alterError);
      }

      const result = await client.query(
        `
        INSERT INTO members (full_name, email, phone, location, business_type, id_type, id_number, gender, age, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        `,
        [fullName, email, phone, location, businessType, idType, idNumber, gender, numericAge, status]
      );

      return NextResponse.json(result.rows[0], { status: 201 });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
