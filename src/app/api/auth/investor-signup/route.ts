import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ntzs } from '@/lib/ntzs';

export const runtime = 'nodejs';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

let cachedPasswordColumn: 'password_hash' | 'password' | null = null;

async function getPasswordColumn(client: import('pg').PoolClient) {
  if (cachedPasswordColumn) return cachedPasswordColumn;
  const res = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users'
       AND column_name IN ('password_hash', 'password')`
  );
  const cols = new Set((res as { rows: { column_name: string }[] }).rows.map(r => r.column_name));
  cachedPasswordColumn = cols.has('password_hash') ? 'password_hash' : cols.has('password') ? 'password' : null;
  return cachedPasswordColumn;
}

async function ensureInvestorSchema(client: { query: (sql: string, params?: unknown[]) => Promise<unknown> }) {
  await client.query(`
    DO $$
    DECLARE
      c_name TEXT;
    BEGIN
      FOR c_name IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'users'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%role%'
      LOOP
        EXECUTE 'ALTER TABLE users DROP CONSTRAINT ' || quote_ident(c_name);
      END LOOP;
      ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN ('admin', 'member', 'investor'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS investor_profiles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      full_name VARCHAR(255) NOT NULL,
      company VARCHAR(255),
      investor_type VARCHAR(50) DEFAULT 'individual' CHECK (investor_type IN ('individual', 'institutional', 'ngo', 'fund')),
      country VARCHAR(100) DEFAULT 'Tanzania',
      focus_areas TEXT[],
      min_investment_tzs NUMERIC(15,2),
      max_investment_tzs NUMERIC(15,2),
      website VARCHAR(500),
      linkedin VARCHAR(500),
      bio TEXT,
      verified BOOLEAN DEFAULT FALSE,
      ntzs_user_id VARCHAR(100),
      ntzs_wallet_address VARCHAR(42),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id)
    );
  `);

  // Add wallet columns to existing tables (safe to run repeatedly)
  await client.query(`ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS ntzs_user_id VARCHAR(100)`);
  await client.query(`ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS ntzs_wallet_address VARCHAR(42)`);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_investor_profiles_ntzs_user_id
      ON investor_profiles(ntzs_user_id) WHERE ntzs_user_id IS NOT NULL
  `);
}

export async function POST(request: NextRequest) {
  let client;
  try {
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : '';
    const company = typeof body?.company === 'string' ? body.company.trim() : null;
    const investorType = ['individual', 'institutional', 'ngo', 'fund'].includes(body?.investorType)
      ? body.investorType : 'individual';
    const country = typeof body?.country === 'string' ? body.country.trim() : 'Tanzania';

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: 'Jina, barua pepe, na nenosiri zinahitajika' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Nenosiri lazima liwe na herufi 8 au zaidi' }, { status: 400 });
    }

    client = await pool.connect();
    await ensureInvestorSchema(client);

    const passwordCol = await getPasswordColumn(client);
    if (!passwordCol) {
      return NextResponse.json({ error: 'Hitilafu ya muundo wa hifadhidata' }, { status: 500 });
    }

    const existing = await client.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [email]);
    if ((existing as { rows: unknown[] }).rows.length > 0) {
      return NextResponse.json({ error: 'Barua pepe hii tayari inasajiliwa' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await client.query('BEGIN');

    const userRes = await client.query(
      `INSERT INTO users (email, ${passwordCol}, full_name, role) VALUES ($1, $2, $3, 'investor') RETURNING id, email, full_name, role`,
      [email, passwordHash, fullName]
    ) as { rows: { id: number; email: string; full_name: string; role: string }[] };

    const user = userRes.rows[0];

    await client.query(
      `INSERT INTO investor_profiles (user_id, full_name, company, investor_type, country)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, fullName, company, investorType, country]
    );

    await client.query('COMMIT');

    // Provision nTZS wallet — non-blocking (doesn't fail signup on error)
    setImmediate(async () => {
      let walletClient;
      try {
        const ntzsUser = await Promise.race([
          ntzs.users.create({ externalId: `investor_${user.id}`, email: user.email }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
        ]);
        walletClient = await pool.connect();
        await walletClient.query(
          `UPDATE investor_profiles SET ntzs_user_id = $1, ntzs_wallet_address = $2, updated_at = NOW() WHERE user_id = $3`,
          [(ntzsUser as { id: string }).id, (ntzsUser as { walletAddress: string }).walletAddress, user.id]
        );
      } catch (err) {
        console.error(`Investor wallet provision failed for user ${user.id}:`, err);
      } finally {
        walletClient?.release();
      }
    });

    const token = jwt.sign({ userId: user.id, email: user.email, role: 'investor' }, JWT_SECRET, { expiresIn: '7d' });
    const userData = { id: user.id, email: user.email, fullName: user.full_name, role: 'investor' };

    const response = NextResponse.json({ success: true, user: userData });
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });
    return response;
  } catch (error) {
    try { await client?.query('ROLLBACK'); } catch {}
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Investor signup error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    client?.release();
  }
}
