import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ensureHarambeeSchema } from '@/lib/harambee';

export const runtime = 'nodejs';

/**
 * GET /api/public/harambee/<code>/cover — the collection's photo, as bytes.
 *
 * The image is stored as a data URL, which is right for rendering inside our
 * own pages and useless for a link preview: WhatsApp, Facebook and Twitter
 * fetch og:image over HTTP and will not parse a base64 blob inlined in a meta
 * tag. So the same bytes are served from a real URL that a crawler can GET.
 *
 * Cached hard. A cover does not change often, and a preview that takes two
 * seconds to resolve is a preview nobody sees — the chat app has usually
 * finished rendering the message by then.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  await ensureHarambeeSchema();

  try {
    const res = await pool.query(
      `SELECT cover_image FROM harambees WHERE code = $1 LIMIT 1`,
      [code]
    );
    const raw = (res.rows[0] as { cover_image: string | null } | undefined)?.cover_image;
    if (!raw) return NextResponse.json({ error: 'No cover' }, { status: 404 });

    const m = /^data:([a-z0-9/+.-]+);base64,(.+)$/i.exec(raw.trim());
    if (!m) return NextResponse.json({ error: 'No cover' }, { status: 404 });

    const mime = m[1].toLowerCase();
    // Only image types are ever served back, whatever ended up in the column.
    // The value is written by our own form, but a stored string that decides
    // its own Content-Type is the shape of a stored-XSS bug, so it is pinned.
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime)) {
      return NextResponse.json({ error: 'No cover' }, { status: 404 });
    }

    const bytes = Buffer.from(m[2], 'base64');
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': mime,
        'Content-Length': String(bytes.length),
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[harambee/cover]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
