import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST() {

  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const client = await pool.connect();
    
    try {
      // Update the group_members table to support new leadership roles
      await client.query(`
        ALTER TABLE group_members 
        DROP CONSTRAINT IF EXISTS group_members_role_check;
      `);
      
      await client.query(`
        ALTER TABLE group_members 
        ADD CONSTRAINT group_members_role_check 
        CHECK (role IN ('leader', 'member', 'mwenyekiti', 'katibu', 'mwekahazina'));
      `);
      
      console.log('Successfully updated group_members role constraints');
      
      client.release();
      
      return NextResponse.json({ 
        success: true, 
        message: 'Database schema updated successfully to support leadership roles' 
      });
    } catch (dbError) {
      client.release();
      throw dbError;
    }
  } catch (error) {
    console.error('Database schema update error:', error);
    return NextResponse.json({ 
      error: 'Failed to update database schema',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
