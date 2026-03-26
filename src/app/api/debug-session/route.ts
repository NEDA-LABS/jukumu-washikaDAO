import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const body = await request.json();
    const { userId, userEmail } = body;
    
    const client = await pool.connect();
    
    try {
      // Get the member record for this user
      const memberResult = await client.query(`
        SELECT id, full_name, email, phone, created_at
        FROM members 
        WHERE id = $1 OR email = $2
        ORDER BY created_at DESC
      `, [userId, userEmail]);

      // Get all members with similar email or name
      const similarMembers = await client.query(`
        SELECT id, full_name, email, phone, created_at
        FROM members 
        WHERE email ILIKE $1 OR full_name ILIKE $2
        ORDER BY created_at DESC
      `, [`%${userEmail}%`, '%Victor%']);

      // Get recent join requests to see pattern
      const recentRequests = await client.query(`
        SELECT 
          jr.id, jr.member_id, jr.created_at,
          m.full_name, m.email
        FROM join_requests jr
        JOIN members m ON jr.member_id = m.id
        WHERE jr.created_at > NOW() - INTERVAL '1 day'
        ORDER BY jr.created_at DESC
        LIMIT 10
      `);

      client.release();
      
      return NextResponse.json({
        success: true,
        sessionInfo: {
          providedUserId: userId,
          providedUserEmail: userEmail
        },
        memberRecord: memberResult.rows,
        similarMembers: similarMembers.rows,
        recentJoinRequests: recentRequests.rows,
        message: 'Session debug completed'
      });
      
    } catch (dbError) {
      client.release();
      throw dbError;
    }
  } catch (error) {
    console.error('Session debug error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
