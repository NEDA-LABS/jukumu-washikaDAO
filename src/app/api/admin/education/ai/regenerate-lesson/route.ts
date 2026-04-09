import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getAuthTokenPayload } from '@/lib/auth';
import { AI_MODEL_CONTENT_GENERATION, COURSE_GENERATION_SYSTEM_PROMPT } from '@/lib/education/ai-prompts';

export async function POST(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { lesson_title, lesson_content, feedback, language, difficulty } = body;

    if (!lesson_title) {
      return NextResponse.json({ error: 'lesson_title is required' }, { status: 400 });
    }

    const userPrompt = `Regenerate/improve this lesson:

Title: ${lesson_title}
${lesson_content ? `Current content:\n${lesson_content.substring(0, 5000)}` : ''}
${feedback ? `Admin feedback: ${feedback}` : 'Please improve the content quality, examples, and clarity.'}

Requirements:
- Language: ${language === 'en' ? 'English' : 'Swahili (Tanzanian dialect)'}
- Difficulty: ${difficulty || 'beginner'}
- Return JSON with: { "title": "...", "content": "...", "duration_minutes": N }
- Content should be in markdown format
- Return ONLY the JSON, no code fences or other text`;

    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: AI_MODEL_CONTENT_GENERATION,
      max_tokens: 8000,
      system: COURSE_GENERATION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    let lesson;
    try {
      lesson = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          lesson = JSON.parse(jsonMatch[1].trim());
        } catch {
          // Fall through
        }
      }
      if (!lesson) {
        const firstBrace = responseText.indexOf('{');
        const lastBrace = responseText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          try {
            lesson = JSON.parse(responseText.substring(firstBrace, lastBrace + 1));
          } catch {
            return NextResponse.json(
              { error: 'Failed to parse AI response' },
              { status: 500 }
            );
          }
        }
      }
    }

    if (!lesson) {
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, lesson });
  } catch (err) {
    console.error('POST /admin/education/ai/regenerate-lesson error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
