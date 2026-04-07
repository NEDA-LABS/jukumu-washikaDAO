import { NextRequest, NextResponse } from 'next/server';
import { getAuthTokenPayload } from '@/lib/auth';
import { getCertificateByCredentialId } from '@/lib/education/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = getAuthTokenPayload(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const certificate = await getCertificateByCredentialId(id);
    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
    }

    return NextResponse.json({ certificate });
  } catch (error) {
    console.error('Education certificate detail GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
