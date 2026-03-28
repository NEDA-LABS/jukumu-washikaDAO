import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const hasDbUrl = !!process.env.DATABASE_URL;
  const dbUrlLength = process.env.DATABASE_URL?.length || 0;
  
  let connectionTest = 'not_tested';
  let error = null;
  
  let tableInfo = {};
  
  try {
    const client = await pool.connect();
    
    // Test basic connection
    const result = await client.query('SELECT NOW()');
    connectionTest = 'success';
    
    // Check if tables exist and have data
    try {
      const usersCount = await client.query('SELECT COUNT(*) FROM users');
      const groupsCount = await client.query('SELECT COUNT(*) FROM groups');
      const investmentsCount = await client.query('SELECT COUNT(*) FROM investments');
      
      tableInfo = {
        users: parseInt(usersCount.rows[0].count),
        groups: parseInt(groupsCount.rows[0].count),
        investments: parseInt(investmentsCount.rows[0].count)
      };
    } catch (tableErr) {
      tableInfo = { error: tableErr instanceof Error ? tableErr.message : 'Table query failed' };
    }
    
    client.release();
  } catch (err) {
    connectionTest = 'failed';
    error = err instanceof Error ? err.message : 'Unknown error';
  }
  
  return NextResponse.json({
    hasDbUrl,
    dbUrlLength,
    nodeEnv: process.env.NODE_ENV,
    connectionTest,
    tableInfo,
    error,
    timestamp: new Date().toISOString()
  });
}
