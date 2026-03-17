import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const RequestSchema = z.object({
  courseId: z.number().optional(),
  topicPrompt: z.string().min(1),
  lessonCount: z.number().min(1).max(20),
  language: z.enum(['sw', 'en']),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  lessonType: z.enum(['single', 'course', 'course_lesson']),
  saveToCourse: z.boolean().default(false),
});

interface GeneratedLesson {
  title: string;
  content: string;
  duration_minutes: number;
  language: string;
  lesson_order?: number;
}

function normalizeGeneratedLessons(raw: unknown): GeneratedLesson[] {
  if (!raw || typeof raw !== 'object') return [];
  
  const obj = raw as Record<string, unknown>;
  const lessonsArray = obj.lessons || obj.content || [];
  
  if (!Array.isArray(lessonsArray)) return [];
  
  const parsed = z.array(
    z.object({
      title: z.string(),
      content: z.string(),
      duration_minutes: z.number().optional(),
      language: z.string().optional(),
      lesson_order: z.number().optional(),
    })
  ).safeParse(lessonsArray);
  
  if (!parsed.success) return [];
  
  return parsed.data.map((l, i) => ({
    ...l,
    duration_minutes: l.duration_minutes || 15,
    language: l.language || 'sw',
    lesson_order: l.lesson_order || i + 1,
  }));
}

async function callAnthropicJson({
  system,
  user,
}: {
  system: string;
  user: string;
}): Promise<unknown> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('MISSING_ANTHROPIC_API_KEY');
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307',
      max_tokens: 4096,
      system,
      messages: [
        {
          role: 'user',
          content: user,
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ANTHROPIC_ERROR_${res.status}:${text}`);
  }

  const data = await res.json();
  
  // Extract text content from Anthropic response
  const textContent = data.content?.[0]?.text;
  if (!textContent) {
    throw new Error('No text content in Anthropic response');
  }

  // Parse JSON from the text content
  try {
    return JSON.parse(textContent);
  } catch (e) {
    throw new Error('Failed to parse JSON from Anthropic response');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsedBody = RequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsedBody.error.issues },
        { status: 400 }
      );
    }

    const {
      courseId,
      topicPrompt,
      lessonCount,
      language,
      difficulty,
      lessonType,
      saveToCourse,
    } = parsedBody.data;

    let courseContext = '';
    let courseTitle = '';

    // If generating for existing course, fetch context
    if (courseId && lessonType === 'course_lesson') {
      try {
        const { Pool } = await import('pg');
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        const result = await pool.query(
          'SELECT title, description FROM educational_content WHERE id = $1',
          [courseId]
        );
        if (result.rows.length > 0) {
          courseTitle = result.rows[0].title;
          courseContext = `\nThis lesson is part of the course: "${courseTitle}"\nCourse description: ${result.rows[0].description || 'N/A'}`;
        }
        await pool.end();
      } catch (e) {
        console.error('Failed to fetch course context:', e);
      }
    }

    const langName = language === 'sw' ? 'Swahili (Tanzania)' : 'English';
    const difficultyMap = {
      beginner: language === 'sw' ? 'Mwanzo (Beginner)' : 'Beginner',
      intermediate: language === 'sw' ? 'Kati (Intermediate)' : 'Intermediate',
      advanced: language === 'sw' ? 'Juu (Advanced)' : 'Advanced',
    };

    const lessonTypeDescription = {
      single: 'a standalone single lesson',
      course: `${lessonCount} lessons that form a complete course`,
      course_lesson: `${lessonCount} lesson(s) to add to an existing course`,
    };

    const system =
      `You are an expert educational content creator for financial literacy and entrepreneurship training in Tanzania.\n` +
      `Generate ${lessonTypeDescription[lessonType]} in ${langName} at ${difficultyMap[difficulty]} level.\n` +
      `${courseContext}\n\n` +
      `Return ONLY valid JSON with this structure:\n` +
      `{"lessons": [{"title": string, "content": string, "duration_minutes": number}]}\n\n` +
      `Guidelines:\n` +
      `- Each lesson should be practical, actionable, and culturally relevant to Tanzania\n` +
      `- Use real-world examples from Tanzanian business context\n` +
      `- Content should be clear, engaging, and easy to understand\n` +
      `- Include practical exercises or reflection questions\n` +
      `- Format content with markdown headings (##), bullets, and numbered lists\n` +
      `- Duration should be realistic (10-30 minutes per lesson)\n` +
      `- For courses: ensure logical progression from lesson to lesson\n` +
      `- Keep language simple and accessible for the target difficulty level`;

    const user =
      `Topic/Theme: ${topicPrompt}\n` +
      `Number of lessons: ${lessonCount}\n` +
      `Language: ${langName}\n` +
      `Difficulty: ${difficultyMap[difficulty]}\n` +
      `Type: ${lessonTypeDescription[lessonType]}\n\n` +
      `Generate the lesson content now.`;

    const raw = await callAnthropicJson({ system, user });
    const lessons = normalizeGeneratedLessons(raw);

    if (lessons.length === 0) {
      return NextResponse.json(
        { error: 'Failed to generate lessons. Please try again.' },
        { status: 500 }
      );
    }

    // If saveToCourse is true and we have a courseId, save the lessons
    if (saveToCourse && courseId && lessonType === 'course_lesson') {
      try {
        const { Pool } = await import('pg');
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });

        // Get current max lesson order
        const maxOrderResult = await pool.query(
          'SELECT COALESCE(MAX(lesson_order), 0) as max_order FROM training_lessons WHERE educational_content_id = $1',
          [courseId]
        );
        let currentOrder = maxOrderResult.rows[0].max_order;

        // Insert lessons
        for (const lesson of lessons) {
          currentOrder++;
          await pool.query(
            `INSERT INTO training_lessons (educational_content_id, title, content, duration_minutes, lesson_order, language, lesson_type, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, 'text', NOW())`,
            [
              courseId,
              lesson.title,
              lesson.content,
              lesson.duration_minutes,
              currentOrder,
              language,
            ]
          );
        }

        await pool.end();
      } catch (e) {
        console.error('Failed to save lessons:', e);
        return NextResponse.json(
          { error: 'Generated lessons but failed to save them' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      lessons: lessons.map((l, i) => ({ ...l, lesson_order: i + 1 })),
      message: `Successfully generated ${lessons.length} lesson(s)`,
    });
  } catch (error) {
    console.error('AI generate lessons error:', error);

    if (error instanceof Error && error.message === 'MISSING_ANTHROPIC_API_KEY') {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured' },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
