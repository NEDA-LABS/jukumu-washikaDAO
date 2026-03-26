import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'No DATABASE_URL configured' });
    }

    const client = await pool.connect();
    
    // Get total members with detailed info
    const membersResult = await client.query(`
      SELECT COUNT(*) as total_members, 
             COUNT(CASE WHEN role = 'member' THEN 1 END) as members_with_role,
             COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users,
             COUNT(CASE WHEN role = 'member' AND status = 'active' THEN 1 END) as active_members
      FROM users
    `);
    
    // Get total groups with detailed info
    const groupsResult = await client.query(`
      SELECT COUNT(*) as total_groups,
             COUNT(CASE WHEN status = 'active' THEN 1 END) as active_groups
      FROM groups
    `);
    
    // Get investment details
    const investmentResult = await client.query(`
      SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
        COALESCE(SUM(amount), 0) as total_investment,
        COALESCE(SUM(actual_return), 0) as total_returns
      FROM investments
    `);
    
    // Get regions info
    const regionsResult = await client.query(`
      SELECT COUNT(DISTINCT location) as active_regions,
             COUNT(*) as users_with_location
      FROM users 
      WHERE role = 'member' AND status = 'active' AND location IS NOT NULL
    `);
    
    // Sample some actual data
    const sampleUsers = await client.query(`
      SELECT id, email, role, status, location, created_at 
      FROM users 
      LIMIT 5
    `);
    
    const sampleGroups = await client.query(`
      SELECT id, name, status, created_at 
      FROM groups 
      LIMIT 5
    `);
    
    client.release();
    
    return NextResponse.json({
      members: membersResult.rows[0],
      groups: groupsResult.rows[0], 
      investments: investmentResult.rows[0],
      regions: regionsResult.rows[0],
      sampleUsers: sampleUsers.rows,
      sampleGroups: sampleGroups.rows,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Debug stats error:', error);
    return NextResponse.json({ 
      error: 'Database error', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
