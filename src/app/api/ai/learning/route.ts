import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthTokenPayload } from '@/lib/auth';

const LearningAiRequestSchema = z.object({
  language: z.enum(['sw', 'en']).default('en'),
  moduleId: z.union([z.string(), z.number()]).optional(),
  moduleTitle: z.string().optional(),
  moduleDescription: z.string().optional(),
  lessons: z
    .array(
      z.object({
        id: z.union([z.string(), z.number()]).optional(),
        title: z.string().optional(),
        preview: z.string().optional(),
        duration_minutes: z.number().optional(),
        lesson_type: z.string().optional(),
        language: z.string().optional()
      })
    )
    .optional(),
  message: z.string().trim().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'ai']),
        message: z.string().max(4000)
      })
    )
    .max(30)
    .optional(),
  action: z.enum(['chat', 'tip', 'goal', 'plan', 'progress']).default('chat')
});

async function callOpenAIJson({
  model,
  messages
}: {
  model: string;
  messages: Array<{ role: 'system' | 'user'; content: string }>;
}): Promise<unknown> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('MISSING_OPENAI_API_KEY');

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
      messages
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

async function streamOpenAI({
  model,
  messages,
  onDelta
}: {
  model: string;
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  onDelta: (delta: string) => void;
}): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('MISSING_OPENAI_API_KEY');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      stream: true,
      messages
    })
  });

  if (!res.ok || !res.body) {
    const text = await res.text();
    throw new Error(`OPENAI_ERROR_${res.status}:${text}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split('\n');
    buffer = parts.pop() || '';

    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;

      const payload = trimmed.slice('data:'.length).trim();
      if (payload === '[DONE]') return;

      try {
        const json = JSON.parse(payload) as any;
        const delta = json?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta.length > 0) {
          onDelta(delta);
        }
      } catch {
        // ignore
      }
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthTokenPayload(request);
    const isAuthed = Boolean(auth);

    if (!isAuthed) {
      const used = Number(request.cookies.get('ai_public_used')?.value || '0');
      if (Number.isFinite(used) && used >= 2) {
        return NextResponse.json(
          { error: 'Please log in to continue using the AI Learning Assistant.' },
          { status: 401 }
        );
      }
    }

    const rawBody = await request.json();
    const parsed = LearningAiRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { language, moduleId, moduleTitle, moduleDescription, lessons, message, history, action } = parsed.data;

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const langInstruction = language === 'sw' ? 'Respond in Swahili (Tanzania).' : 'Respond in English.';

    const systemBase =
      `You are JUKUMU AI Learning Assistant. ${langInstruction} ` +
      `Your job is to help the learner understand the current course and make a practical study plan. ` +
      `Be helpful and accurate. Avoid making promises about earnings. ` +
      `If the user asks for financial advice, focus on education and general best practices.`;

    const lessonContext = Array.isArray(lessons)
      ? lessons
          .slice(0, 25)
          .map((l, idx) => {
            const title = l.title || `Lesson ${idx + 1}`;
            const type = l.lesson_type || '';
            const mins = typeof l.duration_minutes === 'number' ? `${l.duration_minutes} min` : '';
            const prev = l.preview ? `Preview: ${l.preview}` : '';
            return `- ${title}${type ? ` (${type})` : ''}${mins ? ` • ${mins}` : ''}${prev ? `\n  ${prev}` : ''}`;
          })
          .join('\n')
      : '';

    const moduleContextParts = [
      moduleId ? `Module ID: ${moduleId}` : '',
      moduleTitle ? `Module title: ${moduleTitle}` : '',
      moduleDescription ? `Module description: ${moduleDescription}` : '',
      lessonContext ? `Lessons available:\n${lessonContext}` : ''
    ].filter(Boolean);

    const moduleContext = moduleContextParts.join('\n\n');

    const userIntent =
      action === 'tip'
        ? 'Give me a personalized learning tip for the current module.'
        : action === 'goal'
        ? 'Help me set a learning goal for the next 7 days.'
        : action === 'plan'
        ? 'Create a simple learning plan for this module based on the available lessons.'
        : action === 'progress'
        ? 'Analyze my progress and tell me what to do next.'
        : 'Chat with me to help me learn.';

    const historyText = (history || [])
      .slice(-12)
      .map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.message}`)
      .join('\n');

    const userContent =
      `${userIntent}\n\n` +
      (moduleContext ? `Context:\n${moduleContext}\n\n` : '') +
      (historyText ? `Recent conversation:\n${historyText}\n\n` : '') +
      `User message: ${message}`;

    // PLAN: return structured JSON (non-stream)
    if (action === 'plan') {
      const system =
        `${systemBase} ` +
        `Return ONLY valid JSON with this shape: ` +
        `{"reply": string, "plan": {"title": string, "steps": [{"title": string, "description": string}]} | null}`;

      const raw = await callOpenAIJson({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent }
        ]
      });

      const ResponseSchema = z.object({
        reply: z.string().min(1).max(8000),
        plan: z
          .object({
            title: z.string().min(1).max(200),
            steps: z
              .array(
                z.object({
                  title: z.string().min(1).max(200),
                  description: z.string().min(1).max(2000)
                })
              )
              .min(1)
              .max(15)
          })
          .nullable()
          .optional()
      });

      const normalized = ResponseSchema.safeParse(raw);
      if (!normalized.success) {
        return NextResponse.json(
          { error: 'AI output could not be parsed. Try again.' },
          { status: 502 }
        );
      }

      const response = NextResponse.json({
        success: true,
        reply: normalized.data.reply,
        plan: normalized.data.plan ?? null
      });

      if (!isAuthed) {
        const used = Number(request.cookies.get('ai_public_used')?.value || '0');
        response.cookies.set('ai_public_used', String((Number.isFinite(used) ? used : 0) + 1), {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 7 * 24 * 60 * 60
        });
      }

      return response;
    }

    // STREAM: chat/tip/goal/progress
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start: async (controller) => {
        const send = (obj: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        };

        try {
          // First chunk can contain useful metadata
          send({ type: 'start' });

          await streamOpenAI({
            model,
            messages: [
              { role: 'system', content: systemBase },
              { role: 'user', content: userContent }
            ],
            onDelta: (delta: string) => send({ type: 'delta', delta })
          });

          send({ type: 'done' });
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'AI request failed';
          send({ type: 'error', error: msg });
        } finally {
          controller.close();
        }
      }
    });

    const headers = new Headers({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    });

    if (!isAuthed) {
      const used = Number(request.cookies.get('ai_public_used')?.value || '0');
      const nextUsed = (Number.isFinite(used) ? used : 0) + 1;
      headers.append(
        'Set-Cookie',
        `ai_public_used=${encodeURIComponent(String(nextUsed))}; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}; HttpOnly`
      );
    }

    return new Response(stream, { status: 200, headers });
  } catch (error) {
    console.error('AI learning error:', error);

    if (error instanceof Error && error.message === 'MISSING_OPENAI_API_KEY') {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not configured' }, { status: 500 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
