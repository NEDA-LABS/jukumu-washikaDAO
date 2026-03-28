import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {

  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const client = await pool.connect();
    
    try {
      // Check if training_modules table exists
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('training_modules', 'training_lessons', 'lesson_progress')
      `);
      
      const existingTables = tablesResult.rows.map(row => row.table_name);
      
      // Check training modules
      let modules = [];
      let moduleCount = 0;
      if (existingTables.includes('training_modules')) {
        const modulesResult = await client.query('SELECT id, title, description FROM training_modules LIMIT 10');
        modules = modulesResult.rows;
        moduleCount = modules.length;
      }
      
      // Check lessons
      let lessons = [];
      let lessonCount = 0;
      if (existingTables.includes('training_lessons')) {
        const lessonsResult = await client.query('SELECT COUNT(*) as count FROM training_lessons');
        lessonCount = parseInt(lessonsResult.rows[0].count);
        
        if (lessonCount > 0) {
          const sampleLessons = await client.query('SELECT id, language, title, training_module_id FROM training_lessons LIMIT 5');
          lessons = sampleLessons.rows;
        }
      }
      
      client.release();
      
      return NextResponse.json({
        success: true,
        database_status: {
          existing_tables: existingTables,
          training_modules: {
            count: moduleCount,
            sample: modules
          },
          training_lessons: {
            count: lessonCount,
            sample: lessons
          }
        },
        next_steps: lessonCount === 0 ? 'Need to create lessons' : 'Lessons exist'
      });
      
    } catch (dbError) {
      client.release();
      throw dbError;
    }
  } catch (error) {
    console.error('Check training error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      error_details: error
    }, { status: 500 });
  }
}
