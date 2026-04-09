import { NextRequest, NextResponse } from 'next/server';
import { getAuthTokenPayload } from '@/lib/auth';
import pool from '@/lib/db';
import { getRecommendationsForMember, dismissRecommendation } from '@/lib/education/db';

export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dismissId = searchParams.get('dismiss');

  try {
    const memberRes = await pool.query(
      'SELECT id FROM members WHERE user_id = $1 LIMIT 1',
      [auth.userId],
    );
    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Member profile not found' }, { status: 404 });
    }
    const memberId = memberRes.rows[0].id as number;

    // Handle dismiss action
    if (dismissId) {
      const dismissed = await dismissRecommendation(Number(dismissId), memberId);
      if (!dismissed) {
        return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, dismissed: true });
    }

    const recommendations = await getRecommendationsForMember(memberId);

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error('Education recommendations GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
