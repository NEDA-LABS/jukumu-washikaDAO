import { NextRequest, NextResponse } from 'next/server';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { verifyKey, type ApiKeyRecord, type ApiScope } from './keys';

/**
 * Shared plumbing for the public /api/v1 surface: a single response envelope,
 * bearer-key auth with scope checks, per-key rate limiting, and pagination
 * parsing. Every v1 route goes through `handle()` so responses, error codes
 * and headers stay identical across the whole API.
 */

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

const limiter = new RateLimiterMemory({ points: 120, duration: 60 });

export function ok<T>(data: T, meta?: Record<string, unknown>, init?: ResponseInit) {
  return NextResponse.json({ data, ...(meta ? { meta } : {}) }, init);
}

export function fail(status: number, code: string, message: string, details?: unknown) {
  const body: { error: ApiError } = { error: { code, message } };
  if (details !== undefined) body.error.details = details;
  return NextResponse.json(body, { status });
}

export interface Ctx {
  key: ApiKeyRecord;
  /** Parsed ?limit= (1-100, default 25) */
  limit: number;
  /** Parsed ?offset= (>=0, default 0) */
  offset: number;
  searchParams: URLSearchParams;
}

export function parsePaging(searchParams: URLSearchParams) {
  const rawLimit = Number.parseInt(searchParams.get('limit') || '25', 10);
  const rawOffset = Number.parseInt(searchParams.get('offset') || '0', 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 25;
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0;
  return { limit, offset };
}

export function pageMeta(total: number, limit: number, offset: number) {
  return { total, limit, offset, has_more: offset + limit < total };
}

/**
 * Wrap a v1 route handler with auth, scope enforcement and rate limiting.
 *
 *   export const GET = handle('read', async (req, ctx) => ok(...));
 */
export function handle(
  scope: ApiScope,
  fn: (request: NextRequest, ctx: Ctx) => Promise<NextResponse>,
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const header = request.headers.get('authorization') || '';
    const raw = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';

    if (!raw) {
      return fail(401, 'missing_api_key', 'Provide your key as: Authorization: Bearer wd_live_...');
    }

    const key = await verifyKey(raw);
    if (!key) {
      return fail(401, 'invalid_api_key', 'This API key is invalid or has been revoked.');
    }

    if (!key.scopes.includes(scope)) {
      return fail(403, 'insufficient_scope', `This key needs the "${scope}" scope for that request.`);
    }

    try {
      await limiter.consume(String(key.id), 1);
    } catch {
      return NextResponse.json(
        { error: { code: 'rate_limited', message: 'Too many requests. Slow down and retry shortly.' } },
        { status: 429, headers: { 'Retry-After': '60' } },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const { limit, offset } = parsePaging(searchParams);

    try {
      return await fn(request, { key, limit, offset, searchParams });
    } catch (err) {
      console.error('[api/v1]', request.nextUrl.pathname, err);
      return fail(500, 'internal_error', 'Something went wrong handling that request.');
    }
  };
}

/**
 * Same as `handle`, for routes with a dynamic segment. Next passes the params
 * as a second argument, which `handle` does not forward.
 */
export function handleWithParams<P extends Record<string, string>>(
  scope: ApiScope,
  fn: (request: NextRequest, ctx: Ctx & { params: P }) => Promise<NextResponse>,
) {
  return async (request: NextRequest, route: { params: Promise<P> }): Promise<NextResponse> => {
    const params = await route.params;
    return handle(scope, (req, ctx) => fn(req, { ...ctx, params }))(request);
  };
}
