import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const client = await pool.connect();
    
    try {
      // Get join requests with member details
      const joinRequests = await client.query(`
        SELECT 
          jr.id, jr.member_id, jr.group_id, jr.created_at,
          m.full_name, m.email, m.phone,
          g.name as group_name
        FROM join_requests jr
        JOIN members m ON jr.member_id = m.id
        JOIN groups g ON jr.group_id = g.id
        WHERE jr.status = 'pending'
        ORDER BY jr.created_at DESC
        LIMIT 5
      `);

      // Get members with Donosia-like names
      const similarMembers = await client.query(`
        SELECT id, full_name, email, phone, created_at
        FROM members 
        WHERE full_name ILIKE '%donosia%' 
           OR full_name ILIKE '%donoyela%'
           OR email ILIKE '%donoyela%'
        ORDER BY created_at DESC
      `);

      client.release();
      
      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        joinRequests: joinRequests.rows,
        similarMembers: similarMembers.rows,
        message: 'Debug data retrieved'
      });
      
    } catch (dbError) {
      client.release();
      throw dbError;
    }
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
