import { randomBytes } from 'crypto';
import type { PoolClient } from 'pg';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateGroupCode(): string {
  const bytes = randomBytes(6);
  let code = 'JKM-';
  for (let i = 0; i < 6; i++) {
    code += CHARS[bytes[i] % CHARS.length];
  }
  return code;
}

export async function generateUniqueGroupCode(client: PoolClient): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateGroupCode();
    const res = await client.query(
      'SELECT 1 FROM groups WHERE group_code = $1 LIMIT 1',
      [code]
    );
    if ((res as { rows: unknown[] }).rows.length === 0) return code;
  }
  throw new Error('Failed to generate unique group code after 10 attempts');
}
