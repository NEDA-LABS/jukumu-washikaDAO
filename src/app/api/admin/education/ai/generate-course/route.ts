import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getAuthTokenPayload } from '@/lib/auth';
import { AI_MODEL_CONTENT_GENERATION, COURSE_GENERATION_SYSTEM_PROMPT } from '@/lib/education/ai-prompts';
import type { GenerateCourseRequest, GeneratedCourse } from '@/lib/education/types';

function parseGeneratedCourse(text: string): GeneratedCourse | null {
  // Try direct JSON parse first
  try {
    return JSON.parse(text) as GeneratedCourse;
  } catch {
    // Fallback: extract JSON from markdown code fences
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim()) as GeneratedCourse;
      } catch {
        // Fall through
      }
    }

    // Fallback: find first { to last }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.substring(firstBrace, lastBrace + 1)) as GeneratedCourse;
      } catch {
        return null;
      }
    }

    return null;
  }
}

export async function POST(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body: GenerateCourseRequest = await request.json();

    if (!body.topic_prompt || !body.category_id) {
      return NextResponse.json(
        { error: 'topic_prompt and category_id are required' },
        { status: 400 }
      );
    }

    const lessonCount = body.lesson_count || 5;
    const language = body.language || 'sw';
    const difficulty = body.difficulty || 'beginner';

    const userPrompt = `Create a ${difficulty}-level course about: ${body.topic_prompt}

Requirements:
- Number of lessons: ${lessonCount}
- Language: ${language === 'sw' ? 'Swahili (Tanzanian dialect)' : 'English'}
- Difficulty: ${difficulty}
${body.context_notes ? `- Additional context: ${body.context_notes}` : ''}`;

    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: AI_MODEL_CONTENT_GENERATION,
      max_tokens: 16000,
      system: COURSE_GENERATION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    const course = parseGeneratedCourse(responseText);
    if (!course) {
      return NextResponse.json(
        { error: 'Failed to parse AI response as valid course JSON' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, course });
  } catch (err) {
    console.error('POST /admin/education/ai/generate-course error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
