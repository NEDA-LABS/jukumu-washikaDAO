import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { getAuthTokenPayload } from '@/lib/auth';
import type { NextRequest } from 'next/server';

const SECRET = 'test-secret-key';

function makeRequest(token?: string): NextRequest {
  const headers = new Headers();
  if (token) headers.set('cookie', `auth-token=${token}`);
  return {
    cookies: {
      get: (name: string) => (name === 'auth-token' && token ? { value: token } : undefined),
    },
    headers,
  } as unknown as NextRequest;
}

describe('getAuthTokenPayload', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
  });

  it('returns null when no cookie is present', () => {
    const req = makeRequest(undefined);
    expect(getAuthTokenPayload(req)).toBeNull();
  });

  it('returns null when JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET;
    const token = jwt.sign({ userId: 1 }, SECRET);
    const req = makeRequest(token);
    expect(getAuthTokenPayload(req)).toBeNull();
  });

  it('returns null for a tampered token', () => {
    const token = jwt.sign({ userId: 1 }, 'wrong-secret');
    const req = makeRequest(token);
    expect(getAuthTokenPayload(req)).toBeNull();
  });

  it('returns null for an expired token', () => {
    const token = jwt.sign({ userId: 1 }, SECRET, { expiresIn: -1 });
    const req = makeRequest(token);
    expect(getAuthTokenPayload(req)).toBeNull();
  });

  it('returns null when userId is not a number', () => {
    const token = jwt.sign({ userId: 'not-a-number' }, SECRET);
    const req = makeRequest(token);
    expect(getAuthTokenPayload(req)).toBeNull();
  });

  it('returns payload for a valid member token', () => {
    const token = jwt.sign({ userId: 42, email: 'user@test.com', role: 'member' }, SECRET);
    const req = makeRequest(token);
    const payload = getAuthTokenPayload(req);
    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe(42);
    expect(payload!.email).toBe('user@test.com');
    expect(payload!.role).toBe('member');
  });

  it('returns payload for a valid admin token', () => {
    const token = jwt.sign({ userId: 1, role: 'admin' }, SECRET);
    const req = makeRequest(token);
    const payload = getAuthTokenPayload(req);
    expect(payload!.role).toBe('admin');
  });

  it('omits email/role when absent from token', () => {
    const token = jwt.sign({ userId: 5 }, SECRET);
    const req = makeRequest(token);
    const payload = getAuthTokenPayload(req);
    expect(payload!.userId).toBe(5);
    expect(payload!.email).toBeUndefined();
    expect(payload!.role).toBeUndefined();
  });
});
