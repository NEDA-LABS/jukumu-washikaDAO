import { RateLimiterMemory } from 'rate-limiter-flexible';
import { NextRequest, NextResponse } from 'next/server';

const authLimiter = new RateLimiterMemory({
  points: 10,        // 10 attempts
  duration: 15 * 60, // per 15 minutes
  blockDuration: 15 * 60,
});

export async function checkAuthRateLimit(request: NextRequest): Promise<NextResponse | null> {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  try {
    await authLimiter.consume(ip);
    return null;
  } catch {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again in 15 minutes.' },
      {
        status: 429,
        headers: { 'Retry-After': '900' },
      }
    );
  }
}
