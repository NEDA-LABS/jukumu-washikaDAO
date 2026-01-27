import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { z } from 'zod';

const GenerateLessonsRequestSchema = z.object({
  educationalContentId: z.number().int().positive().optional(),
  language: z.enum(['en', 'sw']).default('sw'),
  lessonCount: z.number().int().min(1).max(20).default(6),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  topicPrompt: z.string().trim().min(3).max(500),
  saveToCourse: z.boolean().default(false)
});

type GeneratedLesson = {
  title: string;
  content: string;
  duration_minutes: number;
  lesson_type?: string;
  video_url?: string | null;
};

function normalizeGeneratedLessons(value: unknown): GeneratedLesson[] {
  const LessonSchema = z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1).max(20000),
    duration_minutes: z.number().int().min(1).max(240),
    lesson_type: z.string().optional(),
    video_url: z.string().nullable().optional()
  });

  const PayloadSchema = z.object({
    lessons: z.array(LessonSchema).min(1).max(20)
  });

  const parsed = PayloadSchema.safeParse(value);
  if (!parsed.success) return [];
  return parsed.data.lessons;
}

async function callOpenAIJson({
  model,
  system,
  user
}: {
  model: string;
  system: string;
  user: string;
}): Promise<unknown> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('MISSING_OPENAI_API_KEY');
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OPENAI_ERROR_${res.status}:${text}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthTokenPayload(request);
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await request.json();
    const parsedBody = GenerateLessonsRequestSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsedBody.error.flatten() },
        { status: 400 }
      );
    }

    const {
      educationalContentId,
      language,
      lessonCount,
      difficulty,
      topicPrompt,
      saveToCourse
    } = parsedBody.data;

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    let courseContext = '';
    let courseTitle = '';
    let courseCategory = '';

    if (educationalContentId) {
      const client = await pool.connect();
      try {
        const courseRes = await client.query(
          `SELECT id, title, description, content, category, difficulty_level
           FROM educational_content
           WHERE id = $1`,
          [educationalContentId]
        );

        if (courseRes.rows.length === 0) {
          return NextResponse.json({ error: 'Course not found' }, { status: 404 });
        }

        const course = courseRes.rows[0] as {
          title: string;
          description: string;
          content: string;
          category: string;
          difficulty_level: string;
        };

        courseTitle = course.title || '';
        courseCategory = course.category || '';

        const ctxParts = [
          course.title ? `Course title: ${course.title}` : '',
          course.category ? `Category: ${course.category}` : '',
          course.difficulty_level ? `Course difficulty: ${course.difficulty_level}` : '',
          course.description ? `Course description: ${course.description}` : '',
          course.content ? `Course overview content: ${course.content}` : ''
        ].filter(Boolean);

        courseContext = ctxParts.join('\n');
      } finally {
        client.release();
      }
    }

    const languageInstruction =
      language === 'sw'
        ? 'Write in Swahili (Tanzania).'
        : 'Write in English.';

    const system =
      `You are an expert course designer and tutor. ${languageInstruction} ` +
      `Create lessons for adult learners. Keep content practical, clear, and correct. ` +
      `Return ONLY valid JSON with the shape: {"lessons": [{"title": string, "duration_minutes": number, "content": string}]}.`;

    const user =
      `Generate ${lessonCount} lessons.\n` +
      `Difficulty: ${difficulty}.\n` +
      `Topic: ${topicPrompt}.\n` +
      (courseContext
        ? `\nUse this existing course context to stay aligned (do not contradict it):\n${courseContext}\n`
        : '') +
      `\nGuidelines:\n` +
      `- Each lesson should include: objectives, explanation, at least 1 example, and a short practice task.\n` +
      `- Use simple formatting within the content (headings + bullets).\n` +
      `- Keep each lesson concise but complete.`;

    const raw = await callOpenAIJson({ model, system, user });
    const lessons = normalizeGeneratedLessons(raw);

    if (lessons.length === 0) {
      return NextResponse.json(
        { error: 'AI output could not be parsed. Try again with a different prompt.' },
        { status: 502 }
      );
    }

    if (saveToCourse) {
      if (!educationalContentId) {
        return NextResponse.json(
          { error: 'educationalContentId is required when saveToCourse=true' },
          { status: 400 }
        );
      }

      const client = await pool.connect();
      try {
        const nextOrderRes = await client.query(
          'SELECT COALESCE(MAX(lesson_order), 0) + 1 as next_order FROM training_lessons WHERE educational_content_id = $1',
          [educationalContentId]
        );
        let order = Number(nextOrderRes.rows[0]?.next_order || 1);

        const inserted: Array<{ id: number; lesson_order: number; title: string }> = [];

        for (const lesson of lessons) {
          const result = await client.query(
            `INSERT INTO training_lessons (educational_content_id, language, title, content, lesson_order, duration_minutes, lesson_type, video_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id, lesson_order, title`,
            [
              educationalContentId,
              language,
              lesson.title,
              lesson.content,
              order,
              lesson.duration_minutes,
              lesson.lesson_type || 'text',
              lesson.video_url ?? null
            ]
          );

          inserted.push(result.rows[0]);
          order += 1;
        }

        return NextResponse.json({
          success: true,
          saved: true,
          course: {
            id: educationalContentId,
            title: courseTitle,
            category: courseCategory
          },
          inserted,
          lessons
        });
      } finally {
        client.release();
      }
    }

    return NextResponse.json({ success: true, saved: false, lessons });
  } catch (error) {
    console.error('AI generate lessons error:', error);

    if (error instanceof Error && error.message === 'MISSING_OPENAI_API_KEY') {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not configured' }, { status: 500 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
