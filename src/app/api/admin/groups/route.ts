import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ntzs, NtzsApiError } from '@/lib/ntzs';
import { ensureNtzsSchema, linkGroupWallet } from '@/lib/ntzs-db';

export async function GET() {
  try {
    const client = await pool.connect();
    
    const result = await client.query(`
      SELECT 
        g.id,
        g.name,
        g.founded_date,
        g.total_investment,
        g.monthly_contribution,
        g.status,
        g.created_at,
        u.full_name as leader_name,
        COUNT(gm.member_id) as member_count
      FROM groups g
      LEFT JOIN users u ON g.leader_id = u.id
      LEFT JOIN group_members gm ON g.id = gm.group_id AND gm.status = 'active'
      GROUP BY g.id, g.name, g.founded_date, g.total_investment, g.monthly_contribution, g.status, g.created_at, u.full_name
      ORDER BY g.created_at DESC
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
    const { name, leaderId, monthlyContribution, foundedDate } = body;
    
    // Validate required fields
    if (!name || !monthlyContribution || !foundedDate) {
      return NextResponse.json({ 
        error: 'Jina la kundi, mchango wa kila mwezi, na tarehe ya kuanzishwa ni lazima.' 
      }, { status: 400 });
    }
    
    const client = await pool.connect();
    
    try {
      // Check if group name already exists
      const existingGroup = await client.query(
        'SELECT id FROM groups WHERE LOWER(name) = LOWER($1)',
        [name]
      );
      
      if (existingGroup.rows.length > 0) {
        client.release();
        return NextResponse.json({ 
          error: 'Kundi lenye jina hilo tayari lipo. Tumia jina lingine.' 
        }, { status: 400 });
      }
      
      // Create the group
      const result = await client.query(`
        INSERT INTO groups (name, leader_id, founded_date, monthly_contribution, status)
        VALUES ($1, $2, $3, $4, 'active')
        RETURNING *
      `, [name, leaderId || null, foundedDate, monthlyContribution]);
      
      // If leader is specified, add them to the group
      if (leaderId) {
        await client.query(`
          INSERT INTO group_members (group_id, member_id, joined_date, role, status)
          VALUES ($1, $2, CURRENT_DATE, 'leader', 'active')
        `, [result.rows[0].id, leaderId]);
      }

      // Provision nTZS wallet for the group (non-blocking)
      let walletAddress: string | null = null;
      try {
        await ensureNtzsSchema(client);
        const groupId = result.rows[0].id;
        const ntzsUser = await ntzs.users.create({
          externalId: `group_${groupId}`,
          email: `group_${groupId}@groups.jukumu`,
        });
        await linkGroupWallet(client, groupId, ntzsUser.id, ntzsUser.walletAddress);
        walletAddress = ntzsUser.walletAddress;
        console.log(`nTZS wallet provisioned for group ${groupId}: ${ntzsUser.walletAddress}`);
      } catch (walletErr) {
        if (walletErr instanceof NtzsApiError) {
          console.error(`nTZS group wallet error (${walletErr.status}):`, walletErr.body);
        } else {
          console.error('nTZS group wallet error:', walletErr);
        }
      }
      
      client.release();
      
      return NextResponse.json({ 
        success: true, 
        message: 'Kundi limeanzishwa kwa mafanikio!',
        group: { ...result.rows[0], walletAddress },
      }, { status: 201 });
    } catch (dbError) {
      client.release();
      throw dbError;
    }
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ 
      error: 'Hitilafu imetokea wakati wa kuanzisha kundi. Jaribu tena.' 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, leaderId, monthlyContribution, status } = body;
    
    const client = await pool.connect();
    
    const result = await client.query(`
      UPDATE groups 
      SET name = $1, leader_id = $2, monthly_contribution = $3, status = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `, [name, leaderId, monthlyContribution, status, id]);
    
    client.release();
    
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;
    
    if (!id) {
      return NextResponse.json({ 
        error: 'ID ya kundi ni lazima kwa kufuta kundi.' 
      }, { status: 400 });
    }
    
    const client = await pool.connect();
    
    try {
      // Check if group exists and get member count
      const groupCheck = await client.query(
        'SELECT name, (SELECT COUNT(*) FROM group_members WHERE group_id = $1 AND status = \'active\') as member_count FROM groups WHERE id = $1',
        [id]
      );
      
      if (groupCheck.rows.length === 0) {
        client.release();
        return NextResponse.json({ 
          error: 'Kundi halikupatikana.' 
        }, { status: 404 });
      }
      
      const group = groupCheck.rows[0];
      
      // Prevent deletion if group has active members
      if (group.member_count > 0) {
        client.release();
        return NextResponse.json({ 
          error: `Kundi "${group.name}" bado lina wanachama ${group.member_count}. Ondoa wanachama wote kwanza kabla ya kufuta kundi.` 
        }, { status: 400 });
      }
      
      // Delete related records first (cascade delete)
      await client.query('DELETE FROM group_members WHERE group_id = $1', [id]);
      await client.query('DELETE FROM investments WHERE group_id = $1', [id]);
      await client.query('DELETE FROM monthly_contributions WHERE group_id = $1', [id]);
      await client.query('DELETE FROM join_requests WHERE group_id = $1', [id]);
      
      // Delete the group
      const result = await client.query('DELETE FROM groups WHERE id = $1 RETURNING name', [id]);
      
      client.release();
      
      return NextResponse.json({ 
        success: true,
        message: `Kundi "${result.rows[0].name}" limefutwa kwa mafanikio!`
      });
    } catch (dbError) {
      client.release();
      throw dbError;
    }
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ 
      error: 'Hitilafu imetokea wakati wa kufuta kundi. Jaribu tena.' 
    }, { status: 500 });
  }
}
