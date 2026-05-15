import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';

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
}

async function ensureProposalVotingSchema(client: { query: (sql: string, params?: unknown[]) => Promise<unknown> }) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS group_proposal_votes (
      id SERIAL PRIMARY KEY,
      proposal_id INTEGER NOT NULL REFERENCES group_proposals(id) ON DELETE CASCADE,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      vote VARCHAR(20) NOT NULL CHECK (vote IN ('yes', 'no', 'abstain')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(proposal_id, member_id)
    );
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_group_proposal_votes_proposal_id ON group_proposal_votes(proposal_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_group_proposal_votes_member_id ON group_proposal_votes(member_id)`);
}

async function getMembership(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> },
  userId: number,
  groupId: number
) {
  const res = await client.query(
    `SELECT gm.member_id, gm.role, gm.status
     FROM group_members gm
     JOIN members m ON m.id = gm.member_id
     WHERE m.user_id = $1 AND gm.group_id = $2
     LIMIT 1`,
    [userId, groupId]
  );
  if (res.rows.length === 0) return null;
  return res.rows[0] as { member_id: number; role: string; status: string };
}

async function getVoteSummary(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> },
  proposalId: number
) {
  const res = await client.query(
    `SELECT
        COUNT(*) FILTER (WHERE vote = 'yes')::int AS yes,
        COUNT(*) FILTER (WHERE vote = 'no')::int AS no,
        COUNT(*) FILTER (WHERE vote = 'abstain')::int AS abstain,
        COUNT(*)::int AS total
      FROM group_proposal_votes
      WHERE proposal_id = $1`,
    [proposalId]
  );
  const row = (res.rows[0] || {}) as { yes?: number; no?: number; abstain?: number; total?: number };
  return { yes: row.yes ?? 0, no: row.no ?? 0, abstain: row.abstain ?? 0, total: row.total ?? 0 };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; proposalId: string }> }
) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, proposalId } = await params;
  const groupId = Number.parseInt(id, 10);
  const pid = Number.parseInt(proposalId, 10);

  if (!Number.isFinite(groupId)) return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });
  if (!Number.isFinite(pid)) return NextResponse.json({ error: 'Invalid proposal id' }, { status: 400 });

  const client = await pool.connect();
  try {
    await ensureProposalSchema(client);
    await ensureProposalVotingSchema(client);

    const membership = await getMembership(client, auth.userId, groupId);
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const res = await client.query(
      `SELECT
          p.id, p.group_id, p.title, p.description, p.status,
          p.proposal_type, p.metadata, p.funded_at,
          p.payment_amount_tzs, p.payment_status, p.payment_tx_id, p.executed_at,
          p.created_at, p.updated_at,
          m.full_name AS created_by_name, m.id AS created_by_member_id
        FROM group_proposals p
        JOIN members m ON m.id = p.created_by_member_id
        WHERE p.group_id = $1 AND p.id = $2
        LIMIT 1`,
      [groupId, pid]
    );

    if (res.rows.length === 0) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });

    const voteSummary = await getVoteSummary(client, pid);
    const myVoteRes = await client.query(
      `SELECT vote FROM group_proposal_votes WHERE proposal_id = $1 AND member_id = $2 LIMIT 1`,
      [pid, membership.member_id]
    );
    const myVote = (myVoteRes.rows[0] as { vote?: string } | undefined)?.vote;

    return NextResponse.json({
      success: true,
      proposal: res.rows[0],
      voteSummary,
      myVote: typeof myVote === 'string' ? myVote : null,
      membership,
    });
  } catch (error) {
    console.error('Member proposal details error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; proposalId: string }> }
) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, proposalId } = await params;
  const groupId = Number.parseInt(id, 10);
  const pid = Number.parseInt(proposalId, 10);

  if (!Number.isFinite(groupId)) return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });
  if (!Number.isFinite(pid)) return NextResponse.json({ error: 'Invalid proposal id' }, { status: 400 });

  const body = await request.json().catch(() => null);
  const vote = typeof body?.vote === 'string' ? body.vote.trim() : '';
  if (!['yes', 'no', 'abstain'].includes(vote)) {
    return NextResponse.json({ error: 'Invalid vote' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await ensureProposalSchema(client);
    await ensureProposalVotingSchema(client);

    const membership = await getMembership(client, auth.userId, groupId);
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const proposalRes = await client.query(
      `SELECT id, group_id, status, proposal_type FROM group_proposals WHERE id = $1 AND group_id = $2 LIMIT 1`,
      [pid, groupId]
    );

    if (proposalRes.rows.length === 0) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });

    const proposalRow = proposalRes.rows[0] as { status?: string; proposal_type?: string };
    if (proposalRow.status !== 'open') {
      return NextResponse.json({ error: 'Voting is closed for this proposal' }, { status: 400 });
    }

    await client.query(
      `INSERT INTO group_proposal_votes (proposal_id, member_id, vote)
       VALUES ($1, $2, $3)
       ON CONFLICT (proposal_id, member_id)
       DO UPDATE SET vote = EXCLUDED.vote, updated_at = CURRENT_TIMESTAMP`,
      [pid, membership.member_id, vote]
    );

    const voteSummary = await getVoteSummary(client, pid);

    // Auto-close when threshold is met
    const thresholdRes = await client.query(
      `SELECT g.voting_threshold_numerator, g.voting_threshold_denominator,
              COUNT(gm.member_id) FILTER (WHERE gm.status = 'active') AS total_members
       FROM groups g
       LEFT JOIN group_members gm ON gm.group_id = g.id
       WHERE g.id = $1
       GROUP BY g.id, g.voting_threshold_numerator, g.voting_threshold_denominator`,
      [groupId]
    );

    let autoClosedStatus: string | null = null;
    if (thresholdRes.rows.length > 0) {
      const tRow = thresholdRes.rows[0] as {
        voting_threshold_numerator: number;
        voting_threshold_denominator: number;
        total_members: string;
      };
      const totalMembers = Number(tRow.total_members);
      const required = Math.ceil(totalMembers * tRow.voting_threshold_numerator / tRow.voting_threshold_denominator);
      const passed = voteSummary.yes >= required;
      const cannotPass = voteSummary.no > totalMembers - required;

      if (passed || cannotPass) {
        const pType = proposalRow.proposal_type ?? 'general';
        await client.query(
          `UPDATE group_proposals
           SET status = 'closed',
               funded_at = CASE WHEN $1 AND $2 THEN NOW() ELSE funded_at END,
               updated_at = NOW()
           WHERE id = $3`,
          [passed, pType === 'prodcast', pid]
        );
        autoClosedStatus = passed ? 'passed' : 'failed';
      }
    }

    return NextResponse.json({
      success: true,
      myVote: vote,
      voteSummary,
      ...(autoClosedStatus ? { autoClosed: autoClosedStatus } : {}),
    });
  } catch (error) {
    console.error('Cast vote error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
