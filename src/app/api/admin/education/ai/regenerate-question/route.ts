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
    const { scenario_text, skill_tag, feedback, language, difficulty } = body;

    if (!skill_tag) {
      return NextResponse.json({ error: 'skill_tag is required' }, { status: 400 });
    }

    const userPrompt = `Regenerate/improve this assessment question:

${scenario_text ? `Current question:\n${scenario_text}` : `Create a new question for skill: ${skill_tag}`}
${feedback ? `Admin feedback: ${feedback}` : 'Please improve the question quality and scenario realism.'}

Requirements:
- Language: ${language === 'en' ? 'English' : 'Swahili (Tanzanian dialect)'}
- Difficulty: ${difficulty || 'beginner'}
- Skill tag: ${skill_tag}
- Return JSON with: { "scenario_text": "...", "options": [{"label": "A", "text": "..."}, ...], "correct_option": "...", "explanation": "...", "skill_tag": "${skill_tag}" }
- Must have exactly 4 options (A, B, C, D)
- Use realistic Tanzanian context
- Return ONLY the JSON, no code fences or other text`;

    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: AI_MODEL_CONTENT_GENERATION,
      max_tokens: 2000,
      system: COURSE_GENERATION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    let question;
    try {
      question = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          question = JSON.parse(jsonMatch[1].trim());
        } catch {
          // Fall through
        }
      }
      if (!question) {
        const firstBrace = responseText.indexOf('{');
        const lastBrace = responseText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          try {
            question = JSON.parse(responseText.substring(firstBrace, lastBrace + 1));
          } catch {
            return NextResponse.json(
              { error: 'Failed to parse AI response' },
              { status: 500 }
            );
          }
        }
      }
    }

    if (!question) {
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, question });
  } catch (err) {
    console.error('POST /admin/education/ai/regenerate-question error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
