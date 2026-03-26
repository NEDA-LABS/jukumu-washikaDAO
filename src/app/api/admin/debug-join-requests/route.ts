import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const client = await pool.connect();
    
    try {
      // Get detailed join request data with all member information
      const result = await client.query(`
        SELECT 
          jr.id as request_id,
          jr.member_id,
          jr.group_id,
          jr.message,
          jr.status,
          jr.created_at,
          
          -- Member information from join request
          m.id as actual_member_id,
          m.full_name as actual_member_name,
          m.email as actual_member_email,
          m.phone as actual_member_phone,
          
          -- Group information
          g.name as group_name,
          g.monthly_contribution,
          g.leader_id,
          
          -- Leader information
          leader.full_name as leader_name,
          leader.email as leader_email
          
        FROM join_requests jr
        JOIN members m ON jr.member_id = m.id
        JOIN groups g ON jr.group_id = g.id
        LEFT JOIN members leader ON g.leader_id = leader.id
        WHERE jr.status = 'pending'
        ORDER BY jr.created_at DESC
        LIMIT 10
      `);

      // Also get a sample of members to check for duplicates or issues
      const membersCheck = await client.query(`
        SELECT id, full_name, email, phone, created_at
        FROM members 
        WHERE full_name ILIKE '%donosia%' OR email ILIKE '%donoyela%'
        ORDER BY created_at DESC
      `);

      // Check for potential duplicate members with similar names/emails
      const duplicateCheck = await client.query(`
        SELECT 
          full_name, 
          email, 
          COUNT(*) as count,
          STRING_AGG(id::text, ', ') as member_ids
        FROM members 
        GROUP BY full_name, email
        HAVING COUNT(*) > 1
      `);

      client.release();
      
      return NextResponse.json({
        success: true,
        joinRequests: result.rows,
        membersWithSimilarNames: membersCheck.rows,
        duplicateMembers: duplicateCheck.rows,
        message: 'Debug data retrieved successfully'
      });
      
    } catch (dbError) {
      client.release();
      throw dbError;
    }
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({
      success: false,
      error: 'Debug query failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
