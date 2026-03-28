import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {

  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const client = await pool.connect();
    
    try {
      // Check current constraint on group_members role column
      const constraintCheck = await client.query(`
        SELECT 
          tc.constraint_name,
          cc.check_clause
        FROM information_schema.table_constraints tc
        JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
        WHERE tc.table_name = 'group_members' 
        AND tc.constraint_type = 'CHECK'
        AND cc.check_clause LIKE '%role%'
      `);
      
      // Get sample group_members data
      const sampleData = await client.query(`
        SELECT gm.role, COUNT(*) as count
        FROM group_members gm
        GROUP BY gm.role
        ORDER BY count DESC
      `);
      
      // Test if we can insert a new leadership role (this will fail if constraint doesn't allow it)
      let testResult = null;
      try {
        await client.query('BEGIN');
        const testInsert = await client.query(`
          INSERT INTO group_members (group_id, member_id, role, status, joined_date)
          SELECT 1, 1, 'mwenyekiti', 'active', CURRENT_DATE
          WHERE NOT EXISTS (
            SELECT 1 FROM group_members WHERE group_id = 1 AND member_id = 1
          )
          RETURNING id
        `);
        await client.query('ROLLBACK'); // Rollback the test
        testResult = 'SUCCESS - New roles are supported';
      } catch (testError) {
        await client.query('ROLLBACK');
        testResult = `FAILED - ${testError instanceof Error ? testError.message : 'Unknown error'}`;
      }
      
      client.release();
      
      return NextResponse.json({
        success: true,
        currentConstraints: constraintCheck.rows,
        currentRoles: sampleData.rows,
        testResult,
        message: 'Schema check completed'
      });
      
    } catch (dbError) {
      client.release();
      throw dbError;
    }
  } catch (error) {
    console.error('Schema check error:', error);
    return NextResponse.json({
      success: false,
      error: 'Schema check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
