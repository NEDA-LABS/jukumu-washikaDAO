import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { randomBytes } from 'crypto';

// POST /api/training/complete-course
// Body: { userId, courseId }
// Marks course complete, generates certificate if enabled
export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    const { userId, courseId } = await request.json();
    if (!userId || !courseId) {
      client.release();
      return NextResponse.json({ error: 'userId and courseId required' }, { status: 400 });
    }

    // Resolve member from user
    const memberRes = await client.query(
      'SELECT m.id, m.full_name FROM members m WHERE m.user_id = $1 LIMIT 1',
      [userId]
    );
    if (memberRes.rows.length === 0) {
      client.release();
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }
    const member = memberRes.rows[0];

    // Fetch course info
    const courseRes = await client.query(
      'SELECT id, title, certificates_enabled, pass_threshold FROM educational_content WHERE id = $1',
      [courseId]
    );
    if (courseRes.rows.length === 0) {
      client.release();
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }
    const course = courseRes.rows[0];

    // Count total lessons and completed lessons for this member
    const totalRes = await client.query(
      'SELECT COUNT(*) as total FROM training_lessons WHERE educational_content_id = $1',
      [courseId]
    );
    const completedRes = await client.query(
      `SELECT COUNT(*) as done
       FROM lesson_progress lp
       JOIN training_lessons tl ON lp.lesson_id = tl.id
       WHERE tl.educational_content_id = $1 AND lp.member_id = $2 AND lp.completed = true`,
      [courseId, member.id]
    );

    const total = parseInt(totalRes.rows[0].total);
    const done = parseInt(completedRes.rows[0].done);
    const threshold = course.pass_threshold ?? 100;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    if (pct < threshold) {
      client.release();
      return NextResponse.json({
        error: `Unahitaji kukamilisha angalau ${threshold}% ya masomo. Umefika ${pct}%.`,
        pct,
        threshold,
      }, { status: 400 });
    }

    // Upsert course_completions
    await client.query(
      `INSERT INTO course_completions (member_id, educational_content_id, lessons_completed, total_lessons, completed_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (member_id, educational_content_id)
       DO UPDATE SET lessons_completed = $3, total_lessons = $4, completed_at = NOW()`,
      [member.id, courseId, done, total]
    );

    // Generate certificate if enabled
    let certificate = null;
    if (course.certificates_enabled) {
      // Check if already issued
      const existingCert = await client.query(
        'SELECT * FROM certificates WHERE member_id = $1 AND educational_content_id = $2',
        [member.id, courseId]
      );
      if (existingCert.rows.length > 0) {
        certificate = existingCert.rows[0];
      } else {
        const credentialId = randomBytes(16).toString('hex');
        const certRes = await client.query(
          `INSERT INTO certificates (credential_id, member_id, educational_content_id, member_name, course_title)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [credentialId, member.id, courseId, member.full_name, course.title]
        );
        certificate = certRes.rows[0];
      }
    }

    client.release();
    return NextResponse.json({ success: true, certificate, pct, done, total });
  } catch (err) {
    client.release();
    console.error('complete-course error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
