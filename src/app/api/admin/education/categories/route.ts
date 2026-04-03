import { NextRequest, NextResponse } from 'next/server';
import { getAuthTokenPayload } from '@/lib/auth';
import { getCategoriesAll, createCategory } from '@/lib/education/db';

export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const categories = await getCategoriesAll();
    return NextResponse.json(categories);
  } catch (err) {
    console.error('GET /admin/education/categories error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    if (!body.name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const category = await createCategory({
      name: body.name,
      description: body.description ?? null,
      image_url: body.image_url ?? null,
      pass_threshold: body.pass_threshold ?? 70,
      display_order: body.display_order ?? 0,
    });
    return NextResponse.json(category, { status: 201 });
  } catch (err) {
    console.error('POST /admin/education/categories error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
