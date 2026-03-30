import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('logger', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('in development', () => {
    it('info() calls console.log', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      const { logger } = await import('@/lib/logger');
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('hello');
      expect(spy).toHaveBeenCalledWith('hello');
    });

    it('warn() calls console.warn', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      const { logger } = await import('@/lib/logger');
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('watch out');
      expect(spy).toHaveBeenCalledWith('watch out');
    });

    it('error() passes args through unredacted', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      const { logger } = await import('@/lib/logger');
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const obj = { password: 'secret123' };
      logger.error(obj);
      expect(spy).toHaveBeenCalledWith(obj);
    });
  });

  describe('in production', () => {
    it('info() is silent', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const { logger } = await import('@/lib/logger');
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('should not appear');
      expect(spy).not.toHaveBeenCalled();
    });

    it('error() redacts password fields', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const { logger } = await import('@/lib/logger');
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error({ password: 'secret123', name: 'Alice' });
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ password: '[REDACTED]', name: 'Alice' })
      );
    });

    it('error() redacts nested token fields', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const { logger } = await import('@/lib/logger');
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error({ user: { token: 'abc123', email: 'a@b.com' } });
      const call = (spy.mock.calls[0][0] as any);
      expect(call.user.token).toBe('[REDACTED]');
      expect(call.user.email).toBe('a@b.com');
    });

    it('error() redacts phone and national_id', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const { logger } = await import('@/lib/logger');
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error({ phone: '0712345678', national_id: 'T12345678' });
      const call = spy.mock.calls[0][0] as any;
      expect(call.phone).toBe('[REDACTED]');
      expect(call.national_id).toBe('[REDACTED]');
    });

    it('error() leaves non-sensitive fields intact', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const { logger } = await import('@/lib/logger');
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error({ status: 500, message: 'DB error' });
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 500, message: 'DB error' })
      );
    });
  });
});
