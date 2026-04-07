import { NextRequest, NextResponse } from 'next/server';
import { getAuthTokenPayload } from '@/lib/auth';
import { updateAssessment, deleteAssessment } from '@/lib/education/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const assessmentId = parseInt(id, 10);
  if (isNaN(assessmentId)) {
    return NextResponse.json({ error: 'Invalid assessment ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const updated = await updateAssessment(assessmentId, body);
    if (!updated) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error('PUT /admin/education/assessments/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const assessmentId = parseInt(id, 10);
  if (isNaN(assessmentId)) {
    return NextResponse.json({ error: 'Invalid assessment ID' }, { status: 400 });
  }

  try {
    const deleted = await deleteAssessment(assessmentId);
    if (!deleted) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /admin/education/assessments/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
