import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { oncePerProcess } from '@/lib/db-once';
import { getAuthTokenPayload } from '@/lib/auth';
import { notifyGroupMembers } from '@/lib/notify';

const LEADERSHIP_ROLES = new Set(['leader', 'mwenyekiti', 'katibu', 'mwekahazina']);
const VALID_TYPES = ['general', 'ask', 'spend', 'prodcast'] as const;
type ProposalType = typeof VALID_TYPES[number];

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

  // Payment + type columns — safe to run every time
  const alterStatements = [
    `ALTER TABLE group_proposals ADD COLUMN IF NOT EXISTS payment_amount_tzs NUMERIC(15,2)`,
    `ALTER TABLE group_proposals ADD COLUMN IF NOT EXISTS recipient_member_id INTEGER REFERENCES members(id) ON DELETE SET NULL`,
    `ALTER TABLE group_proposals ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(20)`,
    `ALTER TABLE group_proposals ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) CHECK (payment_status IN ('pending','processing','completed','failed'))`,
    `ALTER TABLE group_proposals ADD COLUMN IF NOT EXISTS payment_tx_id VARCHAR(255)`,
    `ALTER TABLE group_proposals ADD COLUMN IF NOT EXISTS executed_at TIMESTAMP`,
    `ALTER TABLE group_proposals ADD COLUMN IF NOT EXISTS proposal_type VARCHAR(20) DEFAULT 'general' CHECK (proposal_type IN ('general','ask','spend','prodcast'))`,
    `ALTER TABLE group_proposals ADD COLUMN IF NOT EXISTS metadata JSONB`,
    `ALTER TABLE group_proposals ADD COLUMN IF NOT EXISTS funded_at TIMESTAMP`,
  ];
  for (const sql of alterStatements) {
    await client.query(sql);
  }

  await client.query(`CREATE INDEX IF NOT EXISTS idx_group_proposals_group_id ON group_proposals(group_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_group_proposals_created_at ON group_proposals(created_at DESC)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_group_proposals_type ON group_proposals(proposal_type)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_group_proposals_funded ON group_proposals(funded_at) WHERE funded_at IS NOT NULL`);

  // Rename 'prodast' → 'prodcast' in existing rows and update CHECK constraint
  await client.query(`
    DO $$
    DECLARE c_name TEXT;
    BEGIN
      UPDATE group_proposals SET proposal_type = 'prodcast' WHERE proposal_type = 'prodast';
      FOR c_name IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'group_proposals'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%prodast%'
      LOOP
        EXECUTE 'ALTER TABLE group_proposals DROP CONSTRAINT ' || quote_ident(c_name);
      END LOOP;
      ALTER TABLE group_proposals ADD CONSTRAINT group_proposals_proposal_type_check
        CHECK (proposal_type IN ('general','ask','spend','prodcast'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  // Repair divergent payment_status CHECK constraints. Older databases (migration
  // 002 / setup-treasury) created this column with CHECK (... IN
  // ('pending','approved','executed','rejected')), which rejects the 'completed'
  // status the disbursement flow writes. ADD COLUMN IF NOT EXISTS can't alter an
  // existing column's constraint, so drop every payment_status CHECK and re-add
  // one allowing the union of legacy + current values (legacy values are kept so
  // the re-add can't fail on pre-existing rows).
  await client.query(`
    DO $$
    DECLARE c_name TEXT;
    BEGIN
      FOR c_name IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'group_proposals'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%payment_status%'
      LOOP
        EXECUTE 'ALTER TABLE group_proposals DROP CONSTRAINT ' || quote_ident(c_name);
      END LOOP;
      ALTER TABLE group_proposals ADD CONSTRAINT group_proposals_payment_status_check
        CHECK (payment_status IS NULL OR payment_status IN
          ('pending','processing','completed','failed','approved','executed','rejected'));
    EXCEPTION WHEN others THEN NULL;
    END $$;
  `);
}

async function getMembership(client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }, userId: number, groupId: number) {
  const membershipRes = await client.query(
    `SELECT gm.member_id, gm.role, gm.status
     FROM group_members gm
     JOIN members m ON m.id = gm.member_id
     WHERE m.user_id = $1 AND gm.group_id = $2
     LIMIT 1`,
    [userId, groupId]
  );
  if (membershipRes.rows.length === 0) return null;
  return membershipRes.rows[0] as { member_id: number; role: string; status: string };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const groupId = Number.parseInt(id, 10);
  if (!Number.isFinite(groupId)) return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });

  const client = await pool.connect();
  try {
    await oncePerProcess('proposal-schema', () => ensureProposalSchema(client));

    const membership = await getMembership(client, auth.userId, groupId);
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const proposalsRes = await client.query(
      `SELECT
          p.id, p.group_id, p.title, p.description, p.status,
          p.proposal_type, p.metadata, p.funded_at,
          p.payment_amount_tzs, p.recipient_member_id, p.recipient_phone,
          p.payment_status, p.payment_tx_id, p.executed_at,
          p.created_at, p.updated_at,
          m.full_name AS created_by_name, m.id AS created_by_member_id,
          rm.full_name AS recipient_name
        FROM group_proposals p
        JOIN members m ON m.id = p.created_by_member_id
        LEFT JOIN members rm ON rm.id = p.recipient_member_id
        WHERE p.group_id = $1
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT 100`,
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
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const groupId = Number.parseInt(id, 10);
  if (!Number.isFinite(groupId)) return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const proposalType: ProposalType = VALID_TYPES.includes(body?.proposalType) ? body.proposalType : 'general';
  const metadata = body?.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
    ? body.metadata as Record<string, unknown>
    : null;

  // Sanitize the optional attachment: it is rendered client-side as an
  // <img src> / <a href>, so only accept a bounded image/PDF data: URL —
  // never arbitrary strings (javascript:, external URLs, oversized blobs).
  if (metadata && 'attachment' in metadata) {
    const a = metadata.attachment as { dataUrl?: unknown; name?: unknown; mime?: unknown } | null;
    const dataUrl = typeof a?.dataUrl === 'string' ? a.dataUrl : '';
    const validHead = /^data:(image\/(jpeg|png|webp|gif)|application\/pdf);base64,/.test(dataUrl);
    if (validHead && dataUrl.length <= 4_000_000) {
      metadata.attachment = {
        dataUrl,
        name: typeof a?.name === 'string' ? a.name.slice(0, 200) : 'attachment',
        mime: dataUrl.slice(5, dataUrl.indexOf(';')),
      };
    } else {
      delete metadata.attachment;
    }
  }

  let paymentAmountTzs = body?.paymentAmountTzs ? Number(body.paymentAmountTzs) : null;
  let recipientMemberId = body?.recipientMemberId ? Number(body.recipientMemberId) : null;
  const recipientPhone = typeof body?.recipientPhone === 'string' ? body.recipientPhone.trim() : null;

  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

  const client = await pool.connect();
  try {
    await oncePerProcess('proposal-schema', () => ensureProposalSchema(client));

    const membership = await getMembership(client, auth.userId, groupId);
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!LEADERSHIP_ROLES.has(membership.role)) {
      return NextResponse.json({ error: 'You do not have permission to create proposals' }, { status: 403 });
    }

    // Type-specific validation
    if (proposalType === 'ask') {
      if (!paymentAmountTzs || !Number.isFinite(paymentAmountTzs) || paymentAmountTzs <= 0) {
        return NextResponse.json({ error: 'Ask proposal requires a valid amount' }, { status: 400 });
      }
      // Auto-set recipient to requester
      recipientMemberId = membership.member_id;
    } else if (proposalType === 'spend') {
      if (!paymentAmountTzs || !Number.isFinite(paymentAmountTzs) || paymentAmountTzs <= 0) {
        return NextResponse.json({ error: 'Spend proposal requires a valid amount' }, { status: 400 });
      }
      if (!recipientMemberId && !recipientPhone) {
        return NextResponse.json({ error: 'Spend proposal requires a recipient (member or phone)' }, { status: 400 });
      }
    } else if (proposalType === 'prodcast') {
      const goalTzs = Number(metadata?.funding_goal_tzs);
      if (!metadata || !Number.isFinite(goalTzs) || goalTzs <= 0) {
        return NextResponse.json({ error: 'Prodcast proposal requires a valid funding_goal_tzs in metadata' }, { status: 400 });
      }
      if (paymentAmountTzs) {
        return NextResponse.json({ error: 'Prodcast proposals cannot have a direct payment amount' }, { status: 400 });
      }
      paymentAmountTzs = null;
      recipientMemberId = null;
    } else {
      // general — no payment
      paymentAmountTzs = null;
      recipientMemberId = null;
    }

    const insertRes = await client.query(
      `INSERT INTO group_proposals (
          group_id, created_by_member_id, title, description,
          proposal_type, metadata,
          payment_amount_tzs, recipient_member_id, recipient_phone, payment_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id`,
      [
        groupId,
        membership.member_id,
        title,
        description || null,
        proposalType,
        metadata ? JSON.stringify(metadata) : null,
        paymentAmountTzs,
        recipientMemberId,
        recipientPhone || null,
        paymentAmountTzs ? 'pending' : null,
      ]
    );

    const proposalId = (insertRes.rows[0] as { id: number }).id;

    const proposalRes = await client.query(
      `SELECT
          p.id, p.group_id, p.title, p.description, p.status,
          p.proposal_type, p.metadata, p.funded_at,
          p.payment_amount_tzs, p.recipient_member_id, p.recipient_phone,
          p.payment_status, p.payment_tx_id, p.executed_at,
          p.created_at, p.updated_at,
          m.full_name AS created_by_name, m.id AS created_by_member_id,
          rm.full_name AS recipient_name
        FROM group_proposals p
        JOIN members m ON m.id = p.created_by_member_id
        LEFT JOIN members rm ON rm.id = p.recipient_member_id
        WHERE p.id = $1
        LIMIT 1`,
      [proposalId]
    );

    // Notify all group members of the new proposal.
    try {
      const creatorName = (proposalRes.rows[0] as { created_by_name?: string } | undefined)?.created_by_name || 'Kiongozi';
      await notifyGroupMembers(client, groupId, {
        title: 'Pendekezo Jipya',
        message: `${creatorName} ameunda pendekezo: "${title}". Piga kura sasa.`,
        titleEn: 'New Proposal',
        messageEn: `${creatorName} created a proposal: "${title}". Cast your vote now.`,
        type: 'info', category: 'proposal',
        actionUrl: `/member-dashboard/groups/${groupId}/proposals/${proposalId}`,
        actionText: 'Piga Kura',
        metadata: { proposalId, groupId, kind: 'proposal' },
      }, auth.userId);
    } catch (e) { console.error('[proposals] notify failed:', e); }

    return NextResponse.json({ success: true, proposal: proposalRes.rows[0] || null });
  } catch (error) {
    console.error('Create proposal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
