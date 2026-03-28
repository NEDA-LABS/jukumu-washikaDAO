import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {

  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const client = await pool.connect();
    
    // Test database connectivity and table structure
    const tests = {
      membersTable: false,
      groupsTable: false,
      groupMembersTable: false,
      sampleData: {
        members: 0,
        groups: 0,
        groupMembers: 0
      }
    };
    
    try {
      // Test members table
      const membersResult = await client.query('SELECT COUNT(*) as count FROM members');
      tests.membersTable = true;
      tests.sampleData.members = parseInt(membersResult.rows[0].count);
      
      // Test groups table
      const groupsResult = await client.query('SELECT COUNT(*) as count FROM groups');
      tests.groupsTable = true;
      tests.sampleData.groups = parseInt(groupsResult.rows[0].count);
      
      // Test group_members table
      const groupMembersResult = await client.query('SELECT COUNT(*) as count FROM group_members');
      tests.groupMembersTable = true;
      tests.sampleData.groupMembers = parseInt(groupMembersResult.rows[0].count);
      
      // Get sample data for debugging
      const sampleMembers = await client.query('SELECT id, full_name, status FROM members LIMIT 3');
      const sampleGroups = await client.query('SELECT id, name, status FROM groups LIMIT 3');
      const sampleGroupMembers = await client.query(`
        SELECT gm.id, gm.group_id, gm.member_id, gm.role, gm.status,
               g.name as group_name, m.full_name as member_name
        FROM group_members gm
        JOIN groups g ON gm.group_id = g.id
        JOIN members m ON gm.member_id = m.id
        LIMIT 5
      `);
      
      client.release();
      
      return NextResponse.json({
        success: true,
        tests,
        sampleData: {
          members: sampleMembers.rows,
          groups: sampleGroups.rows,
          groupMembers: sampleGroupMembers.rows
        },
        message: 'Database connectivity and structure test completed successfully'
      });
      
    } catch (dbError) {
      client.release();
      throw dbError;
    }
  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json({
      success: false,
      error: 'Database test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { memberId, groupId } = body;
    
    if (!memberId || !groupId) {
      return NextResponse.json({ 
        error: 'Both memberId and groupId are required for testing' 
      }, { status: 400 });
    }
    
    const client = await pool.connect();
    
    try {
      // Verify the group exists
      const groupCheck = await client.query('SELECT id, name FROM groups WHERE id = $1', [groupId]);
      if (groupCheck.rows.length === 0) {
        client.release();
        return NextResponse.json({ error: 'Group not found' }, { status: 400 });
      }
      
      // Verify the member exists
      const memberCheck = await client.query('SELECT id, full_name FROM members WHERE id = $1', [memberId]);
      if (memberCheck.rows.length === 0) {
        client.release();
        return NextResponse.json({ error: 'Member not found' }, { status: 400 });
      }
      
      // Check if member is already in this group
      const existingMembership = await client.query(
        'SELECT id FROM group_members WHERE group_id = $1 AND member_id = $2',
        [groupId, memberId]
      );
      
      if (existingMembership.rows.length > 0) {
        client.release();
        return NextResponse.json({ 
          error: 'Member is already in this group',
          existing: existingMembership.rows[0]
        }, { status: 400 });
      }
      
      // Test insertion
      const insertResult = await client.query(`
        INSERT INTO group_members (group_id, member_id, joined_date, role, status)
        VALUES ($1, $2, CURRENT_DATE, 'member', 'active')
        RETURNING *
      `, [groupId, memberId]);
      
      client.release();
      
      return NextResponse.json({
        success: true,
        message: 'Test member-to-group assignment successful',
        data: {
          group: groupCheck.rows[0],
          member: memberCheck.rows[0],
          membership: insertResult.rows[0]
        }
      });
      
    } catch (dbError) {
      client.release();
      throw dbError;
    }
  } catch (error) {
    console.error('Test assignment error:', error);
    return NextResponse.json({
      success: false,
      error: 'Test assignment failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
