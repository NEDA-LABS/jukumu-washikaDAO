import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const client = await pool.connect();
    
    try {
      // Create tables first
      await client.query(`
        CREATE TABLE IF NOT EXISTS training_lessons (
          id SERIAL PRIMARY KEY,
          training_module_id INTEGER,
          educational_content_id INTEGER,
          language VARCHAR(10) DEFAULT 'sw',
          title VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          lesson_order INTEGER NOT NULL,
          duration_minutes INTEGER DEFAULT 15,
          lesson_type VARCHAR(50) DEFAULT 'text',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS lesson_progress (
          id SERIAL PRIMARY KEY,
          member_id INTEGER,
          lesson_id INTEGER,
          completed BOOLEAN DEFAULT false,
          completed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Get existing training modules
      const modules = await client.query('SELECT id, title FROM training_modules ORDER BY id');
      
      if (modules.rows.length === 0) {
        client.release();
        return NextResponse.json({
          success: false,
          error: 'No training modules found. Please create training modules first.'
        });
      }
      
      // Check if lessons already exist
      const existingLessons = await client.query('SELECT COUNT(*) FROM training_lessons');
      const lessonCount = parseInt(existingLessons.rows[0].count);
      
      if (lessonCount > 0) {
        client.release();
        return NextResponse.json({
          success: true,
          message: 'Lessons already exist',
          modules: modules.rows,
          lessonCount
        });
      }
      
      // Insert basic lessons for each module
      const lessonInserts = [];
      
      for (const mod of modules.rows) {
        // Add 2-3 basic lessons per module
        const lessons = [
          {
            title: `Utangulizi wa ${mod.title}`,
            content: `Karibu katika mafunzo ya ${mod.title}. 

Katika somo hili, tutajifunza misingi muhimu ya ${mod.title.toLowerCase()}.

**Malengo ya Somo:**
- Kuelewa misingi ya ${mod.title.toLowerCase()}
- Kujifunza mbinu za vitendo
- Kupata ujuzi wa kufanya kazi

**Maudhui:**
Somo hili litakuongoza kupitia mambo muhimu unayohitaji kujua kuhusu ${mod.title.toLowerCase()}. Tutaanza na misingi hadi mambo ya kina zaidi.

**Zoezi:**
Fikiria jinsi unavyoweza kutumia ujuzi huu katika maisha yako ya kila siku.`,
            order: 1
          },
          {
            title: `Mbinu za ${mod.title}`,
            content: `Katika somo hili, tutajifunza mbinu mbalimbali za ${mod.title.toLowerCase()}.

**Mbinu Muhimu:**

1. **Mpangilio** - Panga kazi zako vizuri
2. **Ufuatiliaji** - Fuatilia maendeleo yako
3. **Tathmini** - Kagua mafanikio yako

**Mifano ya Vitendo:**
- Tengeneza mpango wa kila siku
- Weka malengo wazi
- Fuatilia maendeleo yako

**Zoezi la Vitendo:**
Chagua mbinu moja na uijaribu kwa wiki moja. Andika matokeo yako.`,
            order: 2
          },
          {
            title: `Mafanikio katika ${mod.title}`,
            content: `Somo la mwisho kuhusu jinsi ya kufanikiwa katika ${mod.title.toLowerCase()}.

**Siri za Mafanikio:**

1. **Uvumilivu** - Endelea hata kama ni vigumu
2. **Kujifunza** - Jifunze kutoka kwa makosa
3. **Kushirikiana** - Fanya kazi na wengine

**Hatua za Mwisho:**
- Kagua kile ulichojifunza
- Tengeneza mpango wa baadaye
- Shiriki ujuzi wako na wengine

**Hongera!**
Umekamilisha mafunzo ya ${mod.title}. Sasa tumia ujuzi huu katika maisha yako!`,
            order: 3
          }
        ];
        
        for (const lesson of lessons) {
          lessonInserts.push([
            mod.id,
            lesson.title,
            lesson.content,
            lesson.order,
            20 // 20 minutes per lesson
          ]);
        }
      }
      
      // Insert all lessons
      for (const lesson of lessonInserts) {
        await client.query(`
          INSERT INTO training_lessons (training_module_id, title, content, lesson_order, duration_minutes)
          VALUES ($1, $2, $3, $4, $5)
        `, lesson);
      }
      
      client.release();
      
      return NextResponse.json({
        success: true,
        message: 'Training lessons initialized successfully',
        modules: modules.rows,
        lessonsCreated: lessonInserts.length,
        tablesCreated: ['training_lessons', 'lesson_progress']
      });
      
    } catch (dbError) {
      client.release();
      throw dbError;
    }
  } catch (error) {
    console.error('Init lessons error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error
    }, { status: 500 });
  }
}
