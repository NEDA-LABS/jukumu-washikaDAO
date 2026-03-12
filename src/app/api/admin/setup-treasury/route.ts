import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensureNtzsSchema } from '@/lib/ntzs-db';

export const runtime = 'nodejs';

/**
 * POST /api/admin/setup-treasury
 * Run database migration for nTZS treasury support
 * Admin only
 */
export async function POST(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ensure nTZS schema (members + groups wallet columns, transactions table)
    await ensureNtzsSchema(client);

    // Add voting thresholds to groups
    await client.query(`
      ALTER TABLE groups ADD COLUMN IF NOT EXISTS voting_threshold_numerator INTEGER DEFAULT 3
    `);
    await client.query(`
      ALTER TABLE groups ADD COLUMN IF NOT EXISTS voting_threshold_denominator INTEGER DEFAULT 5
    `);

    // Extend group_proposals for payment support
    await client.query(`
      ALTER TABLE group_proposals ADD COLUMN IF NOT EXISTS payment_amount_tzs INTEGER
    `);
    await client.query(`
      ALTER TABLE group_proposals ADD COLUMN IF NOT EXISTS recipient_member_id INTEGER REFERENCES members(id) ON DELETE SET NULL
    `);
    await client.query(`
      ALTER TABLE group_proposals ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(30)
    `);
    await client.query(`
      ALTER TABLE group_proposals ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending'
    `);
    await client.query(`
      ALTER TABLE group_proposals ADD COLUMN IF NOT EXISTS payment_tx_id VARCHAR(100)
    `);
    await client.query(`
      ALTER TABLE group_proposals ADD COLUMN IF NOT EXISTS executed_at TIMESTAMP
    `);

    // Add constraint for payment_status
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE group_proposals DROP CONSTRAINT IF EXISTS group_proposals_payment_status_check;
        ALTER TABLE group_proposals ADD CONSTRAINT group_proposals_payment_status_check
          CHECK (payment_status IN ('pending', 'approved', 'executed', 'rejected'));
      EXCEPTION WHEN undefined_table THEN NULL;
      END $$;
    `);

    // Add indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_group_proposals_payment_status ON group_proposals(payment_status)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_group_proposals_recipient_member ON group_proposals(recipient_member_id)
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_ntzs_user_id ON groups(ntzs_user_id) WHERE ntzs_user_id IS NOT NULL
    `);

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: 'Treasury schema migration completed successfully',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Treasury setup error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Migration failed', details: message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
