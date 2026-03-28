import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {

  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const body = await request.json();
    const { memberId, groupId, message } = body;
    
    if (!memberId || !groupId) {
      return NextResponse.json({ 
        error: 'Member ID na Group ID ni lazima.' 
      }, { status: 400 });
    }

    const client = await pool.connect();
    
    try {
      // Check if member exists
      const memberCheck = await client.query(
        'SELECT id, full_name FROM members WHERE id = $1',
        [memberId]
      );
      
      if (memberCheck.rows.length === 0) {
        client.release();
        return NextResponse.json({ 
          error: 'Mwanachama hapatikani.' 
        }, { status: 404 });
      }

      // Check if group exists and is active
      const groupCheck = await client.query(
        'SELECT id, name, leader_id FROM groups WHERE id = $1 AND status = $2',
        [groupId, 'active']
      );
      
      if (groupCheck.rows.length === 0) {
        client.release();
        return NextResponse.json({ 
          error: 'Kundi halipatikani au halipo hai.' 
        }, { status: 404 });
      }

      // Check if member is already in this group
      const existingMembership = await client.query(
        'SELECT id FROM group_members WHERE member_id = $1 AND group_id = $2',
        [memberId, groupId]
      );
      
      if (existingMembership.rows.length > 0) {
        client.release();
        return NextResponse.json({ 
          error: 'Tayari upo kwenye kundi hili.' 
        }, { status: 400 });
      }

      // Check if there's already a pending request
      const existingRequest = await client.query(
        'SELECT id FROM join_requests WHERE member_id = $1 AND group_id = $2 AND status = $3',
        [memberId, groupId, 'pending']
      );
      
      if (existingRequest.rows.length > 0) {
        client.release();
        return NextResponse.json({ 
          error: 'Tayari umetuma ombi la kujiunga na kundi hili. Subiri jibu.' 
        }, { status: 400 });
      }

      // Insert join request
      const result = await client.query(`
        INSERT INTO join_requests (member_id, group_id, message, status, created_at)
        VALUES ($1, $2, $3, 'pending', CURRENT_TIMESTAMP)
        RETURNING *
      `, [memberId, groupId, message || null]);

      client.release();
      
      return NextResponse.json({
        success: true,
        message: 'Ombi lako la kujiunga limetumwa kwa mafanikio! Utapokea jibu hivi karibuni.',
        request: result.rows[0]
      });
      
    } catch (dbError) {
      client.release();
      throw dbError;
    }
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ 
      error: 'Hitilafu imetokea wakati wa kutuma ombi: ' + (error as Error).message 
    }, { status: 500 });
  }
}
