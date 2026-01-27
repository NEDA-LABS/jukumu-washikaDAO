import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// Get lessons for a specific educational content
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = await pool.connect();
    
    const result = await client.query(`
      SELECT 
        id,
        language,
        title,
        content,
        lesson_order,
        duration_minutes,
        lesson_type,
        video_url,
        created_at
      FROM training_lessons 
      WHERE educational_content_id = $1 
      ORDER BY lesson_order ASC
    `, [id]);
    
    client.release();
    
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Add a new lesson to educational content
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, content, lesson_order, duration_minutes, lesson_type, video_url, language } = body;
    
    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const client = await pool.connect();
    
    // Verify the educational content exists
    const contentCheck = await client.query('SELECT id FROM educational_content WHERE id = $1', [id]);
    if (contentCheck.rows.length === 0) {
      client.release();
      return NextResponse.json({ error: 'Educational content not found' }, { status: 404 });
    }
    
    // If no lesson_order provided, get the next order number
    let order = lesson_order;
    if (!order) {
      const orderResult = await client.query(
        'SELECT COALESCE(MAX(lesson_order), 0) + 1 as next_order FROM training_lessons WHERE educational_content_id = $1',
        [id]
      );
      order = orderResult.rows[0].next_order;
    }
    
    const result = await client.query(`
      INSERT INTO training_lessons (educational_content_id, language, title, content, lesson_order, duration_minutes, lesson_type, video_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [id, language || 'sw', title, content, order, duration_minutes || 15, lesson_type || 'text', video_url]);
    
    client.release();
    
    return NextResponse.json({
      success: true,
      lesson: result.rows[0]
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
