import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const client = await pool.connect();
    
    try {
      // First check if training_modules table exists and has data
      const modulesCheck = await client.query('SELECT COUNT(*) FROM training_modules');
      const moduleCount = parseInt(modulesCheck.rows[0].count);
      
      if (moduleCount === 0) {
        // Insert basic training modules first
        await client.query(`
          INSERT INTO training_modules (title, description, duration_hours, category, level) VALUES
          ('Uongozi wa Biashara', 'Jifunze jinsi ya kuongoza biashara yako kwa ufanisi', 2.0, 'Leadership', 'beginner'),
          ('Utunzaji wa Fedha', 'Mafunzo ya jinsi ya kutunza na kupanga fedha za biashara', 1.5, 'Finance', 'beginner'),
          ('Masoko na Uuzaji', 'Jinsi ya kupata na kuwashawishi wateja', 3.0, 'Marketing', 'intermediate')
          ON CONFLICT DO NOTHING
        `);
      }
      
      // Create training_lessons table
      await client.query(`
        CREATE TABLE IF NOT EXISTS training_lessons (
          id SERIAL PRIMARY KEY,
          training_module_id INTEGER REFERENCES training_modules(id) ON DELETE CASCADE,
          educational_content_id INTEGER REFERENCES educational_content(id) ON DELETE CASCADE,
          language VARCHAR(10) DEFAULT 'sw' CHECK (language IN ('sw', 'en')),
          title VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          lesson_order INTEGER NOT NULL,
          duration_minutes INTEGER DEFAULT 15,
          lesson_type VARCHAR(50) DEFAULT 'text' CHECK (lesson_type IN ('text', 'video', 'quiz', 'interactive')),
          video_url VARCHAR(500),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Backfill schema changes for existing databases
      await client.query(`
        ALTER TABLE training_lessons
        ADD COLUMN IF NOT EXISTS educational_content_id INTEGER REFERENCES educational_content(id) ON DELETE CASCADE
      `);
      await client.query(`
        ALTER TABLE training_lessons
        ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'sw'
      `);
      await client.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'training_lessons'
              AND column_name = 'language'
          ) THEN
            ALTER TABLE training_lessons
              DROP CONSTRAINT IF EXISTS training_lessons_language_check;
            ALTER TABLE training_lessons
              ADD CONSTRAINT training_lessons_language_check CHECK (language IN ('sw', 'en'));
          END IF;
        END $$;
      `);
      
      // Create lesson_progress table
      await client.query(`
        CREATE TABLE IF NOT EXISTS lesson_progress (
          id SERIAL PRIMARY KEY,
          member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
          lesson_id INTEGER REFERENCES training_lessons(id) ON DELETE CASCADE,
          completed BOOLEAN DEFAULT false,
          completed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(member_id, lesson_id)
        )
      `);
      
      // Just check if tables exist - don't create any mock content
      let lessonCount = 0;
      try {
        const existingLessons = await client.query('SELECT COUNT(*) FROM training_lessons');
        lessonCount = parseInt(existingLessons.rows[0].count);
      } catch (e) {
        // Table might not exist yet, that's ok
        lessonCount = 0;
      }
      
      // Create indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_training_lessons_module ON training_lessons(training_module_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_training_lessons_educational_content ON training_lessons(educational_content_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_training_lessons_language ON training_lessons(language)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_lesson_progress_member ON lesson_progress(member_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson ON lesson_progress(lesson_id)');
      
      client.release();
      
      return NextResponse.json({
        success: true,
        message: 'Training lesson tables created successfully. Admins can now add lessons to their training modules.',
        existingLessons: lessonCount,
        tablesCreated: ['training_lessons', 'lesson_progress'],
        indexesCreated: 5,
        nextStep: 'Use /api/admin/training-modules/[id]/lessons to add lessons to training modules'
      });
      
    } catch (dbError) {
      client.release();
      throw dbError;
    }
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
