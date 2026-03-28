import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {

  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const client = await pool.connect();
    
    try {
      // Get all users and members to match by email
      const users = await client.query('SELECT id, email, full_name FROM users ORDER BY id');
      const members = await client.query('SELECT id, email, full_name, user_id FROM members ORDER BY id');
      
      const updates = [];
      const matches = [];
      
      // Match users to members by email
      for (const user of users.rows) {
        const matchingMember = members.rows.find(member => 
          member.email && user.email && 
          member.email.toLowerCase() === user.email.toLowerCase()
        );
        
        if (matchingMember) {
          matches.push({
            user: user,
            member: matchingMember,
            action: 'match_by_email'
          });
          
          // Update the member's user_id
          await client.query(
            'UPDATE members SET user_id = $1 WHERE id = $2',
            [user.id, matchingMember.id]
          );
          updates.push(`Member ${matchingMember.full_name} (ID: ${matchingMember.id}) linked to User ${user.full_name} (ID: ${user.id})`);
        }
      }
      
      // Also try to match by name if no email match
      for (const user of users.rows) {
        const alreadyMatched = matches.some(m => m.user.id === user.id);
        if (alreadyMatched) continue;
        
        const matchingMember = members.rows.find(member => 
          member.full_name && user.full_name && 
          member.full_name.toLowerCase().includes(user.full_name.toLowerCase()) ||
          user.full_name.toLowerCase().includes(member.full_name.toLowerCase())
        );
        
        if (matchingMember && !matchingMember.user_id) {
          matches.push({
            user: user,
            member: matchingMember,
            action: 'match_by_name'
          });
          
          // Update the member's user_id
          await client.query(
            'UPDATE members SET user_id = $1 WHERE id = $2',
            [user.id, matchingMember.id]
          );
          updates.push(`Member ${matchingMember.full_name} (ID: ${matchingMember.id}) linked to User ${user.full_name} (ID: ${user.id}) by name`);
        }
      }
      
      client.release();
      
      return NextResponse.json({
        success: true,
        message: 'User-member linking completed',
        matches: matches,
        updates: updates,
        totalMatches: matches.length
      });
      
    } catch (dbError) {
      client.release();
      throw dbError;
    }
  } catch (error) {
    console.error('Fix user-member links error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
