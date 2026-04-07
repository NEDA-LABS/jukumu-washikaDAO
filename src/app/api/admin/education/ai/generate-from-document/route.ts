import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getAuthTokenPayload } from '@/lib/auth';
import {
  AI_MODEL_CONTENT_GENERATION,
  COURSE_GENERATION_SYSTEM_PROMPT,
  DOCUMENT_RESTRUCTURE_PROMPT,
} from '@/lib/education/ai-prompts';
import { validateUpload, extractText } from '@/lib/education/document-parser';
import type { GeneratedCourse } from '@/lib/education/types';

function parseGeneratedCourse(text: string): GeneratedCourse | null {
  try {
    return JSON.parse(text) as GeneratedCourse;
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim()) as GeneratedCourse;
      } catch {
        // Fall through
      }
    }

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
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const categoryId = formData.get('category_id') as string | null;
    const language = (formData.get('language') as string) || 'sw';
    const difficulty = (formData.get('difficulty') as string) || 'beginner';
    const lessonCount = parseInt((formData.get('lesson_count') as string) || '5', 10);

    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    if (!categoryId) {
      return NextResponse.json({ error: 'category_id is required' }, { status: 400 });
    }

    const validation = validateUpload(file.name, file.size);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { text, error: extractError } = await extractText(buffer, file.name);
    if (extractError || !text) {
      return NextResponse.json(
        { error: extractError || 'Failed to extract text from document' },
        { status: 400 }
      );
    }

    const userPrompt = `${DOCUMENT_RESTRUCTURE_PROMPT}

SOURCE MATERIAL:
${text.substring(0, 30000)}

Requirements:
- Number of lessons: ${lessonCount}
- Language: ${language === 'sw' ? 'Swahili (Tanzanian dialect)' : 'English'}
- Difficulty: ${difficulty}`;

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
    console.error('POST /admin/education/ai/generate-from-document error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
