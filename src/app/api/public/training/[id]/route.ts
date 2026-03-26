import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// Get public training module preview (no authentication required)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = await pool.connect();
    
    try {
      // Get training module details
      const moduleResult = await client.query(`
        SELECT 
          tm.id,
          tm.title,
          tm.description,
          tm.duration_hours,
          tm.category,
          tm.level,
          tm.created_at
        FROM training_modules tm
        WHERE tm.id = $1 AND tm.status = 'active'
      `, [id]);
      
      if (moduleResult.rows.length === 0) {
        client.release();
        return NextResponse.json({ error: 'Training module not found' }, { status: 404 });
      }
      
      const trainingModule = moduleResult.rows[0];
      
      // Get lesson previews (titles and basic info only, no full content)
      const lessonsResult = await client.query(`
        SELECT 
          id,
          title,
          lesson_order,
          duration_minutes,
          lesson_type,
          LEFT(content, 150) as preview
        FROM training_lessons 
        WHERE training_module_id = $1 
        ORDER BY lesson_order ASC
      `, [id]);
      
      client.release();
      
      return NextResponse.json({
        module: trainingModule,
        lessons: lessonsResult.rows,
        totalLessons: lessonsResult.rows.length,
        requiresLogin: true,
        loginMessage: 'Jisajili ili kuona maudhui kamili ya masomo'
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
