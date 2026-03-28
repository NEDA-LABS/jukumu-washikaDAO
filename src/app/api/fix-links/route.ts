import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {

  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const client = await pool.connect();
    
    try {
      // Simple approach - just link Victor specifically first
      const victorUser = await client.query(
        'SELECT id, email, full_name FROM users WHERE email = $1',
        ['peepstudio2@gmail.com']
      );
      
      if (victorUser.rows.length === 0) {
        client.release();
        return NextResponse.json({
          success: false,
          error: 'Victor user not found'
        });
      }
      
      const victor = victorUser.rows[0];
      
      // Find Victor's member record by email
      const victorMember = await client.query(
        'SELECT id, full_name, email FROM members WHERE email = $1',
        ['peepstudio2@gmail.com']
      );
      
      if (victorMember.rows.length === 0) {
        client.release();
        return NextResponse.json({
          success: false,
          error: 'Victor member record not found'
        });
      }
      
      const member = victorMember.rows[0];
      
      // Update Victor's member record with his user ID
      await client.query(
        'UPDATE members SET user_id = $1 WHERE id = $2',
        [victor.id, member.id]
      );
      
      client.release();
      
      return NextResponse.json({
        success: true,
        message: 'Victor successfully linked',
        victor_user: victor,
        victor_member: member,
        action: `Linked User ID ${victor.id} to Member ID ${member.id}`
      });
      
    } catch (dbError) {
      client.release();
      throw dbError;
    }
  } catch (error) {
    console.error('Fix links error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
