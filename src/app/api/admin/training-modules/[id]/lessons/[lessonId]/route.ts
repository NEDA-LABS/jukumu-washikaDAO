import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// Delete a specific lesson
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  try {
    const { id, lessonId } = await params;
    const client = await pool.connect();
    
    // Verify the lesson exists and belongs to the training module
    const lessonCheck = await client.query(
      'SELECT id FROM training_lessons WHERE id = $1 AND training_module_id = $2',
      [lessonId, id]
    );
    
    if (lessonCheck.rows.length === 0) {
      client.release();
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }
    
    // Delete the lesson
    await client.query('DELETE FROM training_lessons WHERE id = $1', [lessonId]);
    
    client.release();
    
    return NextResponse.json({
      success: true,
      message: 'Lesson deleted successfully'
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Update a specific lesson
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  try {
    const { id, lessonId } = await params;
    const body = await request.json();
    const { title, content, duration_minutes, lesson_type, video_url, language } = body;
    
    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const client = await pool.connect();
    
    // Verify the lesson exists and belongs to the training module
    const lessonCheck = await client.query(
      'SELECT id FROM training_lessons WHERE id = $1 AND training_module_id = $2',
      [lessonId, id]
    );
    
    if (lessonCheck.rows.length === 0) {
      client.release();
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }
    
    // Update the lesson
    const result = await client.query(
      `UPDATE training_lessons 
       SET title = $1,
           content = $2,
           duration_minutes = $3,
           lesson_type = $4,
           video_url = $5,
           language = COALESCE($6, language),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND training_module_id = $8
       RETURNING *`,
      [title, content, duration_minutes || 15, lesson_type || 'text', video_url, language || null, lessonId, id]
    );
    
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
