import { describe, it, expect } from 'vitest';
import { checkAuthRateLimit } from '@/lib/rate-limiter';
import type { NextRequest } from 'next/server';

function makeRequest(ip?: string, realIp?: string): NextRequest {
  return {
    headers: {
      get: (name: string) => {
        if (name === 'x-forwarded-for') return ip ?? null;
        if (name === 'x-real-ip') return realIp ?? null;
        return null;
      },
    },
  } as unknown as NextRequest;
}

describe('checkAuthRateLimit', () => {
  it('returns null (allow) for a fresh IP', async () => {
    const req = makeRequest('1.2.3.4');
    const result = await checkAuthRateLimit(req);
    expect(result).toBeNull();
  });

  it('uses x-forwarded-for first IP when comma-separated', async () => {
    const req = makeRequest('10.0.0.1, 10.0.0.2');
    const result = await checkAuthRateLimit(req);
    expect(result).toBeNull();
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', async () => {
    const req = makeRequest(undefined, '5.5.5.5');
    const result = await checkAuthRateLimit(req);
    expect(result).toBeNull();
  });

  it('falls back to "unknown" when no IP headers present', async () => {
    const req = makeRequest(undefined, undefined);
    const result = await checkAuthRateLimit(req);
    expect(result).toBeNull();
  });

  it('returns 429 after exhausting rate limit points', async () => {
    const ip = `overload-test-${Date.now()}`;
    const req = makeRequest(ip);

    let blocked: Response | null = null;
    for (let i = 0; i < 12; i++) {
      blocked = await checkAuthRateLimit(req);
      if (blocked !== null) break;
    }

    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
    const body = await blocked!.json();
    expect(body.error).toMatch(/too many/i);
  });

  it('blocked response includes Retry-After header', async () => {
    const ip = `retry-header-${Date.now()}`;
    const req = makeRequest(ip);
    let blocked: Response | null = null;
    for (let i = 0; i < 12; i++) {
      blocked = await checkAuthRateLimit(req);
      if (blocked !== null) break;
    }
    expect(blocked!.headers.get('retry-after')).toBe('900');
  });
});
