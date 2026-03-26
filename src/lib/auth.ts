import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

export type AuthTokenPayload = {
  userId: number;
  email?: string;
  role?: string;
  iat?: number;
  exp?: number;
};

export function getAuthTokenPayload(request: NextRequest): AuthTokenPayload | null {
  const token = request.cookies.get('auth-token')?.value;
  if (!token) return null;

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) return null;

  try {
    const decoded = jwt.verify(token, jwtSecret);
    if (!decoded || typeof decoded !== 'object') return null;

    const userId = (decoded as { userId?: unknown }).userId;
    if (typeof userId !== 'number') return null;

    const email = (decoded as { email?: unknown }).email;
    const role = (decoded as { role?: unknown }).role;

    return {
      userId,
      email: typeof email === 'string' ? email : undefined,
      role: typeof role === 'string' ? role : undefined,
      iat: (decoded as { iat?: unknown }).iat as number | undefined,
      exp: (decoded as { exp?: unknown }).exp as number | undefined
    };
  } catch {
    return null;
  }
}
