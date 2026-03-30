import { describe, it, expect } from 'vitest';
import { middleware } from '@/middleware';
import type { NextRequest } from 'next/server';

function makeRequest(pathname: string, token?: string): NextRequest {
  const url = `http://localhost${pathname}`;
  return {
    nextUrl: { pathname },
    url,
    cookies: {
      get: (name: string) => (name === 'auth-token' && token ? { value: token } : undefined),
    },
    headers: new Headers(),
  } as unknown as NextRequest;
}

describe('middleware route protection', () => {
  describe('public pages', () => {
    it.each(['/', '/login', '/register', '/investor', '/portal'])(
      'allows %s without a token',
      (path) => {
        const res = middleware(makeRequest(path));
        expect(res.status).not.toBe(401);
        expect(res.headers.get('location')).toBeNull();
      }
    );
  });

  describe('public page prefixes', () => {
    it.each(['/jifunze/intro', '/learn/track1'])(
      'allows %s without a token',
      (path) => {
        const res = middleware(makeRequest(path));
        expect(res.status).not.toBe(401);
      }
    );
  });

  describe('public API prefixes', () => {
    it('allows /api/auth/signin without a token', () => {
      const res = middleware(makeRequest('/api/auth/signin'));
      expect(res.status).not.toBe(401);
    });

    it('allows /api/public/training without a token', () => {
      const res = middleware(makeRequest('/api/public/training'));
      expect(res.status).not.toBe(401);
    });

    it('allows /api/webhooks/ntzs without a token', () => {
      const res = middleware(makeRequest('/api/webhooks/ntzs'));
      expect(res.status).not.toBe(401);
    });

    it('allows /api/groups/lookup without a token', () => {
      const res = middleware(makeRequest('/api/groups/lookup'));
      expect(res.status).not.toBe(401);
    });
  });

  describe('protected API routes', () => {
    it('returns 401 for /api/admin/members without a token', async () => {
      const res = middleware(makeRequest('/api/admin/members'));
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toMatch(/unauthorized/i);
    });

    it('returns 401 for /api/member/groups without a token', async () => {
      const res = middleware(makeRequest('/api/member/groups'));
      expect(res.status).toBe(401);
    });

    it('allows /api/admin/members with a token', () => {
      const res = middleware(makeRequest('/api/admin/members', 'some-valid-token'));
      expect(res.status).not.toBe(401);
    });
  });

  describe('protected page routes', () => {
    it('redirects /dashboard to /login when no token', () => {
      const res = middleware(makeRequest('/dashboard'));
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/login');
    });

    it('redirects /member-dashboard to /login when no token', () => {
      const res = middleware(makeRequest('/member-dashboard'));
      expect(res.headers.get('location')).toContain('/login');
    });

    it('includes next param in login redirect', () => {
      const res = middleware(makeRequest('/dashboard'));
      const location = res.headers.get('location') ?? '';
      expect(location).toContain('next=%2Fdashboard');
    });

    it('allows /dashboard with a token', () => {
      const res = middleware(makeRequest('/dashboard', 'some-token'));
      expect(res.headers.get('location')).toBeNull();
    });
  });
});
