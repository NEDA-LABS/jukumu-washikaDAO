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
      model: process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307',
      max_tokens: 4096,
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

  // Extract JSON object — find first { and last }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`AI did not return JSON. Response: ${text.slice(0, 200)}`);
  }
  const extracted = text.slice(start, end + 1);

  // Repair: escape literal newlines/tabs inside JSON string values
  function repairJson(s: string): string {
    let inString = false;
    let escaped = false;
    let out = '';
    for (const ch of s) {
      if (escaped) { escaped = false; out += ch; continue; }
      if (ch === '\\') { escaped = true; out += ch; continue; }
      if (ch === '"') { inString = !inString; out += ch; continue; }
      if (inString) {
        if (ch === '\n') { out += '\\n'; continue; }
        if (ch === '\r') { out += '\\r'; continue; }
        if (ch === '\t') { out += '\\t'; continue; }
      }
      out += ch;
    }
    return out;
  }

  const cleaned = repairJson(extracted);
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`Failed to parse JSON: ${cleaned.slice(0, 300)}`);
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
      `You are an expert educational content creator for Tanzania. Generate a course in ${langName} at ${diffLabel} level.\n` +
      `Return ONLY a raw JSON object — no markdown, no extra text, no code fences.\n` +
      `Structure:\n` +
      `{"title":"...","description":"2 sentences.","category":"Biashara|Fedha|Uongozi|Teknolojia|Akiba","duration":"Xh Ym","lessons":[{"title":"...","content":"150-250 word lesson with 2-3 key points and one practical exercise.","duration_minutes":15}]}\n` +
      `Rules: JSON only. Lesson content max 250 words each. Use Tanzania examples (M-Pesa, VICOBA, shillingi). No markdown fences.`;

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
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (msg === 'MISSING_ANTHROPIC_API_KEY') {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured on this server' }, { status: 500 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
