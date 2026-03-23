import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';

const LEADERSHIP_ROLES = new Set(['leader', 'mwenyekiti', 'katibu', 'mwekahazina']);

async function ensureProposalSchema(client: { query: (sql: string, params?: unknown[]) => Promise<unknown> }) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS group_proposals (
      id SERIAL PRIMARY KEY,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      created_by_member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Add payment columns if they don't exist yet (safe to run every time)
  const alterStatements = [
    `ALTER TABLE group_proposals ADD COLUMN IF NOT EXISTS payment_amount_tzs NUMERIC(15,2)`,
    `ALTER TABLE group_proposals ADD COLUMN IF NOT EXISTS recipient_member_id INTEGER REFERENCES members(id) ON DELETE SET NULL`,
    `ALTER TABLE group_proposals ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(20)`,
    `ALTER TABLE group_proposals ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) CHECK (payment_status IN ('pending','processing','completed','failed'))`,
    `ALTER TABLE group_proposals ADD COLUMN IF NOT EXISTS payment_tx_id VARCHAR(255)`,
    `ALTER TABLE group_proposals ADD COLUMN IF NOT EXISTS executed_at TIMESTAMP`,
  ];
  for (const sql of alterStatements) {
    await client.query(sql);
  }

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_group_proposals_group_id ON group_proposals(group_id);
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_group_proposals_created_at ON group_proposals(created_at DESC);
  `);
}

async function getMembership(client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }, userId: number, groupId: number) {
  const membershipRes = await client.query(
    `
      SELECT gm.member_id, gm.role, gm.status
      FROM group_members gm
      JOIN members m ON m.id = gm.member_id
      WHERE m.user_id = $1
        AND gm.group_id = $2
      LIMIT 1
    `,
    [userId, groupId]
  );

  if (membershipRes.rows.length === 0) return null;
  return membershipRes.rows[0] as { member_id: number; role: string; status: string };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthTokenPayload(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const groupId = Number.parseInt(id, 10);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await ensureProposalSchema(client);

    const membership = await getMembership(client, auth.userId, groupId);
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const proposalsRes = await client.query(
      `
        SELECT
          p.id,
          p.group_id,
          p.title,
          p.description,
          p.status,
          p.payment_amount_tzs,
          p.recipient_member_id,
          p.recipient_phone,
          p.payment_status,
          p.payment_tx_id,
          p.executed_at,
          p.created_at,
          p.updated_at,
          m.full_name AS created_by_name,
          m.id AS created_by_member_id,
          rm.full_name AS recipient_name
        FROM group_proposals p
        JOIN members m ON m.id = p.created_by_member_id
        LEFT JOIN members rm ON rm.id = p.recipient_member_id
        WHERE p.group_id = $1
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT 100
      `,
      [groupId]
    );

    return NextResponse.json({ success: true, proposals: proposalsRes.rows, membership });
  } catch (error) {
    console.error('Member group proposals error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthTokenPayload(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const groupId = Number.parseInt(id, 10);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const paymentAmountTzs = body?.paymentAmountTzs ? Number(body.paymentAmountTzs) : null;
  const recipientMemberId = body?.recipientMemberId ? Number(body.recipientMemberId) : null;
  const recipientPhone = typeof body?.recipientPhone === 'string' ? body.recipientPhone.trim() : null;

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  // Validate payment proposal fields
  if (paymentAmountTzs !== null) {
    if (!Number.isFinite(paymentAmountTzs) || paymentAmountTzs <= 0) {
      return NextResponse.json({ error: 'Invalid payment amount' }, { status: 400 });
    }
    if (!recipientMemberId && !recipientPhone) {
      return NextResponse.json({ error: 'Payment proposal requires a recipient' }, { status: 400 });
    }
  }

  const client = await pool.connect();
  try {
    await ensureProposalSchema(client);

    const membership = await getMembership(client, auth.userId, groupId);
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!LEADERSHIP_ROLES.has(membership.role)) {
      return NextResponse.json({ error: 'You do not have permission to create proposals' }, { status: 403 });
    }

    const insertRes = await client.query(
      `
        INSERT INTO group_proposals (
          group_id, created_by_member_id, title, description,
          payment_amount_tzs, recipient_member_id, recipient_phone, payment_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `,
      [
        groupId,
        membership.member_id,
        title,
        description || null,
        paymentAmountTzs,
        recipientMemberId,
        recipientPhone,
        paymentAmountTzs ? 'pending' : null
      ]
    );

    const proposalId = (insertRes.rows[0] as { id: number }).id;

    const proposalRes = await client.query(
      `
        SELECT
          p.id,
          p.group_id,
          p.title,
          p.description,
          p.status,
          p.payment_amount_tzs,
          p.recipient_member_id,
          p.recipient_phone,
          p.payment_status,
          p.payment_tx_id,
          p.executed_at,
          p.created_at,
          p.updated_at,
          m.full_name AS created_by_name,
          m.id AS created_by_member_id,
          rm.full_name AS recipient_name
        FROM group_proposals p
        JOIN members m ON m.id = p.created_by_member_id
        LEFT JOIN members rm ON rm.id = p.recipient_member_id
        WHERE p.id = $1
        LIMIT 1
      `,
      [proposalId]
    );

    return NextResponse.json({ success: true, proposal: proposalRes.rows[0] || null });
  } catch (error) {
    console.error('Create proposal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
