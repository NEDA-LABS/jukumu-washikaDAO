import { NextRequest } from 'next/server';
import { getAuthTokenPayload } from '@/lib/auth';
import pool from '@/lib/db';
import { getLessonById, checkAndIncrementAIUsage } from '@/lib/education/db';
import { buildCompanionSystemPrompt, AI_MODEL_COMPANION_FAST, AI_MODEL_COMPANION_DEEP } from '@/lib/education/ai-prompts';
import Anthropic from '@anthropic-ai/sdk';
import type { CompanionRequest } from '@/lib/education/types';

export async function POST(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json().catch(() => null) as CompanionRequest | null;
  if (!body?.lesson_id || !body?.message) {
    return new Response(JSON.stringify({ error: 'lesson_id and message are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const memberRes = await pool.query(
      'SELECT id FROM members WHERE user_id = $1 LIMIT 1',
      [auth.userId],
    );
    if (memberRes.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Member profile not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const memberId = memberRes.rows[0].id as number;

    // Check rate limit
    const usage = await checkAndIncrementAIUsage(memberId);
    if (!usage.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Umefika kikomo cha maswali ya leo. Jaribu tena kesho!',
          remaining: 0,
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // Get lesson content for context
    const lesson = await getLessonById(body.lesson_id);
    if (!lesson) {
      return new Response(JSON.stringify({ error: 'Lesson not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Choose model based on action
    const model = body.action === 'my_situation' ? AI_MODEL_COMPANION_DEEP : AI_MODEL_COMPANION_FAST;
    const systemPrompt = buildCompanionSystemPrompt(lesson.title, lesson.content);

    // Build messages
    const messages: Anthropic.MessageParam[] = [
      ...(body.chat_history || []).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: body.message },
    ];

    // Create Anthropic client and stream
    const anthropic = new Anthropic();
    const stream = anthropic.messages.stream({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    // Transform to simplified JSON lines stream
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              const chunk = JSON.stringify({ type: 'delta', text: event.delta.text }) + '\n';
              controller.enqueue(encoder.encode(chunk));
            }
          }
          const done = JSON.stringify({ type: 'done' }) + '\n';
          controller.enqueue(encoder.encode(done));
          controller.close();
        } catch (streamErr) {
          console.error('AI companion stream error:', streamErr);
          const errorChunk = JSON.stringify({ type: 'error', text: 'Hitilafu imetokea. Jaribu tena.' }) + '\n';
          controller.enqueue(encoder.encode(errorChunk));
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('AI companion error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
