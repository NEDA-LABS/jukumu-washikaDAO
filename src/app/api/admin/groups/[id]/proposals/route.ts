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

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_group_proposals_group_id ON group_proposals(group_id);
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_group_proposals_created_at ON group_proposals(created_at DESC);
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

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_group_proposal_votes_proposal_id ON group_proposal_votes(proposal_id);
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_group_proposal_votes_member_id ON group_proposal_votes(member_id);
  `);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') {
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
    await ensureProposalVotingSchema(client);

    const proposalsRes = await client.query(
      `
        SELECT
          p.id,
          p.group_id,
          p.title,
          p.description,
          p.status,
          p.created_at,
          p.updated_at,
          m.full_name AS created_by_name,
          m.id AS created_by_member_id,
          COALESCE(v.yes, 0)::int AS yes_votes,
          COALESCE(v.no, 0)::int AS no_votes,
          COALESCE(v.abstain, 0)::int AS abstain_votes,
          COALESCE(v.total, 0)::int AS total_votes
        FROM group_proposals p
        JOIN members m ON m.id = p.created_by_member_id
        LEFT JOIN (
          SELECT
            proposal_id,
            COUNT(*) FILTER (WHERE vote = 'yes') AS yes,
            COUNT(*) FILTER (WHERE vote = 'no') AS no,
            COUNT(*) FILTER (WHERE vote = 'abstain') AS abstain,
            COUNT(*) AS total
          FROM group_proposal_votes
          GROUP BY proposal_id
        ) v ON v.proposal_id = p.id
        WHERE p.group_id = $1
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT 200
      `,
      [groupId]
    );

    return NextResponse.json({ success: true, proposals: proposalsRes.rows });
  } catch (error) {
    console.error('Admin group proposals error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
