import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  const client = await pool.connect();
  const steps: string[] = [];

  const run = async (label: string, sql: string) => {
    await client.query(sql);
    steps.push(`✓ ${label}`);
  };

  try {
    await run('certificates_enabled column', `
      ALTER TABLE educational_content
      ADD COLUMN IF NOT EXISTS certificates_enabled BOOLEAN DEFAULT false
    `);

    await run('pass_threshold column', `
      ALTER TABLE educational_content
      ADD COLUMN IF NOT EXISTS pass_threshold INTEGER DEFAULT 100
    `);

    await run('course_completions table', `
      CREATE TABLE IF NOT EXISTS course_completions (
        id SERIAL PRIMARY KEY,
        member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        educational_content_id INTEGER NOT NULL REFERENCES educational_content(id) ON DELETE CASCADE,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        lessons_completed INTEGER DEFAULT 0,
        total_lessons INTEGER DEFAULT 0,
        UNIQUE(member_id, educational_content_id)
      )
    `);

    await run('certificates table', `
      CREATE TABLE IF NOT EXISTS certificates (
        id SERIAL PRIMARY KEY,
        credential_id VARCHAR(64) UNIQUE NOT NULL,
        member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        educational_content_id INTEGER NOT NULL REFERENCES educational_content(id) ON DELETE CASCADE,
        issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        member_name VARCHAR(255),
        course_title VARCHAR(255),
        UNIQUE(member_id, educational_content_id)
      )
    `);

    await run('idx_course_completions_member', `CREATE INDEX IF NOT EXISTS idx_course_completions_member ON course_completions(member_id)`);
    await run('idx_certificates_member', `CREATE INDEX IF NOT EXISTS idx_certificates_member ON certificates(member_id)`);
    await run('idx_certificates_credential', `CREATE INDEX IF NOT EXISTS idx_certificates_credential ON certificates(credential_id)`);

    client.release();
    return NextResponse.json({ success: true, steps });
  } catch (err) {
    client.release();
    const msg = err instanceof Error ? err.message : String(err);
    console.error('setup-certificates error:', msg);
    return NextResponse.json({ success: false, error: msg, completedSteps: steps }, { status: 500 });
  }
}
