import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const client = await pool.connect();
    
    try {
      // Check if join_requests table exists
      const tableCheck = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'join_requests'
      `);

      // Get table structure if it exists
      let tableStructure = null;
      if (tableCheck.rows.length > 0) {
        const structureResult = await client.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'join_requests'
          ORDER BY ordinal_position
        `);
        tableStructure = structureResult.rows;
      }

      // Check if members and groups tables exist
      const membersCheck = await client.query(`
        SELECT COUNT(*) as count FROM members LIMIT 1
      `);

      const groupsCheck = await client.query(`
        SELECT COUNT(*) as count FROM groups LIMIT 1
      `);

      client.release();

      return NextResponse.json({
        joinRequestsTableExists: tableCheck.rows.length > 0,
        tableStructure,
        membersCount: membersCheck.rows[0].count,
        groupsCount: groupsCheck.rows[0].count,
        timestamp: new Date().toISOString()
      });

    } catch (dbError) {
      client.release();
      throw dbError;
    }
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({ 
      error: 'Debug failed: ' + (error as Error).message 
    }, { status: 500 });
  }
}
