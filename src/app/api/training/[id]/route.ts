import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// Get specific training module with lessons
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const client = await pool.connect();
    
    try {
      // Get training module details
      const moduleResult = await client.query(`
        SELECT 
          tm.*,
          mt.status as user_progress_status,
          mt.progress_percentage,
          mt.started_at,
          mt.completed_at
        FROM training_modules tm
        LEFT JOIN member_training mt ON tm.id = mt.training_id 
          AND mt.member_id = (SELECT id FROM members WHERE user_id = $1)
        WHERE tm.id = $2 AND tm.status = 'active'
      `, [userId, id]);
      
      if (moduleResult.rows.length === 0) {
        client.release();
        return NextResponse.json({ error: 'Training module not found' }, { status: 404 });
      }
      
      const trainingModule = moduleResult.rows[0];
      
      // Get lessons for this training module
      const lessonsResult = await client.query(`
        SELECT 
          id,
          title,
          content,
          lesson_order,
          duration_minutes,
          lesson_type,
          video_url,
          created_at
        FROM training_lessons 
        WHERE training_module_id = $1 
        ORDER BY lesson_order ASC
      `, [id]);
      
      // Get user's lesson progress
      const progressResult = await client.query(`
        SELECT 
          lesson_id,
          completed,
          completed_at
        FROM lesson_progress 
        WHERE member_id = (SELECT id FROM members WHERE user_id = $1)
        AND lesson_id IN (SELECT id FROM training_lessons WHERE training_module_id = $2)
      `, [userId, id]);
      
      const progressMap: { [key: number]: any } = {};
      progressResult.rows.forEach((p: any) => {
        progressMap[p.lesson_id] = p;
      });
      
      // Add progress info to lessons
      const lessonsWithProgress = lessonsResult.rows.map(lesson => ({
        ...lesson,
        completed: progressMap[lesson.id]?.completed || false,
        completed_at: progressMap[lesson.id]?.completed_at || null
      }));
      
      client.release();
      
      return NextResponse.json({
        module: trainingModule,
        lessons: lessonsWithProgress,
        totalLessons: lessonsWithProgress.length,
        completedLessons: lessonsWithProgress.filter(l => l.completed).length
      });
      
    } catch (dbError) {
      client.release();
      throw dbError;
    }
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
