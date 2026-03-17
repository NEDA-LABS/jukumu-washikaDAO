import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import pool from '@/lib/db';

const RequestSchema = z.object({
  topicPrompt: z.string().min(1),
  language: z.enum(['sw', 'en']),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  lessonCount: z.number().min(1).max(20),
  category: z.string().optional(),
  authorId: z.number().optional(),
  publishImmediately: z.boolean().default(false),
});

async function callAnthropic(system: string, user: string): Promise<unknown> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('MISSING_ANTHROPIC_API_KEY');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
      max_tokens: 8000,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ANTHROPIC_ERROR_${res.status}: ${text}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error('No content in Anthropic response');

  // Strip markdown code fences if present
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error('Failed to parse JSON from Anthropic response');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
    }

    const { topicPrompt, language, difficulty, lessonCount, category, authorId, publishImmediately } = parsed.data;

    const langName = language === 'sw' ? 'Swahili (Tanzania)' : 'English';
    const diffMap = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
    const diffLabel = diffMap[difficulty];

    const system =
      `You are an expert educational content creator for financial literacy, entrepreneurship, and cooperative savings training in Tanzania.\n` +
      `Generate a complete course in ${langName} at ${diffLabel} level.\n\n` +
      `Return ONLY valid JSON — no markdown fences, no extra text — with this exact structure:\n` +
      `{\n` +
      `  "title": "Course title",\n` +
      `  "description": "2-3 sentence course description",\n` +
      `  "category": "Biashara | Fedha | Uongozi | Teknolojia | Akiba",\n` +
      `  "duration": "Xh Ym",\n` +
      `  "lessons": [\n` +
      `    {\n` +
      `      "title": "Lesson title",\n` +
      `      "content": "Full lesson content in markdown",\n` +
      `      "duration_minutes": 15\n` +
      `    }\n` +
      `  ]\n` +
      `}\n\n` +
      `Content guidelines:\n` +
      `- Make lessons practical and culturally relevant to Tanzania\n` +
      `- Use real-world Tanzanian business examples (shillingi, M-Pesa, VICOBA, etc.)\n` +
      `- Format each lesson content with ## headings, bullet points, numbered steps\n` +
      `- End each lesson with a practical exercise or reflection question\n` +
      `- Ensure logical progression across lessons\n` +
      `- Keep language clear and accessible for the difficulty level`;

    const user =
      `Topic: ${topicPrompt}\n` +
      `Language: ${langName}\n` +
      `Difficulty: ${diffLabel}\n` +
      `Number of lessons: ${lessonCount}\n` +
      (category ? `Category hint: ${category}\n` : '') +
      `\nGenerate the complete course now.`;

    const raw = await callAnthropic(system, user) as any;

    // Validate structure
    if (!raw?.title || !raw?.description || !Array.isArray(raw?.lessons) || raw.lessons.length === 0) {
      return NextResponse.json({ error: 'AI returned incomplete course data. Please try again.' }, { status: 500 });
    }

    const lessons = raw.lessons.map((l: any, i: number) => ({
      title: String(l.title || `Somo ${i + 1}`),
      content: String(l.content || ''),
      duration_minutes: Number(l.duration_minutes) || 15,
      lesson_order: i + 1,
    }));

    const totalDuration = lessons.reduce((sum: number, l: any) => sum + l.duration_minutes, 0);
    const durationStr = raw.duration || `${Math.floor(totalDuration / 60)}h ${totalDuration % 60}m`;

    // If publishImmediately is false, just return preview — don't save
    if (!publishImmediately) {
      return NextResponse.json({
        preview: true,
        course: {
          title: raw.title,
          description: raw.description,
          category: category || raw.category || 'Biashara',
          duration: durationStr,
          difficulty_level: difficulty,
          language,
          lessons,
        },
      });
    }

    // Save to database
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const contentResult = await client.query(
        `INSERT INTO educational_content
           (title, description, content, category, duration, difficulty_level, is_published, author_id, certificates_enabled, pass_threshold)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, 100)
         RETURNING *`,
        [
          raw.title,
          raw.description,
          raw.description,
          category || raw.category || 'Biashara',
          durationStr,
          difficulty,
          publishImmediately,
          authorId || null,
        ]
      );

      const courseId = contentResult.rows[0].id;

      for (const lesson of lessons) {
        await client.query(
          `INSERT INTO training_lessons
             (educational_content_id, title, content, duration_minutes, lesson_order, language, lesson_type)
           VALUES ($1, $2, $3, $4, $5, $6, 'text')`,
          [courseId, lesson.title, lesson.content, lesson.duration_minutes, lesson.lesson_order, language]
        );
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        course: { ...contentResult.rows[0], lesson_count: lessons.length },
        message: `Course "${raw.title}" created with ${lessons.length} lessons`,
      });
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('AI generate course error:', error);
    if (error instanceof Error && error.message === 'MISSING_ANTHROPIC_API_KEY') {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
