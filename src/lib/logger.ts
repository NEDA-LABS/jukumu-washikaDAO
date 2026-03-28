const isProd = process.env.NODE_ENV === 'production';

const REDACTED_KEYS = [
  'password', 'password_hash', 'token', 'secret', 'api_key', 'apikey',
  'authorization', 'cookie', 'jwt', 'bearer', 'credit_card', 'phone',
  'national_id', 'id_number',
];

function redact(value: unknown, depth = 0): unknown {
  if (depth > 5 || value === null || value === undefined) return value;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(v => redact(v, depth + 1));
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const lower = k.toLowerCase();
      result[k] = REDACTED_KEYS.some(r => lower.includes(r)) ? '[REDACTED]' : redact(v, depth + 1);
    }
    return result;
  }
  return value;
}

export const logger = {
  info(...args: unknown[]): void {
    if (!isProd) console.log(...args);
  },
  warn(...args: unknown[]): void {
    if (!isProd) console.warn(...args);
  },
  error(...args: unknown[]): void {
    console.error(...(isProd ? args.map(a => redact(a)) : args));
  },
  debug(...args: unknown[]): void {
    if (!isProd) console.log('[debug]', ...args);
  },
};
